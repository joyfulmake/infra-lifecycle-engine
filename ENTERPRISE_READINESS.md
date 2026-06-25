# Enterprise Readiness Checklist — OpsManifest

Honest audit as of 2026-06-21. Based on actual code, not marketing copy.

---

## Legend

- `[DONE]` — implemented and working in production
- `[PARTIAL]` — code exists but not live / not complete
- `[GAP]` — not implemented; required for enterprise procurement

---

## 1. Identity & Access Management

| Item | Status | Notes |
|---|---|---|
| Email + password auth | `[DONE]` | Firebase Auth — `src/lib/auth.js` |
| Guest / no-login build | `[DONE]` | Guests can build; blocked only on save/export |
| Multi-tier plans (Starter / Pro / Team / Enterprise) | `[DONE]` | 5-tier system, `PLANS` in `auth.js` |
| Feature gates per tier | `[DONE]` | `canUseFeature()` / `FEATURE_TIER` map |
| Role-based access within a build | `[DONE]` | 20-role RACI, PM/backup email gating, section-level locks |
| Seeded admin accounts | `[DONE]` | `SEEDED_ACCOUNTS` override in `auth.js` |
| Promo / trial keys | `[DONE]` | Key → plan + days; `PROMO_CODES` map in `auth.js` |
| Password reset | `[PARTIAL]` | Firebase has it; no "Forgot password?" UI exposed yet |
| MFA / 2FA (TOTP, SMS) | `[GAP]` | Not implemented; Firebase supports it but not wired |
| SSO — SAML 2.0 | `[GAP]` | Listed as Enterprise feature in UI copy; no code |
| SSO — OIDC / OAuth 2.0 (Okta, Azure AD, Google Workspace) | `[GAP]` | Not implemented |
| LDAP / Active Directory sync | `[GAP]` | Not implemented |
| Session timeout / auto-logout | `[GAP]` | No idle timeout; sessions persist until sign-out |
| Concurrent session control | `[GAP]` | No detection or blocking of parallel sessions |
| Account lockout after failed attempts | `[GAP]` | Firebase default; no custom policy configured |
| Admin impersonation (support access) | `[GAP]` | No support-mode login |

---

## 2. Multi-Tenancy & Organisations

| Item | Status | Notes |
|---|---|---|
| Organisation workspace | `[DONE]` | `orgDb.js` — Firestore `/organisations/{id}` collection |
| Invite by code | `[DONE]` | `joinOrgByCode()` in `orgDb.js` |
| Team build sharing | `[DONE]` | `_shared: true` flag; org wins deduplication |
| Team size cap per plan | `[DONE]` | `teamSize: 8` (Team), `Infinity` (Enterprise) |
| Per-org admin role | `[PARTIAL]` | `ownerEmail` field exists; no admin UI to manage members |
| Org member management UI | `[GAP]` | No invite/remove member interface |
| Admin dashboard (user/org/billing overview) | `[GAP]` | Not built |
| Custom domain / subdomain per org | `[GAP]` | One domain: `opsmanifest.pages.dev` for all orgs |
| White-label / custom branding | `[GAP]` | No logo/colour theming per org |
| On-premises deployment bundle | `[GAP]` | Mentioned in pricing copy; not built |
| Data residency selection (EU / AU / US) | `[GAP]` | Cloudflare Pages + Firestore; no regional choice |
| Tenant isolation audit | `[GAP]` | Firestore rules are correct but no formal pen-test |

---

## 3. Billing & Payments

| Item | Status | Notes |
|---|---|---|
| Stripe checkout + webhook | `[PARTIAL]` | `workers/stripe-worker.js` complete; `STRIPE_CONFIGURED = false` |
| Stripe customer portal (cancel/upgrade/invoices) | `[PARTIAL]` | Code in `stripe.js`; not live |
| Razorpay (INR / Indian market) | `[PARTIAL]` | `workers/razorpay-worker.js` complete; not deployed |
| 7-day free trial | `[PARTIAL]` | Wired in Stripe checkout params; not live |
| Annual billing discount | `[PARTIAL]` | Price IDs defined; not live |
| Usage-based billing | `[GAP]` | Fixed seat pricing only |
| Invoice / receipt delivery | `[GAP]` | Stripe portal handles it but not live yet |
| Purchase order / enterprise contract flow | `[GAP]` | No offline/PO billing path |

