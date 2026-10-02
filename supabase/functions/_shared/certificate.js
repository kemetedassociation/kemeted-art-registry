// Certificat canonique d'une œuvre KEMETED.
// Même code dans le navigateur (fiche publique) et dans l'Edge Function `nft` :
// le visiteur peut recalculer l'empreinte et la comparer à celle gravée sur la blockchain.
// Ne JAMAIS changer l'ordre ni le nom des champs : les empreintes déjà gravées ne correspondraient plus.

export const CERTIFICATE_VERSION = 1;

/** @param {{id:string, artist_name:string, title:string, year?:number|null, technique?:string|null, dimensions?:string|null, certificate_issued_at:string}} a */
export function canonicalCertificate(a) {
  const fields = [
    ["registry", "KEMETED Art Registry"],
    ["version", CERTIFICATE_VERSION],
    ["artwork_id", a.id],
    ["artist", a.artist_name],
    ["title", a.title],
    ["year", a.year ?? null],
    ["technique", a.technique ?? null],
    ["dimensions", a.dimensions ?? null],
    ["issued_on", String(a.certificate_issued_at).slice(0, 10)],
  ];
  return "{" + fields.map(([k, v]) => JSON.stringify(k) + ":" + JSON.stringify(v)).join(",") + "}";
}

/** @returns {Promise<string>} empreinte SHA-256 au format 0x… (bytes32) */
export async function certificateHash(a) {
  const data = new TextEncoder().encode(canonicalCertificate(a));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return "0x" + Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}
