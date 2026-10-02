// Teste le contrat sur une blockchain locale (npx hardhat node --config hardhat.config.cjs)
// Lancer via : npm run test:contract
import { createWalletClient, createPublicClient, http, keccak256, toHex, stringToBytes } from "viem";
import { hardhat } from "viem/chains";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const { abi, bytecode } = JSON.parse(readFileSync(new URL("../contracts/build/KemetedArtRegistry.json", import.meta.url)));
const transport = http("http://127.0.0.1:8545");
const pub = createPublicClient({ chain: hardhat, transport });
const [admin, buyer, stranger] = await pub.request({ method: "eth_accounts" });
const wallet = (account) => createWalletClient({ account, chain: hardhat, transport });

const deployTx = await wallet(admin).deployContract({ abi, bytecode, args: [admin, admin, "https://registry.example/nft-metadata/"] });
const { contractAddress: address } = await pub.waitForTransactionReceipt({ hash: deployTx });
const read = (functionName, args = []) => pub.readContract({ address, abi, functionName, args });
const write = async (account, functionName, args) =>
  pub.waitForTransactionReceipt({ hash: await wallet(account).writeContract({ address, abi, functionName, args }) });

const cert = keccak256(stringToBytes("certificat KEM-CUL-0001"));
await write(admin, "register", [admin, "KEM-CUL-0001", cert]);

assert.equal(await read("totalMinted"), 1n);
assert.equal((await read("ownerOf", [1n])).toLowerCase(), admin.toLowerCase());
assert.equal(await read("tokenURI", [1n]), "https://registry.example/nft-metadata/KEM-CUL-0001");
assert.equal(await read("tokenOfArtwork", ["KEM-CUL-0001"]), 1n);
assert.equal(await read("verifyCertificate", ["KEM-CUL-0001", cert]), true);
assert.equal(await read("verifyCertificate", ["KEM-CUL-0001", toHex(1n, { size: 32 })]), false);

// Un même identifiant ne peut pas être enregistré deux fois (anti-doublon)
await assert.rejects(write(admin, "register", [admin, "KEM-CUL-0001", cert]), /ArtworkAlreadyRegistered/);
// Seul le rôle MINTER peut enregistrer
await assert.rejects(write(stranger, "register", [stranger, "KEM-CUL-0002", cert]), /AccessControl/);

// Vente : le jeton suit l'œuvre
await write(admin, "transferFrom", [admin, buyer, 1n]);
assert.equal((await read("ownerOf", [1n])).toLowerCase(), buyer.toLowerCase());
assert.equal((await read("artworkOf", [1n])).artworkId, "KEM-CUL-0001");
console.log("Contrat : tous les tests passent");
