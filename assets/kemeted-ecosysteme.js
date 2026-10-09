/*!
 * Écosystème Kemeted : bouton commun à tous les sites de l'association.
 * Relie chaque site à kemeted-association.org et aux autres sites Kemeted.
 * Fichier autonome (aucune dépendance), à inclure avec :
 *   <script src="kemeted-ecosysteme.js" data-site="saveur" defer></script>
 * data-site : association | saveur | museum | registre
 * Pour changer une adresse : modifier la liste SITES ci-dessous dans chaque copie.
 */
(function () {
  if (window.__kemetedEcosysteme) return;
  window.__kemetedEcosysteme = true;

  var SITES = [
    { id: "association", nom: "Kemeted & Association", texte: "Le site principal : pôles, agenda, blog, dons", url: "https://kemeted-association.org/" },
    { id: "saveur", nom: "Kemeted Saveur", texte: "Nos jus naturels : bouye, ditakh, bissap", url: "https://kemetedassociation.github.io/kemeted-pop-soda/" },
    { id: "museum", nom: "Kemeted Museum", texte: "Les œuvres, leurs histoires et leurs artistes", url: "https://kemeted-museum.netlify.app/" },
    { id: "registre", nom: "Registre des œuvres", texte: "Passeport numérique et certificats d'authenticité", url: "https://kemetedassociation.github.io/kemeted-art-registry/" },
    { id: "evenements", nom: "L'agenda Kemeted", texte: "Expositions, ateliers et prochains rendez-vous", url: "https://kemeted-association.org/evenements" }
  ];

  var script = document.currentScript || document.querySelector("script[data-site]");
  var ici = (script && script.getAttribute("data-site")) || "";
  var position = (script && script.getAttribute("data-position")) || "left";
  var CORBEAU = "data:image/png;base64,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";

  var css = [
    ".kmt-eco{position:fixed;" + position + ":max(14px,env(safe-area-inset-" + position + "));bottom:max(14px,env(safe-area-inset-bottom));z-index:930;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}",
    ".kmt-eco *{box-sizing:border-box}",
    ".kmt-eco__btn{display:flex;align-items:center;gap:8px;min-height:44px;padding:6px 14px 6px 6px;border:1px solid rgba(26,26,26,.12);border-radius:999px;background:rgba(250,246,239,.94);color:#1a1a1a;font-size:13px;font-weight:600;letter-spacing:.01em;cursor:pointer;box-shadow:0 10px 30px -12px rgba(60,40,10,.45);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:transform .2s ease,box-shadow .2s ease}",
    ".kmt-eco__btn:hover{transform:translateY(-2px);box-shadow:0 14px 34px -12px rgba(60,40,10,.55)}",
    ".kmt-eco__btn:focus-visible,.kmt-eco a:focus-visible,.kmt-eco__fermer:focus-visible{outline:2px solid #94730f;outline-offset:3px}",
    ".kmt-eco__logo{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#fff}",
    ".kmt-eco__logo img{width:22px;height:auto}",
    ".kmt-eco__panneau{position:absolute;bottom:56px;" + position + ":0;width:min(340px,calc(100vw - 28px));max-height:min(70vh,560px);overflow-y:auto;overscroll-behavior:contain;padding:18px;border-radius:24px;background:#faf6ef;color:#1a1a1a;border:1px solid rgba(26,26,26,.08);box-shadow:0 30px 60px -20px rgba(0,0,0,.45);opacity:0;transform:translateY(10px) scale(.97);transform-origin:bottom " + position + ";pointer-events:none;transition:opacity .22s ease,transform .22s ease}",
    ".kmt-eco[data-ouvert='1'] .kmt-eco__panneau{opacity:1;transform:none;pointer-events:auto}",
    ".kmt-eco__entete{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}",
    ".kmt-eco__titre{font-size:11px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:#94730f}",
    ".kmt-eco__fermer{width:36px;height:36px;border:0;border-radius:50%;background:rgba(26,26,26,.06);color:#1a1a1a;font-size:18px;line-height:1;cursor:pointer}",
    ".kmt-eco__liste{list-style:none;margin:0;padding:0;display:grid;gap:6px}",
    ".kmt-eco__sous{margin:16px 2px 8px;font-size:12px;font-weight:600;color:rgba(26,26,26,.5)}",
    ".kmt-eco__lien{display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 12px;border-radius:16px;background:#fff;color:inherit;text-decoration:none;border:1px solid rgba(26,26,26,.06);transition:border-color .2s ease}",
    ".kmt-eco__lien:hover{border-color:rgba(148,115,15,.5)}",
    ".kmt-eco__lien[aria-current]{background:rgba(212,175,55,.14);border-color:rgba(212,175,55,.45)}",
    ".kmt-eco__point{flex:none;width:10px;height:10px;border-radius:50%;background:#d4af37}",
    ".kmt-eco__nom{display:block;font-size:15px;font-weight:600}",
    ".kmt-eco__desc{display:block;margin-top:2px;font-size:12.5px;line-height:1.35;color:rgba(26,26,26,.6)}",
    ".kmt-eco__ici{margin-left:auto;flex:none;padding:3px 8px;border-radius:999px;background:#1a1a1a;color:#fff;font-size:10.5px;font-weight:600}",
    ".kmt-eco__cta{display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;border-radius:999px;background:#d4af37;color:#1a1a1a;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 12px 30px -12px rgba(156,124,28,.6)}",
    ".kmt-eco__cta:hover{background:#e8cf7a}",
    "@media (max-width:767px){.kmt-eco__btn{padding:6px;width:48px;height:48px;justify-content:center}.kmt-eco__btn .kmt-eco__libelle{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.kmt-eco__logo{width:36px;height:36px}.kmt-eco__panneau{bottom:60px}}",
    "@media (prefers-reduced-motion:reduce){.kmt-eco__btn,.kmt-eco__panneau{transition:none}}",
    "@media print{.kmt-eco{display:none}}"
  ].join("");

  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (enfants || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function monter() {
    var style = el("style", { text: css });
    document.head.appendChild(style);

    var racine = el("div", { class: "kmt-eco", "data-ouvert": "0" });
    var bouton = el("button", { type: "button", class: "kmt-eco__btn", "aria-expanded": "false", "aria-controls": "kmt-eco-panneau" }, [
      el("span", { class: "kmt-eco__logo" }, [el("img", { src: CORBEAU, alt: "" })]),
      el("span", { class: "kmt-eco__libelle", text: "Écosystème Kemeted" })
    ]);
    bouton.setAttribute("title", "Écosystème Kemeted : tous nos sites");

    var liste = el("ul", { class: "kmt-eco__liste" });
    SITES.forEach(function (s) {
      var lien = el("a", { class: "kmt-eco__lien", href: s.url }, [
        el("span", { class: "kmt-eco__point" }),
        el("span", {}, [el("span", { class: "kmt-eco__nom", text: s.nom }), el("span", { class: "kmt-eco__desc", text: s.texte })]),
        s.id === ici ? el("span", { class: "kmt-eco__ici", text: "Vous êtes ici" }) : null
      ]);
      if (s.id === ici) lien.setAttribute("aria-current", "page");
      liste.appendChild(el("li", {}, [lien]));
    });

    var fermer = el("button", { type: "button", class: "kmt-eco__fermer", "aria-label": "Fermer", text: "×" });
    var panneau = el("div", { id: "kmt-eco-panneau", class: "kmt-eco__panneau", role: "dialog", "aria-label": "Les sites de Kemeted & Association" }, [
      el("div", { class: "kmt-eco__entete" }, [el("span", { class: "kmt-eco__titre", text: "Écosystème Kemeted" }), fermer]),
      ici === "association" ? null : el("a", { class: "kmt-eco__cta", href: SITES[0].url, text: "Aller sur kemeted-association.org" }),
      el("div", { class: "kmt-eco__sous", text: "Tous nos sites" }),
      liste
    ]);

    racine.appendChild(panneau);
    racine.appendChild(bouton);
    document.body.appendChild(racine);

    function basculer(ouvrir) {
      var o = typeof ouvrir === "boolean" ? ouvrir : racine.getAttribute("data-ouvert") !== "1";
      racine.setAttribute("data-ouvert", o ? "1" : "0");
      bouton.setAttribute("aria-expanded", o ? "true" : "false");
      if (o) fermer.focus({ preventScroll: true });
    }
    bouton.addEventListener("click", function () { basculer(); });
    fermer.addEventListener("click", function () { basculer(false); bouton.focus(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") basculer(false); });
    document.addEventListener("click", function (e) { if (!racine.contains(e.target)) basculer(false); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", monter);
  else monter();
})();
