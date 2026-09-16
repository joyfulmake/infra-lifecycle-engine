// App Development domain catalog — sprint-based web/mobile delivery:
// discovery through release and hypercare, per DOMAIN_EXPANSION_ROADMAP.md
// Phase 4. UUM "type" is repurposed here as the delivery event type
// (migration=major release, upgrade=framework upgrade, update=patch).

export const incidents = [
  { code: 'ad_inc_1', grp: 'Production', short: 'BUG-P1', txt: 'BUG-P1: Checkout flow returning 500 errors for a subset of users', layers: ['app'] },
  { code: 'ad_inc_2', grp: 'Production', short: 'BUG-P2', txt: 'BUG-P2: Data regression — order totals miscalculated after last deploy', layers: ['app', 'db'] },
  { code: 'ad_inc_3', grp: 'Auth', short: 'BUG-AUTH', txt: 'BUG-AUTH: OAuth provider outage blocking all sign-ins', layers: ['app', 'network'] },
  { code: 'ad_inc_4', grp: 'Third-Party', short: 'BUG-3P', txt: 'BUG-3P: Third-party payment API degraded — elevated timeout rate', layers: ['app', 'network'] },
  { code: 'ad_inc_5', grp: 'Performance', short: 'BUG-PERF', txt: 'BUG-PERF: p95 page load regression after latest release', layers: ['app'] },
  { code: 'ad_inc_6', grp: 'Security', short: 'BUG-SEC', txt: 'BUG-SEC: Dependency scan flags critical CVE in a production npm package', layers: ['app', 'security'] },
  { code: 'ad_inc_7', grp: 'Mobile', short: 'BUG-MOB', txt: 'BUG-MOB: iOS crash spike after app store release (crash-free rate below threshold)', layers: ['app'] },
  { code: 'ad_inc_8', grp: 'Accessibility', short: 'BUG-A11Y', txt: 'BUG-A11Y: Screen-reader navigation broken on checkout form (WCAG failure)', layers: ['app'] },
];

export const fixes = {
  ad_inc_1: 'Roll back offending deploy or hotfix null-check in checkout handler.',
  ad_inc_2: 'Roll back calculation change; backfill affected order totals.',
  ad_inc_3: 'Enable fallback auth provider; monitor upstream status page.',
  ad_inc_4: 'Enable circuit breaker/retry with backoff; notify payment provider.',
  ad_inc_5: 'Profile and revert or optimize the regressing change (bundle size, query, render).',
  ad_inc_6: 'Patch or pin dependency to fixed version; redeploy.',
  ad_inc_7: 'Ship hotfix build; if severe, halt rollout via phased release control.',
  ad_inc_8: 'Fix ARIA labeling / focus order; re-run axe-core audit.',
};