---

## 4. Security

| Item | Status | Notes |
|---|---|---|
| HTTPS everywhere | `[DONE]` | Cloudflare Pages enforces TLS 1.2+ |
| Content Security Policy | `[DONE]` | `public/_headers` — locked-down `connect-src`, no `unsafe-eval` |
| Firebase Firestore security rules | `[DONE]` | Email-scoped; users can only read/write own data |
| No API keys in browser bundle | `[DONE]` | All LLM / TTS / Stripe calls go via CF Worker proxy |
| XSS: React escapes all output | `[DONE]` | No `dangerouslySetInnerHTML` usage |
| Worker CORS | `[DONE]` | `CORS` object in `ai-worker.js` / `razorpay-worker.js` |
| Worker authentication (caller identity) | `[GAP]` | Worker routes have no auth token; anyone with the URL can call |
| Worker rate limiting | `[GAP]` | No per-IP or per-user rate limit on any worker route |
| Worker request size limits | `[GAP]` | CF default only; no explicit body-size cap |
| Secrets scanning in CI | `[GAP]` | No `gitleaks` / `trufflehog` in GitHub Actions |
| Dependency vulnerability scanning | `[GAP]` | No `npm audit` in CI pipeline |
| Penetration test / VAPT | `[GAP]` | Not done |
| SOC 2 Type II | `[GAP]` | Not assessed |
| ISO 27001 | `[GAP]` | Not assessed |

---

## 5. Data & Privacy

| Item | Status | Notes |
|---|---|---|
| Privacy policy | `[DONE]` | `public/privacy.html` at `opsmanifest.pages.dev/privacy.html` |
| Local-first data (IndexedDB) | `[DONE]` | Dexie — builds stored in browser, no server required |
| Cloud sync (Pro+) | `[DONE]` | Firestore bidirectional sync; email-scoped |
| GDPR — right to erasure | `[GAP]` | No user-triggered data deletion endpoint |
| GDPR — data portability export | `[GAP]` | Excel export is per-build, not a full account data dump |
| Data Processing Agreement (DPA) | `[GAP]` | No DPA template for enterprise customers |
| Terms of Service | `[GAP]` | Not published |
| Cookie consent / banner | `[GAP]` | No cookies used but no explicit disclosure |
| Audit log export (CSV / JSON) | `[GAP]` | Audit log exists in state (500 entries) but no export UI |
| Backup / disaster recovery for Firestore | `[PARTIAL]` | CF manages Firestore; no custom backup schedule |

---

## 6. Hosting & Domain

| Item | Status | Notes |
|---|---|---|
| Hosting | `[DONE]` | Cloudflare Pages — `opsmanifest.pages.dev` |
| CDN / global edge | `[DONE]` | CF Pages serves from 300+ PoPs |
| SPA fallback routing | `[DONE]` | `_redirects` + `404.html` copy |
| Cache-busting headers | `[DONE]` | `Cache-Control: no-cache` on HTML; assets use hash filenames |
| Custom domain (`opsmanifest.com` or similar) | `[GAP]` | Not configured; on `pages.dev` subdomain |
| Custom domain SSL cert | `[GAP]` | Would be automatic via CF once domain is added |
| `www` → apex redirect | `[GAP]` | Not configured |
| Email domain (`@opsmanifest.com`) for notifications | `[GAP]` | No transactional email domain set up |

**What it takes to add a custom domain:**
1. Register `opsmanifest.com` (or chosen name) — ~$15/yr
2. CF Pages → Custom domains → add domain → update registrar NS to Cloudflare
3. CF auto-provisions SSL — zero additional config
4. Update `public/manifest.json` `start_url` and `id` to the new domain
5. Update Firebase Auth authorized domains
6. Update Firestore CORS (if needed)
7. Rebuild and redeploy

---

## 7. Integrations & API

