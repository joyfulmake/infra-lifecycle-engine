# OpsManifest — Architecture Reference

## System Purpose

OpsManifest is a React SPA that guides infrastructure PMs through the full server provisioning lifecycle: hardware/OS selection → system design → incident triage → CAB approval → RTM sign-off → project closure. It is a structured pre-work tool, not a CMDB or ITSM replacement.

---

## High-Level Architecture

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        OPSMANIFEST  v1.5.0.0                               ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  BROWSER / PWA                                                              ║
║  ┌────────────────┐  ┌─────────────────────────────────────────────────┐   ║
║  │  PhasePanel    │  │  PmTabs (tab bar + active tab component)        │   ║
║  │  (left sidebar │  │  ExecSummary · SystemDesign · InfraDiagram      │   ║
║  │   320px navy)  │  │  RTM · Gantt · Matrix · RAID · Closure · Roles  │   ║
║  └────────────────┘  └─────────────────────────────────────────────────┘   ║
║         │                         │                                         ║
║         └──────────┬──────────────┘                                         ║
║                    ▼                                                         ║
║  ┌─────────────────────────────────────────────────────────────────────┐    ║
║  │                  Zustand Store  (useStore.js)                       │    ║
║  │  ctx · sysDesignData · selInc/UUM/Fix · rtmRows · ganttOverrides   │    ║
║  │  roleAssignments · coherenceAlerts · liveEolData · customUUM/Inc    │    ║
║  └────────────┬───────────────────────────────────────────────────────┘    ║
║               │                                                              ║
║      ┌────────┴────────┐                                                    ║
║      ▼                 ▼                                                    ║
║  ┌────────────┐  ┌──────────────────────────────────────────────────────┐  ║
║  │ Dexie.js   │  │ useCoherenceEngine (600ms debounce)                  │  ║
║  │ IndexedDB  │  │ → runCoherenceChecks(snapshot) → coherenceAlerts[]  │  ║
║  │ (all plans)│  │ → AgentInsights panels read alerts across tabs      │  ║
║  └────────────┘  └──────────────────────────────────────────────────────┘  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  EXTERNAL SERVICES                                                          ║
║  ┌────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ ║
║  │ endoflife.date API │  │ Cloudflare Worker   │  │ Firebase Firestore  │ ║
║  │ (live EOL/EOS data)│  │ opsmanifest-ai      │  │ (Pro+ cloud sync)   │ ║
║  │ no auth, free tier │  │ proxies Groq API    │  │ auth: email+pw      │ ║
║  └────────────────────┘  └─────────────────────┘  └─────────────────────┘ ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Data Flow

### Phase 1 (Build)
```
User selects hw/os/db/app
        │
        ▼
useStore: setCtx()  →  isDirty = true
        │
        ▼
smartScan.js: standalone CVE/EOL/config scan (no API)
        │
        ▼
FilteredSuggestInput: live endoflife.date search (debounced 500ms)
        │
        ▼
designDefaults.js: pre-fills sysDesignData per hw/os/db/app combo
        │
        ▼
isBuilt = true  →  PmTabs renders, ExecOverview shows KPIs
```

### Phase 2 (Inject)
```
User toggles incidents / UUM  →  selInc / selUUM arrays update
        │
        ▼
useCoherenceEngine (600ms debounce)
  → runCoherenceChecks(snapshot)
  → coherenceAlerts[]  →  AgentInsights panels update
        │
        ▼
tasksStaleReason set if designApplied (amber Gantt banner)
rtmStale set if rtmSigned (amber RTM banner)
        │
        ▼
phase2Active = true  →  Gantt, Matrix, RTM populated from real tasks
```

### Save / Load
```
PhasePanel "Save Build"
        │
        ▼
localSaveBuild(build, Dexie)  +  cloudSaveBuild(build, Firestore) [Pro+]
        │
        ▼
setCurrentBuildId(id)  +  markClean()
        │
        ▼
"Load Build" → loadBuild() → migrateLegacyFreeze() → setAllState()
```