export const incidentFixTasks = {
  ad_inc_1: [
    { role: 'On-Call Eng', name: 'Triage error logs/APM trace for checkout 500s', dep: 'P1 alert fired', validate: 'Root cause isolated to specific code path or dependency' },
    { role: 'On-Call Eng', name: 'Roll back or hotfix the offending change', dep: 'Root cause isolated', validate: 'Error rate returns to baseline; checkout flow verified end-to-end' },
  ],
  ad_inc_2: [
    { role: 'On-Call Eng', name: 'Identify deploy that introduced calculation regression', dep: 'Data regression reported', validate: 'Offending commit/deploy identified' },
    { role: 'Backend Eng', name: 'Roll back and backfill affected order totals', dep: 'Offending deploy identified', validate: 'Affected orders corrected; finance confirms totals match' },
  ],
  ad_inc_3: [
    { role: 'On-Call Eng', name: 'Confirm OAuth provider outage via status page / direct test', dep: 'Sign-in failures reported', validate: 'Outage confirmed as upstream, not app-side' },
    { role: 'On-Call Eng', name: 'Enable fallback auth path if available; communicate to users', dep: 'Outage confirmed', validate: 'Sign-in success rate recovers or fallback active' },
  ],
  ad_inc_4: [
    { role: 'Backend Eng', name: 'Confirm payment API degradation via provider status + internal metrics', dep: 'Elevated timeout rate reported', validate: 'Degradation confirmed as third-party' },
    { role: 'Backend Eng', name: 'Enable circuit breaker/retry with backoff', dep: 'Degradation confirmed', validate: 'Timeout error rate reduced; checkout success rate stabilizes' },
  ],
  ad_inc_5: [
    { role: 'Frontend Eng', name: 'Profile p95 regression using RUM/APM data', dep: 'Performance alert fired', validate: 'Regressing resource/query/render path identified' },
    { role: 'Frontend Eng', name: 'Revert or optimize the regressing change', dep: 'Regressing path identified', validate: 'p95 back within SLA' },
  ],
  ad_inc_6: [
    { role: 'Security Eng', name: 'Confirm CVE applicability and exploitability in production context', dep: 'Dependency scan alert fired', validate: 'CVE impact assessed as applicable/exploitable or not' },
    { role: 'Backend Eng', name: 'Patch or pin dependency to fixed version, redeploy', dep: 'CVE confirmed applicable', validate: 'Scan re-run shows CVE resolved' },
  ],
  ad_inc_7: [
    { role: 'Mobile Eng', name: 'Triage crash reports (Crashlytics/Sentry) for common stack trace', dep: 'Crash-free rate alert fired', validate: 'Dominant crash cause identified' },
    { role: 'Mobile Eng', name: 'Ship hotfix build or halt phased rollout', dep: 'Crash cause identified', validate: 'Crash-free rate recovers above threshold' },
  ],
  ad_inc_8: [
    { role: 'Frontend Eng', name: 'Reproduce with screen reader and run axe-core audit', dep: 'Accessibility issue reported', validate: 'Specific WCAG failure(s) documented' },
    { role: 'Frontend Eng', name: 'Fix ARIA labeling / focus order', dep: 'WCAG failure documented', validate: 'Re-audit passes; manual screen-reader test confirms fix' },
  ],
};

export const uumItems = [
  { code: 'ad_uum_1', grp: 'Release', short: 'REL-001', txt: 'REL-001: Major version release — new feature set behind flag rollout', layers: ['app'], type: 'migration' },
  { code: 'ad_uum_2', grp: 'Framework', short: 'FWK-001', txt: 'FWK-001: Frontend framework major version upgrade (e.g. React 18 to 19)', layers: ['app'], type: 'upgrade' },
  { code: 'ad_uum_3', grp: 'Framework', short: 'FWK-002', txt: 'FWK-002: Backend framework major version upgrade (e.g. Spring Boot 2 to 3, .NET 6 to 8)', layers: ['app'], type: 'upgrade' },
  { code: 'ad_uum_4', grp: 'Data', short: 'DAT-001', txt: 'DAT-001: Database schema migration with backward-compatible rollout', layers: ['db'], type: 'migration' },
  { code: 'ad_uum_5', grp: 'API', short: 'API-001', txt: 'API-001: API version deprecation and client migration', layers: ['app'], type: 'update' },
  { code: 'ad_uum_6', grp: 'Mobile', short: 'MOB-001', txt: 'MOB-001: Mobile app store submission (new major version)', layers: ['app'], type: 'migration' },
  { code: 'ad_uum_7', grp: 'Security', short: 'SEC-001', txt: 'SEC-001: SAST/DAST security scan remediation before release', layers: ['app', 'security'], type: 'update' },
  { code: 'ad_uum_8', grp: 'Quality', short: 'QA-001', txt: 'QA-001: Accessibility audit and WCAG 2.2 AA remediation pass', layers: ['app'], type: 'update' },
];

