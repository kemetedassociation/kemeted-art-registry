// Configuration publique du registre (aucun secret ici : le dépôt peut être public).
// Laisser SUPABASE_URL vide = mode démo (données d'exemple stockées dans le navigateur).
export const config = {
  SUPABASE_URL: "https://ropdanrhoakgbnxlwhnu.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvcGRhbnJob2FrZ2JueGx3aG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NjAxODQsImV4cCI6MjEwNjUzNjE4NH0.x6-ANL88W5EuI6F3kjSjUEg2Ap0kPL6L6sBqLFVQe3E",

  // Blockchain (lecture publique, pour le bouton « Vérifier sur la blockchain »)
  NFT_CHAIN: "base-sepolia", // "base" en production
  NFT_CONTRACT: "0x84dcedfb1420e64425234d38a24f9445b8e40135",
  RPC_URL: "https://sepolia.base.org", // https://mainnet.base.org en production
  EXPLORER_URL: "https://sepolia.basescan.org", // https://basescan.org en production

  CONTACT_EMAIL: "kemeted.association@gmail.com",
};

export const DEMO = !config.SUPABASE_URL;
