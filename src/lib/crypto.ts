/**
 * Vault encryption: PBKDF2-SHA256 (600k iterations, OWASP 2023) -> AES-256-GCM.
 * Everything runs through WebCrypto, so the same code works in browsers and in the Tauri webview.
 */
export const KDF_ITERATIONS = 600_000;

export interface EncryptedBlob {
  v: 1;
  kdf: { name: "PBKDF2-SHA256"; iterations: number; salt: string };
  iv: string;
  data: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface KeyMaterial {
  key: CryptoKey;
  salt: Uint8Array<ArrayBuffer>;
  iterations: number;
}

export async function newKeyMaterial(password: string): Promise<KeyMaterial> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { key: await deriveKey(password, salt, KDF_ITERATIONS), salt, iterations: KDF_ITERATIONS };
}

export async function encryptJSON(km: KeyMaterial, value: unknown): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, km.key, enc.encode(JSON.stringify(value)));
  return {
    v: 1,
    kdf: { name: "PBKDF2-SHA256", iterations: km.iterations, salt: toB64(km.salt) },
    iv: toB64(iv),
    data: toB64(new Uint8Array(ct)),
  };
}

export class WrongPasswordError extends Error {
  constructor() {
    super("wrong-password");
  }
}

export async function unlockBlob<T>(blob: EncryptedBlob, password: string): Promise<{ km: KeyMaterial; value: T }> {
  const salt = fromB64(blob.kdf.salt);
  const key = await deriveKey(password, salt, blob.kdf.iterations);
  const km = { key, salt, iterations: blob.kdf.iterations };
  return { km, value: await decryptJSON<T>(km, blob) };
}

export async function decryptJSON<T>(km: KeyMaterial, blob: EncryptedBlob): Promise<T> {
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(blob.iv) }, km.key, fromB64(blob.data));
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    throw new WrongPasswordError();
  }
}

export function isEncryptedBlob(x: unknown): x is EncryptedBlob {
  const b = x as EncryptedBlob;
  return !!b && b.v === 1 && typeof b.iv === "string" && typeof b.data === "string" && typeof b.kdf?.salt === "string";
}
