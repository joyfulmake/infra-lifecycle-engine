// Client-side field encryption (Web Crypto AES-256-GCM). Sensitive fields
// (PM Decision Log today; any field tagged sensitive going forward) are
// stored as an opaque ciphertext envelope in IndexedDB/Firestore instead of
// plaintext — inspecting browser storage, a Firestore export, or a network
// capture shows base64 noise, not content, without the passphrase.
//
// Honest scope: this protects DATA AT REST from casual inspection of
// storage/exports. It does not protect against a compromised/malicious
// client (plaintext necessarily exists in page memory while the user is
// working with it), and it is not a substitute for server-side access
// control — there is no server here to enforce anything. Real
// organization-wide key management (rotation, recovery, per-org keys)
// needs the backend investment noted separately; this is the strongest
// posture achievable in a pure client-side app.

const SALT_BYTES = 16;
const IV_BYTES = 12;
const PBKDF2_ITERATIONS = 210000; // OWASP 2023 minimum recommendation for PBKDF2-SHA256

function hasWebCrypto() {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

function toBase64(bytes) {
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
function fromBase64(b64) {
  return new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
}

async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// Returns an envelope object — safe to store directly as JSON.
export async function encryptField(plaintext, passphrase) {
  if (!plaintext) return null;
  if (!hasWebCrypto()) throw new Error('Web Crypto API unavailable — encryption requires a secure context (HTTPS or localhost)');
  if (!passphrase) throw new Error('encryptField requires a passphrase');

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));

  return { v: 1, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(new Uint8Array(ciphertext)) };
}

export async function decryptField(envelope, passphrase) {
  if (!envelope) return '';
  if (!hasWebCrypto()) throw new Error('Web Crypto API unavailable — decryption requires a secure context (HTTPS or localhost)');
  if (envelope.v !== 1) throw new Error(`Unsupported envelope version: ${envelope.v}`);

  const key = await deriveKey(passphrase, fromBase64(envelope.salt));
  try {
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv) }, key, fromBase64(envelope.data));
    return new TextDecoder().decode(plainBuf);
  } catch {
    // AES-GCM authentication failure — wrong passphrase or tampered data.
    // Never leak which; both look identical to an attacker either way.
    throw new Error('Decryption failed — wrong passphrase or corrupted data');
  }
}

export function isEncryptedEnvelope(value) {
  return !!value && typeof value === 'object' && value.v === 1 && typeof value.data === 'string' && typeof value.iv === 'string' && typeof value.salt === 'string';
}
