# Launch Content — OpsManifest

Listing copy for every launch/distribution channel — the "what to say." Paired with **`submission.md`**, which covers the "how to submit" (accounts, steps, submission flow) for each of these same channels.

This is a content bank, not a feature roadmap — see `PRODUCT_ROADMAP.md` for shipped/planned features and `DOMAIN_EXPANSION_ROADMAP.md` for the multi-domain product vision.

Status: **G2 copy drafted below, ready to paste.** Product Hunt / Reddit / AlternativeTo copy — draft on request, not yet written.

---

## G2 Listing

**Product name:** OpsManifest

**Website:** https://opsmanifest.pages.dev

**Tagline** (G2 limits ~10 words):
> Guided infrastructure lifecycle workflow — from provisioning to CAB to closure

**Categories** (pick up to 5):
- IT Infrastructure Monitoring
- IT Project Management
- Change Management
- Configuration Management Database (CMDB)
- Requirements Management

**Short description** (~150 chars, shows in search results):
> Structured pre-work guide for infra PMs — hardware/OS selection, system design, incident triage, CAB approval, RTM sign-off, and closure in one workflow.

**Long description:**

OpsManifest is a guided infrastructure lifecycle workflow tool for infra project managers, built to make the systems you already use — ServiceNow, Jira, Confluence, Microsoft Project — more accurate, not replace them.

Instead of scattering provisioning decisions across spreadsheets, tickets, and meeting notes, OpsManifest walks your team through the full delivery lifecycle in one structured flow: hardware/OS/DB/app selection → 8-section system design → AI-powered vulnerability & EOL scan → incident and change triage → CAB approval → Gantt scheduling with critical-path analysis → RTM sign-off → post-go-live closure.

**Built for infra PMs, not generic PM tools:**
- **Live CVE/EOL intelligence** — pulls real end-of-life and security-support data (via endoflife.date) for your exact hardware/OS/DB/app stack, flagging risk before you commit to a design.
- **RACI + RTM + CAB workflows** built natively into the tool, not bolted on as generic templates.
- **Critical Path Gantt scheduling** with automatic float/slack calculation, change-freeze and holiday-aware date math.
- **AI advisor (OpsMentor)** — a domain-grounded assistant that surfaces non-obvious risks, EOL windows, and compatibility gaps as you build, with sourced references (NIST, Red Hat, Microsoft, CVE databases).
- **Cross-tab coherence engine** — automatically detects drift between your incident selections, system design, and RTM sign-off, and flags it before it becomes a production incident.
- **18-sheet Excel export** for audit and stakeholder handoff.
- **Works offline-first** (local IndexedDB storage) with optional cloud sync for teams — your data isn't required to leave the browser unless you choose to sync it.

Whether you're standing up a single Oracle/RHEL server or coordinating a multi-region platform migration, OpsManifest gives your team a repeatable, audit-ready path from "we need a server" to "signed off and closed."

**Key features** (one per line, for G2's feature-list field):
- Guided 7-phase provisioning lifecycle workflow
- Live CVE/EOL/lifecycle intelligence per component (endoflife.date integration)
- 20-role RACI matrix with editable assignments
- Requirements Traceability Matrix (RTM) with pass/fail sign-off
- Change Advisory Board (CAB) approval workflow with rollback planning
- Critical Path Method Gantt scheduling with freeze/holiday-aware dates
- AI advisor with sourced, domain-grounded infrastructure guidance
- Cross-tab coherence engine — detects drift between design, incidents, and sign-off
- 18-sheet styled Excel export for audit/handoff
- Offline-first local storage with optional team cloud sync
- RAID log (Risks, Assumptions, Issues, Decisions)

**Pricing:**

| Plan | Price | For |
|---|---|---|
| Starter | Free | 2 builds/year, full 7-phase workflow, core 15-sheet Excel export |
| Professional | $19/mo ($190/yr) | 15 builds/year, full 18-sheet export, tech review locking |
| Team | $59/mo ($590/yr) | Unlimited builds, up to 8 users, shared repository, RAID collaboration |
| Enterprise | Custom | Unlimited users, SSO/SAML, ServiceNow/Jira/BMC integration, on-prem |

*(Pricing sourced from `src/lib/auth.js` `PLANS` — update here if pricing changes there.)*

**Competitors to tag** (matches the comparison framing already used in `public/demo.html` Scene 8):
ServiceNow, Jira (Atlassian), Microsoft Project, Confluence, Monday.com

**Screenshots to upload:**
1. Phase 1 build screen (hardware/OS/DB/app selection)
2. System Design tab (8-section form with AI suggestions)
3. Gantt tab (critical path + FSM panel)
4. RTM tab (pass/fail matrix)
5. CMDB tab (live EOL tracking)

**Logo:** `public/icon-512.png`

---

## Product Hunt Listing

*Not yet drafted — ask to have this written before the Part 9 submission in `submission.md`.*

---

## Reddit Post (r/sysadmin, r/devops, r/ITManagers)

*Not yet drafted — ask to have this written before the Part 10 submission in `submission.md`.*

---

## AlternativeTo.net Listing

*Reuses the G2 short description above — see Part 11 in `submission.md`. No separate copy needed.*

---

## Microsoft AppSource Listing

*Reuses the G2 long/short description above — see Part 12 in `submission.md`. No separate copy needed.*
