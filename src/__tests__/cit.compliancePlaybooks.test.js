// CIT — Component Integration Tests: compliance playbook library (Phase 5)

import { describe, it, expect } from 'vitest';
import { PROJECT_TYPES, getPlaybook } from '../lib/compliancePlaybooks.js';

const RAID_TYPE_OPTIONS = new Set(['RISK', 'ISSUE', 'ASSUMPTION', 'DEPENDENCY', 'CHANGE', 'DECISION']);
const SEV_OPTIONS = new Set(['CRITICAL', 'HIGH', 'MED', 'LOW']);

describe('PROJECT_TYPES', () => {
  it('includes a blank "not set" option plus seven real archetypes', () => {
    expect(PROJECT_TYPES[0].id).toBe('');
    expect(PROJECT_TYPES.length).toBe(8);
  });
});

describe('getPlaybook', () => {
  it('returns null for an unset or unrecognized project type, never throws', () => {
    expect(getPlaybook('')).toBeNull();
    expect(getPlaybook('not-a-real-type')).toBeNull();
    expect(getPlaybook(undefined)).toBeNull();
  });

  it('every real archetype has program demand plus at least one seed item, all schema-valid', () => {
    PROJECT_TYPES.filter(p => p.id).forEach(p => {
      const playbook = getPlaybook(p.id);
      expect(playbook, `missing playbook for ${p.id}`).toBeTruthy();
      expect(playbook.programDemand.length).toBeGreaterThan(0);
      expect(playbook.items.length).toBeGreaterThan(0);
      playbook.items.forEach(item => {
        expect(RAID_TYPE_OPTIONS.has(item.type), `bad type "${item.type}" in ${p.id}`).toBe(true);
        expect(SEV_OPTIONS.has(item.severity), `bad severity "${item.severity}" in ${p.id}`).toBe(true);
        expect(item.description.length).toBeGreaterThan(0);
        expect(item.mitigation.length).toBeGreaterThan(0);
        expect(item.owner.length).toBeGreaterThan(0);
      });
    });
  });

  it('item shape is a direct drop-in for customRaidEntries (no id/addedAt yet)', () => {
    const item = getPlaybook('cloud-migration').items[0];
    expect(item).not.toHaveProperty('id');
    expect(item).not.toHaveProperty('addedAt');
    expect(item).toHaveProperty('status');
  });
});
