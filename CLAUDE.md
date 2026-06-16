# Infra Lifecycle App — Claude Guide

## What this is

Enterprise Infrastructure Lifecycle Engine — a React SPA that walks infra PMs through the full server provisioning workflow: from hardware/OS selection through system design, incident triage, CAB approval, RTM sign-off, and project closure. Not a CMDB, ITSM, or replacement for ServiceNow/Jira/Confluence — a structured pre-work guide that makes those systems more accurate.

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 19 + Vite 8 |
| Styling | Tailwind CSS v3 + custom CSS in `index.css` |
| State | Zustand v5 (`src/store/useStore.js`) |
| Local storage | Dexie.js v4 (IndexedDB) — replaces localStorage for builds |
| Cloud sync | Firebase Firestore (Pro+ users) — see setup below |
| AI integration | Rule-based local scan + Groq API via `workers/ai-worker.js` CF Worker |
| Excel export | `xlsx-js-style` (npm — fork of SheetJS with cell style support) |
| Hosting | Cloudflare Pages (migrated from Netlify — credits exhausted) |
| Repo | github.com/joyfulmake/infra-lifecycle-engine |

## Firebase / Firestore setup (Pro+ cloud sync)

Cloud sync is **live** (`FIREBASE_CONFIGURED = true` in `src/lib/firebaseConfig.js`). Real credentials are in place.

Setup steps for a fresh project:
1. Go to https://console.firebase.google.com → Create project
2. Project Settings → Your apps → Add Web app → copy the config
3. Authentication → Sign-in method → Enable **Email/Password**
4. Firestore Database → Create database → **Production mode**
5. Firestore → Rules → paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userEmail}/builds/{buildId} {
      allow read, write: if request.auth != null
                        && request.auth.token.email == userEmail;
    }
  }
}
```

6. Edit `src/lib/firebaseConfig.js` — paste real config values, set `FIREBASE_CONFIGURED = true`
7. Build and deploy

**How cloud sync works:**
- **All plans** → Dexie.js (IndexedDB, local browser storage)
- **Pro+ signed in with sync password** → IndexedDB + Firestore bidirectional sync
- On sign-in: pulls cloud builds → merges with local (cloud wins if newer)
- On save: writes to IndexedDB immediately + pushes to Firestore in background
- On new device: sign in with same email + same sync password → builds restore from Firestore

## Running locally

```bash
export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh"  # activate Node 20
npm run dev      # Vite dev server at http://localhost:5173
npm run build    # production build → dist/
npm run preview  # serve dist/ locally
```

## Project structure

```
src/
  App.jsx                 — root layout (PhasePanel | ExecOverview + PmTabs)
  main.jsx                — React entry point
  index.css               — global styles incl. tab-btn, tab-btn-active, scrollbar
  store/
    useStore.js           — single Zustand store; all app state lives here
  components/
    PhasePanel.jsx        — left sidebar (320px, w-full): phase workflow, save/load builds, export
    ExecOverview.jsx      — top strip (96px): KPI tiles, milestones, unsaved indicator
    PmTabs.jsx            — tab bar + renders active tab component
    AuthModal.jsx         — sign-in / plan selection modal
    tabs/
      ExecSummaryTab.jsx  — executive summary & incident/UUM/fix selection
      SystemDesignTab.jsx — 8-section system design form (AI suggestions, presentation mode, tech review lock)
      InfraDiagramTab.jsx — connected infrastructure topology diagram (SVG-style layered boxes)
      RtmTab.jsx          — Requirements Traceability Matrix with pass/fail + All PASS/NA buttons
      GanttTab.jsx        — Gantt chart + 7-point FSM panel per task (⏱ Schedule / ⬡ FSM State tabs); Groq AI Deepen button
      MatrixTab.jsx       — Universal Cross-Stack Dependency Matrix: 8 swimlane layers, task cards by role, FSM detail side panel, Groq enrichment
      RaidTab.jsx         — RAID log (Risks, Assumptions, Issues, Decisions)
      ClosureTab.jsx      — post-go-live closure checklist & notes
      RolesTab.jsx        — 20-role RACI table; editable by PM/backup (Pro+); view-only for all plans
    AgentInsights.jsx   — compact cross-tab advisory panel; takes `tab` prop; reads `coherenceAlerts` from store; collapses to single-line strip, expands to full list; blue = info, amber = warn; rendered at top of ExecSummary, SystemDesign, RTM, Closure, Roles tabs
  lib/
    incidents.js          — incident catalog
    uumItems.js           — UUM (Unix/User/Middleware) catalog
    realTasks.js          — build task catalog
    designTasks.js        — AI design task definitions
    designDefaults.js     — default values per HW/OS/DB/APP combo
    incidentFixTasks.js   — fix task definitions per incident
    smartScan.js          — standalone CVE/EOL scan + auto-suggest incidents/UUM codes
    suggestDb.js          — suggestion engine: `matchSuggestKeys(val, fieldId, minChars=3)` (static DB) + `buildContextSuggestions(val, fieldId, ctx, sysDesignData, scanResults)` (context-aware, used by SuggestInput in PhasePanel)
    roleAccess.js         — email-match role-based access: `getUserRolesForBuild(authUser, roleAssignments)`, `canEditDesignSection(userRoles, sectionKey)`, `isQATeamLead(authUser, roleAssignments)`; `ROLE_SECTION_MAP` maps RACI roles to design section keys
    infraMap.js           — pure functions (no React, no deps): `buildStructuralMap(state)` → 80-char box-drawing ASCII architecture map; `buildFunctionalFlow(state)` → traffic/data flow diagram; `buildCompatibilityMatrix(state)` → markdown lifecycle/EOL table; `buildRuleBasedMissionIntel(state)` → 4-section MissionHelp analysis (signals, RTM note, business/functional/technical layers, next steps). All driven from Zustand state snapshot. Used by InfraDiagramTab ASCII Map and Mission Intel views.
    coherenceEngine.js    — pure `runCoherenceChecks(stateSnapshot)` → `[{ id, severity, tabs, message, action }]`; no React, no deps; runs 14 cross-tab checks: 1–12 existing; 13: TLS 1.0/1.1 deprecated cipher detection + PCI-DSS cipher gap; 14: custom UUM entry EOL proximity warning + migration-without-Phase2 hint
    useCoherenceEngine.js — React hook; debounces 600ms; watches selInc/selUUM/sysDesignData/requirements/rtmRows/roleAssignments/liveEolData; calls `setCoherenceAlerts`; mounted in PmTabs
    eolApi.js             — endoflife.date REST client; `fetchProductCycles(slug)`, `searchProducts(query)`, `fetchComponentLiveData(componentName)`, `cycleLiveStatus(cycle)`; `EOL_SLUG_MAP` maps 60+ component names to API slugs; `daysUntil()`, `securityOnlyStatus()`, `LtsBadge`, `DaysChip`, `ExtendedSupportChip` helpers live in CmdbTab.jsx
    exportExcel.js        — 14-sheet styled Excel export using xlsx-js-style; sheet 4 "Mission Intel" renders buildRuleBasedMissionIntel + buildStructuralMap + buildFunctionalFlow (ASCII maps in monospace dark-fill rows); UUM Items sheet includes custom UUM entries (✦ suffix, CUSTOM status)
    db.js                 — Dexie IndexedDB wrapper (localGetBuilds, localSaveBuild, localDeleteBuild)
    firebase.js           — lazy Firebase singleton (fbSignIn, fbSignOut, cloudSaveBuild, cloudLoadBuilds)
    firebaseConfig.js     — Firebase project config + FIREBASE_CONFIGURED flag
    useBuildsDb.js        — React hook: IndexedDB + optional Firestore sync (useLiveQuery)
    auth.js               — local auth (signIn, signOut, PLANS, canUseFeature, trySilentFirebaseAuth)
    taskMetadata.js       — `enrichTask(task, ctx)` → 7-point FSM metadata (hwDimension, preCondition, execEngine, postValidation, blastRadius, downstream, fsmState); 30+ regex patterns; `FSM_STATE_STYLE`, `HW_DIM_ICON`
    groqConfig.js         — `GROQ_CONFIGURED` flag + `GROQ_WORKER_URL` (off by default)
    groq.js               — (updated) `analyzeMissionContext(stateSnapshot)` → `/groq-mission-analysis` worker; returns `{ analysis: { contextExtraction, deliveryRTM, architectureMap: {business,functional,technical}, compatibilityRisks, nextSteps } }`
    groq.js               — `enrichTaskWithGroq(task, ctx, existingMeta)` + `suggestWithGroq(ctx, query)` — calls `workers/ai-worker.js`
    AuthContext.jsx        — auth React context + provider
