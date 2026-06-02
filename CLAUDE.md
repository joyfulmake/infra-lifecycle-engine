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
| Hosting | Netlify (static deploy) |
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
    coherenceEngine.js    — pure `runCoherenceChecks(stateSnapshot)` → `[{ id, severity, tabs, message, action }]`; no React, no deps; runs 11 cross-tab checks (compliance gap, DR/backup, security incidents, network incidents, SLA/monitoring, design sparseness, empty Phase 2, RTM fails, roles missing, RTM pending count, storage incidents)
    useCoherenceEngine.js — React hook; debounces 600ms; watches selInc/selUUM/sysDesignData/requirements/rtmRows/roleAssignments; calls `setCoherenceAlerts`; mounted in PmTabs
    exportExcel.js        — 13-sheet styled Excel export using xlsx-js-style
    db.js                 — Dexie IndexedDB wrapper (localGetBuilds, localSaveBuild, localDeleteBuild)
    firebase.js           — lazy Firebase singleton (fbSignIn, fbSignOut, cloudSaveBuild, cloudLoadBuilds)
    firebaseConfig.js     — Firebase project config + FIREBASE_CONFIGURED flag
    useBuildsDb.js        — React hook: IndexedDB + optional Firestore sync (useLiveQuery)
    auth.js               — local auth (signIn, signOut, PLANS, canUseFeature, trySilentFirebaseAuth)
    taskMetadata.js       — `enrichTask(task, ctx)` → 7-point FSM metadata (hwDimension, preCondition, execEngine, postValidation, blastRadius, downstream, fsmState); 30+ regex patterns; `FSM_STATE_STYLE`, `HW_DIM_ICON`
    groqConfig.js         — `GROQ_CONFIGURED` flag + `GROQ_WORKER_URL` (off by default)
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

**Current status:** MSIX submitted to Microsoft Store — awaiting certification.
After approval, follow Part 5 of the guide (post-certification steps).

**Microsoft Store URL:** _(pending certification — update here once live)_

**Assets in place:**
- `public/icon-192.png` and `public/icon-512.png` — generated by `scripts/gen-icons.mjs` (navy background, blue-teal gradient tile, white ring mark)
- `public/privacy.html` — full privacy policy at `https://opsmanifest.netlify.app/privacy.html`
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
1. pwabuilder.com → enter `https://opsmanifest.netlify.app` → "Package for Store" → Meta Quest
2. Submit via https://developers.meta.com/horizon/
3. Note: Meta requires landscape — already set in manifest

**Screenshots:** Recommended before the app goes live. Take 1366×768 or 1920×1080 screenshots of: Phase 1 build screen, System Design tab, Gantt tab, RTM tab. Upload in the Partner Center listing page.

## Disclaimer + presentation

- Disclaimer shown at bottom of left sidebar (10px, muted) explaining the tool's scope
- "About this tool ↗" link points to `/slides.html`
- **Presentation deck**: https://opsmanifest.netlify.app/slides.html — 5-slide standalone HTML, keyboard/click navigation, no dependencies

## AI integration

Two AI layers — both use the CF Worker proxy pattern to keep API keys out of the browser.

### Rule-based (always on)
- **AI Smart Scan** (`src/lib/smartScan.js`) — standalone CVE/EOL/security scan, no API key, runs in-browser
- **Task metadata enrichment** (`src/lib/taskMetadata.js`) — `enrichTask(task, ctx)` derives 7-point FSM metadata from 30+ regex patterns over task name/role/dep fields

