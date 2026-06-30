# OpsManifest
### Infrastructure Lifecycle Engine

> *Not a CMDB. Not a ticketing system. The structured pre-work that makes both of those accurate.*

A React SPA that walks infrastructure PMs through the full server provisioning lifecycle — from hardware selection to CAB approval to project closure. Built for teams who know that the real problem isn't tracking infrastructure; it's the 40 decisions made before anything gets tracked.

**Live →** https://opsmanifest.pages.dev

---

## What it does

Every server provisioning project has the same shape: requirements → design → procurement → config → handoff → closure. OpsManifest makes that shape explicit, enforces the right questions at each stage, and produces audit-ready outputs for ServiceNow, Jira, or CAB.

```
Project created → Stage-by-stage workflow
     │
     ├─ Hardware & OS selection      → validated against EOL calendar
     ├─ System design                → architecture decisions recorded
     ├─ Incident triage              → runbooks linked, escalation paths set
     ├─ CAB approval                 → structured change record generated
     ├─ RTM sign-off                 → requirements traced to deliverables
     └─ Project closure              → handoff doc generated
```

---

## Stack

| Layer | What |
|-------|------|
| UI | React 19 + Vite 8 |
| Styling | Tailwind CSS v3 |
| State | Zustand v5 |
| Persistence | Dexie.js v4 (IndexedDB) |
| Cloud sync | Firebase Firestore (Pro+) |
| AI | Groq API via `workers/ai-worker.js` CF Worker |
| Payments | Razorpay + Stripe via `workers/razorpay-worker.js` |
| Hosting | Cloudflare Pages |

---

## Workers

Three Cloudflare Workers run alongside the Pages app:

| Worker | File | Purpose |
|--------|------|---------|
| `opsmanifest-ai` | `workers/ai-worker.js` | Groq AI proxy — infrastructure Q&A, runbook generation |
| `opsmanifest-razorpay` | `workers/razorpay-worker.js` | Razorpay payment proxy |
| `stripe-worker` | `workers/stripe-worker.js` | Stripe payment proxy |

---

## Deploy

```bash
# Build and deploy to Cloudflare Pages
npm run build
npx wrangler pages deploy dist --project-name opsmanifest

# Deploy Workers separately
npx wrangler deploy workers/ai-worker.js --name opsmanifest-ai
npx wrangler deploy workers/razorpay-worker.js --name opsmanifest-razorpay
```

---

## Key files

```
src/
├── App.jsx                    ← root component, routing
├── store/useStore.js          ← Zustand global state
├── lib/
│   ├── firebaseConfig.js      ← Firestore config (Pro sync)
│   └── orchestratorActions.js ← AI action handlers
├── components/                ← stage UI components
└── main.jsx                   ← entry point
public/
├── manifest.json              ← PWA manifest
├── sw.js                      ← service worker
└── *.html                     ← legal pages (TOS, MSA, SLA, DPA, AUP)
workers/
├── ai-worker.js               ← Groq API proxy
├── razorpay-worker.js         ← Razorpay proxy
└── stripe-worker.js           ← Stripe proxy
```

---

## Working on this project

```bash
cd /home/kali/dev-workspace/infr-lifecycle-engine-main
# ask Claude: "add a vendor risk assessment stage" or "fix the CAB approval export"
```
