// Service worker du registre KEMETED : la fiche d'une œuvre reste consultable sans internet
// sur un téléphone qui l'a déjà ouverte une fois avec connexion (photo, textes, certificat, audio d'intro).
const VERSION = "v1";
const SHELL = `kar-shell-${VERSION}`, DATA = `kar-data-${VERSION}`, MEDIA = `kar-media-${VERSION}`;
const SHELL_FILES = [
  "./", "index.html", "a/", "a/index.html", "proprietaire/", "proprietaire/index.html",
  "assets/style.css", "assets/ui.js", "assets/store.js", "assets/config.js", "assets/demo-data.js",
  "assets/voice.js", "assets/splash.js", "assets/offline.js", "assets/logo.png", "assets/adagp-logo.svg",
  "supabase/functions/_shared/certificate.js", "supabase/functions/_shared/sun.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

// Réseau d'abord (contenu toujours à jour), mémoire du téléphone si pas de connexion
async function networkFirst(req, cacheName, { ignoreSearch = false } = {}) {
  const cache = await caches.open(cacheName);
  try {
    const res = await withTimeout(fetch(req), 6000);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch, ignoreVary: true })
      || (ignoreSearch && await caches.match(req, { ignoreSearch: true, ignoreVary: true }));
    if (hit) return hit;
    throw new Error("hors ligne et absent de la mémoire");
  }
}

// Mémoire d'abord (fichiers qui ne changent pas : bibliothèques, polices, photos, audio)
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) cache.put(req, res.clone());
  return res;
}

// Lecture audio/vidéo hors ligne : le lecteur demande des morceaux (« Range ») du fichier gardé en entier
async function rangeFromCache(req) {
  const hit = await caches.match(req.url, { ignoreVary: true });
  if (!hit) return fetch(req);
  const buf = await hit.arrayBuffer();
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get("range") || "");
  const start = m ? Number(m[1]) : 0;
  const end = m && m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": hit.headers.get("Content-Type") || "application/octet-stream",
      "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // vérifications, codes : toujours en direct
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const isPage = req.mode === "navigate";
    e.respondWith(networkFirst(req, SHELL, { ignoreSearch: isPage }));
  } else if (url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/storage/v1/object/public/")) {
    e.respondWith(req.headers.has("range") ? rangeFromCache(req) : cacheFirst(req, MEDIA));
  } else if (url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/rest/v1/")) {
    e.respondWith(networkFirst(req, DATA));
  } else if (["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname)) {
    e.respondWith(cacheFirst(req, SHELL));
  }
});

// La page demande de garder des fichiers entiers (photo, audio d'intro…) pour le mode hors ligne
const keep = (cacheName, urls) => caches.open(cacheName).then((cache) => Promise.all((urls || []).map(async (u) => {
  if (await cache.match(u, { ignoreVary: true })) return;
  try { const res = await fetch(u, { mode: "cors" }); if (res.ok && res.status === 200) await cache.put(u, res); } catch {}
})));
self.addEventListener("message", (e) => {
  if (e.data?.type !== "warm") return;
  e.waitUntil(Promise.all([keep(MEDIA, e.data.urls), keep(SHELL, e.data.shellUrls)]));
});
