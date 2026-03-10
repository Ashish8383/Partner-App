import CryptoJS from 'crypto-js';

const ENCRYPTER_SECRET_KEY =
  "YbRTZP5FVQJSZcvMIFnPuX04rkaiveXW5MI6Tj5T9VOAhWWi7PyfOy3hHwrxNzRYjcvL=RGF%zC]E{&8'ue8~NIW3s's9+L5EVaa2@@.O%>>)*<nXVo=NF&S&oa?1=rc~:~PN{v1411!Gvd.";

/**
 * Decrypts an encrypted payload string produced by the backend.
 *
 * @param {string} data  "ivHex:encryptedHex:hmac"
 * @returns {any}        Parsed JSON value (object / array / primitive)
 * @throws {Error}       If data is missing, HMAC check fails, or decryption errors
 */
export const decryptData = (data) => {
  if (!data) throw new Error('decryptData: data is required');

  // ── 1. Derive the 32-byte key the same way Node does ──────────────────────
  //    crypto.createHash('sha256').update(secret).digest()  →  32-byte Buffer
  //    CryptoJS.SHA256 returns a WordArray; we keep it as WordArray for AES.
  const hashedKey = CryptoJS.SHA256(ENCRYPTER_SECRET_KEY); // WordArray (32 bytes)

  // ── 2. Split payload ───────────────────────────────────────────────────────
  const parts = data.split(':');
  if (parts.length !== 3) throw new Error('decryptData: invalid payload format');
  const [ivHex, encryptedHex, storedHmac] = parts;

  // ── 3. HMAC-SHA256 integrity check ────────────────────────────────────────
  //    Node:  crypto.createHmac('sha256', hashedKey).update(ivHex + encryptedHex).digest('hex')
  //    In Node the hashedKey passed to createHmac is a raw Buffer (binary).
  //    CryptoJS.HmacSHA256 accepts a WordArray as key — same result.
  const calculatedHmac = CryptoJS.HmacSHA256(
    ivHex + encryptedHex,
    hashedKey,
  ).toString(CryptoJS.enc.Hex);

  if (calculatedHmac !== storedHmac) {
    throw new Error('decryptData: data integrity check failed (HMAC mismatch)');
  }

  // ── 4. AES-256-CBC decrypt ─────────────────────────────────────────────────
  const iv          = CryptoJS.enc.Hex.parse(ivHex);
  const ciphertext  = CryptoJS.enc.Hex.parse(encryptedHex);

  // Wrap raw ciphertext WordArray in a CipherParams object
  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext });

  const decrypted = CryptoJS.AES.decrypt(cipherParams, hashedKey, {
    iv,
    mode:    CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
  if (!plaintext) throw new Error('decryptData: decryption produced empty output');

  // ── 5. Parse JSON ──────────────────────────────────────────────────────────
  return JSON.parse(plaintext);
};