```

## State management

All state is in `src/store/useStore.js`. Key slices:

- `ctx` — selected hw/os/db/app
- `requirements` — project name, env type, go-live date, SLA, projectStartDate, hoursPerDay, etc.
- `isBuilt / scanComplete / designApplied / phase2Active / cabApproved / cabDeclined / rtmSigned / promoted` — linear workflow gates
- `selInc / selUUM / selFix` — selected incident/UUM/fix codes (plain arrays, not Sets)
- `customInc` — user-added custom incidents `[{ id, code, short, txt, grp, sev, owner }]`
- `sysDesignData` — nested object keyed by section → field
- `lockedDesignFields` — `{ 'section.field': { lockedBy, value } }` — tech-review locked fields
- `rtmRows` — `{ [id]: 'PASS' | 'FAIL' | 'PENDING' | 'NA' | 'BLOCKED' }`
- `closureChecks / closureNotes` — closure tab state
- `emergencyChanges` — emergency change log entries
- `selRegions` — active regions array e.g. `['Production', 'Model']`
- `changePeriods` — `[{ id, type: 'freeze'|'holiday'|'break', label, start, end }]` — blocks Gantt date calc
- `ganttOverrides` — `{ [taskKey]: { durationHours, dep, parallel } }` — Pro+ inline task edits
- `isDirty` — true whenever state has changed since last save or load; drives "Unsaved" indicator
- `currentBuildId` — ID of the currently loaded/saved build; enables "Update Build" in-place save
- `coherenceAlerts` — `[{ id, severity: 'warn'|'info', tabs: string[], message, action }]` — set by `useCoherenceEngine` hook; read by `AgentInsights`; NOT persisted to Dexie/Firestore (recomputed on load)
- `unlockedForRevision` — set true after CAB decline when PM clicks "Unlock Tabs for Revision"; bypasses all tab locks in PmTabs; also auto-sets `tasksStaleReason`; cleared by `resubmitCAB()`
- `tasksStaleReason` — string message set when design/incidents/periods/schedule change after tasks generated; shown as amber banner in GanttTab with Regenerate button; cleared by `setTasksStaleReason(null)` + `setAiTasks([])`; also set by `setUnlockedForRevision(true)` when `designApplied`
- `rtmStale` — boolean; set true when incidents/design change after `rtmSigned`; cleared by `signRtm()` or `setRtmStale(false)` (dismiss button in RTM tab); shown as amber advisory banner in RtmTab; amber dot on RTM tab in PmTabs
- `roleAssignments` — `{ [roleName]: { name, email, backup, raci } }` — RACI assignments for 20 standard roles
- `requirements.pmEmail` / `requirements.pmBackupEmail` — restrict Roles tab editing to these accounts (Pro+)

Key actions: `markDirty()`, `markClean()`, `setCurrentBuildId(id)` — called by PhasePanel on save/load. Every significant state action automatically sets `isDirty: true`.
New actions: `setUnlockedForRevision(val)`, `setTasksStaleReason(reason)`, `setRtmStale(val)`, `setRoleAssignment(role, data)`, `resubmitCAB()` — resets cabDeclined + unlockedForRevision.

## Agent Intelligence — cross-tab coherence

**Pattern**: Tabs behave as loosely-coupled agents sharing a semantic context bus (Zustand store). The coherence engine detects drift between tabs and emits advisories without page reloads, API calls, or heavyweight dependencies.

**Flow**:
1. Any significant state change updates Zustand
2. `useCoherenceEngine` (mounted in `PmTabs`) debounces 600ms then calls `runCoherenceChecks(snapshot)`
3. `runCoherenceChecks` runs 11 rule-based checks (pure JS, no external deps) and returns `coherenceAlerts[]`
4. `setCoherenceAlerts(alerts)` updates the store
5. `AgentInsights` panels in each tab read the store and render relevant alerts

**Adding a new check**: add a block to `runCoherenceChecks` in `coherenceEngine.js`. Each alert must have: `id` (unique string), `severity` ('warn'|'info'), `tabs` (array of tab IDs that should show it), `message` (user-facing string), `action` (short hint, optional).

**Tab dot colors**: blue dot = coherence insight; amber dot = stale/needs-review (existing system). Both can appear simultaneously on the same tab label.

**Not persisted**: `coherenceAlerts` is runtime-only and not saved to Dexie or Firestore. It is recomputed whenever relevant state changes. `loadBuild` does not need to restore it.

## Tab badges and advisory protocol

- **Gantt tab**: amber pulsing dot appears when `tasksStaleReason` is set; banner inside tab shows reason + Regenerate button
- **RTM tab**: amber pulsing dot appears when `rtmStale` is true; banner inside tab prompts re-review + dismiss
- **Exec tab**: green "Live" badge appears when `promoted` is true
- **System Design tab**: advisory bar when `designApplied` warns that changes will mark tasks stale
- **Revision Mode** (PmTabs amber banner): shown when `unlockedForRevision`; all tabs unlocked regardless of phase gates

Exported constants: `DESIGN_SECTIONS`, `FIELD_LABELS`, `HW_OPTIONS`, `OS_OPTIONS`, `DB_OPTIONS`, `APP_OPTIONS`.

## Gantt tab — date scheduling

- `addWorkingHours(start, hours, hpd, blocked)` — advances a date by working hours, skipping weekends AND any day inside a `changePeriods` entry (freeze/holiday/break)
- `calcDates(tasks, startDateStr, hpd, overrides, blocked)` — schedules all tasks sequentially; tasks with `parallel: true` share the previous sequential task's start date
- `BUFFER = 1.3` — 30% buffer applied to all raw task hours
- `taskKey(task, i)` — stable key: `task.id || task.title || task.name || String(i)`; UUM tasks suffixed with `:uumCode`
- Change period end date auto-populates to start date when start is set (user can extend)
- `min` attribute on end date input prevents setting end before start

## Unsaved changes / build sync

- Pulsing amber "Unsaved" dot appears in ExecOverview top strip whenever `isDirty` is true
- Saved Builds panel shows amber "Unsaved changes / Update Build" banner when `isDirty && currentBuildId`
- "Update Build" saves current state under the same build ID without prompting for a new name
- "Save as new build…" input creates a fresh build entry (new ID)
- Loading a build warns "Unsaved changes will be lost" if `isDirty` is true
- All tab changes (incidents, design fields, RTM rows, Gantt overrides, closure, CAB, etc.) feed into `isDirty` automatically via the store

## Store submission (Microsoft Store + Meta Quest)

Full step-by-step guide: **`STORE_SUBMISSION_GUIDE.md`** in this repo root.

**Current status:** v1.9.0.0 in progress — OpsMentor intelligence upgrades: SET_DESIGN_FIELD covers all 8 sections (unix/web/app/db/storage/backup/network/security), permission fix for guest builds, anti-parroting (silent actions), GanttTab per-UUM inline task adding with delete, RAID custom entries with edit/delete.

**Version history:**
- v1.0.0.0 — initial submission; failed (crash at launch, Windows 11 24H2)
- v1.0.1.0 — crash fixes: `MaxVersionTested` bumped, `orientation` removed from manifest, Firebase CSP domains added
- v1.1.0.0 — major feature release: guided sidebar roadmap (7-step numbered, always-visible), Gantt locked to `designApplied`, System Design PM edit override, CMDB live EOL API, coherence engine, DemoTour, batch job tasks, CSP workers.dev added, SW cache v2 + endoflife.date excluded from cache; submitted 2026-06-04, failed (crash at launch on OS build 10.0.26200)
- v1.2.0.0 — crash fix: `MaxVersionTested` bumped to `10.0.26200.0`; removed `uap3:AppUriHandler` extension; submitted 2026-06-05, failed (crash still on OS build 26200 — revision component mismatch)
- v1.3.0.0 — crash fix: `MaxVersionTested` set to `10.0.65535.65535` (schema max — covers all revisions of all builds); `Windows.Universal` → `Windows.Desktop` (correct device family for desktop PWA); added `ApplicationContentUriRules` for nav scope; removed `orientation` from `manifest.json` (was re-introduced after v1.0.1.0 fix); Partner Center: only Windows 10 Desktop family checked; submitted 2026-06-07, failed (blank screen on 26100.3194 — Netlify credits exhausted, site unavailable)
- v1.4.0.0 — hosting migrated from Netlify to Cloudflare Pages (`https://opsmanifest.pages.dev`); StartPage and ACUR rules updated; `_redirects` replaced with `404.html` copy (CF Pages SPA fallback); submitted 2026-06-09; failed (blank screen — same pattern as v1.3, `pages.dev` likely unreachable from Microsoft lab)
- v1.5.0.0 — MSIX: StartPage gets trailing slash, explicit root ACUR rule added alongside wildcard; root React error boundary added (no blank screen on crash); 12s splash fallback shows retry instead of forever-spinner when JS bundle fails to load; service worker offline response returns branded error page; MissionHelp architecture intelligence added (ASCII Map + Mission Intel views in InfraDiagramTab); TLS/cipher and custom-entry compatibility coherence checks added; Excel export gains Mission Intel sheet (signals/RTM/layers/next steps + ASCII maps) and custom UUM rows; submitted 2026-06-11; failed (12s fallback fired — "Unable to load. Please check your connection." — `pages.dev` unreachable from lab, same root cause as v1.3–v1.4)
- v1.6.0.0 — **Architecture change: fully packaged web app.** Build workflow now runs `npm ci && npm run build`, copies `dist/` into the MSIX package root, and sets `StartPage="index.html"`. App loads from `ms-appx-web:///` with zero network dependency. ACUR updated to `ms-appx-web:///` rules. Firebase/Groq `fetch()` calls still hit the internet at runtime — only the app shell load is offline. Eliminates every CDN-reachability failure permanently. **Submitted 2026-06-15; failed — crash at launch on OS build 26200.8116 (Windows 11 24H2). JS bundle ran but service worker intercepted ms-appx-web: scheme fetch events, crashing WebView2 renderer.**
- v1.7.0.0 — **Service worker disabled in ms-appx-web context.** `main.jsx` skips SW registration when `window.location.href` starts with `ms-appx-web:`. `sw.js` no-ops all event listeners when `self.location.protocol === 'ms-appx-web:'`. Global `unhandledrejection` handler added to `main.jsx` — prevents async API failures (Firebase, IndexedDB) from terminating the WebView2 renderer on Win 11 24H2+.
- v1.9.0.0 (in progress) — **OpsMentor intelligence upgrade.** SET_DESIGN_FIELD now covers all 8 design sections (was silently blocked for unix/web/app/db and for guest builds with no PM email set). Design field regex expanded to all section keys + natural-language aliases. Silent-action anti-parrot: add-incident, add-UUM, add-RAID, set-design-field now emit empty reply text — the result pill confirms execution without echoing the user's words. GanttTab: per-UUM-group inline task adding (`AddTaskRow` + `CustomTaskList` components); global Custom Tasks section always shown with per-task delete (✕ on hover); `customSectionTasks` persisted to Dexie/Firestore via loadBuild. RAID tab: full custom entry form with edit/delete/eta; DECISION type added; auto-rows include custom incidents and custom UUM items.
- v1.8.0.0 — **OpsMentor agent-first UX.** Azure Neural TTS (Jenny Neural) via Web Audio API (`AudioContext.decodeAudioData` + `BufferSourceNode`) — eliminates CSP blob: block that was silently killing audio; Web Speech API fallback removed entirely. Field interview echo eliminated: chips and voice input no longer repeat user selections back; only show next question. Voice feedback loop fixed: SpeechRecognition pauses during TTS playback + 3s dedup on identical transcripts + 8s dedup on TTS. ScanModal auto-closes 4s after completion (countdown on button) — modal can never trap the user while OpsMentor is waiting for input. LLM-generated opening assessment on builds with data (INITIAL_ASSESSMENT pattern). CSP `media-src 'self' blob:` added. `isCommand` escape expanded for free-form content commands (add risk/task/design field).

