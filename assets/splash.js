// Écran d'accueil après un scan : le titre de l'œuvre et le nom de l'artiste en grand, animés,
// puis l'écran s'efface sur la fiche. Un toucher le passe (et débloque le son de l'intro).
import { esc } from "./ui.js";

const DURATION = 4600; // ms affichés après l'arrivée des données

export function createSplash(prefix = "../") {
  const el = document.createElement("div");
  el.className = "splash";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Ouverture de la fiche de l'œuvre");
  el.innerHTML = `<div class="splash-bg"></div><div class="splash-in"><img class="splash-logo" src="${prefix}assets/logo.png" alt="KEMETED"><div class="splash-wait"></div></div>`;
  document.body.append(el);
  document.documentElement.classList.add("no-scroll");

  let timer = 0, gone = false;
  const leave = () => {
    if (gone) return;
    gone = true;
    clearTimeout(timer);
    el.classList.add("out");
    document.documentElement.classList.remove("no-scroll");
    setTimeout(() => el.remove(), 900);
  };
  el.addEventListener("pointerdown", () => { if (el.classList.contains("ready")) leave(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" || e.key === "Enter") leave(); }, { once: true });

  const show = (a) => {
    if (gone) return;
    let i = 0; // lettres numérotées en continu, regroupées par mot pour ne jamais couper un mot
    const letters = a.title.split(/\s+/).map((w) =>
      `<span class="w">${[...w].map((c) => `<span style="--i:${i++}">${esc(c)}</span>`).join("")}</span>`).join(" ");
    const n = [...a.title].length;
    if (a.image_url) el.querySelector(".splash-bg").style.backgroundImage = `url("${encodeURI(a.image_url)}")`;
    el.querySelector(".splash-in").innerHTML = `
      <img class="splash-logo" src="${prefix}assets/logo.png" alt="KEMETED">
      <div class="splash-eyebrow">KEMETED Art Registry · <span class="mono">${esc(a.id)}</span></div>
      <h1 class="splash-title" aria-label="${esc(a.title)}" style="--n:${n}">${letters}</h1>
      <div class="splash-rule" style="--n:${n}"></div>
      <div class="splash-artist" style="--n:${n}">${esc(a.artists?.name ?? "")}${a.year ? `<span>${a.year}</span>` : ""}</div>
      <div class="splash-tap" style="--n:${n}">Touchez pour entrer</div>`;
    requestAnimationFrame(() => el.classList.add("ready"));
    timer = setTimeout(leave, DURATION + n * 45);
  };

  return { show, leave };
}
