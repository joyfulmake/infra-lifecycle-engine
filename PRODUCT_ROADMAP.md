# OpsManifest — Product Roadmap & Requirements Traceability

## Requirements Traceability Matrix

Maps every shipped requirement to the version that delivered it.
Status: `SHIPPED` | `PARTIAL` | `PLANNED` | `BACKLOG`

---

### Core Workflow Engine

| Requirement | Description | Status | Version |
|---|---|---|---|
| WF-01 | Phase 1: Hardware / OS / DB / App selection | SHIPPED | v1.0.0.0 |
| WF-02 | Phase 2: Incident + UUM injection | SHIPPED | v1.0.0.0 |
| WF-03 | CAB approval / decline workflow | SHIPPED | v1.0.0.0 |
| WF-04 | RTM sign-off gate before cutover | SHIPPED | v1.0.0.0 |
| WF-05 | Post-go-live closure checklist | SHIPPED | v1.0.0.0 |
| WF-06 | Linear phase gates (locked tabs until unlocked) | SHIPPED | v1.0.0.0 |
| WF-07 | Revision mode: unlock all tabs after CAB decline | SHIPPED | v1.1.0.0 |
| WF-08 | Always-visible 7-step sidebar roadmap | SHIPPED | v1.1.0.0 |
| WF-09 | "Next" tab badge guiding user through workflow | SHIPPED | v1.1.0.0 |
| WF-10 | Emergency change log | SHIPPED | v1.1.0.0 |

### Data & State

| Requirement | Description | Status | Version |
|---|---|---|---|
| DS-01 | Local persistence (IndexedDB via Dexie) | SHIPPED | v1.0.0.0 |
| DS-02 | Named build saves + load + delete | SHIPPED | v1.0.0.0 |
| DS-03 | "Update Build" in-place save (no rename prompt) | SHIPPED | v1.1.0.0 |
| DS-04 | Copy build | SHIPPED | v1.1.0.0 |
| DS-05 | Unsaved changes indicator (pulsing amber dot) | SHIPPED | v1.1.0.0 |
| DS-06 | Cloud sync via Firebase Firestore (Pro+) | SHIPPED | v1.1.0.0 |
| DS-07 | Multi-device restore on sign-in | SHIPPED | v1.1.0.0 |
| DS-08 | Org / Team shared build collection | SHIPPED | v1.1.0.0 |

### System Design Tab

| Requirement | Description | Status | Version |
|---|---|---|---|
| SD-01 | 8-section design form (network, storage, backup, security, DR, monitoring, compliance, deployment) | SHIPPED | v1.0.0.0 |
| SD-02 | AI Smart Scan — rule-based CVE/EOL scan | SHIPPED | v1.0.0.0 |
| SD-03 | Auto-suggestions from static DB (matchSuggestKeys) | SHIPPED | v1.0.0.0 |
| SD-04 | Context-aware suggestions (stack + scan findings) | SHIPPED | v1.1.0.0 |
| SD-05 | Tech-review field locking by role | SHIPPED | v1.1.0.0 |
| SD-06 | PM override edit mode (bypass tech-review lock) | SHIPPED | v1.1.0.0 |
| SD-07 | Role-based section access (email-matched RACI) | SHIPPED | v1.1.0.0 |
| SD-08 | Design defaults per HW/OS/DB/App combo | SHIPPED | v1.0.0.0 |

### Gantt & Scheduling

| Requirement | Description | Status | Version |
|---|---|---|---|
| GT-01 | Auto-generated task list from hw/os/db/app + incidents | SHIPPED | v1.0.0.0 |
| GT-02 | Working-hour scheduling (skip weekends) | SHIPPED | v1.0.0.0 |
| GT-03 | Change freeze / holiday / break periods | SHIPPED | v1.1.0.0 |
| GT-04 | Gantt bar chart (colour-coded by phase) | SHIPPED | v1.0.0.0 |
| GT-05 | Critical Path Method (CP badge + float indicator) | SHIPPED | v1.1.0.0 |
| GT-06 | 7-point FSM metadata per task | SHIPPED | v1.1.0.0 |
| GT-07 | Groq AI task deepening (opt-in) | SHIPPED | v1.1.0.0 |
| GT-08 | Pro+ inline task duration / dependency overrides | SHIPPED | v1.1.0.0 |
| GT-09 | Tasks-stale detection + Regenerate prompt | SHIPPED | v1.1.0.0 |
| GT-10 | Batch job migration tasks (Control-M, AutoSys, DBMS_SCHEDULER) | SHIPPED | v1.1.0.0 |

