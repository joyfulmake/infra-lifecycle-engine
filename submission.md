# Submission Guide — OpsManifest

Complete reference for submitting and managing OpsManifest across every distribution/launch channel: Microsoft Store, Meta Quest, G2, Product Hunt, Reddit, AlternativeTo, and Microsoft AppSource.
Return here whenever it's time to execute a submission — each part is self-contained with exact steps.

Listing copy (descriptions, taglines, feature lists) lives in **`roadmap.md`** — this file is the "how to submit," `roadmap.md` is the "what to say."

---

## Status snapshot

| Item | Status |
|---|---|
| Live PWA URL | https://opsmanifest.pages.dev |
| Privacy policy | https://opsmanifest.pages.dev/privacy.html |
| Icons (192, 512) | ✓ in `public/` |
| PWA manifest | ✓ `public/manifest.json` (live, 200 OK, valid) |
| MSIX generation method | **PWABuilder.com** (pivoted 2026-07-02 — see root-cause note below) |
| Legacy GitHub Actions workflow | ⚠ **Deprecated** — `.github/workflows/build-msix.yml` — do not use, see note |
| Partner Center identity values | ✓ same values, reused in PWABuilder | 
| Submission status | v3.1.0.0 failed certification 2026-07-02 — crash at launch, HP Spectre x360 / HP 17-bs011dx, OS build 22631.3296. Root cause identified; next submission via PWABuilder. |

---

## ⚠ Root cause of the crash-at-launch pattern (read before rebuilding)

Every submission from v1.0.0.0 through v3.1.0.0 (20 versions) crashed at launch on some device with `Error Message: N/A`, each time on a different OS build (26100.3194, 26200.8116, 26200.8655, and now 22631.3296 — an *older* Windows 11 22H2/23H2 build). Each fix stripped one more CSS/HTML feature (`@font-face`, `@keyframes`, `crossorigin`, `:where()`, `backdrop-filter`, CSS4 media ranges...) suspected of crashing "WebView2" natively.

**The actual root cause: the hand-authored `AppxManifest.xml` never used WebView2 at all.** `.github/workflows/build-msix.yml` declared the app as:
```xml
<Application Id="App" StartPage="index.html">
```
No `Executable`, `EntryPoint`, or `uap10:HostId`. Per Microsoft's own docs, a bare `StartPage` attribute is the **legacy "JavaScript UWP app" model** (WinJS/`wwahost.exe`-era) — a different, effectively unmaintained rendering path that predates WebView2 and was never migrated to Chromium the way the Edge browser was. Which exact build of that legacy renderer runs is tied to the Windows OS build itself (not an independently-updatable Evergreen runtime), which is exactly why every crash report named a different OS build with no JS exception — a native crash in an old parser, not a WebView2 bug.

