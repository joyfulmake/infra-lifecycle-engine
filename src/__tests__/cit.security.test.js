// CIT — Component Integration Tests: security layer
// cryptoVault (client-side field encryption), auditChain (tamper-evident
// audit log), permissions (RBAC capability matrix).

import { describe, it, expect } from 'vitest';
import { encryptField, decryptField, isEncryptedEnvelope } from '../lib/cryptoVault.js';
import { appendAuditEntry, verifyAuditChain } from '../lib/auditChain.js';
import { CAPABILITIES, getCapabilities, hasCapability } from '../lib/permissions.js';

describe('cryptoVault', () => {
  it('round-trips plaintext through encrypt/decrypt with the correct passphrase', async () => {
    const plaintext = 'PM decision: approved emergency change window for 2026-09-20.';
    const envelope = await encryptField(plaintext, 'correct-horse-battery-staple');
    expect(isEncryptedEnvelope(envelope)).toBe(true);
    const recovered = await decryptField(envelope, 'correct-horse-battery-staple');
    expect(recovered).toBe(plaintext);
  });

  it('never stores plaintext anywhere in the envelope', async () => {
    const plaintext = 'UNIQUE_SECRET_MARKER_998877';
    const envelope = await encryptField(plaintext, 'a-passphrase');
    const serialized = JSON.stringify(envelope);
    expect(serialized).not.toContain('UNIQUE_SECRET_MARKER_998877');
  });

  it('produces different ciphertext for the same plaintext each time (random salt/iv)', async () => {
    const a = await encryptField('same text', 'pw');
    const b = await encryptField('same text', 'pw');
    expect(a.data).not.toBe(b.data);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });

  it('fails to decrypt with the wrong passphrase rather than silently returning garbage', async () => {
    const envelope = await encryptField('sensitive value', 'right-passphrase');
    await expect(decryptField(envelope, 'wrong-passphrase')).rejects.toThrow();
  });

  it('encryptField(null/empty) returns null, not an empty envelope', async () => {
    expect(await encryptField('', 'pw')).toBeNull();
    expect(await encryptField(null, 'pw')).toBeNull();
  });

  it('isEncryptedEnvelope rejects plain strings/objects that are not envelopes', () => {
    expect(isEncryptedEnvelope('plain text')).toBe(false);
    expect(isEncryptedEnvelope({ foo: 'bar' })).toBe(false);
    expect(isEncryptedEnvelope(null)).toBe(false);
  });
});

describe('auditChain', () => {
  it('builds a chain where each entry links to the previous hash', async () => {
    let chain = [];
    chain = await appendAuditEntry(chain, { type: 'BUILD', description: 'Build created' });
    chain = await appendAuditEntry(chain, { type: 'SCAN', description: 'AI Smart Scan run' });
    expect(chain.length).toBe(2);
    expect(chain[1].prevHash).toBe(chain[0].hash);
    expect(chain[0].prevHash).toBe('0'.repeat(64));
  });

  it('verifies a clean, untampered chain as valid', async () => {
    let chain = [];
    for (let i = 0; i < 5; i++) chain = await appendAuditEntry(chain, { type: 'EVENT', i });
    const result = await verifyAuditChain(chain);
    expect(result.valid).toBe(true);
  });

  it('detects an in-place edit to an earlier entry', async () => {
    let chain = [];
    for (let i = 0; i < 4; i++) chain = await appendAuditEntry(chain, { type: 'EVENT', i });
    // Tamper: silently change entry 1's description without recomputing hashes
    const tampered = chain.map((e, i) => i === 1 ? { ...e, description: 'HACKED' } : e);
    const result = await verifyAuditChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it('detects a broken prevHash link even if the edited entry recomputed its own hash', async () => {
    let chain = [];
    for (let i = 0; i < 3; i++) chain = await appendAuditEntry(chain, { type: 'EVENT', i });
    // Simulate deleting entry 0 entirely, shifting the chain
    const spliced = chain.slice(1);
    const result = await verifyAuditChain(spliced);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(0);
  });

  it('an empty chain verifies as valid (nothing to break)', async () => {
    expect((await verifyAuditChain([])).valid).toBe(true);
  });
});

describe('permissions (RBAC matrix)', () => {
  it('PM and Deputy PM get every capability', () => {
    CAPABILITIES.forEach(cap => {
      expect(hasCapability(['PM'], cap)).toBe(true);
      expect(hasCapability(['Deputy PM'], cap)).toBe(true);
    });
  });

  it('an unmatched/guest role only gets view_build', () => {
    expect(hasCapability([], 'view_build')).toBe(false); // no roles at all -> nothing
    expect(getCapabilities('Some Random Role')).toEqual(['view_build']);
    expect(hasCapability(['Some Random Role'], 'view_build')).toBe(true);
    expect(hasCapability(['Some Random Role'], 'approve_cab')).toBe(false);
  });

  it('Change Manager can approve CAB but cannot sign RTM', () => {
    expect(hasCapability(['Change Manager'], 'approve_cab')).toBe(true);
    expect(hasCapability(['Change Manager'], 'sign_rtm')).toBe(false);
  });

  it('a user with multiple roles gets the union of their capabilities', () => {
    const roles = ['Change Manager', 'QA Team Lead'];
    expect(hasCapability(roles, 'approve_cab')).toBe(true);
    expect(hasCapability(roles, 'sign_rtm')).toBe(true);
    expect(hasCapability(roles, 'manage_org_security')).toBe(false);
  });
});
