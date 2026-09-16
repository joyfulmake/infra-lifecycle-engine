// CIT — Component Integration Tests: inferred compliance matrix (Phase 6)

import { describe, it, expect } from 'vitest';
import { matchComplianceRules, computeComplianceStatus, COMPLIANCE_RULES } from '../lib/complianceMatrix.js';

function stateWith({ country = '', domain = '', sections = {}, checklist = {} } = {}) {
  const sysDesignData = {};
  Object.entries(sections).forEach(([key, hasValue]) => {
    sysDesignData[key] = hasValue ? { some_field: 'set' } : { some_field: '' };
  });
  return { requirements: { country, domain }, sysDesignData, complianceChecklist: checklist };
}

describe('matchComplianceRules', () => {
  it('returns nothing until both country and domain are set', () => {
    expect(matchComplianceRules(stateWith({ country: 'US' }))).toEqual([]);
    expect(matchComplianceRules(stateWith({ domain: 'Banking' }))).toEqual([]);
    expect(matchComplianceRules(stateWith({}))).toEqual([]);
  });

  it('matches an exact country/domain/techCategory rule when that design section is in scope', () => {
    const state = stateWith({ country: 'US', domain: 'Banking', sections: { network: true } });
    const matched = matchComplianceRules(state);
    expect(matched.some(r => r.id === 'us-pcidss-banking-network')).toBe(true);
  });

  it('does not match a techCategory-specific rule when that section is empty', () => {
    const state = stateWith({ country: 'US', domain: 'Banking', sections: { db: true } }); // network untouched
    const matched = matchComplianceRules(state);
    expect(matched.some(r => r.id === 'us-pcidss-banking-network')).toBe(false);
  });

  it('matches ANY-scoped rules regardless of which sections are filled', () => {
    const state = stateWith({ country: 'US', domain: 'Healthcare', sections: { db: true } });
    const matched = matchComplianceRules(state);
    expect(matched.some(r => r.id === 'us-hipaa-healthcare')).toBe(true); // techCategory: ANY
  });

  it('a completely blank design still surfaces domain-level ANY rules, not silently nothing', () => {
    const state = stateWith({ country: 'US', domain: 'Healthcare', sections: {} });
    const matched = matchComplianceRules(state);
    expect(matched.some(r => r.id === 'us-hipaa-healthcare')).toBe(true);
  });

  it('every rule id is unique and every rule has the required fields', () => {
    const ids = COMPLIANCE_RULES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    COMPLIANCE_RULES.forEach(r => {
      expect(typeof r.framework).toBe('string');
      expect(typeof r.requirement).toBe('string');
      expect(typeof r.mandatory).toBe('boolean');
    });
  });
});

describe('computeComplianceStatus', () => {
  it('reports mandatoryPending for matched mandatory rules left at pending', () => {
    const state = stateWith({ country: 'US', domain: 'Banking', sections: { network: true } });
    const { mandatoryPending, allMandatoryCleared } = computeComplianceStatus(state);
    expect(mandatoryPending.some(r => r.id === 'us-pcidss-banking-network')).toBe(true);
    expect(allMandatoryCleared).toBe(false);
  });

  it('clears once every mandatory matched rule is set to a non-pending status', () => {
    const state = stateWith({
      country: 'US', domain: 'Banking', sections: { network: true },
      checklist: { 'us-pcidss-banking-network': 'agreed', 'any-pcidss-banking-security': 'mitigated' },
    });
    const { allMandatoryCleared } = computeComplianceStatus(state);
    expect(allMandatoryCleared).toBe(true);
  });

  it('non-mandatory pending items never block allMandatoryCleared', () => {
    const state = stateWith({ country: 'ANY', domain: 'ANY', sections: { unix: true, security: true } });
    const { matched, allMandatoryCleared } = computeComplianceStatus(state);
    // any-cis-unix and any-nist-security are both non-mandatory
    expect(matched.every(r => !r.mandatory)).toBe(true);
    expect(allMandatoryCleared).toBe(true);
  });
});