### Infra Diagram — Three Views
```
InfraDiagramTab mounts
        │
        ├─── viewMode = 'visual'
        │         Zustand state → LayerBox/Connector components (React SVG-style)
        │
        ├─── viewMode = 'ascii'
        │         state → infraMap.js
        │           buildStructuralMap(state)   → box-drawing ASCII map string
        │           buildFunctionalFlow(state)  → traffic flow diagram string
        │           buildCompatibilityMatrix()  → Markdown table (rendered as HTML table)
        │         One-click copy to clipboard
        │
        └─── viewMode = 'intel'
                  MissionIntelView component
                  ├── rule-based: buildRuleBasedMissionIntel(state) → instant
                  └── AI path (GROQ_CONFIGURED):
                        analyzeMissionContext(state)
                          → POST /groq-mission-analysis (CF Worker)
                          → Groq llama-3.3-70b-versatile
                          → { contextExtraction, deliveryRTM, architectureMap,
                              compatibilityRisks, nextSteps }
```

---

## Module Map

### Core State
| Module | Role |
|---|---|
| `store/useStore.js` | Single Zustand store; all app state |
| `lib/db.js` | Dexie IndexedDB wrapper |
| `lib/firebase.js` | Lazy Firebase singleton |
| `lib/useBuildsDb.js` | Hook: IndexedDB + optional Firestore sync |
| `lib/auth.js` | Local auth (signIn, canUseFeature, PLANS) |

### Intelligence & Analysis
| Module | Role |
|---|---|
| `lib/coherenceEngine.js` | `runCoherenceChecks(snapshot)` → 14 cross-tab alerts |
| `lib/useCoherenceEngine.js` | React hook; 600ms debounce; watches 16 state slices |
| `lib/infraMap.js` | ASCII structural map · functional flow · compatibility matrix · rule-based mission intel |
| `lib/smartScan.js` | Standalone CVE/EOL scan (no API, no key) |
| `lib/taskMetadata.js` | `enrichTask(task, ctx)` → 7-point FSM metadata (30+ regex patterns) |
| `lib/eolApi.js` | endoflife.date REST client; `EOL_SLUG_MAP` (60+ products) |
| `lib/groq.js` | `enrichTaskWithGroq` · `suggestWithGroq` · `searchUUMWithGroq` · `analyzeMissionContext` |

### Workers
| Route | Purpose |
|---|---|
| `POST /groq-enrich` | Deepen a task's 7-point FSM metadata via Groq |
| `POST /groq-suggest` | Top-5 stack-specific incident/risk suggestions |
| `POST /groq-uum-search` | Generate 6-8 UUM operations from free-text query |
| `POST /groq-uum-enrich` | Full enrichment of a custom UUM entry (tasks, risks, prereqs) |
| `POST /groq-mission-analysis` | MissionHelp 4-section delivery + architecture analysis |

### UI Components
| Component | Role |
|---|---|
| `App.jsx` | Root layout: PhasePanel sidebar + ExecOverview + PmTabs |
| `PhasePanel.jsx` | Left sidebar: workflow steps, save/load, Phase 1/2 controls, smart input |
| `ExecOverview.jsx` | Top strip: KPI tiles, milestones, unsaved indicator |
| `PmTabs.jsx` | Tab bar + `getNextTabId()` for "Next" workflow badge |
| `AgentInsights.jsx` | Compact cross-tab advisory panel; reads `coherenceAlerts` |
| `InfraDiagramTab.jsx` | Three views: Visual · ASCII Map · Mission Intel |
| `SystemDesignTab.jsx` | 8-section system design form |
| `GanttTab.jsx` | Gantt + CPM + 7-point FSM panel per task |
| `MatrixTab.jsx` | Cross-stack dependency matrix (8 swimlane layers) |
| `RtmTab.jsx` | Requirements Traceability Matrix |
| `CmdbTab.jsx` | Live EOL/lifecycle data via endoflife.date API |
| `DemoTour.jsx` | 7-slide onboarding popup (key: `opsmanifest_tour_v3`) |

---

## Coherence Engine — 14 Checks

