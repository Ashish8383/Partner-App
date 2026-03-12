import CryptoJS from 'crypto-js';

const ENCRYPTER_SECRET_KEY =
  "YbRTZP5FVQJSZcvMIFnPuX04rkaiveXW5MI6Tj5T9VOAhWWi7PyfOy3hHwrxNzRYjcvL=RGF%zC]E{&8'ue8~NIW3s's9+L5EVaa2@@.O%>>)*<nXVo=NF&S&oa?1=rc~:~PN{v1411!Gvd.";

/**
 * Decrypts an encrypted payload string produced by the backend.
 *
 * @param {string} data  
 * @returns {any}       
 * @throws {Error}       
 */
export const decryptData = (data) => {
  if (!data) throw new Error('decryptData: data is required');

  
  const hashedKey = CryptoJS.SHA256(ENCRYPTER_SECRET_KEY); 

  const parts = data.split(':');
  if (parts.length !== 3) throw new Error('decryptData: invalid payload format');
  const [ivHex, encryptedHex, storedHmac] = parts;

  const calculatedHmac = CryptoJS.HmacSHA256(
    ivHex + encryptedHex,
    hashedKey,
  ).toString(CryptoJS.enc.Hex);

  if (calculatedHmac !== storedHmac) {
    throw new Error('decryptData: data integrity check failed (HMAC mismatch)');
  }

  const iv          = CryptoJS.enc.Hex.parse(ivHex);
  const ciphertext  = CryptoJS.enc.Hex.parse(encryptedHex);

  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext });

  const decrypted = CryptoJS.AES.decrypt(cipherParams, hashedKey, {
    iv,
    mode:    CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
  if (!plaintext) throw new Error('decryptData: decryption produced empty output');

  return JSON.parse(plaintext);
};