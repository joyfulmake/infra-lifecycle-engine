# OpsManifest — How It Works and Why

> One sentence summary: OpsManifest is a pre-work guide that turns the five most common causes of delivery chaos — undefined scope, unacknowledged risks, unsequenced tasks, assumed sign-offs, and undetected drift — into explicit, signed-off, traceable decisions before a single change ticket is raised, for any of 16 PM domains.

---

## The one problem this solves

In any structured delivery project — a server migration, a SAP rollout, a Salesforce implementation, a hospital EHR upgrade — the chaos almost never comes from the technology itself. It comes from people starting work without having answered the basic questions first:

- What exactly are we changing?
- What could go wrong?
- Who does which part, and in what order?
- How do we know it worked?

Those questions feel obvious. But under time pressure, with multiple teams involved, they get skipped or half-answered. The result is late-night incidents, missed dependencies, CAB rejections, rollbacks that weren't planned, and post-mortems that all say the same thing: "we should have caught this earlier."

OpsManifest is a structured way to answer those questions before work starts. That is its only job — and it does it the same way regardless of which of the 16 supported PM domains the project is in (see [`src/domains/registry.js`](./src/domains/registry.js)).

## What this is not

This tool does not replace anything you already use.

- **Not a CMDB** — it does not store your live asset inventory (there was a dedicated CMDB tab; it was removed 2026-09-17 as scope creep against this exact principle — see [Coherence Engine](#coherence-engine) below and `CLAUDE.md`)
- **Not a ticketing system** — it does not manage your incidents or service requests
- **Not a project management tool** — it does not replace Jira, ServiceNow, Confluence, or Microsoft Project
- **Not a monitoring system** — it does not watch your servers

Those tools all do their jobs well. This tool sits before them. It produces the structured pre-work — the design decisions, the risk mappings, the task schedule, the sign-offs — that makes everything in those tools more accurate and less reactive.

---

## The workflow from a human perspective

Think of a project as having two questions at every stage:

1. **Have we thought this through?** (design, risks, compliance)
2. **Is everyone aligned?** (approvals, sign-offs, RACI)

OpsManifest walks through both, in order, without letting you skip steps. This is the same shape for every domain — only the vocabulary changes (infra's "Hardware/OS/Database/Application" becomes SAP's "Product/Release/Deployment Model/Module Scope", Healthcare's "Care Setting/EHR Platform/Regulatory Region/Channel", and so on for the other 13 domains).

Before any of that, a full-screen onboarding wizard (added 2026-09-18,
replacing what used to be a cramped section inside the sidebar) walks
through the domain choice and initial scope in three short screens —
domain (with a "continue a saved build instead" escape hatch for
returning users), stack/scope, review — before the app itself, sidebar,
16-tab bar and all, ever appears. See `OnboardingWizard` in
`PhasePanel.jsx` and the `!s.isBuilt` branch in `App.jsx`.

```
Step 0: Which kind of project is this?  (wizard screen 1)
  → Pick one of 16 PM domains (infra, cloud migration, SAP, Salesforce,
    Healthcare, Retail, ...) — nothing is pre-selected as a default
  → Every field, tab, and catalog below now speaks that domain's language

Phase 1: What are we building?  (wizard screens 2-3)
  → Pick the domain's own 4 stack/scope fields, review, then Build
  → The tool now knows your project — the normal sidebar+tabs app appears

AI Smart Scan
  → Rule-based scan (no API key) against a built-in CVE/EOL/security-gap catalog
  → Suggests which known issues and changes to plan for

System Design
  → N domain-specific sections (8 for infra: network, storage, backup,
    security, DR, monitoring, compliance, deployment — other domains
    have their own set), each owned by a named role
  → Every field has context-aware suggestions from your stack

Phase 2: What could go wrong / what else needs to happen?
  → Known-issue catalog + change/scope-item catalog, both domain-specific
  → You pick what applies (or add your own); the tool generates tasks

Gantt
  → Tasks scheduled in working hours across your project dates
  → Freeze periods, holidays blocked automatically
  → Critical path identified; parallel tasks given float time
  → AI can deepen each task's metadata (pre-conditions, blast radius, rollback steps)

Matrix
  → Shows who depends on whom, swimlane per domain function area
    (8 fixed layers for infra; one per design section + Validation +
    Governance for the other 15 domains)
  → Every role's tasks visible side by side; dependency drift spotted early

Deploy + Services  (added 2026-09-18, cross-domain by design)
  → Deploy: universal build → test → staging → production → verify pipeline
  → Services: vendor/dependency register, sorted by criticality + soonest renewal

RTM (Requirements Traceability Matrix)
  → One row per design section + one per selected known issue/change
  → QA Lead marks each PASS / FAIL / NA / BLOCKED
  → Sign-off required before cutover is allowed

CAB Approval
  → Change Advisory Board decision recorded in the tool
  → Decline unlocks all tabs for revision without losing history,
    and generates a domain-appropriate rollback plan

Cutover & Closure
  → Go-live checklist
  → Post-go-live items tracked to completion
```

## How the tool stays coherent across those steps

Every tab is watching the others. This is the most technically non-obvious part of the design.

When you change something in System Design, the Gantt knows. When you add a new known issue in Phase 2 after already signing the RTM, the RTM tab gets an amber dot. When a vendor contract in Services is renewing within 90 days, an advisory appears in that tab and the Executive Summary simultaneously.

This works through a component called the **coherence engine** (`src/lib/coherenceEngine.js`). It runs 20+ rule-based alert conditions across 17 numbered checks every time any significant state changes. It produces a list of alerts — each one tagged to the tabs it belongs on. Every tab has an `AgentInsights` advisory panel that reads from this list and shows only the alerts relevant to it — this panel is mounted on every tab in the app, not just a subset.

No API calls. No page reloads. No manual sync. Just one source of truth (the Zustand store) and one set of rules that runs against it continuously, debounced 600ms.

```
State change (any tab)
  → useCoherenceEngine hook (600ms debounce)
  → runCoherenceChecks(snapshot) — pure logic, no side effects
  → Produces alerts list
  → Each tab's AgentInsights panel reads the alerts relevant to it
```

---

## Technical architecture — plain language

### The browser is the application

OpsManifest is a React 19 + Vite 8 single-page application. When you open it, the entire application loads into your browser. After that, nothing needs a server to function for the core workflow — task generation, scheduling, coherence checks, Excel export all run locally in your browser tab.

This matters for two reasons:
1. It works offline after the first load (the service worker caches all assets)
2. It can be packaged as a desktop app (Windows Store) without any backend

### Where data lives

```
Your browser (always)
  IndexedDB via Dexie.js
    → All builds saved here automatically, every plan
    → Works with zero sign-in, zero configuration
    → Survives page refresh, browser restart

Firebase Firestore (optional, Professional+ plan)
  → Same builds pushed to cloud on every save
  → Sign in on a second device → builds restore automatically
  → Bidirectional merge (cloud wins if newer)
  → Firestore security rules scope every build to the signed-in
    account's own email — no cross-account access

Org/Team collection (Team plan)
  → Builds saved to a shared Firestore org collection
  → Any team member with the org code sees shared builds
```

See [Security & Data Handling](#security--data-handling) below and the full [`ENTERPRISE_READINESS.md`](./ENTERPRISE_READINESS.md) audit for what this does and doesn't cover today (no SSO/MFA yet, for example).

### How tasks are generated

When you complete Phase 1 and Phase 2, the tool knows your stack/scope selections and which known issues/change items you picked. From those inputs, `realTasks.js` and `incidentFixTasks.js` produce a list of concrete tasks — no AI needed for this part. For infra, the patterns are based on real provisioning sequences (a full platform migration always includes storage configuration before OS deployment, batch job migration always includes a shadow-run validation step before cutover). For the other 15 domains, each domain's own catalog (`src/domains/{domainId}.js`) supplies pre-authored tasks per known-issue/change-item code; a **generic fallback** (added 2026-09-18) covers any *custom* item a user adds that has no catalog entry, deriving a plausible owner from that domain's own design-section owners instead of falling through to infra-flavored text.

Task duration is estimated in working hours, with a 30% buffer built in. Scheduling accounts for weekends and any freeze or holiday periods you defined.

### The live lifecycle-data layer

`src/lib/eolApi.js` connects to `endoflife.date` — a public API that tracks end-of-life dates for hundreds of software products. It backs the build-phase live search (`FilteredSuggestInput`, 3+ characters) and the Phase 2 catalog search's "Live EOL API" section — both available in every domain, since looking up a real product's lifecycle status is useful regardless of which domain you're in.

*(There used to be a dedicated CMDB tab built entirely around this API plus infra-only design fields; it was removed 2026-09-17 — see "What this is not" above.)*

### How the AI fits in

Two layers, clearly separated:

**Rule-based (always on, no API key)**
The Smart Scan, task metadata enrichment, and coherence checks are all pure logic. They use 30+ regex patterns in `taskMetadata.js` and the rule set in `coherenceEngine.js`. Fast, deterministic, works offline, and never leaves the browser.

**Groq AI (opt-in, off by default)**
When an organization configures it, the tool can ask a large language model to deepen a task's metadata — adding specific CVE references, best-practice checks, pre-condition detail — and OpsMentor can answer richer natural-language questions grounded in the build. This goes through a Cloudflare Worker proxy so the API key never touches the browser. AI-enhanced fields are shown with a distinct "✦ AI" badge so it's always clear which content came from rules and which came from inference.

### How sign-offs work

The tool enforces an explicit order:

```
Design complete → triggers task generation
Tasks reviewed → CAB approval or decline
CAB approved → RTM becomes signable
RTM signed by QA Lead → cutover is allowed
Cutover done → closure checklist opens
```

If something changes after a sign-off — a known issue added, a design field edited — the relevant sign-off is marked stale. The system does not silently accept drift. It surfaces it and asks you to re-verify.

---

## Data flow — one full pass

What happens from the moment you open the tool to the moment you export a completed build.

```
1. Open app
   → React loads, Zustand store initialises (activeDomain defaults to
     'infra' internally, but nothing displays it as chosen until the
     user actually clicks a domain — see domainConfirmed in PhasePanel.jsx)
   → IndexedDB checked for saved builds
   → Service worker confirms assets cached
   → DemoTour shown once per browser session (sessionStorage-gated)

2. Pick a PM domain, then Phase 1: select the 4 stack/scope fields
   → applyDomain(id) swaps ALL_INC / ALL_UUM / DESIGN_SECTIONS / axis
     labels / HW-OS-DB-APP-equivalent option lists to that domain's catalog
   → ctx slice in store updated
   → Live search queries endoflife.date on 3+ chars
   → Design defaults pre-filled for the selected combo (infra only —
     other domains don't yet have per-combo defaults)

3. AI Smart Scan
   → smartScan.js runs against ctx
   → Suggests relevant known-issue and change-item codes

4. System Design
   → Domain's own sections filled, each field shows suggestions
   → Tech Review Mode: specific fields locked by named role
   → Role owners can edit their sections via email-matched access

5. Phase 2 injection
   → User toggles known-issue and change codes (or adds custom ones)
   → If tasks already generated: tasksStaleReason set → amber Gantt banner

6. Gantt generation
   → realTasks.js + incidentFixTasks.js produce the raw task list
     (domain catalog lookup, or the generic fallback for custom items)
   → enrichTask() adds 7-point FSM metadata per task (regex patterns)
   → calcDates() schedules tasks in working hours, skipping weekends + freezes
   → computeCPM() identifies critical path and float
   → Optional: Groq deepens selected tasks via CF Worker

7. Matrix
   → collectAllTasks() aggregates all tasks across roles and layers
   → Swimlanes rendered per domain (8 fixed for infra, generic
     per-section for the rest); FSM detail panel opens on task click

8. RTM
   → Base rows derived per domain (12 infra-specific rows, or one row
     per design section + 4 universal governance rows elsewhere) plus
     one row per selected known issue/change item
   → QA Lead marks each row; All PASS / All N/A shortcuts available
   → signRtm() sets rtmSigned, clears rtmStale

9. CAB
   → setCabApproved(true) or setCabDeclined(true)
   → Decline: unlockedForRevision → all tabs open; domain-derived
     rollback plan shown in Gantt; tasksStaleReason set
   → Resubmit: resubmitCAB() clears both flags, returns to pending

10. Cutover + Closure
    → setPromoted(true) → Live badge on Executive Summary
    → Closure checklist items ticked; notes saved

11. Save
    → localSaveBuild() writes the store snapshot to IndexedDB
    → cloudSaveBuild() pushes to Firestore in background (Professional+)

12. Export
    → exportExcel() builds up to an 18-sheet workbook (13 on Starter;
      Gantt/System Design/Closure Summary are the 3 gated behind Pro+)
      using xlsx-js-style — Executive Summary, Mission Intel, Incidents,
      UUM Items, RTM Checklist, RAID Registry, Deploy Pipeline, Services
      Register, RACI Matrix, Vulnerability Registry, Audit Log,
      Emergency Changes, OpsMentor Tasks, plus the Pro+ sheets
    → File downloaded directly from browser, no server involved
```

---

## Module Map

### Core State
| Module | Role |
|---|---|
| `store/useStore.js` | Single Zustand store; all app state and actions |
| `domains/registry.js` | The 16 domains, their categories, icons, axis labels |
| `domains/applyDomain.js` | Swaps the shared catalog arrays/objects when the domain changes |
| `lib/db.js` | Dexie IndexedDB wrapper |
| `lib/firebase.js` | Lazy Firebase singleton |
| `lib/useBuildsDb.js` | Hook: IndexedDB + optional Firestore sync |
| `lib/auth.js` | Local auth (signIn, canUseFeature, PLANS, FEATURE_TIER) |

### Intelligence & Analysis
| Module | Role |
|---|---|
| `lib/coherenceEngine.js` | `runCoherenceChecks(snapshot)` → 20+ cross-tab alerts across 17 numbered checks |
| `lib/useCoherenceEngine.js` | React hook; 600ms debounce; watches ~18 state slices including `activeDomain` |
| `lib/riskEngine.js` | `computeAllRisks(state)` → live risk score for the Risk Tracker tab |
| `lib/rtmBaseRows.js` | `getRtmBaseRows(activeDomain, designSections)` — infra's 12 fixed rows, or one row per design section for the rest |
| `lib/infraMap.js` | ASCII structural map · functional flow · compatibility matrix · rule-based mission intel (infra domain only) |
| `lib/smartScan.js` | Standalone CVE/EOL scan (no API, no key) |
| `lib/taskMetadata.js` | `enrichTask(task, ctx)` → 7-point FSM metadata (30+ regex patterns) |
| `lib/eolApi.js` | endoflife.date REST client; `EOL_SLUG_MAP` (60+ products) |
| `lib/groq.js` | `enrichTaskWithGroq` · `suggestWithGroq` · `searchUUMWithGroq` · `analyzeMissionContext` · `friendlyGroqError()` |

### Workers
| Route | Purpose |
|---|---|
| `POST /orchestrator-chat` | OpsMentor main chat; `INITIAL_ASSESSMENT` prefix for opening brief |
| `POST /groq-enrich` | Deepen a task's 7-point FSM metadata via Groq |
| `POST /groq-suggest` | Top-5 stack-specific risk suggestions |
| `POST /groq-uum-search` | Generate 6-8 change-item operations from free-text query |
| `POST /groq-uum-enrich` | Full enrichment of a custom change item (tasks, risks, prereqs) |
| `POST /groq-mission-analysis` | MissionHelp 4-section delivery + architecture analysis (infra) |
| `POST /cartesia-tts` | Text-to-speech; tries Azure Neural first, then Cartesia, then ElevenLabs |
| `workers/stripe-worker.js`, `workers/razorpay-worker.js` | Payment checkout/webhook proxies (both `[PARTIAL]` — code complete, not live; see `ENTERPRISE_READINESS.md`) |

### UI Components
| Component | Role |
|---|---|
| `App.jsx` | Root layout: before a build exists, renders only `PhasePanel`'s onboarding wizard full-viewport; once built, the normal PhasePanel sidebar + ExecOverview + PmTabs three-pane layout (1160px desktop/drawer breakpoint) |
| `PhasePanel.jsx` | Before a build: `OnboardingWizard` (domain → stack/scope → review, full screen, own theme toggle). After: left sidebar — phase controls, save/load, export; the domain picker is still reachable here too (Phase 1 section's "▸ Change" link), unchanged from before the wizard existed |
| `ExecOverview.jsx` | Top strip: KPI tiles, milestones, unsaved indicator |
| `PmTabs.jsx` | Tab bar + `getNextTabId()` for "Next" workflow badge; mounts the coherence hook |
| `AgentInsights.jsx` | Advisory strip mounted at the top of every tab; reads `coherenceAlerts` |
| `SystemDesignTab.jsx` | Domain-specific design form (8 sections for infra) |
| `GanttTab.jsx` | Gantt + CPM + FSM panel per task + domain-derived CAB-decline rollback plan |
| `MatrixTab.jsx` | Domain-derived swimlane dependency matrix |
| `RtmTab.jsx` | Requirements traceability table + sign-off, domain-derived base rows |
| `DeployTab.jsx` / `ServicesTab.jsx` | Build/test/release pipeline tracker / vendor-dependency register — both cross-domain |
| `RaidTab.jsx` | Risks, assumptions, issues, decisions log |
| `RolesTab.jsx` | 20-role RACI table (infra) or generic per-section roles (other domains) |
| `ClosureTab.jsx` | Post-go-live checklist |
| `ExecSummaryTab.jsx` | Executive summary + known-issue/change-item selection |
| `InfraDiagramTab.jsx` | Three views: Visual · ASCII Map · Mission Intel — **infra domain only**, hidden elsewhere |
| `DemoTour.jsx` | 6-slide onboarding popup shown once per browser session (`sessionStorage` key `opsmanifest_tour_seen`) |

---

## Coherence Engine

Full list of numbered checks in `src/lib/coherenceEngine.js` as of 2026-09-18 (some push more than one alert type — see the source for exact conditions):

| # | Trigger | Tabs |
|---|---|---|
| 1 | Compliance framework set but no security section content | design, exec |
| 2 | Tier 1 DR without RPO/RTO | design, exec |
| 3 | Security known-issue active but security design sparse | design |
| 4 | Network known-issue active but network design sparse | design |
| 5 | High SLA with no monitoring agent configured | design, exec |
| 6 | Design applied but very sparse (< 8% fields filled) | design |
| 7 | Phase 2 active but nothing selected — unusual | exec |
| 8 | RTM has FAIL/BLOCKED rows — blocks closure | closure, rtm |
| 9 | Critical roles not assigned (domain-derived, not hardcoded infra names) | roles |
| 10 | Many RTM rows still PENDING | rtm |
| 11 | Storage known-issue active but storage design sparse | design |
| 12a–c | RTM/tasks stale after sign-off, cutover-ready-but-stale variants | gantt, rtm, exec, closure |
| 13 | TLS 1.0/1.1 deprecated cipher + PCI-DSS cipher gap | design |
| 14 | Migration-type custom change item with no Phase 2 injection yet | diagram |
| 15 | Vendor platform compatibility (DB × OS × HW × App rules + free-text scan) | design, diagram, exec |
| 16 | Deploy pipeline stage blocked or failed | deploy, exec |
| 17 | Service/vendor contract at risk or renewing within 90 days | services, exec |

---

## Deployment

| Target | URL | Method |
|---|---|---|
| App (PWA) | https://opsmanifest.pages.dev | `git push origin main` → GitHub Actions → Cloudflare Pages |
| Presentation deck | https://opsmanifest.pages.dev/slides | same |
| Guided tour | https://opsmanifest.pages.dev/demo | same |
| AI Worker | Cloudflare Workers (`opsmanifest-ai`) | `wrangler deploy workers/ai-worker.js` |

**Build command:** `npm run build` (Vite 8 + React 19 + Tailwind v3)
**Node version:** 20
**Deploy:** `git push origin main` — `.github/workflows/deploy-pages.yml` builds and deploys automatically via `wrangler pages deploy`.

### Microsoft Store (MSIX)

**`.github/workflows/build-msix.yml` is deprecated — do not run it.** It hand-authors a legacy `StartPage`-only `AppxManifest.xml`, which is the pre-WebView2 "JavaScript UWP app" model, not a real WebView2 app — this was the root cause of 20 consecutive submissions crashing at launch on different Windows builds (found and fixed 2026-07-02). MSIX packages are now generated via **pwabuilder.com** (PWABuilder's Hosted App Model, backed by real Chromium Edge). Full current steps are in [`submission.md`](./submission.md) Part 1.

---

## Security & Data Handling

The full, continuously-updated audit is [`ENTERPRISE_READINESS.md`](./ENTERPRISE_READINESS.md) — read it before relying on this for regulated data. Summary:

- No API keys in browser-facing code — Groq/TTS/payment calls are proxied via Cloudflare Workers
- Firebase Firestore rules: each user can only read/write their own `users/{email}/builds/{id}`
- CSP via Cloudflare Pages `_headers`; TLS 1.2+ enforced by Cloudflare for all traffic
- React escapes all rendered output — no `dangerouslySetInnerHTML` anywhere in the codebase
- **Not yet in place**: SSO (SAML/OIDC), MFA, worker-route authentication or rate limiting, a formal penetration test, SOC 2/ISO 27001 assessment, or a GDPR self-service erasure flow — see `ENTERPRISE_READINESS.md` for the complete gap list before using this for anything regulated.

---

## Plans & Access Control

| Plan | Builds/year | Price | Adds |
|---|---|---|---|
| Guest | unlimited (session only) | free | Full build workflow, all tabs — no save/export |
| Starter | 2 | free | Save/load, core 13-sheet Excel export |
| Professional | 15 | $19/mo | Full 18-sheet export, tech review locking, cloud sync |
| Team | unlimited | $59/mo, up to 8 seats | Shared build repository, Team RAID board |
| Enterprise | unlimited | custom | SSO/LDAP/SAML, ServiceNow/Jira/BMC integration, on-prem, SOC2/ISO 27001 audit trail |

Billing isn't live yet (`STRIPE_CONFIGURED = false` in `src/lib/stripeConfig.js`) — Team/Enterprise are a "buy later" roadmap item, not an active checkout today. Access is checked via `canUseFeature(authUser, featureKey)` in `auth.js`; see `DOMAIN_EXPANSION_ROADMAP.md` for the domain-add-on monetization model.

---

## Adding a New Coherence Check

1. Open `src/lib/coherenceEngine.js`
2. Add a block inside `runCoherenceChecks(state)` before `return alerts`:
```javascript
{
  // Check N: description
  if (state.someField && someCondition) {
    alerts.push({
      id: 'unique_id',
      severity: 'warn', // or 'info'
      tabs: ['exec', 'design'], // which tabs show this alert
      message: 'User-facing message explaining the issue.',
      action: 'Where to fix it',
    });
  }
}
```
3. If the check watches a new state slice, add it to both the destructuring in `runCoherenceChecks` and the snapshot + dependency array in `useCoherenceEngine.js`.
4. `AgentInsights` panels will automatically show alerts whose `tabs` array includes the current tab — no per-tab wiring needed as long as that tab already mounts `<AgentInsights tab="..." />`.

## Adding a New Groq Route

1. Add a handler function in `workers/ai-worker.js` following the pattern of existing handlers
2. Add the route in the Router section
3. Add a client function in `src/lib/groq.js` calling `${GROQ_WORKER_URL}/groq-new-route`, returning `friendlyGroqError()`-friendly failures rather than raw error text
4. Deploy worker: `wrangler deploy workers/ai-worker.js --name opsmanifest-ai`

---

## Further reading

- **Step-by-step user walkthrough:** [`USER_GUIDE.md`](./USER_GUIDE.md)
- **Full technical reference (for contributors/AI agents working in this repo):** [`CLAUDE.md`](./CLAUDE.md)
- **Security/enterprise-readiness audit:** [`ENTERPRISE_READINESS.md`](./ENTERPRISE_READINESS.md)
- **Shipped vs. planned features:** [`PRODUCT_ROADMAP.md`](./PRODUCT_ROADMAP.md)
- **Domain rollout + monetization roadmap:** [`DOMAIN_EXPANSION_ROADMAP.md`](./DOMAIN_EXPANSION_ROADMAP.md)
