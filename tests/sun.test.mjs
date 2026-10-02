// Vecteurs de test officiels NXP AN12196 + RFC 4493
import { ecb } from "@noble/ciphers/aes";
import { createSun } from "../supabase/functions/_shared/sun.js";
import assert from "node:assert/strict";

const sun = createSun(ecb);
const Z = "00000000000000000000000000000000";

// RFC 4493 exemples 1 et 2
const rfcKey = sun.hexToBytes("2b7e151628aed2a6abf7158809cf4f3c");
assert.equal(sun.bytesToHex(sun.cmac(rfcKey, new Uint8Array(0))), "BB1D6929E95937287FA37D129B756746");
assert.equal(sun.bytesToHex(sun.cmac(rfcKey, sun.hexToBytes("6bc1bee22e409f96e93d7e117393172a"))), "070A16B46B4D4144F79BDD9DD04A287C");

// AN12196 : URL d'exemple, clés à zéro
const ok = sun.verify({ p: "EF963FF7828658A599F3041510671E88", m: "94EED9EE65337086", metaKey: Z, fileKey: Z });
assert.deepEqual(ok, { valid: true, uid: "04DE5F1EACC040", counter: 61 });

// MAC altéré
const bad = sun.verify({ p: "EF963FF7828658A599F3041510671E88", m: "94EED9EE65337087", metaKey: Z, fileKey: Z });
assert.equal(bad.valid, false);
assert.equal(bad.reason, "mac");

// Mauvaise clé
const wrongKey = sun.verify({ p: "EF963FF7828658A599F3041510671E88", m: "94EED9EE65337086", metaKey: Z, fileKey: "11".repeat(16) });
assert.equal(wrongKey.valid, false);

assert.equal(sun.verify({ p: "zz", m: "", metaKey: Z, fileKey: Z }).reason, "format");
console.log("SUN : tous les tests passent");
