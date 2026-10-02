-- KEMETED Art Registry — schéma initial
-- Public : fiches publiées, artistes, expositions, historique de propriété masqué.
-- Privé (admins) : identités des propriétaires, puces NFC, journal des scans.

create extension if not exists pgcrypto;

-- ── Administrateurs ─────────────────────────────────────────────────────────
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create policy "admins voient la liste des admins" on public.admins for select using (public.is_admin());

-- ── Artistes ────────────────────────────────────────────────────────────────
create table public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  bio text,
  photo_url text,
  website text,
  instagram text,
  created_at timestamptz not null default now()
);

-- ── Œuvres ──────────────────────────────────────────────────────────────────
create sequence public.artwork_seq start 1;

create type public.artwork_status as enum ('enregistree', 'exposee', 'a_vendre', 'vendue', 'archivee');

create table public.artworks (
  id text primary key default ('KEM-CUL-' || lpad(nextval('public.artwork_seq')::text, 4, '0')),
  artist_id uuid not null references public.artists(id),
  title text not null,
  year int,
  technique text,
  dimensions text,
  description text,              -- l'histoire de l'œuvre
  image_url text,
  detail_images text[] not null default '{}', -- photos de détail (signature, dos, texture) pour comparer
  status public.artwork_status not null default 'enregistree',
  price_eur numeric(12,2),
  show_price boolean not null default false,
  published boolean not null default false,
  certificate_issued_at timestamptz,
  certificate_hash text,         -- SHA-256 du certificat canonique, gravé dans le NFT
  nft_chain text,
  nft_contract text,
  nft_token_id text,
  nft_tx text,
  nft_minted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Une fois le NFT créé, l'identité gravée on-chain ne peut plus changer côté base
create or replace function public.lock_minted_identity() returns trigger language plpgsql as $$
begin
  if old.nft_token_id is not null and (
       new.title is distinct from old.title or new.artist_id is distinct from old.artist_id
    or new.year is distinct from old.year or new.technique is distinct from old.technique
    or new.dimensions is distinct from old.dimensions or new.certificate_hash is distinct from old.certificate_hash
    or new.nft_token_id is distinct from old.nft_token_id) then
    raise exception 'Identité de l''œuvre % verrouillée : NFT déjà créé', old.id;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger artworks_lock before update on public.artworks
  for each row execute function public.lock_minted_identity();

-- ── Expositions ─────────────────────────────────────────────────────────────
create table public.exhibitions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  venue text,
  city text,
  starts_on date,
  ends_on date
);

create table public.artwork_exhibitions (
  artwork_id text references public.artworks(id) on delete cascade,
  exhibition_id uuid references public.exhibitions(id) on delete cascade,
  primary key (artwork_id, exhibition_id)
);

-- ── Propriété (privée) ──────────────────────────────────────────────────────
create table public.ownerships (
  id uuid primary key default gen_random_uuid(),
  artwork_id text not null references public.artworks(id) on delete cascade,
  owner_name text not null,
  owner_email text,
  owner_wallet text,             -- portefeuille où transférer le NFT, si le propriétaire en veut un
  show_name boolean not null default false, -- consentement écrit à afficher le nom
  acquired_on date not null default current_date,
  price_eur numeric(12,2),
  note text,
  current boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index ownerships_one_current on public.ownerships(artwork_id) where current;

-- Transfert atomique : clôt le propriétaire courant, ouvre le nouveau, passe l'œuvre en « vendue »
create or replace function public.transfer_ownership(
  p_artwork_id text, p_owner_name text, p_owner_email text, p_owner_wallet text,
  p_show_name boolean, p_acquired_on date, p_price_eur numeric, p_note text
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_admin() then raise exception 'réservé aux administrateurs'; end if;
  update public.ownerships set current = false where artwork_id = p_artwork_id and current;
  insert into public.ownerships(artwork_id, owner_name, owner_email, owner_wallet, show_name, acquired_on, price_eur, note)
    values (p_artwork_id, p_owner_name, p_owner_email, nullif(p_owner_wallet, ''), coalesce(p_show_name, false),
            coalesce(p_acquired_on, current_date), p_price_eur, p_note)
    returning id into new_id;
  update public.artworks set status = 'vendue' where id = p_artwork_id;
  return new_id;
end $$;

-- Historique public : nom masqué sauf consentement
create view public.provenance_public as
  select o.artwork_id,
         case when o.show_name then o.owner_name else 'Propriétaire privé' end as owner_display,
         o.acquired_on, o.current
  from public.ownerships o
  join public.artworks a on a.id = o.artwork_id and a.published;

-- ── Puces NFC et scans (privés) ─────────────────────────────────────────────
create table public.nfc_tags (
  uid text primary key,          -- UID 7 octets en hex majuscule, ex. 04DE5F1EACC040
  artwork_id text not null unique references public.artworks(id) on delete cascade,
  last_counter int not null default -1,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.scans (
  id bigint generated always as identity primary key,
  artwork_id text,
  tag_uid text,
  counter int,
  result text not null,          -- authentique | qr | rejoue | invalide | puce_inconnue | autre_oeuvre | revoquee
  user_agent text,
  created_at timestamptz not null default now()
);
create index scans_artwork on public.scans(artwork_id, created_at desc);

-- Avance le compteur seulement s'il augmente : un lien rejoué échoue ici
create or replace function public.consume_tag_counter(p_uid text, p_counter int)
returns boolean language sql security definer set search_path = public as $$
  with u as (
    update public.nfc_tags set last_counter = p_counter
    where uid = p_uid and last_counter < p_counter and not revoked
    returning 1)
  select exists (select 1 from u);
$$;
revoke execute on function public.consume_tag_counter(text, int) from public, anon, authenticated;

-- ── Sécurité (RLS) ──────────────────────────────────────────────────────────
alter table public.artists enable row level security;
alter table public.artworks enable row level security;
alter table public.exhibitions enable row level security;
alter table public.artwork_exhibitions enable row level security;
alter table public.ownerships enable row level security;
alter table public.nfc_tags enable row level security;
alter table public.scans enable row level security;

create policy "lecture publique" on public.artists for select using (true);
create policy "lecture publique" on public.exhibitions for select using (true);
create policy "lecture publique" on public.artwork_exhibitions for select using (true);
create policy "fiches publiées" on public.artworks for select using (published or public.is_admin());

create policy "admin écrit" on public.artists for all using (public.is_admin()) with check (public.is_admin());
create policy "admin écrit" on public.artworks for all using (public.is_admin()) with check (public.is_admin());
create policy "admin écrit" on public.exhibitions for all using (public.is_admin()) with check (public.is_admin());
create policy "admin écrit" on public.artwork_exhibitions for all using (public.is_admin()) with check (public.is_admin());
create policy "admin seul" on public.ownerships for all using (public.is_admin()) with check (public.is_admin());
create policy "admin seul" on public.nfc_tags for all using (public.is_admin()) with check (public.is_admin());
create policy "admin lit" on public.scans for select using (public.is_admin());

grant select on public.provenance_public to anon, authenticated;

-- ── Stockage des photos ─────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('artworks', 'artworks', true)
  on conflict (id) do nothing;
create policy "photos publiques" on storage.objects for select using (bucket_id = 'artworks');
create policy "admin téléverse" on storage.objects for insert with check (bucket_id = 'artworks' and public.is_admin());
create policy "admin modifie" on storage.objects for update using (bucket_id = 'artworks' and public.is_admin());
create policy "admin supprime" on storage.objects for delete using (bucket_id = 'artworks' and public.is_admin());
