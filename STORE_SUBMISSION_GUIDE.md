# Microsoft Store Submission Guide — OpsManifest

Complete reference for building, submitting, and managing OpsManifest on the Microsoft Store.
Return here after certification is complete for post-approval steps.

---

## Status snapshot

| Item | Status |
|---|---|
| Live PWA URL | https://opsmanifest.netlify.app |
| Privacy policy | https://opsmanifest.netlify.app/privacy.html |
| Icons (192, 512) | ✓ in `public/` |
| PWA manifest | ✓ `public/manifest.json` |
| GitHub Actions MSIX workflow | ✓ `.github/workflows/build-msix.yml` |
| Partner Center identity values | ✓ set as workflow defaults |
| Submission status | In certification (awaiting Microsoft approval) |

---

## Part 1 — Building the MSIX

The MSIX is built entirely via GitHub Actions — no local Windows tooling required.

### Workflow: `.github/workflows/build-msix.yml`

**Trigger:** Manual only (`workflow_dispatch`)

**Default identity values already set in the workflow:**

| Input | Default value |
|---|---|
| `package_name` | `Flourishing.opsmanifest` |
| `publisher_id` | `CN=CF05ACFD-1A2C-4D3B-85CE-80828C73812E` |
| `publisher_display_name` | `Flourishing` |
| `app_version` | `1.0.0.0` |

**How to run:**
1. Go to https://github.com/joyfulmake/infra-lifecycle-engine/actions
2. Click "Build MSIX for Microsoft Store" in the left sidebar
3. Click "Run workflow" → leave all defaults → "Run workflow"
4. Wait ~2 minutes for the job to complete
5. Download artifacts: `opsmanifest-msix` (the `.msix` file) and `store-listing-images`

**What the workflow produces:**
- `opsmanifest.msix` — the package to upload to Partner Center
- `store-listing-images/StoreLogo-300x300.png` — 300×300 store logo
- `store-listing-images/AppIcon-512x512.png` — 512×512 icon

> The MSIX is **unsigned** — Microsoft Store signs it during ingestion. You do NOT need a code-signing certificate for Store submission.

---

## Part 2 — Partner Center setup (already done)

Partner Center: https://partner.microsoft.com/dashboard

**Account:** sriram.c76@gmail.com  
**Registration fee:** $19 USD (one-time, already paid)

### App identity (from Partner Center → Apps & Games → OpsManifest → App identity)

| Field | Value |
|---|---|
| Package/Application identity name | `Flourishing.opsmanifest` |
| Publisher (CN=...) | `CN=CF05ACFD-1A2C-4D3B-85CE-80828C73812E` |
| Publisher display name | `Flourishing` |

These values are already hardcoded as defaults in the workflow. If you ever create a new app in Partner Center, the identity values will change — update the workflow defaults to match.

---

## Part 3 — Submission checklist (before or during certification)

Use this when submitting or re-submitting.

### 3a. Package upload

1. Partner Center → Apps & Games → OpsManifest → New submission (or open existing draft)
2. Packages section → Upload `opsmanifest.msix`
3. Partner Center will validate the manifest — common errors:
   - **Identity mismatch**: `Name` or `Publisher` in `AppxManifest.xml` doesn't match Partner Center. Re-run the workflow with the exact values from the App identity page.
   - **Version already used**: Bump `app_version` input (e.g. `1.0.1.0`) and rebuild.

### 3b. Store listing (English — en-US)

Fill in the following fields in the Partner Center listing form:

**App name:** OpsManifest

**Description (up to 10,000 chars — suggested):**
```
OpsManifest is a guided infrastructure lifecycle engine for IT teams and infrastructure PMs.

Walk through the complete server provisioning workflow — hardware and OS selection, system design, incident triage, CAB approval, RTM sign-off, and project closure — in one structured tool.

Key features:
• Phase-gated workflow from design to production go-live
• System design form with AI-assisted suggestions
• Infrastructure topology diagram (layered: HW → OS → App/DB → Storage → Network)
• CAB approval and revision workflow
• Requirements Traceability Matrix (RTM) with sign-off
• Gantt chart with change-freeze periods and buffer scheduling
• RAID log (Risks, Assumptions, Issues, Decisions)
• Role-based access (PM, backup PM, QA Lead)
• Cloud sync via Firebase (Pro plan)
• Excel export across 12 sheets

Not a CMDB or replacement for ServiceNow/Jira/Confluence — a structured pre-work guide that makes those systems more accurate.
```

**Short description (up to 200 chars):**
```
Guided infrastructure provisioning workflow for IT teams — system design, CAB approval, RTM sign-off, Gantt scheduling, RAID log, and Excel export.
```

**Keywords (comma-separated):**
```
infrastructure, ITSM, provisioning, CAB, RTM, system design, Gantt, RAID log, IT operations, server lifecycle
```

**Privacy policy URL:** `https://opsmanifest.netlify.app/privacy.html`

**Website URL:** `https://opsmanifest.netlify.app`

**Support contact:** `sriram.c76@gmail.com`

### 3c. Age rating

Complete the IARC questionnaire in the submission:
- No violence, no mature content, no user-generated content (in the traditional sense)
- Expected result: **PEGI 3 / Everyone**

