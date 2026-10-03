// Petits utilitaires d'interface partagés par les pages.
import { DEMO } from "./config.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const STATUS = {
  enregistree: { label: "Enregistrée", tone: "" },
  exposee: { label: "Exposée", tone: "good" },
  a_vendre: { label: "Disponible", tone: "good" },
  vendue: { label: "Collection privée", tone: "" },
  archivee: { label: "Archivée", tone: "" },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
export const fmtDate = (d) => (d ? dateFmt.format(new Date(String(d).length === 10 ? d + "T12:00:00" : d)) : "");
export const fmtPrice = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** prefix = chemin vers la racine du site depuis la page ("" ou "../") */
export function chrome(prefix, { admin = false } = {}) {
  const banner = DEMO
    ? `<div class="demo-banner">Mode démonstration : œuvres et artistes fictifs, données stockées dans ce navigateur.${admin ? "" : ` <a href="${prefix}a/?id=KEM-CUL-0001&p=EF963FF7828658A599F3041510671E88&m=94EED9EE65337086">Simuler un scan NFC</a>`}</div>`
    : "";
  document.body.insertAdjacentHTML("afterbegin", `${banner}
    <header class="site"><div class="wrap">
      <a class="brand" href="${prefix}"><img class="logo" src="${prefix}assets/logo.png" alt=""><div><b>KEMETED</b><span>Art Registry</span></div></a>
      <nav class="site">${admin ? `<a href="${prefix}">Registre public</a>` : `<a href="${prefix}">Œuvres</a><a href="${prefix}admin/">Espace KEMETED</a>`}</nav>
    </div></header>`);
  document.body.insertAdjacentHTML("beforeend", `
    <footer class="site"><div class="wrap">KEMETED &amp; Association · L'alliance des cultures, la puissance du lien · Registre des œuvres accompagnées par KEMETED CULTURE</div></footer>`);
}

export function toast(msg, err = false) {
  const el = document.createElement("div");
  el.className = "toast" + (err ? " err" : "");
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), err ? 6000 : 3000);
}

/** Lecteur d'un média : YouTube / Vimeo intégrés, fichier vidéo ou audio téléversé. */
export function mediaPlayer(m) {
  const url = String(m.url || "");
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/);
  let player;
  if (yt) player = `<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0" title="${esc(m.title)}" allow="encrypted-media; picture-in-picture; fullscreen" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  else if (vimeo) player = `<div class="embed"><iframe src="https://player.vimeo.com/video/${vimeo[1]}${vimeo[2] ? "?h=" + vimeo[2] : ""}" title="${esc(m.title)}" allow="fullscreen; picture-in-picture" loading="lazy"></iframe></div>`;
  else if (m.kind === "audio") player = `<audio controls preload="metadata" src="${esc(url)}"></audio>`;
  else player = `<video controls playsinline preload="metadata" src="${esc(url)}"></video>`;
  return `<figure class="media"><figcaption>${m.kind === "audio" ? "Écouter" : "Regarder"} · <b>${esc(m.title)}</b></figcaption>${player}</figure>`;
}
