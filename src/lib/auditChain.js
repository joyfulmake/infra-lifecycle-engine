// Tamper-evident audit log. Each entry's hash is computed over its own
// content plus the PREVIOUS entry's hash, so retroactively editing any
// entry changes every hash after it — detectable by re-verifying the
// chain, exactly like a minimal blockchain without the distributed part.
//
// Honest scope: this proves whether the chain that ships in a build is
// internally consistent. It cannot stop someone with direct read/write
// access to IndexedDB/Firestore from regenerating a whole new, internally
// self-consistent chain from scratch — true immutability requires a
// server the client doesn't control, which doesn't exist here. What it
// DOES catch: an in-place edit to one entry that leaves the rest of an
// otherwise-real chain untouched, which is the realistic tampering case.

const GENESIS_HASH = '0'.repeat(64);

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function appendAuditEntry(chain, entry) {
  const prevHash = chain.length ? chain[chain.length - 1].hash : GENESIS_HASH;
  const record = { ...entry, prevHash };
  const hash = await sha256Hex(JSON.stringify(record));
  return [...chain, { ...record, hash }];
}

export async function verifyAuditChain(chain) {
  let expectedPrev = GENESIS_HASH;
  for (let i = 0; i < chain.length; i++) {
    const { hash, ...record } = chain[i];
    if (record.prevHash !== expectedPrev) {
      return { valid: false, brokenAt: i, reason: 'prevHash does not match the preceding entry' };
    }
    const recomputed = await sha256Hex(JSON.stringify(record));
    if (recomputed !== hash) {
      return { valid: false, brokenAt: i, reason: 'stored hash does not match recomputed hash — entry was modified after being written' };
    }
    expectedPrev = hash;
  }
  return { valid: true };
}
