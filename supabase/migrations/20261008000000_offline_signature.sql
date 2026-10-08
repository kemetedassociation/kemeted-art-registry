-- Signature numérique KEMETED du certificat (ECDSA P-256, base64url),
-- vérifiable sur le téléphone sans connexion grâce à la clé publique intégrée au site.
alter table public.artworks add column if not exists offline_signature text;
notify pgrst, 'reload schema';
