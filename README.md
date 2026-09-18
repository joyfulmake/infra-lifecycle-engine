# OpsManifest
### Guided Delivery Platform — 16 PM Domains

> *Not a CMDB. Not a ticketing system. The structured pre-work that makes both of those accurate.*

A React SPA that walks project delivery teams through a full change lifecycle — from initial stack/scope selection to CAB approval to project closure. Started as an infrastructure-only tool; now covers 16 PM domains (infra, cloud migration, DevOps, cybersecurity, SAP, Salesforce, Oracle EBS, Dynamics 365, BFSI, Healthcare, Manufacturing, Telecom, Retail, App Dev, and more) with the same guided workflow underneath, each speaking that domain's own vocabulary.

**Live →** https://opsmanifest.pages.dev
**Full walkthrough with security details →** [`USER_GUIDE.md`](./USER_GUIDE.md)

---

## What it does

Every one of the 16 domains has the same shape: pick your domain → set up scope → design → triage known risks → CAB approval → schedule → sign-off → closure. OpsManifest makes that shape explicit, enforces the right questions at each stage, and produces audit-ready outputs for ServiceNow, Jira, or CAB — see [`USER_GUIDE.md`](./USER_GUIDE.md) for the full step-by-step with what you gain at each stage.

```
Pick a PM domain → Stage-by-stage workflow (same shape, every domain)
     │
     ├─ Stack / scope selection       → validated against EOL calendar
     ├─ System design                → architecture decisions recorded, role-locked
     ├─ Known issue / change triage   → tasks generated, escalation paths set
     ├─ CAB approval                  → structured change record generated
     ├─ RTM sign-off                  → requirements traced to deliverables
     └─ Project closure               → handoff doc generated
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
