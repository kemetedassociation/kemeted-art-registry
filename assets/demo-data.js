// Données de démonstration (mode démo uniquement). Artistes et œuvres fictifs.
const art = (bg, shapes) =>
  "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="${bg}"/>${shapes}</svg>`);

const baobab = art("#d9c3a0",
  `<circle cx="560" cy="250" r="110" fill="#b5462b"/>
   <path d="M330 1000 L360 560 Q300 520 180 470 Q330 480 370 520 L380 380 Q300 300 230 260 Q350 290 400 360 Q440 280 560 230 Q460 320 430 400 L445 540 Q520 470 640 450 Q520 520 460 580 L490 1000Z" fill="#2a1d14"/>
   <rect y="860" width="800" height="140" fill="#7a4a2a"/>`);
const heritage = art("#1f2a2e",
  `<rect x="90" y="120" width="620" height="760" fill="none" stroke="#c9a45c" stroke-width="6"/>
   <circle cx="400" cy="420" r="170" fill="#c9a45c"/><circle cx="400" cy="420" r="120" fill="#1f2a2e"/>
   <path d="M260 700 h280 M300 750 h200 M340 800 h120" stroke="#e8dcc2" stroke-width="14"/>`);
const pont = art("#efe6d6",
  `<path d="M0 640 Q400 320 800 640" fill="none" stroke="#1a1a1a" stroke-width="26"/>
   <path d="M0 700 H800" stroke="#1a1a1a" stroke-width="10"/>
   <g stroke="#1a1a1a" stroke-width="8">${[120, 240, 360, 480, 600, 720].map((x) => `<line x1="${x}" y1="${640 - Math.round(320 * (1 - ((x - 400) / 400) ** 2))}" x2="${x}" y2="700"/>`).join("")}</g>
   <circle cx="400" cy="230" r="60" fill="#d4572a"/><rect y="700" width="800" height="300" fill="#3c6e71" opacity=".85"/>`);

export const demoSeed = () => ({
  artists: [
    { id: "ar1", name: "Mamadou X (démo)", country: "Sénégal", bio: "Peintre né à Saint-Louis, il travaille la mémoire des arbres et des lieux de rassemblement. Exposé à Dakar et Besançon.", website: "", instagram: "", photo_url: "" },
    { id: "ar2", name: "Aïssatou Y (démo)", country: "France / Mali", bio: "Plasticienne, elle explore la géométrie des textiles d'Afrique de l'Ouest et la transmission entre générations.", website: "", instagram: "", photo_url: "" },
  ],
  artworks: [
    { id: "KEM-CUL-0001", artist_id: "ar1", title: "Mémoire du Baobab", year: 2026, technique: "Acrylique sur toile", dimensions: "80 × 100 cm",
      description: "Le baobab de la place du village, sous lequel les anciens tranchaient les différends. L'artiste l'a peint de mémoire, après sa disparition lors de travaux de voirie.",
      image_url: baobab, detail_images: [], status: "exposee", price_eur: 2400, show_price: true, published: true,
      certificate_issued_at: "2026-09-15", certificate_hash: null, nft_chain: null, nft_contract: null, nft_token_id: null, nft_tx: null, nft_minted_at: null },
    { id: "KEM-CUL-0002", artist_id: "ar2", title: "Héritage", year: 2026, technique: "Technique mixte, feuille d'or", dimensions: "60 × 80 cm",
      description: "Un cercle d'or transmis de main en main : trois lignes pour trois générations de femmes.",
      image_url: heritage, detail_images: [], status: "vendue", price_eur: 1800, show_price: false, published: true,
      certificate_issued_at: "2026-06-02", certificate_hash: null, nft_chain: null, nft_contract: null, nft_token_id: null, nft_tx: null, nft_minted_at: null },
    { id: "KEM-CUL-0003", artist_id: "ar1", title: "Le Pont", year: 2025, technique: "Huile sur toile", dimensions: "100 × 120 cm",
      description: "Le pont comme alliance des cultures : une arche entre deux rives qui ne se ressemblent pas.",
      image_url: pont, detail_images: [], status: "a_vendre", price_eur: 3200, show_price: true, published: true,
      certificate_issued_at: "2026-01-20", certificate_hash: null, nft_chain: null, nft_contract: null, nft_token_id: null, nft_tx: null, nft_minted_at: null },
  ],
  exhibitions: [
    { id: "ex1", title: "Les couleurs de la solidarité", venue: "Fabrique de Besançon", city: "Besançon", starts_on: "2026-11-14", ends_on: "2026-11-30" },
    { id: "ex2", title: "Racines et passages", venue: "Galerie partenaire", city: "Dakar", starts_on: "2026-03-05", ends_on: "2026-03-20" },
  ],
  artwork_exhibitions: [
    { artwork_id: "KEM-CUL-0001", exhibition_id: "ex1" },
    { artwork_id: "KEM-CUL-0001", exhibition_id: "ex2" },
    { artwork_id: "KEM-CUL-0003", exhibition_id: "ex1" },
  ],
  ownerships: [
    { id: "ow1", artwork_id: "KEM-CUL-0002", owner_name: "Collection privée (démo)", owner_email: "", owner_wallet: "", show_name: false, acquired_on: "2026-07-10", price_eur: 1800, note: "", current: true },
  ],
  nfc_tags: [{ uid: "04DE5F1EACC040", artwork_id: "KEM-CUL-0001", last_counter: 60, revoked: false }],
  scans: [],
  seq: 3,
});
