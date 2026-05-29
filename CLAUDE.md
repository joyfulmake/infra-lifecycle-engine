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
| AI integration | Anthropic API via a Cloudflare Worker proxy (CORS — see below) |
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
    PhasePanel.jsx        — left sidebar (276px): phase workflow, save/load builds, export
    ExecOverview.jsx      — top strip (96px): KPI tiles, milestones, unsaved indicator
    PmTabs.jsx            — tab bar + renders active tab component
    AuthModal.jsx         — sign-in / plan selection modal
    tabs/
      ExecSummaryTab.jsx  — executive summary & incident/UUM/fix selection
      SystemDesignTab.jsx — 8-section system design form (AI suggestions, presentation mode, tech review lock)
      InfraDiagramTab.jsx — connected infrastructure topology diagram (SVG-style layered boxes)
      RtmTab.jsx          — Requirements Traceability Matrix with pass/fail + All PASS/NA buttons
      GanttTab.jsx        — Gantt chart: task dates, buffered hours, change periods, inline editing
      RaidTab.jsx         — RAID log (Risks, Assumptions, Issues, Decisions)
      ClosureTab.jsx      — post-go-live closure checklist & notes
  lib/
    incidents.js          — incident catalog
    uumItems.js           — UUM (Unix/User/Middleware) catalog
    realTasks.js          — build task catalog
    designTasks.js        — AI design task definitions
    designDefaults.js     — default values per HW/OS/DB/APP combo
    incidentFixTasks.js   — fix task definitions per incident
    smartScan.js          — standalone CVE/EOL scan + auto-suggest incidents/UUM codes
    suggestDb.js          — suggestion engine (matchSuggestKeys — min 3 chars)
    exportExcel.js        — 12-sheet styled Excel export using xlsx-js-style
    db.js                 — Dexie IndexedDB wrapper (localGetBuilds, localSaveBuild, localDeleteBuild)
    firebase.js           — lazy Firebase singleton (fbSignIn, fbSignOut, cloudSaveBuild, cloudLoadBuilds)
    firebaseConfig.js     — Firebase project config + FIREBASE_CONFIGURED flag
    useBuildsDb.js        — React hook: IndexedDB + optional Firestore sync (useLiveQuery)
    auth.js               — local auth (signIn, signOut, PLANS, canUseFeature, trySilentFirebaseAuth)
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

Key actions: `markDirty()`, `markClean()`, `setCurrentBuildId(id)` — called by PhasePanel on save/load. Every significant state action automatically sets `isDirty: true`.

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

## Disclaimer + presentation

- Disclaimer shown at bottom of left sidebar (10px, muted) explaining the tool's scope
- "About this tool ↗" link points to `/slides.html`
- **Presentation deck**: https://opsmanifest.netlify.app/slides.html — 5-slide standalone HTML, keyboard/click navigation, no dependencies

## AI integration

The app calls the Anthropic API through a Cloudflare Worker proxy to avoid exposing the API key in the browser. The `connect-src` CSP in `netlify.toml` allows `https://api.anthropic.com` and `http://localhost:8787` (local worker dev).

When adding AI features, keep the proxy pattern — do not call `api.anthropic.com` directly from the frontend with a hardcoded key.

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

GitHub repo is connected to Netlify for auto-deploy on push to `main`.

## Common pitfalls

- **Zustand + Sets**: Zustand doesn't serialize ES6 Sets across renders correctly. All multi-select state uses plain arrays (`selInc`, `selUUM`, `selFix`).
- **Tailwind v3 vs v4**: This project uses Tailwind **v3** (`tailwindcss@^3.4`). Do not upgrade to v4 without updating the PostCSS config and removing the `@tailwind` directives.
- **React 19**: Some third-party component libraries haven't updated peer deps for React 19 yet. Check compatibility before adding dependencies.
- **xlsx-js-style**: Excel export uses `xlsx-js-style` npm package (API-compatible with SheetJS, adds cell `s` style property). Do NOT upgrade to `xlsx` v0.19+ — it removes community cell styles.
- **Auto-suggestions**: Fixed with React Portal (`createPortal`) in both `SystemDesignTab.jsx` and `PhasePanel.jsx`. Dropdowns render at `document.body` level with `position: fixed`. `matchSuggestKeys(val, fieldId, minChars=3)` — returns `[]` if val.length < 3.
- **RTM sign-off**: Requires every row explicitly set via `s.setRtmRow(id, status)`. "All PASS" and "All N/A" buttons bulk-set.
- **CAB declined**: `s.cabDeclined` triggers rollback plan in PhasePanel and rollback tasks in GanttTab. `setCabDeclined(true)` also sets `cabApproved = false`.
- **Tech-review locked fields**: `s.lockDesignField('section.field', data)` / `s.unlockDesignField(key)`. PM sees locked fields read-only with amber label. Only visible in Tech Review Mode.
- **Custom incidents**: `s.addCustomInc(inc)` / `s.removeCustomInc(id)`. Appear alongside ALL_INC in Phase 2 and RTM.
- **Phase guidemark**: `PHASE_HINTS` map in PhasePanel.jsx includes `cabdeclined` state. `currentPhaseId` checks `s.cabDeclined` before `s.cabApproved`.
- **Firebase lazy singleton**: All Firebase modules are imported dynamically inside async getter functions (`getApp()`, `getDb()`, `getAuthInstance()`). This avoids init errors when `FIREBASE_CONFIGURED = false`. Build warning about "dynamic import will not move module into another chunk" is non-fatal — Firebase ends up in the main bundle regardless.
- **ESM — no require()**: The project is pure ESM. Never use `require()` inside component function bodies. All imports must be static at the top of each file.
- **migrateLegacyFreeze(b)**: Called inside `loadBuild` to convert old single `changeFreezeStart`/`changeFreezeEnd`/`holidays` fields to the new `changePeriods` array format.
- **isDirty not reset on tab switch**: `setActiveTab` and `toggleDesignSection` deliberately do NOT set `isDirty` — they are UI-only, not data changes.
- **Infra Diagram**: `InfraDiagramTab.jsx` shows layered topology (HW → OS → App/DB → Storage/Backup → Network/Security). Incidents color boxes red; UUM items show amber tags. `grpToLayer` maps incident groups to stack layers.

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