export const uumTasks = {
  ad_uum_1: [
    { role: 'Product Manager', name: 'Finalize scope and acceptance criteria for release', dep: 'Discovery and backlog grooming complete', validate: 'Scope locked; acceptance criteria signed off', window: 'Working hours', est_hours: 6 },
    { role: 'Backend Eng', name: 'Implement API contract (OpenAPI spec) for new endpoints', dep: 'Scope locked', validate: 'API contract reviewed and approved', window: 'Working hours', est_hours: 16 },
    { role: 'Frontend Eng', name: 'Build feature behind flag; unit tests at 80%+ coverage', dep: 'API contract available', validate: 'Feature complete behind flag; coverage threshold met', window: 'Working hours', est_hours: 32 },
    { role: 'QA Eng', name: 'Run integration and regression test suite', dep: 'Feature complete', validate: 'Integration suite passes; no regression in existing flows', window: 'Working hours', est_hours: 12 },
    { role: 'Release Manager', name: 'Progressive flag rollout (canary → 50% → 100%)', dep: 'QA sign-off', validate: 'Each rollout stage meets error-rate/latency guardrails', window: 'Working hours', est_hours: 8 },
  ],
  ad_uum_2: [
    { role: 'Frontend Eng', name: 'Review breaking-changes list for target framework version', dep: 'Upgrade scheduled', validate: 'Breaking changes inventoried against codebase' },
    { role: 'Frontend Eng', name: 'Upgrade dependencies and fix breaking changes', dep: 'Breaking changes inventoried', validate: 'Build passes; no console warnings/errors introduced' },
    { role: 'QA Eng', name: 'Run full regression suite on upgraded build', dep: 'Upgrade complete', validate: 'Regression suite passes on new framework version' },
  ],
  ad_uum_3: [
    { role: 'Backend Eng', name: 'Review breaking-changes and deprecated API list for target version', dep: 'Upgrade scheduled', validate: 'Breaking changes inventoried' },
    { role: 'Backend Eng', name: 'Upgrade and fix breaking changes, update CI pipeline if needed', dep: 'Breaking changes inventoried', validate: 'Build and CI pipeline pass on target version' },
    { role: 'QA Eng', name: 'Run load test to confirm no performance regression', dep: 'Upgrade complete', validate: 'Load test results within baseline tolerance' },
  ],
  ad_uum_4: [
    { role: 'Backend Eng', name: 'Design backward-compatible migration (expand-contract pattern)', dep: 'Schema change requirement defined', validate: 'Migration plan reviewed — old and new code paths both supported during rollout' },
    { role: 'Backend Eng', name: 'Run migration in production with dual-write/dual-read verification', dep: 'Migration plan approved', validate: 'Dual-write verified consistent before cutover' },
    { role: 'Backend Eng', name: 'Remove legacy path after bake period', dep: 'New path stable for bake period', validate: 'Legacy path removed; no errors post-removal' },
  ],
  ad_uum_5: [
    { role: 'Backend Eng', name: 'Publish deprecation notice and sunset timeline for old API version', dep: 'New API version stable in production', validate: 'Deprecation notice published to all known consumers' },
    { role: 'Backend Eng', name: 'Track consumer migration and follow up on stragglers', dep: 'Deprecation notice published', validate: '95%+ of traffic migrated to new version' },
    { role: 'Backend Eng', name: 'Sunset old API version', dep: 'Migration threshold met', validate: 'Old version returns deprecation error; no critical consumer breaks' },
  ],
  ad_uum_6: [
    { role: 'Mobile Eng', name: 'Complete app store review checklist (metadata, screenshots, privacy labels)', dep: 'Release candidate build passes QA', validate: 'Checklist complete; build uploaded to store console' },
    { role: 'Mobile Eng', name: 'Submit for app store review', dep: 'Checklist complete', validate: 'Build approved by app store review' },
    { role: 'Mobile Eng', name: 'Phased rollout via store staged release', dep: 'Store approval received', validate: 'Crash-free rate and adoption tracked through each rollout stage' },
  ],
  ad_uum_7: [
    { role: 'Security Eng', name: 'Run SAST/DAST scan against release candidate', dep: 'Release candidate build available', validate: 'Scan report generated with severity breakdown' },
    { role: 'Backend Eng', name: 'Remediate critical/high findings', dep: 'Scan report reviewed', validate: 'Re-scan shows zero critical/high findings' },
  ],
  ad_uum_8: [
    { role: 'Frontend Eng', name: 'Run automated accessibility audit (axe-core) across key flows', dep: 'Flows identified for audit', validate: 'Audit report generated' },
    { role: 'Frontend Eng', name: 'Remediate WCAG 2.2 AA findings', dep: 'Audit report reviewed', validate: 'Re-audit passes; manual screen-reader spot-check confirms' },
  ],
};

