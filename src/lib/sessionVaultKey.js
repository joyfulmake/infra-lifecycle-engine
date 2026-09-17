// Session-scoped passphrase cache for cryptoVault.js. Prompted once per
// browser session (not persisted anywhere — reloading the page asks again),
// so a PM doesn't re-enter it on every keystroke. Honest limitation: this
// is a UX convenience, not a security boundary — anyone with devtools
// access to a live session can read the cached value from this module's
// closure. Real key management (rotation, recovery, per-org vaults) needs
// the backend investment noted separately.

let cachedPassphrase = null;

export function getSessionPassphrase(promptMessage) {
  if (!cachedPassphrase) {
    cachedPassphrase = window.prompt(
      promptMessage || 'Enter a vault passphrase for this session. It never leaves your browser and cannot be recovered if forgotten — it only encrypts sensitive fields locally.'
    );
  }
  return cachedPassphrase || null;
}

export function clearSessionPassphrase() {
  cachedPassphrase = null;
}
