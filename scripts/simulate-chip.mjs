// Simule une puce NTAG 424 DNA programmée avec les clés KEMETED (.env) : produit une URL signée
// identique à celle qu'une vraie puce génère à chaque lecture. Pour tester avant d'avoir les puces.
//
//   npm run simulate -- <ID œuvre> <UID 14 hex> <compteur> [url du site]
//   npm run simulate -- KEM-CUL-0001 04AABBCCDDEEFF 1 https://kemetedassociation.github.io/kemeted-art-registry/
import { ecb } from "@noble/ciphers/aes";
import { randomBytes } from "node:crypto";
import { createSun } from "../supabase/functions/_shared/sun.js";

const [id, uidHex, ctrArg, site = "http://localhost:5190/"] = process.argv.slice(2);
if (!id || !/^[0-9a-fA-F]{14}$/.test(uidHex ?? "") || !(Number(ctrArg) >= 0)) {
  console.error("Usage : npm run simulate -- <ID œuvre> <UID 14 hex> <compteur> [url du site]");
  process.exit(1);
}
const { SUN_META_KEY, SUN_FILE_KEY } = process.env;
const sun = createSun(ecb);
const ctr = Number(ctrArg);
const uid = sun.hexToBytes(uidHex.toUpperCase());
const ctrBytes = [ctr & 0xff, (ctr >> 8) & 0xff, (ctr >> 16) & 0xff];

const picc = new Uint8Array(16);
picc.set([0xc7, ...uid, ...ctrBytes]);
picc.set(randomBytes(5), 11);
const p = sun.bytesToHex(ecb(sun.hexToBytes(SUN_META_KEY), { disablePadding: true }).encrypt(picc));

const sv2 = new Uint8Array([0x3c, 0xc3, 0x00, 0x01, 0x00, 0x80, ...uid, ...ctrBytes]);
const session = sun.cmac(sun.hexToBytes(SUN_FILE_KEY), sv2);
const m = sun.bytesToHex(sun.cmac(session, new Uint8Array(0)).filter((_, i) => i % 2 === 1));

if (!sun.verify({ p, m, metaKey: SUN_META_KEY, fileKey: SUN_FILE_KEY }).valid) throw new Error("auto-vérification échouée");
console.log(`${site.replace(/\/?$/, "/")}a/?id=${encodeURIComponent(id)}&p=${p}&m=${m}`);