### RTM (Requirements Traceability Matrix tab)

| Requirement | Description | Status | Version |
|---|---|---|---|
| RT-01 | Auto-generated RTM rows from incidents + UUM | SHIPPED | v1.0.0.0 |
| RT-02 | PASS / FAIL / PENDING / NA / BLOCKED per row | SHIPPED | v1.0.0.0 |
| RT-03 | All PASS / All N/A bulk buttons | SHIPPED | v1.0.0.0 |
| RT-04 | QA Team Lead sign-off (role-matched) | SHIPPED | v1.1.0.0 |
| RT-05 | RTM-stale detection when incidents/design change after sign-off | SHIPPED | v1.1.0.0 |
| RT-06 | Amber pulsing dot on RTM tab when stale | SHIPPED | v1.1.0.0 |

### CMDB & EOL Intelligence

| Requirement | Description | Status | Version |
|---|---|---|---|
| CM-01 | Live EOL data from endoflife.date API (stack components) | SHIPPED | v1.1.0.0 |
| CM-02 | Live keyword search (500+ products) | SHIPPED | v1.1.0.0 |
| CM-03 | UUM Keyword Matcher (score catalog by free-text) | SHIPPED | v1.1.0.0 |
| CM-04 | EOL columns: EOS / EOL / EOSL / Security-Only / LTS / Next Milestone | SHIPPED | v1.1.0.0 |
| CM-05 | All Cycles accordion per component | SHIPPED | v1.1.0.0 |
| CM-06 | Coherence alert when live API confirms EOL stack | SHIPPED | v1.1.0.0 |
| CM-07 | EOL badge in UUM ItemList search results | SHIPPED | v1.1.0.0 |

### AI & Coherence

| Requirement | Description | Status | Version |
|---|---|---|---|
| AI-01 | Cross-tab coherence engine (12 rule-based checks) | SHIPPED | v1.1.0.0 |
| AI-02 | AgentInsights advisory panels per tab | SHIPPED | v1.1.0.0 |
| AI-03 | Groq AI task enrichment via CF Worker proxy | SHIPPED | v1.1.0.0 |
| AI-04 | Groq UUM search (AI-generated ops from free text) | SHIPPED | v1.1.0.0 |
| AI-05 | Smart keyword detection (layer, type, severity, group) | SHIPPED | v1.1.0.0 |
| AI-06 | Live EOL context fetched in parallel with catalog search | SHIPPED | v1.1.0.0 |

### Other Tabs

| Requirement | Description | Status | Version |
|---|---|---|---|
| OT-01 | Universal Cross-Stack Dependency Matrix (8 swimlanes) | SHIPPED | v1.1.0.0 |
| OT-02 | RAID log (Risks, Assumptions, Issues, Decisions) | SHIPPED | v1.0.0.0 |
| OT-03 | Infra Topology Diagram (layered SVG) | SHIPPED | v1.1.0.0 |
| OT-04 | 20-role RACI table (email-gated edit, Pro+) | SHIPPED | v1.1.0.0 |
| OT-05 | Executive Summary with KPI tiles + milestones | SHIPPED | v1.0.0.0 |

### Auth & Plans

| Requirement | Description | Status | Version |
|---|---|---|---|
| AU-01 | Guest mode — full build, no sign-in required | SHIPPED | v1.0.0.0 |
| AU-02 | Free / Professional / Team plan tiers | SHIPPED | v1.0.0.0 |
| AU-03 | Firebase Email/Password auth | SHIPPED | v1.1.0.0 |
| AU-04 | Stripe checkout + subscription (off by default) | SHIPPED | v1.1.0.0 |
| AU-05 | Stripe Customer Portal (manage billing) | SHIPPED | v1.1.0.0 |
| AU-06 | 7-day free trial on paid plans | SHIPPED | v1.1.0.0 |

