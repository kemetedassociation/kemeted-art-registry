// Métadonnées ERC-721 lues par les portefeuilles et places de marché.
// tokenURI du contrat = https://<projet>.supabase.co/functions/v1/nft-metadata/<ID KEMETED>
// Public (pas de JWT). Aucune donnée de propriétaire ici.
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = Deno.env.get("PUBLIC_SITE_URL") ?? "https://registry.kemeted.org";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

Deno.serve(async (req) => {
  const id = decodeURIComponent(new URL(req.url).pathname.split("/").pop() ?? "");
  const { data: a } = await db.from("artworks")
    .select("id, title, year, technique, dimensions, description, image_url, certificate_hash, artists(name, country, adagp)")
    .eq("id", id).maybeSingle();
  if (!a) return new Response(JSON.stringify({ error: "introuvable" }), { status: 404 });

  const attributes = [
    { trait_type: "Artiste", value: a.artists?.name },
    { trait_type: "Pays", value: a.artists?.country },
    { trait_type: "Année", value: a.year },
    { trait_type: "Technique", value: a.technique },
    { trait_type: "Dimensions", value: a.dimensions },
    { trait_type: "Identifiant KEMETED", value: a.id },
    { trait_type: "Empreinte du certificat", value: a.certificate_hash },
    a.artists?.adagp && { trait_type: "Droits d'auteur", value: `© ${a.artists.name} / ADAGP, Paris ${a.year ?? ""}`.trim() },
    a.artists?.adagp && { trait_type: "Gestion collective", value: "Artiste membre de l'ADAGP" },
  ].filter((x) => x && x.value != null && x.value !== "");

  return new Response(JSON.stringify({
    name: `${a.title} — ${a.artists?.name ?? ""}`.trim(),
    description: `Jumeau numérique de l'œuvre physique ${a.id}, enregistrée dans le registre KEMETED. ` +
      `Ce jeton ne transfère aucun droit d'auteur.${a.artists?.adagp ? ` © ${a.artists.name} / ADAGP, Paris ${a.year ?? ""}.` : ""} ${a.description ?? ""}`.trim(),
    image: a.image_url,
    external_url: `${SITE}/a/?id=${a.id}`,
    attributes,
  }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } });
});