**Fix: stop hand-authoring the legacy-model manifest. Generate the MSIX via [pwabuilder.com](https://pwabuilder.com), which uses PWABuilder's "Hosted App Model" backed by real Chromium Edge.** This is the same official Microsoft-endorsed tool this project already documents using for the Meta Quest submission (Part 7 below). See Part 1 for the new build steps.

The old `build-msix.yml` workflow is left in the repo for reference only — **do not run it for future submissions**; it will keep producing the same crash-prone legacy-model package.

---

## Part 1 — Building the MSIX (via PWABuilder)

1. Go to https://pwabuilder.com
2. Enter the live URL: `https://opsmanifest.pages.dev` → Start
3. Review the PWA Report Card — manifest, service worker (`sw.js`), icons, and HTTPS are already valid, so it should score well. Fix anything it flags as **Required** before continuing.
4. Click **Package for Store** → choose **Windows**
5. Fill in the Partner Center identity values (same values as before — from Partner Center → Apps & Games → OpsManifest → App identity):

   | Field | Value |
   |---|---|
   | Package/Application identity name | `Flourishing.opsmanifest` |
   | Publisher (CN=...) | `CN=CF05ACFD-1A2C-4D3B-85CE-80828C73812E` |
   | Publisher display name | `Flourishing` |
   | Version | `4.0.0` — **3 segments only**, not 4 (see version format note below) |
   | Classic version | `3.9.0` — 3 segments, must be numerically **lower** than Version |

   **⚠ Version format is different from the old workflow's 4-segment scheme.** PWABuilder's Windows form requires exactly 3 segments (`X.Y.Z`) for both **Version** and **Classic version** — a 4th segment is rejected ("Version must have 3 segments: 1.0.0"), and the first segment can't be `0`. PWABuilder reserves the 4th segment internally for Store use. The two fields also can't be equal — **Version must be greater than Classic version** (Version drives the modern `.msixbundle`, Classic version drives the fallback `.classic.appxbundle`). Since nothing has actually published to the Store yet, any 3-segment Version higher than Classic version works — you don't need to match the repo's old `3.1.0.0`-style numbering.

6. Generate → download the zip. It contains:
   - `{app name}.msixbundle` — the **modern package** (Hosted App Model, Windows 10 2004+ / all Win11) — this is the one to upload to Partner Center
   - `{app name}.classic.appxbundle` — fallback for older Windows — upload alongside it if Partner Center asks for it
   - `install.ps1` — lets you test-install locally before submitting (if you have access to a Windows machine)

7. **Before submitting**, if you have any access to a Windows machine (even a VM), run `install.ps1` and confirm the app actually launches and the app shell loads without a network round-trip issue — this project has a history of "unreachable CDN" failures in earlier versions (v1.3–v1.5, when the app loaded the live URL directly instead of bundling `dist/`), so it's worth a sanity check that PWABuilder's package caches the app via `sw.js` correctly. If you have no Windows machine available, submit directly — Partner Center certification will surface it either way, faster than guessing.

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

**Privacy policy URL:** `https://opsmanifest.pages.dev/privacy.html`

**Website URL:** `https://opsmanifest.pages.dev`

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
| Privacy policy URL unreachable | Confirm https://opsmanifest.pages.dev/privacy.html loads in a fresh browser |
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
- Deploy: `git push origin main` (auto-deploys to Cloudflare Pages via GitHub Actions)

### 5e. Announce

Share the Store URL. Suggested channels: LinkedIn, any relevant community or email list.

---

## Part 6 — Submitting future updates

When the app gets new features and you want to update the Store listing:

1. Deploy the updated web app first (`git push origin main` → auto-deploys to Cloudflare Pages) — PWABuilder packages whatever is live at `https://opsmanifest.pages.dev`
2. Go to https://pwabuilder.com → re-enter the live URL → **Package for Store** → **Windows**
3. Use the same Partner Center identity values, **bump the version** (e.g. `4.1.0` — 3 segments, keep Classic version below it, see Part 1 note)
4. Download the new package
5. **Partner Center** → OpsManifest → "Update" → new submission draft
6. Upload the new package to the Packages section
7. Update the store listing if anything changed (description, screenshots)
8. Submit — certification again (usually faster for updates, 1–3 days)

Do not use `.github/workflows/build-msix.yml` — it's deprecated (see root-cause note above).

**Version numbering convention (PWABuilder, 3 segments):** `MAJOR.MINOR.PATCH` — e.g. `4.0.0` → `4.1.0` for feature releases, `4.0.1` for patches. (The old `.github/workflows/build-msix.yml` used a 4-segment `MAJOR.MINOR.PATCH.BUILD` scheme — that convention no longer applies since the pivot to PWABuilder.)

> Microsoft Store will **not** accept a version number equal to or lower than the currently published one. Always increment.

---

## Part 7 — Meta Quest (separate submission)

The app manifest is already set up for landscape (required by Meta).

**Steps:**
1. Go to https://pwabuilder.com → enter `https://opsmanifest.pages.dev` (live Cloudflare Pages URL)
2. "Package for Store" → Meta Quest
3. Download the APK package
4. Submit via Meta's Horizon OS developer portal: https://developers.meta.com/horizon/
5. Requires a Meta developer account (free)
6. App category: Productivity
7. Minimum spec: Meta Quest 2 (or Quest 3 for best experience)

---

## Part 8 — G2 (free vendor listing)

**Why first:** highest-leverage free channel for this product — G2 is where enterprise IT buyers actively compare tools against ServiceNow/Jira/Confluence/Monday.com, which is exactly the positioning already used in `public/demo.html` Scene 8. No packaging, no certification wait, live same day.

**Cost:** Free (G2 charges vendors for review-generation/analytics add-ons, not for the base listing).

**Steps:**
1. Go to https://www.g2.com/products/new (or https://sell.g2.com to start as a vendor)
2. Create a vendor account with a business email (use `sriram.c76@gmail.com` or a company alias if preferred)
3. Verify ownership of `opsmanifest.pages.dev` — G2 typically asks for a meta tag or DNS TXT record; since this is a Cloudflare Pages custom subdomain (not a custom domain you control DNS for), use the meta-tag verification method if offered, or verify via business email domain match
4. Fill in the listing form using the copy in **`roadmap.md` → G2 Listing**:
   - Product name, tagline, short + long description
   - Categories (IT Infrastructure Monitoring, IT Project Management, Change Management, CMDB, Requirements Management)
   - Feature list (paste each line as a separate feature)
   - Pricing table (Starter/Professional/Team/Enterprise from `src/lib/auth.js` `PLANS`)
   - Competitors: ServiceNow, Jira, Microsoft Project, Confluence, Monday.com
5. Upload screenshots (see Part 3e above — same five screenshots work here)
6. Upload a logo — use `public/icon-512.png`
7. Submit for G2's moderation review (usually a few business days before it's publicly searchable)
8. Once live, note the G2 profile URL and add it next to the Microsoft Store badge in the sidebar footer (same spot referenced in Part 5c)