**Root cause of blank screen / "unable to load" (v1.3–v1.5)**: Microsoft's certification lab cannot reach `*.netlify.app` or `*.pages.dev` CDN subdomains. For a hosted web app MSIX, the entire app shell (HTML + JS bundle) must be fetched from the CDN every launch — if the CDN is unreachable, nothing loads. v1.5 improved the UX (retry message instead of infinite spinner) but did not fix the root cause. v1.6 eliminates the dependency entirely by bundling the app into the MSIX package itself.

**Root cause of 26200 crash**: Three layered issues. (1) `MaxVersionTested` was `10.0.26100.0` / `10.0.26200.0` — when OS version (including 4th revision component) exceeds MaxVersionTested, Windows applies a compatibility shim that breaks hosted web apps. Real devices run e.g. `10.0.26200.2630`, so `.0` revision is always exceeded. Fix: use `10.0.65535.65535` (schema maximum — each component is capped at 65535). (2) The `uap3:AppUriHandler` extension referenced `opsmanifest.netlify.app` but no `.well-known/windows-app-web-link` file exists; Windows 26200 tightened domain verification (removed in v1.2.0.0). (3) `TargetDeviceFamily Name="Windows.Universal"` is the UWP multi-device family — desktop PWA Store apps should use `Windows.Desktop`.

