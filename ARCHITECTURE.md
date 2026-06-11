# OpsManifest — How It Works and Why

---

## The one problem this solves

In any infrastructure project — a server migration, an OS upgrade, a database patch, a new environment rollout — the chaos almost never comes from the technology itself. It comes from people starting work without having answered the basic questions first:

- What exactly are we changing?
- What could go wrong?
- Who does which part, and in what order?
- How do we know it worked?

Those questions feel obvious. But under time pressure, with multiple teams involved, they get skipped or half-answered. The result is late-night incidents, missed dependencies, CAB rejections, rollbacks that weren't planned, and post-mortems that all say the same thing: "we should have caught this earlier."

OpsManifest is a structured way to answer those questions before work starts. That is its only job.

---

## What this is not

This tool does not replace anything you already use.

- **Not a CMDB** — it does not store your live asset inventory
- **Not a ticketing system** — it does not manage your incidents or service requests
- **Not a project management tool** — it does not replace Jira, ServiceNow, or Confluence
- **Not a monitoring system** — it does not watch your servers

Those tools all do their jobs well. This tool sits before them. It produces the structured pre-work — the design decisions, the risk mappings, the task schedule, the sign-offs — that makes everything in those tools more accurate and less reactive.

---

## The workflow from a human perspective

Think of a provisioning project as having two questions at every stage:

1. **Have we thought this through?** (design, risks, compliance)
2. **Is everyone aligned?** (approvals, sign-offs, RACI)

OpsManifest walks through both, in order, without letting you skip steps.

```
Phase 1: What are we building?
  → Pick hardware, OS, database, application
  → The tool now knows your stack

AI Smart Scan
  → Scans your stack for known EOL dates, CVEs, security gaps
  → Suggests which incidents and changes to plan for

System Design
  → 8 key areas: network, storage, backup, security,
    disaster recovery, monitoring, compliance, deployment
  → Every field has context-aware suggestions from your stack

Phase 2: What could go wrong / what else needs to happen?
  → Incident catalog: known failure patterns (e.g. "Oracle RAC failover", "NFS mount failure")
  → UUM catalog: Unix / User / Middleware changes (e.g. "JBoss EAP upgrade", "AD group migration")
  → You pick what applies; the tool generates tasks from your choices

Gantt
  → Tasks are scheduled in working hours across your project dates
  → Freeze periods, holidays blocked automatically
  → Critical path identified; parallel tasks given float time
  → AI can deepen each task's metadata (pre-conditions, blast radius, rollback steps)

Matrix
  → Shows who depends on whom across 8 stack layers
  → Every role's tasks visible side by side
  → Dependency drift spotted before the work starts

RTM (Requirements Traceability Matrix)
  → Every incident and change you chose becomes a row
  → QA Lead marks each PASS / FAIL / NA / BLOCKED
  → Sign-off required before cutover is allowed

CAB Approval
  → Change Advisory Board decision recorded in the tool
  → Decline unlocks all tabs for revision without losing history

Cutover & Closure
  → Go-live checklist
  → Post-go-live items tracked to completion
```

---

## How the tool stays coherent across those steps

Every tab is watching the others. This is the most technically non-obvious part of the design.

When you change something in System Design, the Gantt knows. When you add a new incident in Phase 2 after already signing the RTM, the RTM tab gets an amber dot. When the live EOL API confirms your database version goes end-of-life in 60 days, an advisory appears in the Executive Summary, the System Design tab, and the Closure tab simultaneously.

This works through a component called the **coherence engine**. It runs 12 rule-based checks every time any significant state changes. It produces a list of alerts — each one tagged to the tabs it belongs on. Every tab has an advisory panel that reads from this list and shows only the alerts relevant to it.

No API calls. No page reloads. No manual sync. Just one source of truth (the Zustand store) and one set of rules that runs against it continuously.

```
State change (any tab)
  → Coherence engine runs (12 checks, pure logic, no side effects)
  → Produces alerts list
  → Each tab reads the alerts relevant to it
  → Advisory panels update
```

---

## Technical architecture — plain language

### The browser is the application

OpsManifest is a React single-page application. When you open it, the entire application loads into your browser. After that, nothing needs a server to function. All the logic — task generation, scheduling, coherence checks, Excel export — runs locally in your browser tab.

This matters for two reasons:
1. It works offline after the first load (the service worker caches all assets)
2. It can be packaged as a desktop app (Windows Store MSIX) without any backend

### Where data lives

```
Your browser (always)
  IndexedDB via Dexie.js
    → All builds saved here automatically
    → Works with zero sign-in, zero configuration
    → Survives page refresh, browser restart

Firebase Firestore (optional, Pro+ plan)
  → Same builds pushed to cloud on every save
  → Sign in on a second device → builds restore automatically
  → Bidirectional merge (cloud wins if newer)

Org/Team collection (Team plan)
  → Builds saved to a shared Firestore org collection
  → Any team member with the org code sees shared builds
```

