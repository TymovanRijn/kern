// Small WebCrypto helpers: PBKDF2 key derivation + AES-GCM. Needs a secure context (https / localhost).

export const secure = () => !!(window.isSecureContext && crypto?.subtle);

export const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

export function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const enc = new TextEncoder();
const dec = new TextDecoder();

async function pbkdf2Bits(secret, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 256);
}

/** Hash a PIN for storage. Returns { salt, iter, hash } (base64). */
export async function hashPin(pin, salt = rand(16), iter = 210000) {
  const bits = await pbkdf2Bits(pin, salt, iter);
  return { salt: b64(salt), iter, hash: b64(bits) };
}

export async function checkPin(pin, rec) {
  const { hash } = await hashPin(pin, unb64(rec.salt), rec.iter);
  // constant-time-ish compare
  let diff = hash.length ^ rec.hash.length;
  for (let i = 0; i < Math.min(hash.length, rec.hash.length); i++) diff |= hash.charCodeAt(i) ^ rec.hash.charCodeAt(i);
  return diff === 0;
}

async function aesKey(password, salt, iter) {
  const bits = await pbkdf2Bits(password, salt, iter);
  return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Encrypt a string with a password → JSON envelope string. */
export async function encryptText(text, password) {
  const salt = rand(16), iv = rand(12), iter = 600000;
  const key = await aesKey(password, salt, iter);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return JSON.stringify({
    app: 'amifo', format: 'encrypted-backup', v: 1,
    kdf: 'PBKDF2-SHA256', iter, cipher: 'AES-256-GCM',
    salt: b64(salt), iv: b64(iv), data: b64(data),
  });
}

export const isEncrypted = (obj) => obj?.format === 'encrypted-backup';

export async function decryptEnvelope(obj, password) {
  const key = await aesKey(password, unb64(obj.salt), obj.iter);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(obj.iv) }, key, unb64(obj.data));
    return dec.decode(plain);
  } catch {
    throw new Error('Onjuist wachtwoord');
  }
}
