// Mode hors ligne : signature KEMETED vérifiée sur le téléphone, mémoire de la fiche, retour de connexion.
import { config } from "./config.js";
import { canonicalCertificate } from "../supabase/functions/_shared/certificate.js";

// La page était-elle déjà servie par le service worker au début du chargement ?
// Sinon (1re visite), les données chargées avant son activation ne sont pas en mémoire : il faudra les recharger.
const controlledAtStart = "serviceWorker" in navigator && !!navigator.serviceWorker.controller;

/** Enregistre le service worker (la fiche reste disponible sans internet). */
export function registerOffline(prefix = "../") {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register(`${prefix}sw.js`, { scope: prefix }).catch(() => null);
}

/**
 * Garde sur le téléphone tout ce qu'il faut pour rouvrir la fiche sans internet, dès la première visite :
 * - les fichiers entiers (photo, audio…) et les bibliothèques/polices déjà chargées par la page ;
 * - les données de l'œuvre : `refetch()` les recharge une fois le service worker actif, pour qu'il les garde.
 */
export async function keepOffline(urls, refetch) {
  if (!("serviceWorker" in navigator) || !navigator.onLine) return;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg?.active) return;
  const loaded = performance.getEntriesByType("resource").map((e) => e.name);
  const shellUrls = loaded.filter((u) => /^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(u));
  const media = [...urls.filter(Boolean), ...loaded.filter((u) => u.includes("/storage/v1/object/public/") && !/\.(mp4|mov|webm)(\?|$)/i.test(u))];
  reg.active.postMessage({ type: "warm", urls: [...new Set(media)], shellUrls: [...new Set(shellUrls)] });
  if (refetch && !controlledAtStart) {
    // 1re visite : on recharge les données à travers le service worker pour qu'il les garde
    if (!navigator.serviceWorker.controller) {
      await new Promise((res) => { navigator.serviceWorker.addEventListener("controllerchange", res, { once: true }); setTimeout(res, 10000); });
    }
    if (navigator.serviceWorker.controller) await refetch().catch(() => {});
  }
}

const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/**
 * Vérifie la signature numérique KEMETED du certificat, sans réseau (clé publique intégrée au site).
 * @returns {Promise<boolean|null>} true = signé par KEMETED, false = signature invalide, null = pas de signature
 */
export async function verifyKemetedSignature(a) {
  if (!a.offline_signature || !config.OFFLINE_PUBLIC_KEY) return null;
  try {
    const key = await crypto.subtle.importKey("jwk", config.OFFLINE_PUBLIC_KEY, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const msg = new TextEncoder().encode(canonicalCertificate({ ...a, artist_name: a.artists?.name }));
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, fromB64url(a.offline_signature), msg);
  } catch { return false; }
}

/** Petit bandeau « Hors connexion » qui apparaît et disparaît avec le réseau. */
export function connectionBanner() {
  const bar = document.createElement("div");
  bar.className = "offline-bar";
  bar.setAttribute("role", "status");
  bar.textContent = "Hors connexion · fiche enregistrée sur ce téléphone";
  document.body.prepend(bar);
  const sync = () => bar.classList.toggle("on", !navigator.onLine);
  addEventListener("online", sync);
  addEventListener("offline", sync);
  sync();
}