### Groq AI (opt-in — `GROQ_CONFIGURED` in `src/lib/groqConfig.js`)
- **Worker**: `workers/ai-worker.js` — deploy as `opsmanifest-ai` CF Worker; requires `GROQ_API_KEY` env var
- **Routes**: `POST /groq-enrich` (deepens a task's FSM metadata), `POST /groq-suggest` (top-5 stack risks)
- **Model**: `llama-3.3-70b-versatile` (overridable via `GROQ_MODEL` worker env var)
- **UI**: "✦ AI Deepen — Groq" button appears in the Gantt FSM panel and Matrix FSM detail panel when configured; AI-enhanced fields shown with teal "✦ AI" badge; adds CVE Risks + Best Practice fields
- **To activate**:
  1. `wrangler deploy workers/ai-worker.js --name opsmanifest-ai`
  2. Set `GROQ_API_KEY` in Cloudflare Workers → Settings → Variables
  3. Set `GROQ_WORKER_URL` + `GROQ_CONFIGURED = true` in `src/lib/groqConfig.js`
  4. Build and deploy

Always keep the proxy pattern — never call `api.groq.com` directly from the frontend.

### Tab sync via coherence engine
All AI outputs feed into the Zustand store. `useCoherenceEngine` (mounted in PmTabs) runs 11 cross-tab checks on every state change and emits `coherenceAlerts` read by `AgentInsights` panels. The Matrix tab recomputes from `selInc`/`selUUM`/`designApplied` reactively — no manual sync needed.

## Styling conventions

- Tailwind utility classes for layout and spacing
- Custom semantic classes in `index.css`: `tab-btn`, `tab-btn-active`, scrollbar styles
- Left panel background: `#1A2E4A` (navy), width: `320px` — set via inline style on the wrapper div in App.jsx; PhasePanel root uses `w-full` to fill it
- ExecOverview height: exactly `96px` via inline style

## Deployment

Live URL: **https://opsmanifest.netlify.app**
Presentation: **https://opsmanifest.netlify.app/slides.html**
Netlify site ID: `7887d6bd-ab2c-49fc-a5b1-64ce93d08d09`
Admin: https://app.netlify.com/projects/opsmanifest

`netlify.toml` configures:
- Build command: `npm run build`, publish dir: `dist`
- SPA redirect: `/* → /index.html` (status 200) — note: `/slides.html` is a static file in `public/`, served directly, not caught by the SPA redirect
- Security headers (X-Frame-Options, CSP, etc.)

**After every code change, always run the full deploy sequence:**
```bash
export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh"
npm run build
netlify deploy --prod --dir=dist --no-build
```

The `--no-build` flag bypasses Netlify's remote build step (which fails in WSL due to extension fetch issues) and deploys the locally-built `dist/` directly.

**If Netlify CLI returns 403 "Account credit usage exceeded"**: skip the CLI deploy and just `git push origin main` — GitHub → Netlify auto-deploy is always active and doesn't consume CLI credits.

GitHub repo is connected to Netlify for auto-deploy on push to `main`.

## Common pitfalls

- **Zustand + Sets**: Zustand doesn't serialize ES6 Sets across renders correctly. All multi-select state uses plain arrays (`selInc`, `selUUM`, `selFix`).
- **Tailwind v3 vs v4**: This project uses Tailwind **v3** (`tailwindcss@^3.4`). Do not upgrade to v4 without updating the PostCSS config and removing the `@tailwind` directives.
- **React 19**: Some third-party component libraries haven't updated peer deps for React 19 yet. Check compatibility before adding dependencies.
- **xlsx-js-style**: Excel export uses `xlsx-js-style` npm package (API-compatible with SheetJS, adds cell `s` style property). Do NOT upgrade to `xlsx` v0.19+ — it removes community cell styles.
- **Auto-suggestions**: Fixed with React Portal (`createPortal`) in both `SystemDesignTab.jsx` and `PhasePanel.jsx`. Dropdowns render at `document.body` level with `position: fixed`. `matchSuggestKeys(val, fieldId, minChars=3)` — returns `[]` if val.length < 3. `SuggestInput` in PhasePanel calls `buildContextSuggestions(val, fieldId, ctx, sysDesignData, scanResults)` which reads the store and prepends stack-specific hints (scan findings, Oracle/AIX/RHEL/WebSphere error patterns, EOL flags, role owner suggestions) before the static DB results. `SystemDesignTab` still uses plain `matchSuggestKeys` (design fields are already field-specific enough).
- **RTM sign-off**: Requires every row explicitly set via `s.setRtmRow(id, status)`. "All PASS" and "All N/A" buttons bulk-set.
- **CAB declined**: `s.cabDeclined` triggers rollback plan in PhasePanel and rollback tasks in GanttTab. `setCabDeclined(true)` also sets `cabApproved = false`. After decline, PM can click "Unlock Tabs for Revision" → `unlockedForRevision = true` → all tabs unlocked in PmTabs regardless of phase gates. "Resubmit to CAB" calls `resubmitCAB()` which clears `cabDeclined` and `unlockedForRevision`. "Quick Change — PM Override" (Pro+) calls `setCabApproved(true)` — bypasses re-review and immediately allows cutover. Do NOT call `resubmitCAB()` here; that resets to pending and blocks the PM.
- **Tasks stale detection**: `tasksStaleReason` is set (as a string) by `toggleInc`/`toggleUUM` (when `phase2Active`), `setDesignField`/`setAllDesignFields` (when `designApplied`), `setChangePeriods` (when `designApplied`), `setRequirements` (when `projectStartDate` or `hoursPerDay` changes and `designApplied`), and `setUnlockedForRevision(true)` (when `designApplied`). GanttTab shows an amber banner with a Regenerate button that calls `setAiTasks([])` + `setTasksStaleReason(null)` — returning to rule-based auto-computed tasks. PmTabs shows amber pulsing dot on the Gantt tab label when `tasksStaleReason` is set.
- **RTM stale detection**: `rtmStale` is set true by `toggleInc`/`toggleUUM` (when `rtmSigned`), `setDesignField`/`setAllDesignFields` (when `rtmSigned`). Cleared by `signRtm()` or the Dismiss button in RtmTab. PmTabs shows amber pulsing dot on the RTM tab label when `rtmStale` is true. Advisory banner in RtmTab prompts re-review.
- **Sidebar text opacity**: PhasePanel uses `text-white/82` (labels), `text-white/85` (headings), `text-white/78` (subtitles), `text-white/75` (section headers/pill roles), `text-white/62` (arrows), `text-white/58` (meta info), `text-white/52` (disabled/inactive), `rgba(255,255,255,0.72)` (disclaimer). Never go below `/52` on the navy (#1A2E4A) background — lower values are illegible.
- **Roles tab edit gating**: editing requires `canUseFeature(authUser, 'save_builds')` (Pro+) AND `!pmEmail || authUser?.email === pmEmail || authUser?.email === pmBackupEmail`. If no `pmEmail` is set, any Pro+ user can edit. `RoleRow` uses `useEffect` to sync local `form` state when `assignment` prop changes externally (e.g. build load) — only syncs while not actively editing to avoid clobbering in-progress edits.
- **Email-match role-based access** (Pro+): `getUserRolesForBuild(authUser, roleAssignments)` matches `authUser.email` against all role assignments in the build. `canEditDesignSection(userRoles, sectionKey)` unlocks specific System Design sections for the role owner even when `phase2Active` (normal lock). `isQATeamLead` enables QA Lead to sign RTM. Roles tab shows "Your role in this build" teal banner. System Design shows "Your section" badge on owned sections. Future: Team/Enterprise plan → SSO via Firebase Auth SAML provider or OIDC; `authUser.email` already drives all permission checks, so SSO just changes the auth source, not the permission model.
- **Tech-review locked fields**: `s.lockDesignField('section.field', data)` / `s.unlockDesignField(key)`. PM sees locked fields read-only with amber label. Only visible in Tech Review Mode.
- **Custom incidents**: `s.addCustomInc(inc)` / `s.removeCustomInc(id)`. Appear alongside ALL_INC in Phase 2 and RTM.
- **Phase guidemark**: `PHASE_HINTS` map in PhasePanel.jsx includes `cabdeclined` state. `currentPhaseId` checks `s.cabDeclined` before `s.cabApproved`.
- **Firebase lazy singleton**: All Firebase modules are imported dynamically inside async getter functions (`getApp()`, `getDb()`, `getAuthInstance()`). This avoids init errors when `FIREBASE_CONFIGURED = false`. Build warning about "dynamic import will not move module into another chunk" is non-fatal — Firebase ends up in the main bundle regardless.
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