After approval, follow Part 5 of the guide (post-certification steps).

**Microsoft Store URL:** _(pending certification — update here once live)_

**Assets in place:**
- `public/icon-192.png` and `public/icon-512.png` — generated by `scripts/gen-icons.mjs` (navy background, blue-teal gradient tile, white ring mark)
- `public/privacy.html` — full privacy policy at `https://opsmanifest.pages.dev/privacy.html`
- `public/manifest.json` — has `id`, `scope`, `prefer_related_applications: false`, separate `any` + `maskable` icon entries, `edge_side_panel` for Edge sidebar, `dir: ltr`, `lang: en-GB`
- `.github/workflows/build-msix.yml` — builds unsigned MSIX on GitHub Actions (Windows runner); defaults set to correct Partner Center identity values

**To regenerate icons:** `node scripts/gen-icons.mjs` (requires `pngjs` devDependency — already installed)

**To rebuild the MSIX:** Go to https://github.com/joyfulmake/infra-lifecycle-engine/actions → "Build MSIX for Microsoft Store" → Run workflow with defaults. Download the `opsmanifest-msix` artifact. For updates, bump the `app_version` input (must be higher than the current published version).

**Partner Center identity (hardcoded as workflow defaults):**
- Package name: `Flourishing.opsmanifest`
- Publisher ID: `CN=CF05ACFD-1A2C-4D3B-85CE-80828C73812E`
- Publisher display name: `Flourishing`

**Post-certification checklist (run once Microsoft approves):**
1. Confirm "In the Store" status in Partner Center dashboard
2. Note the Store URL (`apps.microsoft.com/store/detail/...`) and replace the placeholder above
3. Add Microsoft Store badge link near the "About this tool" link in the sidebar footer
4. Update `public/slides.html` last slide with the Store URL — then `git push origin main`
5. See `STORE_SUBMISSION_GUIDE.md` Part 5 for full detail

**Meta Quest steps:**
1. pwabuilder.com → enter `https://opsmanifest.pages.dev` → "Package for Store" → Meta Quest
2. Submit via https://developers.meta.com/horizon/
3. Note: Meta requires landscape — already set in manifest

**Screenshots:** Recommended before the app goes live. Take 1366×768 or 1920×1080 screenshots of: Phase 1 build screen, System Design tab, Gantt tab, RTM tab. Upload in the Partner Center listing page.

## Disclaimer + presentation

- Disclaimer shown at bottom of left sidebar (10px, muted) explaining the tool's scope
- "About this tool ↗" link points to `/slides.html`
- **Presentation deck**: https://opsmanifest.pages.dev/slides.html — 10-slide standalone HTML, keyboard/click navigation, no dependencies

## AI integration

Two AI layers — both use the CF Worker proxy pattern to keep API keys out of the browser.

### Rule-based (always on)
- **AI Smart Scan** (`src/lib/smartScan.js`) — standalone CVE/EOL/security scan, no API key, runs in-browser
- **Task metadata enrichment** (`src/lib/taskMetadata.js`) — `enrichTask(task, ctx)` derives 7-point FSM metadata from 30+ regex patterns over task name/role/dep fields

### OpsMentor — LLM-powered advisor (via Groq + `workers/ai-worker.js`)

OpsMentor is the app's embedded AI agent. Key behavioral contract:
- **Opening assessment**: when opened on any build with data, calls `/orchestrator-chat` with a special `INITIAL_ASSESSMENT` prompt. Treats all entered data as approved. Surfaces only non-obvious risks, EOL windows, or gaps. Never narrates what the user already did.
- **Proactive actions**: the opening LLM response includes `ADD_RAID_ENTRY`, `ADD_CUSTOM_TASK`, and `SET_DESIGN_FIELD` actions without the user asking. These are applied immediately (no confirmation needed).
- **Blank builds only**: static warm welcome + hardware chips shown when truly nothing is entered.
- **Voice**: Azure Neural TTS (Jenny Neural, free tier) is the ONLY voice. No Web Speech fallback. Uses Web Audio API (`AudioContext.decodeAudioData` + `BufferSourceNode`) — avoids CSP `blob:` media restrictions. `unlockAudio()` creates and resumes a shared `AudioContext` in the gesture handler (gesture context required). SpeechRecognition is paused during TTS playback to prevent acoustic feedback. TTS dedup: same excerpt skipped within 8s. Voice input dedup: same transcript skipped within 3s. Worker: `/cartesia-tts` endpoint tries Azure first, then Cartesia, then ElevenLabs.
- **System Design from Phase 1**: when design is empty but stack is known, the opening assessment suggests specific `SET_DESIGN_FIELD` values derived from the hw/os/db/app configuration.
- `buildWelcome()` and `buildVoicePrompt()` are fallback-only now — only used when the LLM call fails or on a blank build.

Worker routes relevant to OpsMentor:
- `POST /orchestrator-chat` — main chat; `INITIAL_ASSESSMENT` prefix triggers expert opening brief
- `POST /cartesia-tts` — TTS; tries Azure Neural first, then Cartesia, then ElevenLabs
- `GET /health` — returns `{tts:{azure,cartesia,elevenlabs,voice}}`

**Rule 15 in worker system prompt**: when `message` starts with `INITIAL_ASSESSMENT`, do not narrate, do not ask for data already visible, include proactive actions, keep reply to 2–4 sentences.

**Action confirmation rules**: `ADD_RAID_ENTRY`, `ADD_CUSTOM_TASK`, `SET_DESIGN_FIELD` require no confirmation. `APPLY_DESIGN`, `INJECT_PHASE2`, `SUBMIT_CAB`, `SIGN_RTM`, `PROMOTE`, `UNLOCK_FOR_REVISION`, `RESUBMIT_CAB`, `ADD_INCIDENT`, `ADD_UUM_ITEM` always require confirmation.

