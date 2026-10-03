-- Médias des œuvres : vidéos et audios de l'artiste.
-- audience = 'public'  → visible sur la fiche (« Rencontre avec l'artiste »)
-- audience = 'owner'   → réservé au propriétaire, délivré seulement contre son code d'accès

create table public.artwork_media (
  id uuid primary key default gen_random_uuid(),
  artwork_id text not null references public.artworks(id) on delete cascade,
  kind text not null check (kind in ('video', 'audio')),
  audience text not null default 'public' check (audience in ('public', 'owner')),
  title text not null,
  url text not null,             -- YouTube / Vimeo, ou fichier téléversé
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index artwork_media_artwork on public.artwork_media(artwork_id, position);

-- Code d'accès propriétaire (un par œuvre). Lisible par les seuls admins.
create table public.owner_codes (
  artwork_id text primary key references public.artworks(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now()
);

alter table public.artwork_media enable row level security;
alter table public.owner_codes enable row level security;

create policy "médias publics des fiches publiées" on public.artwork_media for select
  using (audience = 'public' and exists (select 1 from public.artworks a where a.id = artwork_id and a.published));
create policy "admin écrit" on public.artwork_media for all using (public.is_admin()) with check (public.is_admin());
create policy "admin seul" on public.owner_codes for all using (public.is_admin()) with check (public.is_admin());

-- Génère (ou remplace) le code d'accès : 12 caractères sans ambiguïté (pas de 0/O, 1/I/L)
create or replace function public.new_owner_code(p_artwork_id text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := gen_random_bytes(12);
  result text := '';
begin
  if not public.is_admin() then raise exception 'réservé aux administrateurs'; end if;
  for i in 0..11 loop
    result := result || substr(alphabet, 1 + (get_byte(bytes, i) % length(alphabet)), 1);
  end loop;
  insert into public.owner_codes(artwork_id, code) values (p_artwork_id, result)
    on conflict (artwork_id) do update set code = excluded.code, created_at = now();
  return result;
end $$;

-- Contenus du propriétaire : rien sans le bon code
create or replace function public.owner_media(p_artwork_id text, p_code text)
returns setof public.artwork_media language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.owner_codes
    where artwork_id = p_artwork_id and code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
  ) then
    raise exception 'code invalide' using errcode = '28000';
  end if;
  return query select * from public.artwork_media
    where artwork_id = p_artwork_id and audience = 'owner' order by position, created_at;
end $$;
grant execute on function public.owner_media(text, text) to anon, authenticated;

-- Fichiers réservés : bucket public SANS droit de lister. Les adresses (dossier aléatoire)
-- ne sont connues que via owner_media(), comme un lien YouTube « non répertorié ».
insert into storage.buckets (id, name, public) values ('owner-media', 'owner-media', true)
  on conflict (id) do nothing;
create policy "admin téléverse (propriétaire)" on storage.objects for insert with check (bucket_id = 'owner-media' and public.is_admin());
create policy "admin supprime (propriétaire)" on storage.objects for delete using (bucket_id = 'owner-media' and public.is_admin());
