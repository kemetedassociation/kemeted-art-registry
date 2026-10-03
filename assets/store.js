// Couche de données : Supabase en production, navigateur (localStorage) en mode démo.
// Les pages n'appellent que ces fonctions, jamais Supabase directement.
import { config, DEMO } from "./config.js";
import { demoSeed } from "./demo-data.js";
import { certificateHash } from "../supabase/functions/_shared/certificate.js";

let sb = null;
if (!DEMO) {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  sb = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
}
export { DEMO };

// ── Mode démo ───────────────────────────────────────────────────────────────
const KEY = "kemeted-registry-demo-v1";
const load = () => {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.artworks) return s; } catch {}
  return demoSeed();
};
let demo = DEMO ? load() : null;
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(demo)); } catch {} };
export const resetDemo = () => { demo = demoSeed(); persist(); };
const uid = () => Math.random().toString(36).slice(2, 10);
const artistOf = (a) => demo.artists.find((x) => x.id === a.artist_id) ?? null;
const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

// ── Lecture publique ────────────────────────────────────────────────────────
export async function listArtworks({ all = false } = {}) {
  if (DEMO) {
    return demo.artworks.filter((a) => all || a.published).map((a) => ({ ...a, artists: artistOf(a) }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  let q = sb.from("artworks").select("*, artists(*)").order("id");
  if (!all) q = q.eq("published", true);
  return check(await q);
}

export async function getArtwork(id) {
  if (DEMO) {
    const a = demo.artworks.find((x) => x.id === id);
    if (!a) return null;
    const exIds = demo.artwork_exhibitions.filter((x) => x.artwork_id === id).map((x) => x.exhibition_id);
    return {
      ...a,
      artists: artistOf(a),
      exhibitions: demo.exhibitions.filter((e) => exIds.includes(e.id)),
      provenance: demo.ownerships.filter((o) => o.artwork_id === id)
        .map((o) => ({ owner_display: o.show_name ? o.owner_name : "Propriétaire privé", acquired_on: o.acquired_on, current: o.current })),
    };
  }
  const a = check(await sb.from("artworks").select("*, artists(*), artwork_exhibitions(exhibitions(*))").eq("id", id).maybeSingle());
  if (!a) return null;
  const provenance = check(await sb.from("provenance_public").select("*").eq("artwork_id", id).order("acquired_on"));
  return { ...a, exhibitions: a.artwork_exhibitions.map((x) => x.exhibitions), provenance };
}

export const artworksByArtist = async (artistId) =>
  (await listArtworks()).filter((a) => a.artist_id === artistId);

/** Vérifie un scan. Retourne { status: authentique | qr | rejoue | invalide | puce_inconnue | autre_oeuvre | revoquee } */
export async function verifyScan(id, p, m) {
  if (!DEMO) {
    const r = await fetch(`${config.SUPABASE_URL}/functions/v1/verify-scan`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: config.SUPABASE_ANON_KEY },
      body: JSON.stringify({ id, p, m }),
    });
    return r.json();
  }
  // Démo : vraie vérification cryptographique SUN dans le navigateur, avec les clés d'usine (zéro)
  const logScan = (result, extra = {}) => { demo.scans.unshift({ id: uid(), artwork_id: id, result, created_at: new Date().toISOString(), ...extra }); persist(); };
  if (!p || !m) { logScan("qr"); return { status: "qr" }; }
  const [{ ecb }, { createSun }] = await Promise.all([
    import("https://cdn.jsdelivr.net/npm/@noble/ciphers@1.3.0/aes.js/+esm"),
    import("../supabase/functions/_shared/sun.js"),
  ]);
  const zero = "0".repeat(32);
  const r = createSun(ecb).verify({ p, m, metaKey: zero, fileKey: zero });
  if (!r.valid) { logScan("invalide"); return { status: "invalide" }; }
  const tag = demo.nfc_tags.find((t) => t.uid === r.uid);
  const extra = { tag_uid: r.uid, counter: r.counter };
  if (!tag) { logScan("puce_inconnue", extra); return { status: "puce_inconnue" }; }
  if (tag.artwork_id !== id) { logScan("autre_oeuvre", extra); return { status: "autre_oeuvre", registered_artwork_id: tag.artwork_id }; }
  if (tag.revoked) { logScan("revoquee", extra); return { status: "revoquee" }; }
  if (r.counter <= tag.last_counter) { logScan("rejoue", extra); return { status: "rejoue" }; }
  tag.last_counter = r.counter;
  logScan("authentique", extra);
  return { status: "authentique", counter: r.counter };
}

// ── Authentification admin ──────────────────────────────────────────────────
export async function currentAdmin() {
  if (DEMO) return { email: "demo@kemeted.org" };
  const { data } = await sb.auth.getSession();
  if (!data.session) return null;
  const { data: ok } = await sb.rpc("is_admin");
  return ok ? data.session.user : false;
}
export async function signIn(email, password) {
  if (DEMO) return;
  check(await sb.auth.signInWithPassword({ email, password }));
}
export async function signOut() { if (!DEMO) await sb.auth.signOut(); }

// ── Écriture (admin) ────────────────────────────────────────────────────────
export async function listArtists() {
  if (DEMO) return [...demo.artists].sort((a, b) => a.name.localeCompare(b.name));
  return check(await sb.from("artists").select("*").order("name"));
}
export async function saveArtist(artist) {
  if (DEMO) {
    if (artist.id) Object.assign(demo.artists.find((a) => a.id === artist.id), artist);
    else demo.artists.push({ ...artist, id: uid() });
    return persist();
  }
  const { id, ...fields } = artist;
  check(id ? await sb.from("artists").update(fields).eq("id", id) : await sb.from("artists").insert(fields));
}

const IDENTITY = ["title", "artist_id", "year", "technique", "dimensions"];
export async function saveArtwork(artwork) {
  if (DEMO) {
    const existing = artwork.id && demo.artworks.find((a) => a.id === artwork.id);
    if (existing) {
      if (existing.nft_token_id && IDENTITY.some((k) => String(existing[k] ?? "") !== String(artwork[k] ?? ""))) {
        throw new Error("Identité verrouillée : le NFT est déjà créé (titre, artiste, année, technique, dimensions).");
      }
      Object.assign(existing, artwork);
    } else {
      demo.seq += 1;
      demo.artworks.push({ detail_images: [], certificate_hash: null, nft_token_id: null, status: "enregistree", ...artwork,
        id: "KEM-CUL-" + String(demo.seq).padStart(4, "0") });
    }
    return persist();
  }
  const { id, artists, exhibitions, provenance, artwork_exhibitions, ...fields } = artwork;
  return check(id ? await sb.from("artworks").update(fields).eq("id", id) : await sb.from("artworks").insert(fields).select("id").single());
}

export async function listExhibitions() {
  if (DEMO) return [...demo.exhibitions].sort((a, b) => (b.starts_on ?? "").localeCompare(a.starts_on ?? ""));
  return check(await sb.from("exhibitions").select("*").order("starts_on", { ascending: false }));
}
export async function saveExhibition(ex) {
  if (DEMO) {
    if (ex.id) Object.assign(demo.exhibitions.find((e) => e.id === ex.id), ex);
    else demo.exhibitions.push({ ...ex, id: uid() });
    return persist();
  }
  const { id, ...fields } = ex;
  check(id ? await sb.from("exhibitions").update(fields).eq("id", id) : await sb.from("exhibitions").insert(fields));
}
export async function setArtworkExhibitions(artworkId, exhibitionIds) {
  if (DEMO) {
    demo.artwork_exhibitions = demo.artwork_exhibitions.filter((x) => x.artwork_id !== artworkId)
      .concat(exhibitionIds.map((exhibition_id) => ({ artwork_id: artworkId, exhibition_id })));
    return persist();
  }
  check(await sb.from("artwork_exhibitions").delete().eq("artwork_id", artworkId));
  if (exhibitionIds.length) check(await sb.from("artwork_exhibitions").insert(exhibitionIds.map((exhibition_id) => ({ artwork_id: artworkId, exhibition_id }))));
}

export async function listOwnerships(artworkId) {
  if (DEMO) return demo.ownerships.filter((o) => o.artwork_id === artworkId).sort((a, b) => b.acquired_on.localeCompare(a.acquired_on));
  return check(await sb.from("ownerships").select("*").eq("artwork_id", artworkId).order("acquired_on", { ascending: false }));
}
export async function transferOwnership(artworkId, o) {
  if (DEMO) {
    demo.ownerships.forEach((x) => { if (x.artwork_id === artworkId) x.current = false; });
    demo.ownerships.push({ ...o, id: uid(), artwork_id: artworkId, current: true });
    demo.artworks.find((a) => a.id === artworkId).status = "vendue";
    return persist();
  }
  check(await sb.rpc("transfer_ownership", {
    p_artwork_id: artworkId, p_owner_name: o.owner_name, p_owner_email: o.owner_email || null, p_owner_wallet: o.owner_wallet || null,
    p_show_name: !!o.show_name, p_acquired_on: o.acquired_on || null, p_price_eur: o.price_eur || null, p_note: o.note || null,
  }));
}

export async function listTags() {
  if (DEMO) return demo.nfc_tags;
  return check(await sb.from("nfc_tags").select("*"));
}
export async function linkTag(uidHex, artworkId) {
  const tagUid = uidHex.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (tagUid.length !== 14) throw new Error("L'UID d'une NTAG 424 DNA fait 7 octets (14 caractères hex).");
  if (DEMO) {
    if (demo.nfc_tags.some((t) => t.uid === tagUid && t.artwork_id !== artworkId)) throw new Error("Cette puce est déjà liée à une autre œuvre.");
    demo.nfc_tags = demo.nfc_tags.filter((t) => t.artwork_id !== artworkId);
    demo.nfc_tags.push({ uid: tagUid, artwork_id: artworkId, last_counter: -1, revoked: false });
    return persist();
  }
  check(await sb.from("nfc_tags").delete().eq("artwork_id", artworkId));
  check(await sb.from("nfc_tags").insert({ uid: tagUid, artwork_id: artworkId }));
}
export async function revokeTag(tagUid) {
  if (DEMO) { demo.nfc_tags.find((t) => t.uid === tagUid).revoked = true; return persist(); }
  check(await sb.from("nfc_tags").update({ revoked: true }).eq("uid", tagUid));
}

export async function listScans(limit = 100) {
  if (DEMO) return demo.scans.slice(0, limit);
  return check(await sb.from("scans").select("*").order("created_at", { ascending: false }).limit(limit));
}

export async function uploadImage(file, artworkId) {
  if (DEMO) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  const path = `${artworkId || "nouvelle"}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  check(await sb.storage.from("artworks").upload(path, file, { upsert: false }));
  return sb.storage.from("artworks").getPublicUrl(path).data.publicUrl;
}

// ── NFT ─────────────────────────────────────────────────────────────────────
export async function mintNft(artworkId) {
  if (DEMO) {
    const a = demo.artworks.find((x) => x.id === artworkId);
    if (a.nft_token_id) throw new Error("NFT déjà créé");
    a.certificate_issued_at ||= new Date().toISOString().slice(0, 10);
    a.certificate_hash = await certificateHash({ ...a, artist_name: artistOf(a).name });
    a.nft_chain = "démo";
    a.nft_token_id = String(demo.artworks.filter((x) => x.nft_token_id).length + 1);
    a.nft_minted_at = new Date().toISOString();
    persist();
    return { token_id: a.nft_token_id, certificate_hash: a.certificate_hash };
  }
  const { data, error } = await sb.functions.invoke("nft", { body: { action: "mint", artwork_id: artworkId } });
  if (error) throw new Error((await error.context?.json?.())?.error ?? error.message);
  return data;
}
export async function transferNft(artworkId, to) {
  if (DEMO) throw new Error("Transfert on-chain indisponible en mode démo.");
  const { data, error } = await sb.functions.invoke("nft", { body: { action: "transfer", artwork_id: artworkId, to } });
  if (error) throw new Error((await error.context?.json?.())?.error ?? error.message);
  return data;
}

// ── Médias (vidéos, audios) et espace propriétaire ─────────────────────────
// audience "public" : fiche publique · audience "owner" : réservé, délivré contre le code d'accès
const ensureDemoMedia = () => { demo.media ??= []; demo.owner_codes ??= {}; };

export async function listMedia(artworkId, { audience } = {}) {
  if (DEMO) {
    ensureDemoMedia();
    return demo.media.filter((x) => x.artwork_id === artworkId && (!audience || x.audience === audience))
      .sort((a, b) => a.position - b.position);
  }
  let q = sb.from("artwork_media").select("*").eq("artwork_id", artworkId).order("position").order("created_at");
  if (audience) q = q.eq("audience", audience);
  return check(await q);
}
export async function addMedia(m) {
  if (DEMO) { ensureDemoMedia(); demo.media.push({ ...m, id: uid(), position: m.position ?? demo.media.length }); return persist(); }
  check(await sb.from("artwork_media").insert(m));
}
export async function deleteMedia(id) {
  if (DEMO) { ensureDemoMedia(); demo.media = demo.media.filter((x) => x.id !== id); return persist(); }
  check(await sb.from("artwork_media").delete().eq("id", id));
}
/** Téléverse un fichier audio/vidéo. Les fichiers réservés vont dans un dossier aléatoire non listable. */
export async function uploadMedia(file, artworkId, audience) {
  if (file.size > 50 * 1024 * 1024) throw new Error("Fichier de plus de 50 Mo : publiez la vidéo sur YouTube (non répertoriée) ou Vimeo et collez le lien.");
  if (DEMO) return uploadImage(file, artworkId);
  const bucket = audience === "owner" ? "owner-media" : "artworks";
  const folder = audience === "owner" ? crypto.randomUUID() : `${artworkId}/media`;
  const path = `${folder}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  check(await sb.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || undefined }));
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function getOwnerCode(artworkId) {
  if (DEMO) { ensureDemoMedia(); return demo.owner_codes[artworkId] ?? null; }
  return check(await sb.from("owner_codes").select("code, created_at").eq("artwork_id", artworkId).maybeSingle())?.code ?? null;
}
export async function newOwnerCode(artworkId) {
  if (DEMO) {
    ensureDemoMedia();
    const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    demo.owner_codes[artworkId] = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => abc[b % abc.length]).join("");
    persist();
    return demo.owner_codes[artworkId];
  }
  return check(await sb.rpc("new_owner_code", { p_artwork_id: artworkId }));
}
/** Contenus du propriétaire. Lève une erreur si le code est faux. */
export async function ownerMedia(artworkId, code) {
  if (DEMO) {
    ensureDemoMedia();
    const clean = String(code || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!clean || demo.owner_codes[artworkId] !== clean) throw new Error("code invalide");
    return listMedia(artworkId, { audience: "owner" });
  }
  const { data, error } = await sb.rpc("owner_media", { p_artwork_id: artworkId, p_code: code });
  if (error) throw new Error(error.message);
  return data;
}