### How tasks are generated

When you complete Phase 1 and Phase 2, the tool knows:
- Hardware type (physical, VM, cloud, container)
- Operating system and version
- Database and version
- Application / middleware
- Which incidents you expect
- Which Unix/Middleware changes are needed

From those inputs, `realTasks.js` and `incidentFixTasks.js` produce a list of concrete tasks. No AI needed for this part. The patterns are based on real provisioning sequences — for example, a full platform migration always includes storage configuration before OS deployment, and batch job migration always includes a shadow-run validation step before cutover.

Task duration is estimated in working hours, with a 30% buffer built in. Scheduling accounts for weekends and any freeze or holiday periods you defined.

### The live EOL layer

The CMDB tab connects to `endoflife.date` — a public API that tracks end-of-life dates for hundreds of software products. When you look up your stack components there, the tool fetches the actual support timeline: when security patches stop, when extended support ends, when the product is fully dead.

This data then feeds back into the coherence engine. If your stack has something expiring in the next 90 days, you get an advisory in the tabs that matter.

```
Stack component (e.g. "Oracle Database 19c")
  → Resolved to an API product slug
  → Cycles fetched (all versions + their dates)
  → Matched to your specific version
  → EOS / EOL / Security-Only period / LTS flag surfaced
  → Coherence check runs: is any component EOL within project window?
  → Alert emitted if yes, visible on CMDB + Executive Summary + System Design
```

### How the AI fits in

Two layers, clearly separated:

**Rule-based (always on, no API key)**
The Smart Scan, task metadata enrichment, and coherence checks are all pure logic. They use the 30+ patterns in `taskMetadata.js` and `coherenceEngine.js`. Fast, deterministic, works offline.

**Groq AI (opt-in)**
When configured, the tool can ask a large language model to deepen a task's metadata — adding specific CVE references, best practice checks, pre-condition detail. This goes through a Cloudflare Worker proxy so the API key never touches the browser. The AI output is shown with a distinct badge so it is always clear which content came from rules and which came from inference.

### How sign-offs work

The tool enforces an explicit order:

```
Design complete → triggers task generation
Tasks reviewed → CAB approval or decline
CAB approved → RTM becomes signable
RTM signed by QA Lead → cutover is allowed
Cutover done → closure checklist opens
```

If something changes after a sign-off — an incident added, a design field edited — the relevant sign-off is marked stale. The system does not silently accept drift. It surfaces it and asks you to re-verify.

---

## Data flow — one full pass

Here is what happens from the moment you open the tool to the moment you export a completed build.

```
1. Open app
   → React loads, Zustand store initialises with defaults
   → IndexedDB checked for saved builds
   → Service worker confirms assets cached
   → DemoTour shown on first visit

2. Phase 1: select hw / os / db / app
   → ctx slice in store updated
   → FilteredSuggestInput queries endoflife.date on 3+ chars
   → Design defaults pre-filled for selected combo

3. AI Smart Scan
   → smartScan.js runs against ctx
   → Suggests relevant incidents and UUM codes
   → Scan results become input to context-aware suggestions in design fields

4. System Design
   → 8 sections filled, each field shows suggestions from static DB + scan findings
   → SuggestInput portals dropdown to document.body (avoids overflow clipping)
   → Tech Review Mode: specific fields locked by named role
   → Role owners can edit their sections via email-matched access

5. Phase 2 injection
   → User toggles incidents and UUM codes
   → toggleInc / toggleUUM update store, set isDirty
   → If tasks already generated: tasksStaleReason set → amber banner in Gantt

6. Gantt generation
   → realTasks.js + incidentFixTasks.js produce raw task list from ctx + selInc + selUUM
   → enrichTask() adds 7-point FSM metadata per task (pure regex patterns)
   → calcDates() schedules tasks in working hours, skipping weekends + changePeriods
   → computeCPM() identifies critical path and float
   → Optional: Groq deepens selected tasks via CF Worker

7. Matrix
   → collectAllTasks() aggregates all tasks across roles and layers
   → 8 swimlanes rendered; FSM detail panel opens on task click
   → Coherence alerts visible in AgentInsights strip at top

8. RTM
   → resolveUUM() + catalog lookup builds row list from selInc + selUUM + customInc + customUUM
   → QA Lead marks each row; All PASS / All N/A shortcuts available
   → signRtm() sets rtmSigned, clears rtmStale

9. CAB
   → setCabApproved(true) or setCabDeclined(true)
   → Decline: unlockedForRevision → all tabs open; tasksStaleReason set
   → Resubmit: resubmitCAB() clears both flags, returns to pending

10. Cutover + Closure
    → setPromoted(true) → Live badge on Executive Summary
    → Closure checklist items ticked; notes saved
    → isDirty set true throughout → Unsaved dot pulses in header

11. Save
    → localSaveBuild() writes full store snapshot to IndexedDB
    → cloudSaveBuild() pushes to Firestore in background (Pro+)
    → isDirty cleared, currentBuildId set

12. Export
    → exportExcel() builds 14-sheet workbook using xlsx-js-style
    → Sheets: Executive Summary, Infrastructure Diagram, Platform Topology, Mission Intel,
      CMDB Register, Incidents, UUM Items, RTM Checklist, Gantt Timeline, RAID Registry,
      System Design, RACI Matrix, Emergency Changes, Closure Summary
    → Mission Intel sheet renders the same rule-based architecture intelligence as the
      InfraDiagramTab: context signals, RTM status, business/functional/technical layers,
      next steps, plus the structural ASCII map and functional flow in monospace rows
    → File downloaded directly from browser, no server involved
```

