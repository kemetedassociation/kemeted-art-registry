-- Image d'aperçu des vidéos téléversées (affichée avant la lecture)
alter table public.artwork_media add column if not exists poster_url text;
notify pgrst, 'reload schema';
