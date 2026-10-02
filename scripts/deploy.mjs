// Déploie le contrat KemetedArtRegistry sur Base (ou Base Sepolia pour les tests).
//
//   DEPLOYER_PRIVATE_KEY=0x… MINTER_ADDRESS=0x… BASE_URI=https://<projet>.supabase.co/functions/v1/nft-metadata/ \
//   CHAIN=base-sepolia node scripts/deploy.mjs
//
// DEPLOYER = portefeuille administrateur de KEMETED (gardé hors ligne ensuite, idéalement un Safe multisignature).
// MINTER   = portefeuille « chaud » utilisé par l'Edge Function `nft` (clé MINTER_PRIVATE_KEY côté Supabase).
import { createWalletClient, createPublicClient, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { readFileSync } from "node:fs";

const { DEPLOYER_PRIVATE_KEY, MINTER_ADDRESS, BASE_URI, CHAIN = "base-sepolia", RPC_URL } = process.env;
if (!DEPLOYER_PRIVATE_KEY || !isAddress(MINTER_ADDRESS ?? "") || !BASE_URI) {
  console.error("Variables requises : DEPLOYER_PRIVATE_KEY, MINTER_ADDRESS, BASE_URI (voir l'en-tête du script)");
  process.exit(1);
}
const chain = CHAIN === "base" ? base : baseSepolia;
const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);
const transport = http(RPC_URL || undefined);
const wallet = createWalletClient({ account, chain, transport });
const pub = createPublicClient({ chain, transport });
const { abi, bytecode } = JSON.parse(readFileSync(new URL("../contracts/build/KemetedArtRegistry.json", import.meta.url)));

console.log(`Déploiement sur ${chain.name} depuis ${account.address}…`);
const hash = await wallet.deployContract({ abi, bytecode, args: [account.address, MINTER_ADDRESS, BASE_URI] });
const receipt = await pub.waitForTransactionReceipt({ hash });
console.log(`Contrat déployé : ${receipt.contractAddress}`);
console.log(`Explorateur : ${chain.blockExplorers.default.url}/address/${receipt.contractAddress}`);
console.log("→ Mettre cette adresse dans assets/config.js (NFT_CONTRACT) et dans le secret Supabase NFT_CONTRACT.");
