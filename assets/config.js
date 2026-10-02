// Configuration publique du registre (aucun secret ici : le dépôt peut être public).
// Laisser SUPABASE_URL vide = mode démo (données d'exemple stockées dans le navigateur).
export const config = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Blockchain (lecture publique, pour le bouton « Vérifier sur la blockchain »)
  NFT_CHAIN: "base-sepolia", // "base" en production
  NFT_CONTRACT: "",
  RPC_URL: "https://sepolia.base.org", // https://mainnet.base.org en production
  EXPLORER_URL: "https://sepolia.basescan.org", // https://basescan.org en production

  CONTACT_EMAIL: "kemeted.association@gmail.com",
};

export const DEMO = !config.SUPABASE_URL;