### Groq AI (opt-in — `GROQ_CONFIGURED` in `src/lib/groqConfig.js`)
- **Worker**: `workers/ai-worker.js` — deploy as `opsmanifest-ai` CF Worker; requires `GROQ_API_KEY` env var
- **Routes**: `POST /groq-enrich` (deepens a task's FSM metadata), `POST /groq-suggest` (top-5 stack risks), `POST /groq-uum-search` (UUM keyword AI search), `POST /groq-mission-analysis` (Mission Intel)
- **Model**: `llama-3.3-70b-versatile` (overridable via `GROQ_MODEL` worker env var)
- **UI**: "✦ AI Deepen — Groq" button appears in the Gantt FSM panel and Matrix FSM detail panel when configured; AI-enhanced fields shown with teal "✦ AI" badge; adds CVE Risks + Best Practice fields
- **To activate**:
  1. `wrangler deploy workers/ai-worker.js --name opsmanifest-ai --compatibility-date 2026-06-15` (use this date — 2026-06-16 causes API errors)
  2. Set `GROQ_API_KEY`, `AZURE_TTS_KEY`, `AZURE_TTS_REGION` in Cloudflare Workers → Settings → Variables
  3. Set `GROQ_WORKER_URL` + `GROQ_CONFIGURED = true` in `src/lib/groqConfig.js`
  4. Build and deploy

Always keep the proxy pattern — never call `api.groq.com` or Azure Speech directly from the frontend.

### endoflife.date Live API (CMDB tab — always on, no key required)
- **Module**: `src/lib/eolApi.js` — REST client for `https://endoflife.date/api`
- **EOL_SLUG_MAP**: 60+ component-to-product-slug mappings (OS, DB, App/Middleware)
- **Stack Live Check** (`StackLiveCheck` in CmdbTab.jsx): fully rewritten. Resolves ALL 4 stack components even when not in EOL_SLUG_MAP. `resolveComponentToSlug(name)` tries: (1) exact EOL_SLUG_MAP key, (2) case-insensitive key, (3) 50+ keyword token map (e.g. "jboss" → "jboss-eap"), (4) `searchProducts()` API fallback. Cycle matching: exact → numeric-prefix → `cycles[0]`. Errors show as amber `⚠ API Error` badge (was invisible `text-slate-300`). Columns: Component · API Slug · Cycle · Latest · Released · Last Patch · **EOS** · **EOL** · **EOSL/ESU** · **Security-Only** · **LTS** · **Next Milestone** · Live Status. Security-Only = period between EOS and EOL (security patches only). EOSL/ESU = Extended Security Updates / End of Software Life. Next Milestone = nearest upcoming date with countdown. All Cycles accordion at the bottom shows every tracked cycle for each component. Components selected via Live API (FilteredSuggestInput) are now resolved via token map or searchProducts fallback.
- **Live Search**: any of 500+ products by keyword; same enhanced columns
- **UUM Keyword Matcher**: free-text input in CMDB tab; scores entire ALL_UUM catalog by keyword overlap; toggle-add matched items to selUUM; live API EOL context fetched in parallel
- **Lifecycle data surfaces**: `cycle.lts` (LTS flag/date), `cycle.extendedSupport` (ESU availability), `cycle.support` vs `cycle.eol` delta = security-only period detection, day-precise countdown chips (red <90d, amber <1yr, months otherwise), `cycle.latestReleaseDate` (last patch date)
- **Store**: `liveEolData: { [componentName]: { slug, resolvedFrom, matchedCycle, allCycles, fetchedAt, error? } }` — non-persisted runtime state; `setLiveEolData(componentName, data)`. `resolvedFrom` = 'map' | 'map-ci' | 'token' | 'api-search' (shown as small label under component name)
- **Coherence check 12**: `runCoherenceChecks` emits `live_eol_detected` (warn) / `live_eos_soon` (info) alerts when live API confirms EOL/EOS-soon stack components
- **CSP**: `https://endoflife.date` added to `connect-src` in `netlify.toml`
- **Build phase live search**: `FilteredSuggestInput` in PhasePanel queries endoflife.date on 3+ chars alongside catalog; shows "Live API" section in dropdown with lifecycle badge per result; any API result can be selected as ctx value

### Tab sync via coherence engine
All AI outputs feed into the Zustand store. `useCoherenceEngine` (mounted in PmTabs) now watches 12 state slices including `liveEolData`, runs checks on every state change, and emits `coherenceAlerts` read by `AgentInsights` panels. The Matrix tab recomputes from `selInc`/`selUUM`/`designApplied` reactively — no manual sync needed.

## Critical Path Method (Gantt tab)

- `computeCPM(tasks, dates, overrides, hpd, blocked)` in `GanttTab.jsx` — pure JS, no deps
- **Model**: sequential tasks = critical path (any delay propagates to project end); parallel tasks have float
- **Slack for parallel tasks**: working-day gap between parallel task end and next sequential task start
- **UI**: CP badge (red, `CP` label) on critical-path tasks; `+Nd` float indicator on parallel tasks; Gantt header shows "CP: N · Float: N" summary
- The critical path logic is accurate for the OpsManifest scheduling model where tasks are sequential by default with optional parallelism

## Styling conventions

- Tailwind utility classes for layout and spacing
- Custom semantic classes in `index.css`: `tab-btn`, `tab-btn-active`, scrollbar styles
- Left panel background: `#1A2E4A` (navy), width: `320px` — set via inline style on the wrapper div in App.jsx; PhasePanel root uses `w-full` to fill it
- ExecOverview height: exactly `96px` via inline style

## Deployment

Live URL: **https://opsmanifest.pages.dev** _(Cloudflare Pages — migrated from Netlify 2026-06-09)_
Presentation: **https://opsmanifest.pages.dev/slides.html**
Cloudflare Pages admin: https://dash.cloudflare.com → Pages → opsmanifest

Cloudflare Pages config (via `public/_redirects` and `public/_headers`):
- SPA redirect: `_redirects` → `/* /index.html 200`
- Security headers + CSP: `_headers` → applied to `/*`
- Note: `/slides.html` is a static file in `public/`, served directly by Cloudflare without needing the SPA redirect

**⚠ 2026-06-11 incident — Pages project vanished:** `opsmanifest.pages.dev` went NXDOMAIN (the `opsmanifest` Pages project no longer existed in the Cloudflare account — likely the cause of the v1.4 "blank screen" cert failure, not just MS lab firewalls). Project was recreated the same day via `wrangler pages project create opsmanifest --production-branch main` and redeployed. **The recreated project is NOT connected to GitHub — `git push origin main` no longer auto-deploys.** To restore push-to-deploy, reconnect the repo in CF dashboard → Pages → opsmanifest → Settings → Builds & deployments.

**After every code change, deploy with wrangler (push alone does NOT deploy):**
```bash
export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh"
npm run build
npx wrangler pages deploy dist --project-name opsmanifest --branch main
git push origin main   # keep repo in sync (does not trigger deploy)
```

**Verify after deploy:** `curl -s https://opsmanifest.pages.dev/ | grep -o 'assets/index-[^"]*\.js'` must match the hash in `dist/index.html`, and DNS must resolve (`dig +short opsmanifest.pages.dev @1.1.1.1`). Given the project vanished once, check DNS resolution before every Store submission.

_(Netlify was migrated away from on 2026-06-09 due to exhausted account credits. `netlify.toml` kept for reference but not active.)_

## Common pitfalls

- **Zustand + Sets**: Zustand doesn't serialize ES6 Sets across renders correctly. All multi-select state uses plain arrays (`selInc`, `selUUM`, `selFix`).
- **Tailwind v3 vs v4**: This project uses Tailwind **v3** (`tailwindcss@^3.4`). Do not upgrade to v4 without updating the PostCSS config and removing the `@tailwind` directives.
- **React 19**: Some third-party component libraries haven't updated peer deps for React 19 yet. Check compatibility before adding dependencies.
- **xlsx-js-style**: Excel export uses `xlsx-js-style` npm package (API-compatible with SheetJS, adds cell `s` style property). Do NOT upgrade to `xlsx` v0.19+ — it removes community cell styles.
- **Auto-suggestions**: Fixed with React Portal (`createPortal`) in both `SystemDesignTab.jsx` and `PhasePanel.jsx`. Dropdowns render at `document.body` level with `position: fixed`. `matchSuggestKeys(val, fieldId, minChars=3)` — returns `[]` if val.length < 3. `SuggestInput` in PhasePanel calls `buildContextSuggestions(val, fieldId, ctx, sysDesignData, scanResults)` which reads the store and prepends stack-specific hints (scan findings, Oracle/AIX/RHEL/WebSphere error patterns, EOL flags, role owner suggestions) before the static DB results. `SystemDesignTab` still uses plain `matchSuggestKeys` (design fields are already field-specific enough).
- **Keyboard navigation in all suggest inputs**: All three suggest input variants (`SuggestInput`, `FilteredSuggestInput` in PhasePanel; `DesignField` in SystemDesignTab) support ArrowDown/ArrowUp to navigate, Enter to select (highlighted item, or first if none highlighted), Escape to close. `SuggestDropdown` portals accept `activeIdx` prop and scroll the active item into view. Active item is highlighted with teal background.
- **FilteredSuggestInput live API**: When 3+ chars typed in any build-phase OS/DB/App selector, a debounced (500ms) search hits endoflife.date. Results appear in a "Live API" section beneath the catalog section. Selecting an API result sets that as the ctx value — allows picking any product not in the predefined list.
- **RTM sign-off**: Requires every row explicitly set via `s.setRtmRow(id, status)`. "All PASS" and "All N/A" buttons bulk-set.
- **CAB declined**: `s.cabDeclined` triggers rollback plan in PhasePanel and rollback tasks in GanttTab. `setCabDeclined(true)` also sets `cabApproved = false`. After decline, PM can click "Unlock Tabs for Revision" → `unlockedForRevision = true` → all tabs unlocked in PmTabs regardless of phase gates. "Resubmit to CAB" calls `resubmitCAB()` which clears `cabDeclined` and `unlockedForRevision`. "Quick Change — PM Override" (Pro+) calls `setCabApproved(true)` — bypasses re-review and immediately allows cutover. Do NOT call `resubmitCAB()` here; that resets to pending and blocks the PM.
- **Tasks stale detection**: `tasksStaleReason` is set (as a string) by `toggleInc`/`toggleUUM` (when `phase2Active`), `setDesignField`/`setAllDesignFields` (when `designApplied`), `setChangePeriods` (when `designApplied`), `setRequirements` (when `projectStartDate` or `hoursPerDay` changes and `designApplied`), and `setUnlockedForRevision(true)` (when `designApplied`). GanttTab shows an amber banner with a Regenerate button that calls `setAiTasks([])` + `setTasksStaleReason(null)` — returning to rule-based auto-computed tasks. PmTabs shows amber pulsing dot on the Gantt tab label when `tasksStaleReason` is set.
- **RTM stale detection**: `rtmStale` is set true by `toggleInc`/`toggleUUM` (when `rtmSigned`), `setDesignField`/`setAllDesignFields` (when `rtmSigned`). Cleared by `signRtm()` or the Dismiss button in RtmTab. PmTabs shows amber pulsing dot on the RTM tab label when `rtmStale` is true. Advisory banner in RtmTab prompts re-review.
- **Sidebar text opacity**: PhasePanel uses `text-white/82` (labels), `text-white/85` (headings), `text-white/78` (subtitles), `text-white/75` (section headers/pill roles), `text-white/62` (arrows), `text-white/58` (meta info), `text-white/52` (disabled/inactive), `rgba(255,255,255,0.72)` (disclaimer). Never go below `/52` on the navy (#1A2E4A) background — lower values are illegible.
- **Roles tab edit gating**: editing requires `canUseFeature(authUser, 'save_builds')` (Pro+) AND `!pmEmail || authUser?.email === pmEmail || authUser?.email === pmBackupEmail`. If no `pmEmail` is set, any Pro+ user can edit. `RoleRow` uses `useEffect` to sync local `form` state when `assignment` prop changes externally (e.g. build load) — only syncs while not actively editing to avoid clobbering in-progress edits.
- **Email-match role-based access** (Pro+): `getUserRolesForBuild(authUser, roleAssignments)` matches `authUser.email` against all role assignments in the build. `canEditDesignSection(userRoles, sectionKey)` unlocks specific System Design sections for the role owner even when `phase2Active` (normal lock). `isQATeamLead` enables QA Lead to sign RTM. Roles tab shows "Your role in this build" teal banner. System Design shows "Your section" badge on owned sections. Future: Team/Enterprise plan → SSO via Firebase Auth SAML provider or OIDC; `authUser.email` already drives all permission checks, so SSO just changes the auth source, not the permission model.
- **Tech-review locked fields**: `s.lockDesignField('section.field', data)` / `s.unlockDesignField(key)`. PM sees locked fields read-only with amber label. Only visible in Tech Review Mode.
- **Custom incidents**: `s.addCustomInc(inc)` / `s.removeCustomInc(id)`. Appear alongside ALL_INC in Phase 2 and RTM.
- **Custom UUM entries**: `s.addCustomUUM(uum)` / `s.removeCustomUUM(id)` / `s.updateCustomUUM(id, patch)`. State: `customUUM: []` in store (persisted to Dexie + Firestore). Shape: `{ id, short, txt, grp, layer, type, layers, aiTasks?, risks?, prerequisites?, enriching?, enriched? }`. `removeCustomUUM` also strips the id from `selUUM`. Displayed above the catalog ItemList in Phase 2. Custom UUM flows to ALL tabs: Gantt (task groups via `getRealTasks` with detected layers/type, or `aiTasks` if Groq-enriched), RTM (row via `resolveUUM`), Matrix (`collectAllTasks`), Exec Summary (UUM list + group summary).
- **Smart keyword detection** (`src/lib/uumKeywordDetect.js`): `detectLayersFromText(text)` → `string[]` — matches 9 layers (hardware, os, db, app, web, storage, network, security, backup) using regex patterns against product/component names. `detectTypeFromText(text)` → `'migration'|'upgrade'|'update'|'patch'`. `detectPrimaryLayerFromText(text)` → single layer for the dropdown. `detectSeverityFromText(text)` → `'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'` for incidents. `detectIncidentGroupFromText(text)` → group name. `buildUUMDescription(title, desc, layers, type)` → full technical description string. `buildUUMGroup(layers, type)` → catalog-matching group name. All functions used live in the custom UUM and custom incident forms as the user types — detected values shown as teal badges with "(auto)" label; user can override via dropdowns.
- **ItemList search — three-section parallel search**: The UUM ItemList has a `<textarea rows=2>` with a 600ms debounce. After debounce fires, three searches run in parallel: (1) Catalog — multi-token scoring, immediate; (2) Live EOL API — `extractProductSlugs(query)` maps product keywords (sybase→sap-ase, aix→aix, postgres→postgresql, etc.) to endoflife.date slugs, then `fetchProductCycles(slug)` fetches lifecycle data; (3) Groq AI — `searchUUMWithGroq(query)` if `GROQ_CONFIGURED`. Results shown in three sections: **Live EOL API** (blue, above catalog), **✦ AI-Generated** (amber, above catalog), **Catalog matches** (default). Every result in all three sections has a `+ Add` button that calls `onAiAdd(r)` to create a custom UUM entry, trigger Groq enrichment, and toggle into `selUUM`. Catalog items get an `EolBadge` when any of their text tokens match a fetched EOL slug. The status bar shows live counts: "X catalog · Y EOL products · Z AI ops". **`extractProductSlugs(text)`** in `uumKeywordDetect.js` maps 50+ product keywords to their endoflife.date slugs, sorted by keyword length descending so "windows server" matches before "windows". `formatEolDate(eol)` handles boolean and string EOL fields. `EolBadge` is a local component in PhasePanel showing coloured EOL/EOS/Supported badges. **Critical**: `text-slate-800` must be on the textarea — inherited `text-white` from the navy sidebar makes text invisible on white background.
- **Custom UUM tab sync**: Every tab that reads UUM items must resolve both catalog AND custom: `ALL_UUM.find(u => u.code === code) || (s.customUUM || []).find(u => u.id === code)`. GanttTab uses `getRealTasks({...uum, code: uum.code||uum.id}, ctx)` for custom UUM (or `aiTasks` if Groq-enriched). RtmTab uses `resolveUUM(code, s.customUUM)`. MatrixTab `collectAllTasks` takes `customInc` and `customUUM` as extra params. ExecSummaryTab lookup includes `s.customUUM`. IncidentEnvPanel in GanttTab takes `customUUM` prop. Custom UUM items show a "Custom" badge in Exec Summary.
- **Custom incident smart form**: Auto-detects severity and group from the title as user types. Detected values shown as teal chips (layers) + coloured badge (severity) + group name. `addCustomInc` stores `layers` field so `getIncidentFixTasks` generates correct layer-matched tasks. Incidents show fix tasks in Matrix + RTM; they do NOT appear as Gantt task rows (by design — Gantt runs planned operations; Matrix/RTM run incident triage). Custom incidents are merged as `[...ALL_INC, ...s.customInc]` in all resolution points.
- **getNextTabId timing** (PmTabs.jsx): Only highlights a tab when it is both unlocked AND logically next in the workflow. `!scanComplete → null` (user needs to run scan in sidebar, not a tab). `scanComplete && !designApplied → 'design'`. `designApplied && !phase2Active → null` (user needs to inject Phase 2 in sidebar). `phase2Active && !cabApproved && !cabDeclined → 'gantt'`. `(cabApproved || cabDeclined) && !rtmSigned → 'rtm'`. `rtmSigned && !promoted → 'closure'`. This ensures Gantt is never highlighted prematurely and the "Next" badge only appears when meaningful.
- **Batch job migration tasks** (`realTasks.js`): Two new task generators — `batchSchedulerTasks()` (6 tasks: inventory → export → dependency validation → recreate scheduler → shadow run → QA regression) and `dbJobMigrationTasks(isOracle)` (6 tasks: DB job inventory → export DDL → convert → deploy → test run → QA validation). Injected into: (1) Full platform migration — after "Continuous Unix support during DB setup"; (2) DB-only migration — after "Recompile invalid objects"; (3) OS-only migration — after "Full regression smoke test". The `T()` helper now accepts an optional 6th arg `est_hours` for Gantt duration. All batch tasks have realistic est_hours (4–12h). Tasks cover Control-M, IBM WS, AutoSys, Tivoli TWS, cron, pg_cron, DBMS_SCHEDULER, SQL Server Agent — shadow run with source/target output comparison is the key validation step.
- **Sign-off workflow warnings** (`PhasePanel.jsx`): `handleRtmSignoff` now runs three pre-checks before navigating to RTM tab: (1) if `promoted && rtmStale` → confirm rollback intent before proceeding; (2) if `!rtmSigned && tasksStaleReason` → confirm stale scope acknowledged. `handleCutover` pre-checks: (1) if `rtmStale` → confirm re-verify before live; (2) count FAIL/BLOCKED rtmRows → confirm accepted risk if any exist. RTM Sign-Off sidebar section shows contextual amber/red banners: Gantt stale warning (with "Open Gantt →" button), RTM FAIL row count, post-live stale warning (with "Assess Rollback →" button). Cutover section shows RTM-stale and Gantt-stale banners before the cutover button.
- **Coherence checks 12a–12c** (`coherenceEngine.js`): (12a) `rtmSigned && tasksStaleReason` → warn on gantt+rtm tabs: scope drifted after sign-off; (12b) `promoted && rtmStale` → warn on exec+rtm+closure: live system with stale RTM, check rollback; (12c) `rtmSigned && cabApproved && tasksStaleReason && !promoted` → warn on gantt: ready to cut over but tasks stale, verify completion. `useCoherenceEngine` now also watches `promoted`, `cabApproved`, `rtmStale`, `tasksStaleReason`.
- **Phase guidemark**: `PHASE_HINTS` map in PhasePanel.jsx includes `cabdeclined` state. `currentPhaseId` checks `s.cabDeclined` before `s.cabApproved`.
- **Always-visible sidebar roadmap**: All 7 workflow sections in PhasePanel are always rendered (never conditionally hidden). Each has a step number (`1 · Phase 1`, `2 · AI Smart Scan` … `7 · Export`). When locked, the section shows only its header + `{LOCK_ICON} prerequisite message`. When unlocked, full content renders. Spacing is `space-y-6` between sections. Do not revert to conditional `{condition && <div>...}` rendering — the always-visible approach is intentional to show the user their full lifecycle roadmap from the first screen.
- **Firebase lazy singleton**: All Firebase modules are imported dynamically inside async getter functions (`getApp()`, `getDb()`, `getAuthInstance()`). This avoids init errors when `FIREBASE_CONFIGURED = false`. Build warning about "dynamic import will not move module into another chunk" is non-fatal — Firebase ends up in the main bundle regardless.
- **Auth flow — guest can build freely**: `buildLimitReached(null)` returns `false` — guests can build without hitting the modal. The modal only appears when a signed-in user hits their plan limit (`build_limit` reason), or when they click Save/Export as a guest (`save`/`export` reasons). `openAuthModal(reason)` from `AuthContext` sets `authModalReason` before showing the modal. The modal uses `REASON_META[reason]` to show a compact sign-in form (for `save`/`export`) or the full plans grid (for `build_limit`/`signup`). "Not now" / "Continue as Guest" always available.
- **Seeded accounts** (`src/lib/auth.js` `SEEDED_ACCOUNTS`): email → plan map that overrides whatever plan the user selects on sign-in. `getAuthUser()` auto-upgrades a stored user if their email is in `SEEDED_ACCOUNTS`. `canUseFeature()` and `buildLimitReached()` both check seeded accounts. Currently: `sriram.c76@gmail.com → professional`.
- **Next-step tab badge**: `getNextTabId(s)` in `PmTabs.jsx` computes the recommended next tab based on workflow state (`scanComplete && !designApplied → 'design'`, `phase2Active && !cabApproved && !cabDeclined → 'gantt'`, `(cabApproved || cabDeclined) && !rtmSigned → 'rtm'`, `rtmSigned && !promoted → 'closure'`). Returns `null` (no badge) when the required action is in the sidebar rather than a tab (e.g. Phase 2 injection, scan). The matching tab button gets a pulsing teal "Next" badge + `ring-2 ring-teal-400` outline.
- **Gantt tab lock**: `unlocked: s => s.phase2Active` — Gantt is locked until Phase 2 is injected. Before injection there are no UUM/incident tasks to show. `unlockedForRevision` bypasses this (as with all tabs).
- **DemoTour**: `src/components/DemoTour.jsx` — 6-slide animated onboarding popup shown once on first visit (localStorage key `opsmanifest_tour_v2`). Shows after 600ms delay. Slides auto-advance every 4.5s. Dot nav, back/next buttons, "Skip tour" link, "Start using it →" on last slide. Clear `localStorage.removeItem('opsmanifest_tour_v2')` in browser console to replay.
- **Worker new route**: `POST /groq-uum-search` in `workers/ai-worker.js` — takes `{ query }`, returns `{ results: [{ short, description, type, layer, grp }] }`. Prompt instructs Groq to generate 6–8 specific enterprise infra operation entries covering the full breadth of the query (pre-migration, migration, post-validation as separate entries). Corresponds to `searchUUMWithGroq(query)` in `src/lib/groq.js`.
- **ESM — no require()**: The project is pure ESM. Never use `require()` inside component function bodies. All imports must be static at the top of each file.
- **migrateLegacyFreeze(b)**: Called inside `loadBuild` to convert old single `changeFreezeStart`/`changeFreezeEnd`/`holidays` fields to the new `changePeriods` array format.
- **isDirty not reset on tab switch**: `setActiveTab` and `toggleDesignSection` deliberately do NOT set `isDirty` — they are UI-only, not data changes.
- **Infra Diagram**: `InfraDiagramTab.jsx` shows layered topology (HW → OS → App/DB → Storage/Backup → Network/Security). Incidents color boxes red; UUM items show amber tags. `grpToLayer` maps incident groups to stack layers.
- **Copy Build**: `handleCopyBuild(build)` in PhasePanel spreads the full build snapshot with a new `id = String(Date.now())` and `name = "${original.name} (copy)"`, then calls `saveBuild()` immediately — no confirmation needed. The copy is completely independent from the original.
- **Netlify CLI credits**: `netlify deploy --prod --dir=dist --no-build` may fail with 403 if account credits are exhausted. Fallback: `git push origin main` triggers auto-deploy via the GitHub → Netlify integration. Both paths are valid; push-to-deploy is always available.

## Stripe / billing setup

Stripe is **off by default** (`STRIPE_CONFIGURED = false` in `src/lib/stripeConfig.js`).

### Activation steps
1. Create Stripe products and prices (Professional monthly/annual, Team monthly/annual)
2. Copy price IDs into `STRIPE_PRICES` in `src/lib/stripeConfig.js`
3. Set `STRIPE_PUBLISHABLE_KEY` to your `pk_live_...` key
4. Set `STRIPE_WORKER_URL` to your deployed Cloudflare Worker URL
5. Set `STRIPE_CONFIGURED = true`
6. Deploy the Cloudflare Worker (`workers/stripe-worker.js`):
   ```bash
   npm install -g wrangler
   wrangler deploy workers/stripe-worker.js --name opsmanifest-stripe
   ```
7. Set worker env vars in Cloudflare dashboard (Workers → Settings → Variables):
   - `STRIPE_SECRET_KEY` — `sk_live_...`
   - `STRIPE_WEBHOOK_SECRET` — `whsec_...` (from Stripe Webhooks dashboard)
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (service account)
8. In Stripe Webhooks dashboard, add endpoint `https://<worker-url>/stripe-webhook` and listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
9. Fill in `PRICE_TO_PLAN` map in `workers/stripe-worker.js` with real price IDs
10. Build and deploy

### Trial period
- **7-day free trial** — `subscription_data[trial_period_days]: 7` is set in the checkout session
- Cancel during trial = **zero charge** (no payment was ever taken)
- After day 7, first payment is charged automatically
- Refunds after first payment are manual via the Stripe dashboard

### Customer Portal
- "Manage Billing" button appears in AuthModal header for signed-in paid users (when `STRIPE_CONFIGURED = true`)
- Calls `openCustomerPortal(email)` in `src/lib/stripe.js` → POST to `/create-portal-session` on the Worker
- Worker reads `stripeCustomerId` from Firestore `users/{email}/subscription/active`, creates a Stripe Billing Portal session, returns the URL
- Portal lets users cancel, change plan, update payment method, view invoices

### Files involved
- `src/lib/stripeConfig.js` — public keys + price IDs + worker URL + STRIPE_CONFIGURED flag
- `src/lib/stripe.js` — `startCheckout()`, `getSubscriptionStatus()`, `openCustomerPortal()`
- `workers/stripe-worker.js` — Cloudflare Worker: checkout sessions, portal sessions, webhook handler
- `src/components/AuthModal.jsx` — "Subscribe" button + "Manage Billing" button + trial note

## PWA

- `public/manifest.json` — PWA manifest (name, icons, display: standalone)
- `public/sw.js` — Service worker: cache-first for static assets, network-first for HTML; never caches API calls (Anthropic, Firebase, Stripe, workers.dev)
- `index.html` — `<link rel="manifest">`, `<meta name="theme-color">`, apple-mobile-web-app tags
- `src/main.jsx` — registers `/sw.js` on load
- `icon-192.png` and `icon-512.png` in `public/` are needed for store listings — only SVG exists currently

## Org / Team sharing (Team plan)

Firestore collection: `organisations/{orgId}/builds/{buildId}`

Firestore rules to add for org builds:
```
match /organisations/{orgId}/builds/{buildId} {
  allow read, write: if request.auth != null
    && request.auth.token.email in get(/databases/(default)/documents/organisations/$(orgId)).data.memberEmails;
}
match /organisations/{orgId} {
  allow read: if request.auth != null
    && request.auth.token.email in resource.data.memberEmails;
  allow write: if request.auth != null
    && request.auth.token.email == resource.data.ownerEmail;
}
```

- `src/lib/orgDb.js` — `createOrg`, `joinOrgByCode`, `getOrgForEmail`, `orgLoadBuilds`, `orgSaveBuild`, `orgDeleteBuild`
- `src/lib/useBuildsDb.js` — merges personal + org builds; routes saves/deletes to correct collection; exposes `shareToTeam(build)`, `org`, `setOrg`, `orgBuilds`, `teamEnabled`
- `src/components/OrgPanel.jsx` — Team Workspace UI in sidebar: create org, join by invite code, shared builds list, share current build button
- `_shared: true` flag on a build means it lives in the org collection; org wins deduplication by ID