### 3d. Pricing and availability

- **Price:** Free
- **Markets:** All markets (or limit to specific regions if needed)
- **Release:** Automatic after certification

### 3e. Screenshots

Minimum: 1 screenshot. Accepted sizes: 1366×768, 1920×1080, 2560×1440 (or portrait equivalents).

**Recommended screenshots to take** (open the live app in a browser, use browser screenshot or Windows Snipping Tool):

1. **Phase 1 build screen** — left panel showing hardware/OS selection + scan results
2. **System Design tab** — filled-in design form with section headings visible
3. **Gantt chart tab** — tasks with timeline and change periods
4. **RTM tab** — matrix with PASS/FAIL/PENDING rows

Upload these in the "Screenshots" section of the store listing. They are not required during the first submission but improve conversion rates significantly — add them before the app goes live if possible.

### 3f. Store logos

Upload from the `store-listing-images` artifact:
- 300×300 PNG → "Store logo" field
- 512×512 PNG → optional additional logo field

---

## Part 4 — During certification

Microsoft certification typically takes **3–7 business days** for PWAs.

**What Microsoft checks:**
- Policy compliance (Microsoft Store Policies — [aka.ms/msp](https://aka.ms/msp))
- Security scan of the MSIX package
- Functional test: loads, runs, doesn't crash
- Privacy policy URL is reachable
- Age rating completeness

**You will receive email updates** to sriram.c76@gmail.com at these stages:
- Submission received
- Certification in progress
- Certification passed / failed

**Monitor status:** Partner Center → Apps & Games → OpsManifest → Submission status

**Common certification failures and fixes:**

| Failure | Fix |
|---|---|
| Privacy policy URL unreachable | Confirm https://opsmanifest.netlify.app/privacy.html loads in a fresh browser |
| Identity mismatch in MSIX | Re-run workflow with exact values from App identity page |
| Age rating incomplete | Complete the IARC questionnaire fully |
| App crashes on launch | Test the live URL on a Windows machine in Edge/Chrome |

---

## Part 5 — Post-certification (what to do when Microsoft approves)

When you receive the "Certification passed" email:

### 5a. Confirm the app is live

1. Go to Partner Center → submission should show **"In the Store"**
2. Microsoft will provide a Store URL — format: `https://apps.microsoft.com/store/detail/opsmanifest/PRODUCTID`
3. Test: open the Store URL on a Windows machine, confirm install works

### 5b. Update CLAUDE.md

Add the Microsoft Store URL to the CLAUDE.md "Store submission" section:
```
Microsoft Store URL: https://apps.microsoft.com/store/detail/opsmanifest/PRODUCTID
```

### 5c. Update the live app

Add the Microsoft Store badge/link to the app:
- Options: add "Get it on Microsoft Store" badge link in the sidebar footer area near the "About this tool" link
- Badge assets: https://developer.microsoft.com/en-us/store/badges

### 5d. Update the presentation deck

- Open `public/slides.html` and add the Store URL / badge on the last slide
- Deploy: `git push origin main` (auto-deploys to Netlify)

### 5e. Announce

Share the Store URL. Suggested channels: LinkedIn, any relevant community or email list.

---

## Part 6 — Submitting future updates

When the app gets new features and you want to update the Store listing:

1. **Bump the app version** — decide on the new version (e.g. `1.1.0.0`)
2. **Re-run the workflow** at https://github.com/joyfulmake/infra-lifecycle-engine/actions with the new version number
3. **Download the new MSIX** artifact
4. **Partner Center** → OpsManifest → "Update" → new submission draft
5. Upload the new MSIX to the Packages section
6. Update the store listing if anything changed (description, screenshots)
7. Submit — certification again (usually faster for updates, 1–3 days)

**Version numbering convention:** `MAJOR.MINOR.PATCH.BUILD` — e.g. `1.0.0.0` → `1.1.0.0` for feature releases, `1.0.1.0` for patches.

> Microsoft Store will **not** accept a version number equal to or lower than the currently published one. Always increment.

---

## Part 7 — Meta Quest (separate submission)

The app manifest is already set up for landscape (required by Meta).

**Steps:**
1. Go to https://pwabuilder.com → enter `https://opsmanifest.netlify.app`
2. "Package for Store" → Meta Quest
3. Download the APK package
4. Submit via Meta's Horizon OS developer portal: https://developers.meta.com/horizon/
5. Requires a Meta developer account (free)
6. App category: Productivity
7. Minimum spec: Meta Quest 2 (or Quest 3 for best experience)

---

## Quick reference

| Task | Where |
|---|---|
| Build MSIX | https://github.com/joyfulmake/infra-lifecycle-engine/actions |
| Partner Center | https://partner.microsoft.com/dashboard |
| Live app | https://opsmanifest.netlify.app |
| Privacy policy | https://opsmanifest.netlify.app/privacy.html |
| Presentation | https://opsmanifest.netlify.app/slides.html |
| Netlify admin | https://app.netlify.com/projects/opsmanifest |
| Microsoft Store badge assets | https://developer.microsoft.com/en-us/store/badges |
| Microsoft Store Policies | https://aka.ms/msp |
