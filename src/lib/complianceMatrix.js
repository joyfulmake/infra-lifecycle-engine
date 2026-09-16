// Phase 6 — Inferred Compliance Matrix. Given a project's country, domain,
// and which System Design sections are actually in scope (non-empty), infer
// which regulatory obligations likely apply. Illustrative regulatory
// mapping, not certified — review with compliance/legal before relying on
// this for a real audit gate. techCategory values are exactly the
// DESIGN_SECTIONS keys from useStore.js (network/storage/backup/unix/db/web/
// app/security) — no invented product taxonomy, since that's already the
// real, grounded scope signal this app tracks per build.

export const COUNTRY_OPTIONS = [
  { id: '', label: '— Not set —' },
  { id: 'ANY', label: 'Global / Multiple' },
  { id: 'US', label: 'United States' },
  { id: 'EU', label: 'European Union' },
  { id: 'UK', label: 'United Kingdom' },
  { id: 'India', label: 'India' },
  { id: 'Australia', label: 'Australia' },
  { id: 'Singapore', label: 'Singapore' },
];

export const DOMAIN_OPTIONS = [
  { id: '', label: '— Not set —' },
  { id: 'ANY', label: 'General / Other' },
  { id: 'Banking', label: 'Banking / Finance' },
  { id: 'Healthcare', label: 'Healthcare' },
  { id: 'Government', label: 'Government / Public Sector' },
  { id: 'Retail', label: 'Retail / E-commerce' },
  { id: 'Telecom', label: 'Telecom' },
];

// Illustrative regulatory mapping. Not certified. Requires legal/compliance
// review before an organization relies on this for an actual audit gate.
export const COMPLIANCE_RULES = [
  { id: 'in-dpdp-network', country: 'India', domain: 'ANY', techCategory: 'network', framework: 'DPDP Act', requirement: 'Confirm data residency and cross-border transfer basis for network paths carrying personal data', mandatory: true },
  { id: 'eu-gdpr-db', country: 'EU', domain: 'ANY', techCategory: 'db', framework: 'GDPR', requirement: 'Confirm lawful basis and retention policy for personal data stored in-scope databases', mandatory: true },
  { id: 'eu-gdpr-backup', country: 'EU', domain: 'ANY', techCategory: 'backup', framework: 'GDPR', requirement: 'Confirm backup copies honor the same retention/erasure obligations as primary data', mandatory: true },
  { id: 'us-hipaa-healthcare', country: 'US', domain: 'Healthcare', techCategory: 'ANY', framework: 'HIPAA', requirement: 'Confirm PHI handling controls and Business Associate Agreement coverage', mandatory: true },
  { id: 'us-pcidss-banking-network', country: 'US', domain: 'Banking', techCategory: 'network', framework: 'PCI-DSS', requirement: 'Confirm cardholder data network segmentation meets current PCI-DSS scope reduction requirements', mandatory: true },
  { id: 'any-pcidss-banking-security', country: 'ANY', domain: 'Banking', techCategory: 'security', framework: 'PCI-DSS', requirement: 'Confirm cipher suites, key management, and access logging meet PCI-DSS v4 requirements', mandatory: true },
  { id: 'uk-dpa-db', country: 'UK', domain: 'ANY', techCategory: 'db', framework: 'UK GDPR / DPA 2018', requirement: 'Confirm lawful basis and retention policy for personal data stored in-scope databases', mandatory: true },
  { id: 'any-nist-security', country: 'ANY', domain: 'ANY', techCategory: 'security', framework: 'NIST', requirement: 'Confirm cryptographic controls align with current NIST guidance for the technology in scope', mandatory: false },
  { id: 'any-cis-unix', country: 'ANY', domain: 'ANY', techCategory: 'unix', framework: 'CIS Benchmarks', requirement: 'Confirm OS hardening baseline applied per current CIS benchmark for the platform in scope', mandatory: false },
  { id: 'gov-any-security', country: 'ANY', domain: 'Government', techCategory: 'security', framework: 'Agency-specific ATO', requirement: 'Confirm Authority to Operate (ATO) or equivalent accreditation covers this change', mandatory: true },
  { id: 'telecom-any-network', country: 'ANY', domain: 'Telecom', techCategory: 'network', framework: 'Lawful Intercept / Local Telecom Regs', requirement: 'Confirm lawful intercept and local telecom regulatory obligations are unaffected by this change', mandatory: true },
  { id: 'retail-us-pcidss-app', country: 'US', domain: 'Retail', techCategory: 'app', framework: 'PCI-DSS', requirement: 'Confirm application-layer cardholder data handling meets PCI-DSS v4 requirements', mandatory: true },
];

function inScopeTechCategories(sysDesignData) {
  const cats = new Set();
  Object.entries(sysDesignData || {}).forEach(([sectionKey, fields]) => {
    const hasValue = Object.values(fields || {}).some(v => (v || '').toString().trim().length > 0);
    if (hasValue) cats.add(sectionKey);
  });
  return cats;
}

function matches(scope, value) {
  return scope === 'ANY' || scope === value;
}

// Unrecognized/empty scope never silently skips compliance — only rules
// with techCategory "ANY" apply to it, so a build with a completely blank
// design still surfaces domain/country-level obligations (e.g. HIPAA) if
// applicable, rather than looking falsely clean.
export function matchComplianceRules(state) {
  const country = state.requirements?.country || '';
  const domain = state.requirements?.domain || '';
  if (!country || !domain) return [];

  const cats = inScopeTechCategories(state.sysDesignData);
  const matchedIds = new Set();
  const evalCats = cats.size > 0 ? cats : new Set(['__none__']);

  COMPLIANCE_RULES.forEach(rule => {
    if (!matches(rule.country, country) || !matches(rule.domain, domain)) return;
    if (rule.techCategory === 'ANY' || [...evalCats].some(c => matches(rule.techCategory, c))) {
      matchedIds.add(rule.id);
    }
  });

  return COMPLIANCE_RULES.filter(r => matchedIds.has(r.id));
}

export function computeComplianceStatus(state) {
  const matched = matchComplianceRules(state);
  const checklist = state.complianceChecklist || {};
  const mandatoryPending = matched.filter(r => r.mandatory && (checklist[r.id] || 'pending') === 'pending');
  return { matched, mandatoryPending, allMandatoryCleared: mandatoryPending.length === 0 };
}