### Export & Presentation

| Requirement | Description | Status | Version |
|---|---|---|---|
| EX-01 | 14-sheet styled Excel export (xlsx-js-style) | SHIPPED | v1.0.0.0 |
| EX-02 | Presentation deck (slides.html, 10 slides) | SHIPPED | v1.1.0.0 |
| EX-03 | DemoTour onboarding popup (first visit) | SHIPPED | v1.1.0.0 |
| EX-04 | Mission Intel export sheet (signals, RTM status, architecture layers, ASCII maps) + custom UUM rows on UUM sheet | SHIPPED | v1.5.0.0 |

### Platform & Distribution

| Requirement | Description | Status | Version |
|---|---|---|---|
| PL-01 | PWA (offline-capable, installable from browser) | SHIPPED | v1.0.0.0 |
| PL-02 | Netlify hosting + auto-deploy | SHIPPED | v1.0.0.0 |
| PL-03 | Microsoft Store MSIX (hosted web app) | SHIPPED | v1.2.0.0 |
| PL-04 | Meta Quest (PWABuilder submission) | PLANNED | — |
| PL-05 | Google Play Store (TWA via PWABuilder) | PLANNED | — |
| PL-06 | Apple App Store (PWABuilder → iOS wrapper) | PLANNED | — |
| PL-07 | Amazon Appstore | BACKLOG | — |
| PL-08 | Edge Add-ons (sidebar panel via edge_side_panel manifest) | BACKLOG | — |

---

## Upcoming Release Plans

_(v1.3.0.0–v1.5.0.0 were consumed by Store certification fixes — see Version Summary. Planned feature releases renumbered accordingly.)_

### v1.6.0.0 — Payments & Feedback (post-Store approval)

**Trigger:** Microsoft Store certification approved.

| # | Feature | Detail |
|---|---|---|
| 1 | **Razorpay gateway** | Parallel to Stripe for INR customers — UPI, net banking, cards. New `workers/razorpay-worker.js`. Lower transaction fees than Stripe for India. `paymentConfig.js` replaces direct stripeConfig imports so both gateways coexist. |
| 2 | **Web3Forms — enterprise inquiry** | "Contact us for Team pricing" form in sidebar or landing. No backend needed — Web3Forms handles delivery to email. |
| 3 | **Web3Forms — in-app feedback** | Bug report / feedback link in sidebar footer next to Privacy link. One-click form, stays in-app. |

### v1.7.0.0 — Store Expansion

| # | Feature | Detail |
|---|---|---|
| 1 | **Google Play (TWA)** | Trusted Web Activity wrapper via PWABuilder. Requires Digital Asset Links file at `/.well-known/assetlinks.json` on Netlify — one static file, no code change. Target: IT admins on Android tablets. |
| 2 | **Meta Quest** | PWABuilder → Meta Quest package. Already in CLAUDE.md. Landscape orientation already set in manifest. Target: ops teams in field / physical data centres. |
| 3 | **Microsoft Store badge** | Add store badge to sidebar footer + slides.html once Store URL is confirmed. |

### v1.8.0.0 — Collaboration & SSO

| # | Feature | Detail |
|---|---|---|
| 1 | **SSO (SAML/OIDC via Firebase)** | Enterprise plan. `authUser.email` already drives all permission checks — SSO just changes the auth source. Firebase Auth supports SAML provider and OIDC. |
| 2 | **Comment threads on RTM rows** | Inline comments per RTM row for QA Lead ↔ PM review loop. Stored in Firestore under build. |
| 3 | **Build sharing via link** | Generate a read-only share URL for a build (Firestore public read rule scoped to share token). |
| 4 | **Slack / Teams webhook notifications** | Notify a channel on CAB decision, RTM sign-off, or go-live cutover. Config in sidebar (Pro+). |

### Backlog (no version target yet)

