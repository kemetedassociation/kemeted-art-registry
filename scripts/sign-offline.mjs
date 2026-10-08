// Signe le certificat d'une ou plusieurs œuvres avec la clé KEMETED (ECDSA P-256).
// La signature est vérifiable sur le téléphone du visiteur, même sans connexion.
//
//   SUPABASE_ACCESS_TOKEN=sbp_… npm run sign -- KEM-CUL-0001 [KEM-CUL-0002 …]
import { canonicalCertificate } from "../supabase/functions/_shared/certificate.js";
import { config } from "../assets/config.js";

const ids = process.argv.slice(2);
const { OFFLINE_SIGNING_KEY_JWK, SUPABASE_ACCESS_TOKEN } = process.env;
if (!ids.length || !OFFLINE_SIGNING_KEY_JWK || !SUPABASE_ACCESS_TOKEN) {
  console.error("Usage : SUPABASE_ACCESS_TOKEN=sbp_… npm run sign -- KEM-CUL-0001 …");
  process.exit(1);
}
const ref = new URL(config.SUPABASE_URL).hostname.split(".")[0];
const key = await crypto.subtle.importKey("jwk", JSON.parse(OFFLINE_SIGNING_KEY_JWK), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
const b64url = (buf) => Buffer.from(buf).toString("base64url");

for (const id of ids) {
  const r = await fetch(`${config.SUPABASE_URL}/rest/v1/artworks?id=eq.${encodeURIComponent(id)}&select=id,title,year,technique,dimensions,certificate_issued_at,artists(name)`,
    { headers: { apikey: config.SUPABASE_ANON_KEY } });
  const [a] = await r.json();
  if (!a?.certificate_issued_at) { console.error(`${id} : introuvable ou certificat non délivré`); continue; }
  const message = canonicalCertificate({ ...a, artist_name: a.artists.name });
  const sig = b64url(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(message)));
  const q = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: `update public.artworks set offline_signature = '${sig}' where id = '${id.replace(/'/g, "")}'` }),
  });
  console.log(`${id} : ${q.ok ? "signé" : "échec " + q.status}`);
}
