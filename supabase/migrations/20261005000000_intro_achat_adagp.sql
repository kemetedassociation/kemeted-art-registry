-- Intro audio synchronisée, audio « achat » protégé par code, ADAGP et signature de l'artiste

alter table public.artists add column if not exists adagp boolean not null default false;
alter table public.artists add column if not exists signature_url text;

-- role : 'intro' (lancé à l'ouverture de la fiche, texte synchronisé) ou 'achat' (réservé, derrière le pavé numérique)
alter table public.artwork_media add column if not exists role text check (role in ('intro', 'achat'));
-- transcript : [{ "t": secondes, "text": "phrase" }, …] pour l'affichage au fil de l'audio
alter table public.artwork_media add column if not exists transcript jsonb;

-- Code choisi par KEMETED (ex. 1756) : 4 à 20 caractères, chiffres ou lettres
create or replace function public.set_owner_code(p_artwork_id text, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if not public.is_admin() then raise exception 'réservé aux administrateurs'; end if;
  if length(clean) < 4 or length(clean) > 20 then raise exception 'le code doit faire 4 à 20 caractères'; end if;
  insert into public.owner_codes(artwork_id, code) values (p_artwork_id, clean)
    on conflict (artwork_id) do update set code = excluded.code, created_at = now();
  delete from public.owner_code_failures where artwork_id = p_artwork_id;
  return clean;
end $$;

-- Anti-essais en série : 10 codes faux par heure et par œuvre, puis blocage jusqu'à l'heure suivante
create table if not exists public.owner_code_failures (
  id bigint generated always as identity primary key,
  artwork_id text not null,
  at timestamptz not null default now()
);
create index if not exists owner_code_failures_recent on public.owner_code_failures(artwork_id, at desc);
alter table public.owner_code_failures enable row level security;
create policy "admin lit" on public.owner_code_failures for select using (public.is_admin());

-- Remplace owner_media : renvoie { ok, media | error } sans lever d'erreur,
-- pour que l'échec soit bien enregistré (une exception annulerait l'enregistrement)
drop function if exists public.owner_media(text, text);
create or replace function public.owner_unlock(p_artwork_id text, p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  fails int;
begin
  select count(*) into fails from public.owner_code_failures
    where artwork_id = p_artwork_id and at > now() - interval '1 hour';
  if fails >= 10 then
    return jsonb_build_object('ok', false, 'error', 'bloque');
  end if;
  if clean = '' or not exists (select 1 from public.owner_codes where artwork_id = p_artwork_id and code = clean) then
    insert into public.owner_code_failures(artwork_id) values (p_artwork_id);
    return jsonb_build_object('ok', false, 'error', 'code', 'remaining', greatest(0, 9 - fails));
  end if;
  return jsonb_build_object('ok', true, 'media', coalesce((
    select jsonb_agg(to_jsonb(m) order by m.position, m.created_at)
    from public.artwork_media m where m.artwork_id = p_artwork_id and m.audience = 'owner'), '[]'::jsonb));
end $$;
grant execute on function public.owner_unlock(text, text) to anon, authenticated;
revoke execute on function public.set_owner_code(text, text) from anon;

notify pgrst, 'reload schema';

-- Titres des contenus réservés (jamais leurs adresses), pour afficher le bouton verrouillé sur la fiche
create or replace function public.owner_media_titles(p_artwork_id text)
returns table(title text, kind text, role text) language sql stable security definer set search_path = public as $$
  select m.title, m.kind, m.role from public.artwork_media m
  join public.artworks a on a.id = m.artwork_id and a.published
  where m.artwork_id = p_artwork_id and m.audience = 'owner' order by m.position, m.created_at;
$$;
grant execute on function public.owner_media_titles(text) to anon, authenticated;
notify pgrst, 'reload schema';