---

## Why this structure reduces chaos

The chaos in ground-level operations work comes from five gaps. The tool closes each one explicitly.

**Gap 1: No one agreed on what the stack actually is.**
Phase 1 forces this. One source of truth for hardware, OS, DB, application — before any design work starts.

**Gap 2: Risks were known but not written down.**
The incident catalog and UUM catalog are the accumulated patterns of what goes wrong on each combination of stack. Selecting them is a forcing function: you cannot ignore a known risk by not mentioning it.

**Gap 3: Tasks were listed but not sequenced.**
The Gantt does not just list tasks. It schedules them with real working hours, flags the critical path, and blocks parallel tasks from hiding their dependencies. If task B depends on task A, that is explicit in the data, not just in someone's head.

**Gap 4: "Done" was declared before it was verified.**
The RTM row must be explicitly PASS, FAIL, NA, or BLOCKED. Not blank. Not assumed. The QA Lead signs it. If something changes after sign-off, the system marks it stale — it does not silently stay green.

**Gap 5: The left hand did not know what the right hand was doing.**
The coherence engine watches all 12 state dimensions simultaneously. When two tabs drift out of alignment — design changed after tasks generated, incidents added after RTM signed, EOL approaching within project window — it surfaces that drift immediately without waiting for a human to notice.

The result is not a perfect project. The result is a project where every known gap was addressed before work started, and any drift that occurred during planning was caught and re-verified before cutover.

---

## File map (where to find things)

```
src/
  store/useStore.js          — all application state; every action defined here
  lib/
    coherenceEngine.js       — 12 cross-tab checks; pure functions; no React
    useCoherenceEngine.js    — React hook that runs checks on every state change
    realTasks.js             — task catalog: what tasks does each stack combo produce
    incidentFixTasks.js      — task catalog: what tasks does each incident produce
    taskMetadata.js          — 7-point FSM enrichment per task (30+ regex patterns)
    smartScan.js             — rule-based CVE/EOL scan against stack selection
    eolApi.js                — endoflife.date REST client + 60+ product slug mappings
    exportExcel.js           — 14-sheet Excel export (incl. Mission Intel architecture sheet)
    db.js                    — IndexedDB wrapper (Dexie)
    firebase.js              — Firestore cloud sync
    auth.js                  — plan tiers, feature gates, seeded accounts
    roleAccess.js            — email-matched RACI access control
  components/
    PhasePanel.jsx           — left sidebar: all phase controls, save/load, export
    ExecOverview.jsx         — top strip: KPI tiles, milestones, unsaved indicator
    PmTabs.jsx               — tab bar + tab routing + coherence hook mount point
    AgentInsights.jsx        — advisory strip shown at top of each tab
    tabs/
      SystemDesignTab.jsx    — 8-section design form
      GanttTab.jsx           — Gantt chart + CPM + FSM panel + Groq deepening
      MatrixTab.jsx          — 8-swimlane dependency matrix
      RtmTab.jsx             — requirements traceability table + sign-off
      CmdbTab.jsx            — live EOL lookup + UUM keyword matcher
      RaidTab.jsx            — risks, assumptions, issues, decisions log
      RolesTab.jsx           — 20-role RACI table
      ClosureTab.jsx         — post-go-live checklist
      ExecSummaryTab.jsx     — executive summary + incident/UUM/fix selection
workers/
  ai-worker.js               — Cloudflare Worker: Groq proxy (task enrich + UUM search)
  stripe-worker.js           — Cloudflare Worker: Stripe checkout + webhook handler
public/
  sw.js                      — service worker: cache-first static, network-first HTML
  manifest.json              — PWA manifest
  slides.html                — standalone presentation deck
```

---

## One sentence summary

OpsManifest is a pre-work guide that turns the five most common causes of operations chaos — undefined stack, unacknowledged risks, unsequenced tasks, assumed sign-offs, and undetected drift — into explicit, signed-off, traceable decisions before a single change ticket is raised.