export const designSections = [
  { key: 'requirements', label: 'Requirements', owner: 'Product Manager', fields: ['functional_reqs', 'nfr_performance', 'nfr_security', 'nfr_scalability', 'notes'] },
  { key: 'architecture', label: 'Architecture', owner: 'Backend Eng', fields: ['api_design', 'data_model', 'integration_design', 'hosting_target', 'notes'] },
  { key: 'frontend', label: 'Frontend', owner: 'Frontend Eng', fields: ['framework', 'state_mgmt', 'design_system', 'browser_support', 'notes'] },
  { key: 'quality', label: 'Test Strategy', owner: 'QA Eng', fields: ['unit_coverage_target', 'integration_strategy', 'load_test_tool', 'accessibility_target', 'notes'] },
  { key: 'release', label: 'Release Strategy', owner: 'Release Manager', fields: ['deployment_model', 'flag_strategy', 'rollback_plan', 'cdn_config', 'notes'] },
  { key: 'compliance', label: 'Compliance', owner: 'Security Eng', fields: ['data_privacy_framework', 'accessibility_standard', 'security_scan_gate', 'notes'] },
];

export const fieldLabels = {
  functional_reqs: 'Functional Requirements', nfr_performance: 'NFR — Performance', nfr_security: 'NFR — Security', nfr_scalability: 'NFR — Scalability',
  api_design: 'API Design (OpenAPI)', data_model: 'Data Model', integration_design: 'Integration Design', hosting_target: 'Hosting Target',
  framework: 'Frontend Framework', state_mgmt: 'State Management', design_system: 'Design System', browser_support: 'Browser Support Matrix',
  unit_coverage_target: 'Unit Test Coverage Target', integration_strategy: 'Integration Test Strategy', load_test_tool: 'Load Test Tool', accessibility_target: 'Accessibility Target',
  deployment_model: 'Deployment Model', flag_strategy: 'Feature Flag Strategy', rollback_plan: 'Rollback Plan', cdn_config: 'CDN Configuration',
  data_privacy_framework: 'Data Privacy Framework (GDPR/CCPA)', accessibility_standard: 'Accessibility Standard (WCAG)', security_scan_gate: 'Security Scan Gate (SAST/DAST)',
  notes: 'Notes / Comments',
};

export const axisOptions = [
  ['Web App', 'Mobile App (iOS)', 'Mobile App (Android)', 'Cross-Platform Mobile', 'API / Backend Service'],
  ['React 19', 'React 18', 'Vue 3', 'Angular 18', 'Next.js', 'Swift/SwiftUI', 'Kotlin/Jetpack Compose', 'React Native', 'Flutter'],
  ['Node.js 22 LTS', 'Spring Boot 3.x', '.NET 8', 'Python/FastAPI', 'Ruby on Rails', 'Go'],
  ['Cloudflare Pages', 'Vercel', 'AWS (ECS/Lambda)', 'Azure App Service', 'App Store / Play Store', 'On-Prem'],
];
