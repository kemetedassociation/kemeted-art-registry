// Lecteur « voix + texte » : l'audio se lance, le texte s'écrit au fil de la voix.
// Et pavé numérique plein écran pour les contenus réservés aux acquéreurs.
import { esc } from "./ui.js";

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const ICON_PLAY = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>`;

/**
 * Monte un lecteur synchronisé dans `host`.
 * @param {HTMLElement} host
 * @param {{url:string, title:string, transcript?:{t:number,text:string}[]}} media
 * @param {{autoplay?:boolean, eyebrow?:string}} opts
 */
export function mountVoice(host, media, { autoplay = false, eyebrow = "" } = {}) {
  const lines = (media.transcript || []).slice().sort((a, b) => a.t - b.t);
  host.innerHTML = `
    <div class="voice">
      <div class="voice-head">
        <button class="voice-btn" type="button" aria-label="Lecture">${ICON_PLAY}</button>
        <div class="voice-meta">
          ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}
          <div class="voice-title">${esc(media.title)}</div>
          <div class="voice-bar"><span></span></div>
        </div>
        <div class="voice-time small muted">0:00</div>
      </div>
      <div class="voice-text" aria-live="off">${lines.map((l, i) => `<p data-i="${i}"><span class="typed"></span><span class="caret"></span></p>`).join("")}</div>
      <div class="voice-hint small"></div>
      <audio preload="auto" src="${esc(media.url)}"></audio>
    </div>`;
  const root = host.querySelector(".voice");
  const audio = root.querySelector("audio");
  const btn = root.querySelector(".voice-btn");
  const bar = root.querySelector(".voice-bar span");
  const time = root.querySelector(".voice-time");
  const hint = root.querySelector(".voice-hint");
  const box = root.querySelector(".voice-text");
  const ps = [...box.querySelectorAll("p")];
  let raf = 0, current = -1;

  const render = () => {
    const t = audio.currentTime, d = audio.duration || lines.at(-1)?.t + 3 || 1;
    bar.style.width = `${Math.min(100, (t / d) * 100)}%`;
    time.textContent = fmt(t);
    lines.forEach((l, i) => {
      const end = i + 1 < lines.length ? lines[i + 1].t : d;
      const p = ps[i], typed = p.firstChild;
      if (t < l.t) { if (p.classList.contains("on")) { p.classList.remove("on", "done", "now"); typed.textContent = ""; } return; }
      const k = Math.min(1, (t - l.t) / Math.max(0.6, (end - l.t) * 0.85)); // l'écriture finit un peu avant la phrase suivante
      const n = Math.round(l.text.length * k);
      if (typed.textContent.length !== n) typed.textContent = l.text.slice(0, n);
      p.classList.add("on");
      p.classList.toggle("now", t < end);
      p.classList.toggle("done", k >= 1 && t >= end);
      // Fait défiler uniquement le cadre du texte, jamais la page : le visiteur garde la main sur son défilement
      if (t < end && current !== i) { current = i; box.scrollTo({ top: Math.max(0, p.offsetTop - box.clientHeight + p.offsetHeight + 8), behavior: "smooth" }); }
    });
    if (!audio.paused) raf = requestAnimationFrame(render);
  };
  const setBtn = () => { btn.innerHTML = audio.paused ? ICON_PLAY : ICON_PAUSE; btn.setAttribute("aria-label", audio.paused ? "Lecture" : "Pause"); root.classList.toggle("playing", !audio.paused); };
  const play = () => audio.play().then(() => { hint.textContent = ""; root.classList.remove("blocked"); }).catch(() => {
    root.classList.add("blocked");
    hint.innerHTML = "Touchez <b>Lecture</b> pour écouter Claudine.";
  });

  btn.onclick = () => (audio.paused ? play() : audio.pause());
  audio.addEventListener("play", () => { setBtn(); cancelAnimationFrame(raf); raf = requestAnimationFrame(render); });
  audio.addEventListener("pause", () => { setBtn(); render(); });
  audio.addEventListener("ended", () => { setBtn(); render(); hint.innerHTML = `<button type="button" class="linkish">Réécouter</button>`; hint.querySelector("button").onclick = () => { audio.currentTime = 0; play(); }; });
  root.querySelector(".voice-bar").onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (audio.duration) { audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; render(); }
  };

  if (autoplay) {
    // Les navigateurs bloquent souvent le son sans geste de l'utilisateur :
    // on essaie, sinon le premier toucher n'importe où sur la page lance la voix.
    play();
    const unlock = (e) => {
      if (!audio.paused || e.target.closest?.(".voice-btn, .keypad, a, button, input, video, audio")) return;
      play(); off();
    };
    const off = () => ["pointerdown", "keydown"].forEach((ev) => document.removeEventListener(ev, unlock, true));
    ["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, unlock, true));
    audio.addEventListener("play", off, { once: true });
  }
  return { audio, play, stop: () => { audio.pause(); } };
}

/**
 * Pavé numérique plein écran. `onSubmit(code)` renvoie { ok } ou { ok:false, message }.
 * En cas de succès, `onSuccess(result, overlayBody)` remplit l'overlay (lecteur réservé).
 */
export function openKeypad({ title, subtitle = "", onSubmit, onSuccess, maxLength = 8 }) {
  let code = "";
  const el = document.createElement("div");
  el.className = "keypad";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.innerHTML = `
    <button class="keypad-close" type="button" aria-label="Fermer">×</button>
    <div class="keypad-body">
      <div class="keypad-lock"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div>
      <h2>${esc(title)}</h2>
      ${subtitle ? `<p class="keypad-sub">${esc(subtitle)}</p>` : ""}
      <div class="keypad-dots" aria-live="polite"></div>
      <div class="keypad-msg" aria-live="assertive"></div>
      <div class="keypad-grid">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-k="${n}">${n}</button>`).join("")}
        <button type="button" data-k="del" aria-label="Effacer">⌫</button>
        <button type="button" data-k="0">0</button>
        <button type="button" data-k="ok" class="ok" aria-label="Valider">✓</button>
      </div>
    </div>`;
  document.body.append(el);
  document.documentElement.classList.add("no-scroll");
  const dots = el.querySelector(".keypad-dots"), msg = el.querySelector(".keypad-msg"), body = el.querySelector(".keypad-body");
  const draw = () => { dots.innerHTML = code ? [...code].map(() => "<i></i>").join("") : "<span>Saisissez le code</span>"; };
  const close = () => { el.querySelectorAll("audio,video").forEach((m) => m.pause()); el.remove(); document.documentElement.classList.remove("no-scroll"); document.removeEventListener("keydown", onKey); };
  let busy = false;
  const submit = async () => {
    if (!code || busy) return;
    busy = true; msg.textContent = "Vérification…";
    try {
      const r = await onSubmit(code);
      if (r.ok) { msg.textContent = ""; el.classList.add("unlocked"); onSuccess(r, body, close); }
      else { msg.textContent = r.message; el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); code = ""; draw(); }
    } catch (e) { msg.textContent = "Impossible de vérifier le code. Réessayez."; }
    busy = false;
  };
  const press = (k) => {
    if (el.classList.contains("unlocked")) return;
    if (k === "del") code = code.slice(0, -1);
    else if (k === "ok") return submit();
    else if (code.length < maxLength) code += k;
    msg.textContent = ""; draw();
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
    else if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === "Backspace") press("del");
    else if (e.key === "Enter") press("ok");
  };
  el.querySelector(".keypad-grid").onclick = (e) => { const b = e.target.closest("button"); if (b) press(b.dataset.k); };
  el.querySelector(".keypad-close").onclick = close;
  document.addEventListener("keydown", onKey);
  draw();
  el.querySelector('[data-k="1"]').focus({ preventScroll: true });
  return { close };
}