| # | ID | Severity | Trigger | Tabs |
|---|---|---|---|---|
| 1 | `compliance_gap` | warn | Compliance framework set but no security incident | exec, design |
| 2 | `dr_backup_gap` | warn | DR/backup section empty but incidents present | exec, design |
| 3 | `security_incident_no_siem` | warn | Security incident active but no SIEM configured | design |
| 4 | `network_incident_no_fw` | warn | Network incident active but no firewall rules | design |
| 5 | `sla_monitoring_gap` | info | SLA set but no monitoring endpoint | exec, design |
| 6 | `design_sparse` | info | Design applied but fewer than 3 fields filled | design |
| 7 | `empty_phase2` | info | Phase 2 active but no incidents or UUM | exec |
| 8 | `rtm_fails` | warn | RTM has FAIL rows after signing | rtm, exec |
| 9 | `roles_missing` | info | No role assignments defined | roles |
| 10 | `rtm_pending_count` | warn | Many PENDING rows before signing | rtm |
| 11 | `storage_incident` | warn | Storage incident active but no backup tool | design, exec |
| 12 | `live_eol_detected` | warn | Live API confirms EOL components | cmdb, exec, design |
| 12b | `live_eos_soon` | info | Components EOS < 12 months | cmdb |
| 12a–c | `rtm_stale_*` | warn | RTM stale, tasks stale, post-live drift | gantt, rtm, exec |
| 13 | `tls_deprecated` | warn | TLS 1.0/1.1 in ssl_protocols | design, diagram, exec |
| 13b | `tls_pci_gap` | warn | PCI-DSS scope + no explicit TLS 1.2+ | design, diagram |
| 14 | `custom_entry_eol` | warn | Custom UUM name matches near-EOL component | diagram, cmdb |
| 14b | `custom_migration_no_phase2` | info | Migration-type custom UUM but Phase 2 not injected | diagram |

---

## Deployment

| Target | URL | Method |
|---|---|---|
| App (PWA) | https://opsmanifest.pages.dev | `git push origin main` → Cloudflare Pages auto-build |
| Presentation | https://opsmanifest.pages.dev/slides.html | same |
| Groq AI Worker | Cloudflare Workers (`opsmanifest-ai`) | `wrangler deploy workers/ai-worker.js` |

**Build command:** `npm run build` (Vite 8 + React 19 + Tailwind v3)  
**Node version:** 20 (pinned in `.nvmrc`)  
**Deploy:** `git push origin main` — GitHub repo connected to Cloudflare Pages for auto-deploy  

### MSIX (Microsoft Store)
Built by GitHub Actions workflow `.github/workflows/build-msix.yml`.  
Current version: **v1.5.0.0**  
StartPage: `https://opsmanifest.pages.dev/`  
ACUR: `https://opsmanifest.pages.dev/` + `https://opsmanifest.pages.dev/*`  
MaxVersionTested: `10.0.65535.65535`  
TargetDeviceFamily: `Windows.Desktop`

> **Known issue**: `*.pages.dev` CDN subdomains may be blocked in Microsoft's certification lab network. The long-term fix is a custom domain (e.g. `opsmanifest.app`) pointed at Cloudflare Pages. v1.5.0.0 adds a 12-second splash fallback and a root React error boundary so the app never shows a pure blank screen even when the network is unavailable.

---

## Security Model

- No API keys in browser-facing code (Groq proxied via CF Worker)
- Firebase Firestore rules: each user can only read/write their own `users/{email}/builds/{id}`
- CSP via Cloudflare Pages `_headers`: `script-src 'self' 'unsafe-inline'`, `worker-src 'self'`
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- TLS 1.2+ enforced by Cloudflare Pages for all traffic
- Service worker: cache-first for static assets, network-first for HTML navigations, branded offline fallback page

---

## Plans & Access Control

| Plan | Builds | Features |
|---|---|---|
| Guest | unlimited (session only) | Build, scan, design, all tabs — no save |
| Free/Starter | 2 | Save/load, Excel export |
| Pro | 15 | + CMDB live EOL, cloud sync, Roles tab editing |
| Team | 50 | + Org sharing, shared builds |

Seeded account: `sriram.c76@gmail.com → professional`  
Access checked via `canUseFeature(authUser, featureKey)` in `auth.js`

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
3. If the check watches a new state slice, add it to `useCoherenceEngine.js` dependency array.
4. `AgentInsights` panels will automatically show alerts whose `tabs` array includes the current tab.

---

## Adding a New Groq Route

1. Add handler function in `workers/ai-worker.js` following the pattern of existing handlers
2. Add route in the Router section: `if (req.method === 'POST' && url.pathname === '/groq-new-route') { return handleNew(req, env); }`
3. Add client function in `src/lib/groq.js` calling `${GROQ_WORKER_URL}/groq-new-route`
4. Deploy worker: `wrangler deploy workers/ai-worker.js --name opsmanifest-ai`