| Item | Status | Notes |
|---|---|---|
| endoflife.date live API | `[DONE]` | CMDB tab, stack live check |
| Groq LLM via CF Worker | `[DONE]` | `workers/ai-worker.js` |
| Azure TTS / Cartesia / ElevenLabs via Worker | `[DONE]` | TTS queue in OrchestratorPanel |
| Firebase Firestore | `[DONE]` | Cloud sync |
| Stripe | `[PARTIAL]` | Worker code complete; not live |
| Razorpay | `[PARTIAL]` | Worker code complete; not live |
| Public REST API for external integrations | `[GAP]` | No API — all state is browser-local |
| Webhooks (on build save / CAB / RTM events) | `[GAP]` | Not implemented |
| Slack / Teams notifications | `[GAP]` | Not implemented |
| Email notifications (build milestones, CAB decisions) | `[GAP]` | No SMTP/SendGrid integration |
| ServiceNow / Jira integration | `[GAP]` | Not implemented |
| CMDB write-back (ServiceNow, BMC Helix) | `[GAP]` | Not implemented |
| Embeddable widget / iframe SDK | `[GAP]` | Not implemented |

---

## 8. Observability & Reliability

| Item | Status | Notes |
|---|---|---|
| Error boundary (React) | `[DONE]` | Root error boundary in `main.jsx` |
| SW offline fallback | `[DONE]` | `sw.js` branded error page |
| Global `unhandledrejection` handler | `[DONE]` | `main.jsx` |
| Health check endpoint | `[DONE]` | `GET /health` on CF Worker |
| Frontend error tracking (Sentry / Datadog) | `[GAP]` | Not integrated |
| Worker error tracking | `[GAP]` | CF Analytics only; no structured error logs |
| Uptime monitoring | `[GAP]` | No external monitor (UptimeRobot, BetterUptime, etc.) |
| Performance monitoring (Core Web Vitals) | `[GAP]` | Not tracked |
| Alerting on errors / downtime | `[GAP]` | Not configured |

---

## 9. Accessibility & Internationalisation

| Item | Status | Notes |
|---|---|---|
| Semantic HTML (headings, buttons, labels) | `[PARTIAL]` | Mostly correct; not formally audited |
| Keyboard navigation | `[PARTIAL]` | Arrow / Enter / Esc on suggest inputs; modal traps not verified |
| Screen reader (ARIA labels) | `[GAP]` | No systematic `aria-label` / `role` attribute coverage |
| WCAG 2.1 AA compliance | `[GAP]` | Not assessed |
| Internationalisation (i18n) | `[GAP]` | English only; no translation layer |
| RTL layout support | `[GAP]` | Not implemented |
| High contrast / reduced-motion modes | `[GAP]` | Not implemented |

---

## 10. Distribution

| Item | Status | Notes |
|---|---|---|
| Web app (PWA) | `[DONE]` | Live at `opsmanifest.pages.dev` |
| Microsoft Store (MSIX) | `[PARTIAL]` | v2.0.0.0 submitted; pending certification |
| Meta Quest | `[PARTIAL]` | Planned; PWABuilder step documented |
| iOS / Android (TWA / PWA) | `[GAP]` | Not submitted to App Store / Play Store |
| macOS (Electron or PWA) | `[GAP]` | Not packaged |

---

## Honest Summary

**Ready for individual and small-team use** — the workflow engine, AI scan, OpsMentor, Gantt, RTM, CAB, and Closure flow are production-quality.

**Not ready for enterprise procurement** without:
1. SSO (SAML/OIDC) — most enterprise IT policies require it
2. Custom domain — `pages.dev` will not pass corporate URL whitelisting
3. Worker authentication + rate limiting — current worker has open routes
4. MFA — required by most enterprise security baselines
5. GDPR tooling — right to erasure and DPA are legal requirements in EU
6. Admin dashboard — no way to manage an organisation's users without going direct to Firebase
7. Billing live — Stripe code is complete but not activated

**Fastest path to enterprise-ready:** custom domain (1 day) → Stripe live (1 day) → worker auth token (1 day) → Firebase MFA toggle (2 days) → SSO via Firebase Auth SAML provider (3–5 days). The auth model (`authUser.email`) already drives all permission checks — SSO just changes the login provider, not the permission model.
