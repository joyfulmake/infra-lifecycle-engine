# Infra Lifecycle App — Claude Guide

## What this is

Enterprise Infrastructure Lifecycle Engine — a React SPA that walks infra PMs through the full server provisioning workflow: from hardware/OS selection through system design, incident triage, CAB approval, RTM sign-off, and project closure. Port of the original `infra_lifecycle_engine_v13` HTML tool.

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 19 + Vite 8 |
| Styling | Tailwind CSS v3 + custom CSS in `index.css` |
| State | Zustand v5 (`src/store/useStore.js`) |
| AI integration | Anthropic API via a Cloudflare Worker proxy (CORS — see below) |
| Excel export | `xlsx-js-style` (npm — fork of SheetJS with cell style support) |
| Hosting | Netlify (static deploy) |
| Repo | github.com/joyfulmake/infra-lifecycle-engine |

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
    PhasePanel.jsx        — left sidebar: phase workflow steps
    ExecOverview.jsx      — top strip: project name, phase badges, key dates
    PmTabs.jsx            — tab bar + renders active tab component
    tabs/
      ExecSummaryTab.jsx  — executive summary & incident/UUM/fix selection
      SystemDesignTab.jsx — 8-section system design form (AI suggestions)
      RtmTab.jsx          — Requirements Traceability Matrix with pass/fail
      GanttTab.jsx        — Gantt chart view
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
```

## State management

All state is in `src/store/useStore.js`. Key slices:

- `ctx` — selected hw/os/db/app
- `requirements` — project name, env type, go-live date, SLA, etc.
- `isBuilt / scanComplete / designApplied / phase2Active / cabApproved / rtmSigned / promoted` — linear workflow gates
- `selInc / selUUM / selFix` — selected incident/UUM/fix codes (plain arrays, not Sets)
- `sysDesignData` — nested object keyed by section → field
- `rtmRows` — `{ [id]: 'PASS' | 'FAIL' | 'PENDING' | 'NA' | 'BLOCKED' }`
- `closureChecks / closureNotes` — closure tab state
- `emergencyChanges` — emergency change log entries

Exported constants from `useStore.js`: `DESIGN_SECTIONS`, `FIELD_LABELS`, `HW_OPTIONS`, `OS_OPTIONS`, `DB_OPTIONS`, `APP_OPTIONS`.

## AI integration

The app calls the Anthropic API through a Cloudflare Worker proxy to avoid exposing the API key in the browser. The `connect-src` CSP in `netlify.toml` allows `https://api.anthropic.com` and `http://localhost:8787` (local worker dev).

When adding AI features, keep the proxy pattern — do not call `api.anthropic.com` directly from the frontend with a hardcoded key.

## Styling conventions

- Tailwind utility classes for layout and spacing
- Custom semantic classes in `index.css`: `tab-btn`, `tab-btn-active`, scrollbar styles
- Left panel background: `#1A2E4A` (navy) — set via inline style on the wrapper div
- ExecOverview height: exactly `96px` via inline style

## Deployment

Live URL: **https://opsmanifest.netlify.app**
Netlify site ID: `7887d6bd-ab2c-49fc-a5b1-64ce93d08d09`
Admin: https://app.netlify.com/projects/opsmanifest

`netlify.toml` configures:
- Build command: `npm run build`, publish dir: `dist`
- SPA redirect: `/* → /index.html` (status 200)
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
- **xlsx-js-style**: Excel export uses `xlsx-js-style` npm package (API-compatible with SheetJS, adds cell `s` style property). The CDN SheetJS script in `index.html` is still loaded (legacy; safe to remove eventually). Do NOT upgrade to `xlsx` v0.19+ — it removes community cell styles.
- **Auto-suggestions**: `matchSuggestKeys(val, fieldId, minChars=3)` — returns `[]` if val.length < 3. Use `minChars=0` to get placeholder hints without the 3-char gate.
- **RTM sign-off**: Requires every row to be explicitly set via `s.setRtmRow(id, status)` — auto-populated defaults do not count as reviewed. The "Confirm current statuses" button bulk-marks all rows.
- **Phase guidemark**: Current phase determined by workflow gate flags in order. `PHASE_HINTS` map in PhasePanel.jsx drives the bottom guidemark text.
- **AI auto-select**: `runSmartScan(ctx)` returns `{ findings, riskLevel, suggestedInc, suggestedUUM }`. PhasePanel pre-selects them post-scan; user sees accept/clear banner.