---

## Part 9 — Product Hunt

**Why:** free, fast (live same day you launch), good for an initial traffic/feedback spike. Lower audience-fit than G2 for enterprise buyers (skews indie/dev/consumer), so treat this as a visibility + feedback channel, not the primary enterprise lead source.

**Cost:** Free.

**Steps:**
1. Create an account at https://www.producthunt.com (a personal account with some existing activity/followers helps traction, but isn't required)
2. Go to https://www.producthunt.com/posts/new
3. Product name: `OpsManifest`
4. Tagline: use the short version from `roadmap.md` → Product Hunt section (draft on request — not yet written)
5. Link: `https://opsmanifest.pages.dev` (launch the live PWA directly — no Store dependency needed)
6. Upload gallery images/GIF (same screenshots as Part 3e, plus a short screen-recording GIF of the Phase 1 → Gantt → RTM flow if possible — Product Hunt rewards a demo GIF heavily)
7. Add topics/categories: SaaS, Developer Tools, IT
8. **Schedule the launch for 12:01 AM PT** — Product Hunt's daily ranking resets at midnight Pacific, and launching right at reset maximizes the visibility window
9. Have 2–3 people ready to upvote/comment in the first hour (early momentum matters for PH's ranking algorithm) — do not use fake accounts or purchased upvotes, this gets listings penalized/removed
10. Respond to every comment on launch day — PH rewards active maker engagement

---

## Part 10 — Reddit (r/sysadmin, r/devops, r/ITManagers)

**Why:** free, laser-targeted audience of exactly the infra PM / sysadmin persona this tool is built for. Highest risk of being seen as spam if done wrong — read each subreddit's rules before posting.

**Cost:** Free.

**Steps:**
1. Use an existing Reddit account with some karma/history if possible — brand-new accounts posting a product link are often auto-filtered as spam by subreddit bots
2. **Read the subreddit rules first** — r/sysadmin in particular has strict self-promotion rules (often requires posting in a designated "self-promo" thread, or a minimum account age/karma). Check the sidebar/wiki before posting.
3. Draft a **"I built this" / show-and-tell post**, not an ad — lead with the problem (infra provisioning decisions scattered across tickets/spreadsheets/meeting notes), not the product. Copy to draft on request — not yet written in `roadmap.md`.
4. Suggested subreddits, in order of fit:
   - r/sysadmin (huge, general IT ops — check self-promo rules first)
   - r/devops
   - r/ITManagers
   - r/msp (if relevant to managed service provider audience)
5. Post the live app link (`https://opsmanifest.pages.dev`) directly — no signup wall, so people can try it immediately
6. Reply to every comment, especially critical ones — Reddit rewards genuine engagement and punishes drive-by self-promotion

---

## Part 11 — AlternativeTo.net

**Why:** free, low-effort, high durability — once listed, it captures long-tail "alternative to ServiceNow / Jira / Confluence" search traffic indefinitely with zero ongoing maintenance.

**Cost:** Free.

**Steps:**
1. Go to https://alternativeto.net and create an account
2. Search for the product first to confirm it isn't already listed (avoids duplicate-listing rejection)
3. Click "Add a new app/website" (or "Suggest new")
4. Fill in:
   - Name: `OpsManifest`
   - URL: `https://opsmanifest.pages.dev`
   - Short description: reuse the G2 short description from `roadmap.md`
   - Tags/categories: ITSM, Project Management, Infrastructure Management
   - **"Alternative to"** field: tag it as an alternative to ServiceNow, Jira, Confluence, Microsoft Project, Monday.com — this is what drives the search-traffic benefit
5. Upload the logo (`public/icon-512.png`)
6. Submit — community moderators typically approve within a few days

---

## Part 12 — Microsoft AppSource (not the Microsoft Store)

**Why:** separate catalog from the Microsoft Store — lists SaaS/web apps for Microsoft 365/Azure enterprise customers. Keeps Microsoft-ecosystem credibility without any MSIX/WebView2 packaging risk (sidesteps everything in Parts 1–6 entirely).

**Cost:** Free to list (requires a Microsoft Partner Center account — same account already used for the Store submission, no separate $19 fee).

**Steps:**
1. Go to https://partner.microsoft.com/dashboard → Marketplace offers → "+ New offer" → **"SaaS offer"** (not "App" — that's the Store path already covered in Parts 1–6)
2. Fill in offer setup: offer ID (e.g. `opsmanifest`), name `OpsManifest`
3. **Properties**: categories (IT & Management Tools, Project Management), legal terms (link to `https://opsmanifest.pages.dev/privacy.html` and existing ToS pages)
4. **Offer listing**: reuse the long/short description from `roadmap.md` → G2 Listing (same copy works — AppSource's format is similar to G2's)
5. **Preview audience**: add your own account as a preview tenant to test the listing before publishing
6. **Technical configuration**: since this is a web app (not a true multi-tenant SaaS with Azure AD provisioning), use the **"Transactable — Landing page"** or **"Contact me"** offer type rather than full metered/transactable SaaS — this just links out to `https://opsmanifest.pages.dev` and your Stripe checkout, no Azure backend integration required
7. Submit for Microsoft certification (typically faster than Store certification — a few business days)

---

## Quick reference

| Task | Where |
|---|---|
| Build MSIX | https://pwabuilder.com (do NOT use the GitHub Actions workflow — deprecated) |
| Partner Center (Store + AppSource) | https://partner.microsoft.com/dashboard |
| Live app | https://opsmanifest.pages.dev |
| Privacy policy | https://opsmanifest.pages.dev/privacy.html |
| Presentation | https://opsmanifest.pages.dev/slides.html |
| Cloudflare Pages admin | https://dash.cloudflare.com → Pages → opsmanifest |
| Microsoft Store badge assets | https://developer.microsoft.com/en-us/store/badges |
| Microsoft Store Policies | https://aka.ms/msp |
| G2 new product | https://www.g2.com/products/new |
| Product Hunt new post | https://www.producthunt.com/posts/new |
| AlternativeTo submit | https://alternativeto.net |
| Listing copy bank | `roadmap.md` (this repo) |
