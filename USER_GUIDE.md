# OpsManifest — Complete Walkthrough

**Live app:** https://opsmanifest.pages.dev &nbsp;•&nbsp; **Guided tour:** https://opsmanifest.pages.dev/demo &nbsp;•&nbsp; **Deck:** https://opsmanifest.pages.dev/slides

This is the step-by-step, start-to-finish guide to running a real project through OpsManifest — every phase, every tab, what you actually get out of each one, and how your data is handled along the way. No account needed to follow along; open the live app in another tab and do it as you read.

---

## Who this is for

Anyone delivering a structured change and tired of that structure living across five disconnected tools — a ticket in Jira, a design doc in Confluence, a CAB pack assembled by hand, a spreadsheet RAID log nobody updates. OpsManifest is **not** a CMDB, ITSM platform, or a replacement for ServiceNow/Jira/Confluence — it's the guided pre-work layer that makes what you eventually put into those systems accurate, because you did the thinking first instead of after.

It works the same way whether your project is a server migration, a SAP S/4HANA rollout, a Salesforce implementation, a hospital EHR upgrade, a retail platform cutover, or twelve other kinds of enterprise delivery — see [Step 0](#step-0--choose-your-project-domain) below.

---

## Step 0 — Choose your project domain

The very first thing you do, before anything else: pick which of the 16 supported domains matches your project.

| Category | Domains |
|---|---|
| Horizontals | Infrastructure Provisioning, Cloud Migration, DevOps/Platform Engineering, Cybersecurity, Network Refresh, Data & Analytics |
| Enterprise Apps | SAP, Salesforce, Oracle EBS/Fusion, Dynamics 365 |
| Industries | Banking/Financial Services, Healthcare, Manufacturing, Telecom, Retail |
| App Delivery | App Development |

Nothing is pre-selected — you have to actually choose, because this choice changes almost everything downstream: the labels on every field, the catalog of known issues and change items you can pick from, which tabs are relevant, and the vocabulary every other screen uses. Pick "Healthcare" and your stack fields become *Care Setting / EHR Platform / Regulatory Region / Channel* instead of *Hardware / OS / Database / Application* — same workflow engine underneath, completely different language on top.

**What you gain:** one tool that speaks your project's actual language instead of forcing an infrastructure vocabulary onto a Salesforce rollout, or vice versa.

---

## Step 1 — Project Setup *(the onboarding screens right after you pick a domain)*

Fill in your project's four stack fields (whatever your domain calls them) plus the basics: project name, environment type (Production/UAT/DR/Dev/SIT), go-live date, SLA target, project start date, hours-per-day for scheduling. Click **Build Environment**.

**What you gain:** a single source of truth for "what is this project, exactly" that every later phase — design, schedule, sign-off, closure — reads from instead of each team keeping its own half-accurate copy.

## Step 2 — AI Smart Scan

Click **Run AI Smart Scan** — no sign-in, no API key, nothing leaves your browser. This is a rule-based scan (not an LLM call) that checks your exact stack selections against a built-in CVE/end-of-life/security-posture catalog and flags what's already a known risk before you've designed anything.

**What you gain:** the CVEs and EOL dates that would otherwise surface three weeks into the project — or in the CAB meeting — surface in the first five minutes instead.

## Step 3 — System Design

Work through your domain's design sections as a team — each section is owned by a specific role (the DBA owns the database section, the Storage Lead owns storage, and so on for infra; every other domain has its own equivalent owners). Fields lock once a section passes tech review, so a later "quick edit" can't silently drift the design without triggering re-approval. When it's ready, generate the task plan.

**What you gain:** an audit trail of *who* decided *what*, locked against silent edits — the single biggest thing CAB boards and auditors ask for and rarely get from a spreadsheet.

## Step 4 — Change Scope *(sidebar: "Phase 2")*

Select the known issues and change/scope items relevant to this build from your domain's catalog (or add your own — every custom entry you add gets its own generated tasks, RTM row, and RAID entries, not just a text label). Click **Inject** once you've picked at least one item.

**What you gain:** every incident, migration step, or upgrade item you select automatically generates its own task list, test criteria, and role assignment — you're not hand-writing a runbook from scratch.

## Step 5 — CAB Gate

Review the RAID log, the generated task plan, and the risk picture, then set CAB authorization. If it's declined, OpsManifest generates a domain-appropriate rollback plan and unlocks every tab for revision — you fix the scope and resubmit, you don't start over.

**What you gain:** a CAB pack that's already assembled from real project data instead of built by hand the night before the meeting; a structured way to handle a decline that doesn't mean going back to a blank page.

## Step 6 — RTM Sign-Off

Every requirement row — one per design section (worded in your domain's own terms, e.g. "EHR / EMR design meets approved requirements" owned by an EHR Analyst, not a generic infra label) plus the specific incidents/changes you selected — needs an explicit PASS / FAIL / PENDING / N/A / BLOCKED, reviewed by your QA lead. Bulk "All PASS" / "All N/A" buttons exist, but nothing signs off silently: if scope changes after sign-off, the row goes stale and flags itself again.

**What you gain:** traceability from "what we required" to "what we actually verified," the exact document a compliance or audit review asks for — and it can't quietly go out of date without you knowing.

## Step 7 — Production Cutover

Once CAB is approved and RTM is signed, execute cutover. If anything's stale (schedule changed after sign-off, a task plan needs regenerating), you're warned and asked to confirm before going live, not after.

**What you gain:** a last-mile safety check that catches "we approved this three weeks ago and the design changed since" before it becomes a live incident.

## Step 8 — Closure

Work through the post-go-live checklist (hypercare monitoring, lessons learned, configuration/asset records updated, formal sign-off), then export the full audit trail.

**What you gain:** a closed loop — every project ends with a documented handoff instead of just quietly stopping.

---

## Running alongside every phase

These tabs aren't a separate linear path — they're live for the whole project, reacting to whatever you've done in the phases above.

| Tab | What it's for | What you gain |
|---|---|---|
| **RAID Log** | Risks, Assumptions, Issues, Decisions — auto-populated from your selections plus anything you add by hand | A single governance record CAB boards actually examine, instead of a doc nobody opens |
| **Matrix** | Every generated task laid out by function-area swimlane (your domain's own sections, e.g. Storage/Database/Network for infra, or EHR/Interoperability/Compliance for healthcare) with 7-point FSM detail per task | See exactly which team is overloaded in the critical change window before it becomes a bottleneck |
| **Dependency Graph** | Visual task-dependency graph with cycle detection | Catches circular dependencies and unlinked RAID items a flat task list would hide |
| **Vulnerabilities** | CVE/EOL findings from the scan plus stakeholder-agreement tracking, with a full disposition trail (fixed / parked / workaround / accepted risk) | Nothing gets silently dropped — every risk has a decision and an owner on record |
| **Risk Tracker** | A live, computed risk score across the whole build, not a static list | Know your actual risk posture right now, not what it was when someone last updated a spreadsheet |
| **Cost** *(optional, off by default)* | Budget vs. estimated cost from real task hours × team day-rate, with risk-adjusted contingency | Turn "are we over budget" into a number instead of a guess |
| **Deploy** | Universal build → test → staging → production → verify pipeline tracker (works the same whether "deploy" means CI/CD, a SAP transport, a Salesforce package push, or a release window) | One place to see where the actual release is stuck, across any kind of project |
| **Services** | A register of every external vendor/service the project depends on — provider, criticality, renewal date, SLA — sorted so the most urgent one surfaces first | Never get blindsided by a vendor contract nobody was tracking |
| **Roles** | 20-role RACI table; each System Design section shows "your section" to the person who owns it | Everyone knows exactly who's Responsible, Accountable, Consulted, or just Informed — no ambiguity at CAB |
| **Governance Report** | Live schedule/cost/risk/capacity/compliance status recomputed every time you open it — not a cached snapshot | A daily-status view that's always current, for the one person who has to say "where are we" in a stand-up |

Every one of these has a small advisory panel at the top ("Agent") that surfaces the specific things needing your attention on that tab right now — pending reviews, blocked stages, risks approaching a deadline — rather than making you go looking for them.

---

## OpsMentor — your AI advisor

Click the collapsed **OpsMentor** strip at any time. It's deliberately quiet by default — it doesn't pop open uninvited or narrate what you already did.

What it does, always (no configuration required):
- Walks you through the guided field interview with domain-correct chip options (real product names from *your* domain's catalog, not a generic placeholder)
- Answers workflow/status questions and executes plain-language commands ("add task: validate indexes 4h", "go live date is 2026-11-30", "open the RTM tab")
- Every proposed action that meaningfully changes your build asks for confirmation first — it proposes, you accept

What it does when your organization has connected an AI backend (opt-in, off by default):
- Deeper natural-language Q&A grounded in your actual build state, with a cited source (NIST, Red Hat, Microsoft, CVE databases, endoflife.date) on every factual claim it makes
- References your own past builds with similar stacks

Either way, **no AI provider API key ever reaches your browser** — every AI call is proxied through a Cloudflare Worker that holds the key server-side. See [Security & Data Safety](#security--data-safety) below.

---

## Exporting your work

**Export to Excel** produces a single workbook — up to 18 styled sheets (fewer on the free tier) covering Executive Summary, System Design, RAID, RTM, Incidents, Deploy Pipeline, Services Register, RACI Matrix, Vulnerability Registry, Closure Summary, and more — ready to hand to a CAB board, an auditor, or a stakeholder who will never log into the tool itself.

---

## Security & Data Safety

The honest version, not the marketing version — the full technical audit lives in [`ENTERPRISE_READINESS.md`](./ENTERPRISE_READINESS.md), updated as things change. Here's the summary:

**What's solid today:**
- **Local-first by default.** Every plan stores your build in your own browser (IndexedDB via Dexie) — nothing is sent anywhere unless you explicitly sign in for cloud sync.
- **Cloud sync is opt-in and scoped to you.** Professional+ sync uses Firebase, with Firestore security rules that restrict every build to the signed-in account's own email — no cross-account access.
- **No API keys ever reach the browser.** The AI advisor, text-to-speech, and payment integrations all go through a Cloudflare Worker proxy that holds credentials server-side — inspect the network tab yourself, there's nothing to leak client-side.
- **HTTPS everywhere**, served from Cloudflare's edge with a locked-down Content Security Policy (no `unsafe-eval`, restricted `connect-src`).
- **React escapes all rendered output** — no `dangerouslySetInnerHTML` anywhere in the codebase, so there's no obvious XSS surface from user-entered text.
- **Guest mode needs nothing.** You can run a full build, all 8 phases, with zero sign-up — an account is only required to save/export or sync across devices.

**What's genuinely not there yet — know this before you rely on it for regulated data:**
- No SSO (SAML/OIDC), no MFA. Sign-in today is email + password via Firebase only.
- The AI/payment worker routes have no caller authentication or rate limiting — anyone with the URL can call them (they don't expose secrets, but they're not access-controlled either).
- No formal penetration test, SOC 2, or ISO 27001 assessment has been done.
- No GDPR "right to erasure" self-service flow, no formal Data Processing Agreement template yet.

If any of that matters for your use case — it will, for most regulated enterprise data — read the full [`ENTERPRISE_READINESS.md`](./ENTERPRISE_READINESS.md) checklist before deciding what you put into a shared/synced build. Guest builds and Starter-tier local-only use are the safest posture available today for anything sensitive.

---

## Plans

| Plan | Price | What it adds |
|---|---|---|
| **Starter** | Free forever | Full 8-phase workflow, 2 builds/year, core Excel export |
| **Professional** | $19/mo ($190/yr) | 15 builds/year, full 18-sheet export, tech review locking, cloud sync |
| **Team** | $59/mo ($590/yr) | Unlimited builds, up to 8 seats, shared build repository, Team RAID board |
| **Enterprise** | Custom | Unlimited seats, SSO/LDAP/SAML, ServiceNow/Jira/BMC integration, on-prem bundle, SOC2/ISO 27001 audit trail |

Billing isn't live yet (`STRIPE_CONFIGURED = false`) — Team and Enterprise are a "coming soon, talk to us" roadmap item today, not an active checkout. See [`DOMAIN_EXPANSION_ROADMAP.md`](./DOMAIN_EXPANSION_ROADMAP.md) for the full monetization roadmap.

---

## Where to go next

- **Try it live, no account:** https://opsmanifest.pages.dev
- **12-scene guided tour:** https://opsmanifest.pages.dev/demo
- **Presentation deck:** https://opsmanifest.pages.dev/slides
- **Full security/enterprise-readiness audit:** [`ENTERPRISE_READINESS.md`](./ENTERPRISE_READINESS.md)
- **What's shipped vs. planned:** [`PRODUCT_ROADMAP.md`](./PRODUCT_ROADMAP.md)
- **Contributing / architecture reference:** [`CLAUDE.md`](./CLAUDE.md)
