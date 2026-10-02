// Vérification SUN (Secure Unique NFC) des puces NXP NTAG 424 DNA.
// Référence : NXP AN12196 « NTAG 424 DNA and NTAG 424 DNA TagTamper features and hints ».
//
// À chaque lecture, la puce réécrit dans son URL :
//   p = PICCData chiffrée (UID 7 octets + compteur de lecture 3 octets), AES-128-CBC, IV nul
//   m = CMAC tronqué (8 octets) calculé avec une clé de session dérivée de l'UID et du compteur
// Sans la clé secrète, impossible de fabriquer un couple (p, m) valide.
//
// Ce module n'importe rien : on lui passe la primitive AES-ECB (ex. `ecb` de @noble/ciphers),
// pour qu'il tourne à l'identique dans Deno (Edge Functions) et dans Node (tests).

const hexToBytes = (hex) => {
  if (!/^([0-9a-fA-F]{2})*$/.test(hex)) throw new Error("hex invalide");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const bytesToHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();

export function createSun(ecb) {
  const aesBlock = (key, block) => ecb(key, { disablePadding: true }).encrypt(block);
  const aesBlockDecrypt = (key, block) => ecb(key, { disablePadding: true }).decrypt(block);

  const shiftLeft = (b) => {
    const out = new Uint8Array(16);
    for (let i = 0; i < 16; i++) out[i] = ((b[i] << 1) | (i < 15 ? b[i + 1] >> 7 : 0)) & 0xff;
    if (b[0] & 0x80) out[15] ^= 0x87;
    return out;
  };

  // AES-CMAC (RFC 4493)
  function cmac(key, msg) {
    const k1 = shiftLeft(aesBlock(key, new Uint8Array(16)));
    const k2 = shiftLeft(k1);
    const n = Math.max(1, Math.ceil(msg.length / 16));
    const complete = msg.length > 0 && msg.length % 16 === 0;
    let x = new Uint8Array(16);
    for (let i = 0; i < n; i++) {
      const block = new Uint8Array(16);
      const chunk = msg.subarray(i * 16, i * 16 + 16);
      block.set(chunk);
      if (i === n - 1) {
        if (!complete) block[chunk.length] = 0x80;
        const sub = complete ? k1 : k2;
        for (let j = 0; j < 16; j++) block[j] ^= sub[j];
      }
      for (let j = 0; j < 16; j++) block[j] ^= x[j];
      x = aesBlock(key, block);
    }
    return x;
  }

  // Le MAC SUN ne garde que les octets d'indice impair du CMAC (AN12196 §3.4.4.2.2)
  const truncate = (mac) => mac.filter((_, i) => i % 2 === 1);

  const timingSafeEqual = (a, b) => {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  };

  /**
   * @param {object} o
   * @param {string} o.p        PICCData chiffrée, 32 caractères hex
   * @param {string} o.m        MAC tronqué, 16 caractères hex
   * @param {string} o.metaKey  K_SDMMetaRead, 32 caractères hex
   * @param {string} o.fileKey  K_SDMFileRead, 32 caractères hex
   * @returns {{ valid: boolean, uid?: string, counter?: number, reason?: string }}
   */
  function verify({ p, m, metaKey, fileKey }) {
    if (!/^[0-9a-fA-F]{32}$/.test(p || "") || !/^[0-9a-fA-F]{16}$/.test(m || "")) {
      return { valid: false, reason: "format" };
    }
    const picc = aesBlockDecrypt(hexToBytes(metaKey), hexToBytes(p));
    // 0xC7 = UID miroir + compteur miroir + UID de 7 octets
    if (picc[0] !== 0xc7) return { valid: false, reason: "picc_tag" };
    const uid = picc.slice(1, 8);
    const ctr = picc.slice(8, 11);
    const counter = ctr[0] | (ctr[1] << 8) | (ctr[2] << 16); // LSB en premier

    const sv2 = new Uint8Array(16);
    sv2.set([0x3c, 0xc3, 0x00, 0x01, 0x00, 0x80]);
    sv2.set(uid, 6);
    sv2.set(ctr, 13);
    const sessionKey = cmac(hexToBytes(fileKey), sv2);
    // URL sans données fichier chiffrées : SDMMACInputOffset == SDMMACOffset → entrée MAC vide
    const expected = truncate(cmac(sessionKey, new Uint8Array(0)));
    if (!timingSafeEqual(expected, hexToBytes(m))) {
      return { valid: false, reason: "mac", uid: bytesToHex(uid), counter };
    }
    return { valid: true, uid: bytesToHex(uid), counter };
  }

  return { verify, cmac, hexToBytes, bytesToHex };
}