| Feature | Rationale |
|---|---|
| Apple App Store (PWABuilder iOS wrapper) | Significant effort, Apple dev account required ($99/yr). Worth it only after Android traction confirmed. |
| Amazon Appstore | Niche for enterprise FireOS/tablet deployments. Low priority. |
| Edge Add-ons listing | `edge_side_panel` already in manifest — listing in Edge Add-ons store would increase enterprise discovery. Low effort. |
| PDF export | Complement to Excel export. jsPDF or puppeteer-based. |
| Confluence / Jira push | Export RTM / RAID / design sections directly to Confluence pages or Jira tickets via API. High-value for enterprise but requires OAuth integration. |
| LDAP / Active Directory user lookup | Auto-complete role assignments from AD. Enterprise plan only. |
| Offline AI (local LLM) | Run enrichment via WebLLM in-browser — no Groq key needed. Feasibility depends on model size. |

---

## Distribution Strategy — Where to Publish

### Tier 1 — Active now

| Channel | Audience | Status | Notes |
|---|---|---|---|
| **Netlify web (PWA)** | Any browser, any OS | Live | `https://opsmanifest.netlify.app` — install prompt on Chrome/Edge/Safari |
| **Microsoft Store** | Windows IT admins, enterprise devices | In cert (v1.5.0.0) | Highest-value channel for the target persona |

### Tier 2 — Next 60 days

| Channel | Audience | Effort | Action needed |
|---|---|---|---|
| **Google Play (TWA)** | Android tablets, field teams | Low | PWABuilder → generate APK → Google Play Console upload. Needs `assetlinks.json` on Netlify. |
| **Meta Quest** | Physical infra ops, on-site teams | Low | PWABuilder → Quest package → Meta Developer Hub. Already scoped in CLAUDE.md. |
| **Edge Add-ons** | Enterprise Edge users | Very low | Submit existing manifest to Edge Add-ons store — no new code. |

### Tier 3 — After traction confirmed

| Channel | Audience | Effort | Notes |
|---|---|---|---|
| **Apple App Store** | iOS / iPad users | High | PWABuilder generates Xcode project. Apple dev account required. WKWebView + SW limitations on iOS. |
| **Amazon Appstore** | FireOS tablets, AWS-adjacent teams | Low-Medium | APK from Google Play can be repackaged for Amazon with minor changes. |
| **Product Hunt launch** | Tech / devops early adopters | Medium | Coordinate with feature release (v1.6.0.0). One-day launch window. |
| **LinkedIn organic** | IT managers, infra PMs | Ongoing | Short demo video clips from slides.html deck. |
| **Hacker News Show HN** | Developers, IT ops | Low | "Show HN: A structured pre-work guide for infra provisioning" — works best when the tool is polished and live on multiple stores. |
| **r/sysadmin, r/ITManagers** | Direct target persona | Low | Genuine use-case post — not a promo. |

### Enterprise direct

| Channel | Detail |
|---|---|
| **Web3Forms enterprise inquiry** | "Contact us for Team pricing" form (v1.6.0.0) — captures inbound leads from organisations who find the tool and want multi-seat licences. |
| **LinkedIn outreach** | Target: IT Programme Managers, Infrastructure Architects, Change Management leads at mid-size enterprises. Demo deck is the leave-behind. |
| **Microsoft Partner Network** | Once Store listed, eligible to appear in Microsoft solution catalogues used by IT procurement teams. |

---

## Version Summary

| Version | Date | Outcome |
|---|---|---|
| v1.0.0.0 | 2026-05 | Failed cert — crash at launch (Windows 11 24H2) |
| v1.0.1.0 | 2026-05 | MaxVersionTested fix, manifest cleanup — also failed |
| v1.1.0.0 | 2026-06-04 | Major feature release — failed cert (crash on OS build 26200) |
| v1.2.0.0 | 2026-06-05 | Crash fix: MaxVersionTested 26200, AppUriHandler removed — failed cert (revision component mismatch) |
| v1.3.0.0 | 2026-06-07 | MaxVersionTested 10.0.65535.65535, Windows.Desktop family, ACUR rules — failed cert (blank screen, Netlify credits exhausted) |
| v1.4.0.0 | 2026-06-09 | Hosting migrated Netlify → Cloudflare Pages — failed cert (blank screen, pages.dev unreachable from MS lab) |
| v1.5.0.0 | 2026-06-11 | Root error boundary, 12s splash fallback, MissionHelp architecture intelligence, Mission Intel Excel sheet — submitted, in cert |
