# OpsManifest — Domain Expansion Roadmap

From a single-domain infra provisioning PM tool to a universal project delivery engine
covering every major PM vertical and technology horizontal.

---

## Architecture Pattern (the same for every domain)

The current infra module is the template. Every domain expansion follows the same file structure:

```
src/domains/{domain}/
  tasks.js          — task catalog (equiv. realTasks.js)
  incidents.js      — incident / risk catalog (equiv. incidents.js)
  uumItems.js       — change / upgrade items (equiv. uumItems.js)
  designSections.js — design form sections and fields
  compatRules.js    — vendor compat rule database (equiv. compatibilityRules.js)
  rtmRows.js        — requirement traceability rows
  closureChecks.js  — post-delivery closure checklist
  scanRules.js      — smart scan rules (equiv. smartScan.js)
  designDefaults.js — auto-fill defaults per stack combo
  suggestDb.js      — field-level autocomplete suggestions
```

The Zustand store, workflow gates (CAB → RTM → Closure), Gantt CPM engine, RAID log,
coherence engine, and OpsMentor LLM layer are **domain-agnostic** — they stay shared.

OpsMentor's system prompt gets a domain context block injected per module. The worker
`/orchestrator-chat` route receives `{ domain, context }` and routes to domain-specific
guidance logic.

---

## Phase 0 — Foundation (Now → Q3 2026)

Before expanding domains, harden the platform:

- [ ] Custom domain (`opsmanifest.com`)
- [ ] Worker auth tokens (shared secret per CF Worker deployment)
- [ ] Stripe live (billing gate for new domain modules as paid add-ons)
- [ ] SSO via Firebase Auth SAML provider (enterprise gate)
- [ ] Domain selector UI in PhasePanel — user picks their PM domain on first load
- [ ] Domain registry in store (`activeDomain: 'infra' | 'app' | 'sap' | ...`)
- [ ] Domain-specific OpsMentor system prompt injection
- [ ] Domain-specific quick-action chips in OrchestratorPanel

---

## Phase 1 — Technology Horizontals (Q3–Q4 2026)

Horizontals cut across every industry. Add these first because they're universally sellable.

---

### 1.1 Cloud Migration PM

**Who:** Cloud architects, migration PMs, hyperscaler practices (AWS, Azure, GCP)

**Unique workflow gates:**
- Discovery & Assessment → Wave Planning → Lift-Shift / Replatform / Refactor decision → Landing Zone setup → Migration Wave execution → Hypercare → Cloud cost baseline

**Key catalogs:**
- Tasks: cloud readiness assessment, VPC/VNET design, IAM role mapping, networking cutover, DNS cutover, DR test in cloud
- Incidents: network latency regression, S3/Blob permission drift, IAM role misconfiguration, cost spike
- UUM items: EC2 rightsizing, RDS migration, S3 bucket policy hardening, CloudTrail enablement
- Compat rules: Oracle license on AWS (BYOL vs RDS), Windows Server activation in Azure, GCP nested virtualisation support matrix
- Design sections: landing zone, networking (VPC / ExpressRoute / Direct Connect), IAM, cost governance, tagging strategy, DR

**OpsMentor specialisation:** knows AWS Migration Acceleration Program (MAP), Azure Migration Factory, GCP Rapid Assessment and Migration Program (RAMP); can generate cost estimates from task hours × cloud pricing

---

### 1.2 DevOps / Platform Engineering PM

**Who:** Platform engineering leads, DevOps PMs, SRE leads

**Unique workflow gates:**
- Platform charter → Toolchain design → Pipeline build → Environment provisioning → Developer onboarding → SLO baseline → GA

**Key catalogs:**
- Tasks: CI/CD pipeline setup (Jenkins / GitLab CI / GitHub Actions), container image registry, Kubernetes cluster provisioning, secret management (Vault / AWS Secrets Manager), SLO instrumentation, DORA metric baseline
- Incidents: pipeline flapping, registry auth failure, cluster cert expiry, secret rotation failure
- UUM items: Jenkins → GitHub Actions migration, Docker Swarm → Kubernetes lift, Helm chart upgrade
- Compat rules: Helm 2 EOL (cluster-side Tiller), Docker v1 manifest deprecation, Kubernetes API version removal matrix (1.x deprecations)
- Design sections: source control, CI/CD, container platform, observability stack, secret management, developer self-service portal

---

### 1.3 Cybersecurity PM

**Who:** CISOs, InfoSec PMs, GRC leads, red/blue team project managers

**Unique workflow gates:**
- Scope & Rules of Engagement → Threat Modelling → Controls Design → Implementation → Penetration Test → Remediation → CAB (security change) → RTM (control effectiveness) → Closure

**Key catalogs:**
- Tasks: vulnerability assessment, pen test (external / internal / web app), IAM hardening, PAM rollout, SIEM onboarding, zero-trust network segmentation, DLP deployment, SOC handover
- Incidents: critical CVE exposure (CVSS ≥9), data exfiltration signal, ransomware IOC, supply chain compromise, cert expiry on prod
- UUM items: TLS 1.0/1.1 cipher retirement, legacy auth protocol (NTLM/Kerberos delegation) hardening, password policy enforcement, EDR agent rollout
- Compat rules: specific CVE-to-product-version maps, TLS cipher support matrix per browser/OS, FIPS 140-2 compliant library requirements
- Design sections: identity (IAM / PAM / MFA), network segmentation, endpoint security, data classification, logging & SIEM, IR playbook, compliance framework (SOC 2 / ISO 27001 / PCI-DSS / HIPAA / DPDP)
- RTM rows map to: NIST CSF functions, CIS Controls v8, ISO 27001 Annex A controls

**Differentiator:** RTM maps requirements to control frameworks (NIST, CIS, ISO) — most tools don't do this

---

### 1.4 Network Refresh PM

**Who:** Network PMs, NOC leads, WAN/LAN refresh project managers

**Unique workflow gates:**
- Current-state survey → Design (topology, addressing, QoS) → Procurement → Lab validation → Change Window scheduling → Cutover (phased) → Hypercare → Closure

**Key catalogs:**
- Tasks: network baseline capture (CDP/LLDP discovery), IP address management (IPAM) update, firewall ruleset export/diff, BGP/OSPF neighbour check, WAN circuit handover test
- Incidents: BGP flap, OSPF neighbour loss, switchport duplex mismatch, spanning-tree loop, firewall policy regression
- UUM items: Cisco IOS 12.x EOL, Junos EOL, ASA to FTD migration, MPLS to SD-WAN, legacy ACL conversion
- Compat rules: Cisco IOS version support matrix, Junos platform support, SD-WAN vendor interop (Cisco Meraki / VMware Velocloud / Palo Alto Prisma)
- Design sections: physical topology, IP addressing plan, routing protocol, QoS policy, firewall zones, WAN circuits, out-of-band management, monitoring

---

### 1.5 Data & Analytics PM

**Who:** Data platform PMs, BI leads, lakehouse migration PMs

**Unique workflow gates:**
- Data inventory → Architecture design → Pipeline build → Data quality baseline → UAT (business validation) → Go-live → Hypercare

**Key catalogs:**
- Tasks: source system profiling, ETL pipeline build (Spark / dbt / Informatica), data quality rule definition, Tableau / Power BI report migration, data catalogue (Collibra / DataHub) onboarding
- Incidents: pipeline failure (SLA breach), data quality alert (row count deviation), schema drift, PII exposure in dev environment
- UUM items: Hadoop HDFS → cloud object store migration, Oracle DW → Snowflake migration, Teradata → BigQuery migration, SSIS → ADF migration
- Compat rules: Spark version support matrix, dbt-core adapter compatibility, Tableau Server version support lifecycle
- Design sections: ingestion layer, transformation layer, storage (lakehouse / DW), serving layer (BI / API), data quality, PII/masking strategy, lineage & catalogue, DR

---

## Phase 2 — Enterprise Application Verticals (Q1–Q2 2027)

---

### 2.1 SAP PM

**Who:** SAP Basis leads, SAP project managers, S/4HANA transformation PMs

**Why it's a major opportunity:** SAP projects are notoriously high-risk, high-cost, and under-tooled for structured pre-work governance. The CAB → RTM → Closure workflow maps perfectly to SAP's own ACTIVATE methodology.

**Unique workflow gates:**
- System landscape design → Transport route setup → Basis readiness (kernel / SP / ABAP) → Functional module go-live sequence → Cutover (parallel ledger / legacy shutdown) → Post-go-live support (hypercare) → Closure

**Key catalogs:**
- Tasks: OS/DB platform check (SAP PAM), kernel upgrade, ABAP SP stack application, SAP Note implementation, transport release & import sequence, cutover master list (CMO), legacy system shutdown, license audit
- Incidents: Short dump (ABAP runtime error), R/3 kernel crash, dialog work process exhaustion, spool request overflow, update task termination, HANA OOM (out of memory), logon load balancer failure
- UUM items: SAP ECC 6.0 → S/4HANA 2023 migration, Oracle DB → HANA DB migration, SAP GUI 7.40 → SAP GUI 8.0 upgrade, SAP NetWeaver ABAP kernel 7.53 → 7.93 upgrade, transport management system (TMS) reconfiguration
- Compat rules: SAP PAM for every HW/OS/DB/Kernel combination; HANA TDI minimum requirements (CPU/RAM); SAP-certified hardware (TDI/TCOE); WebDispatcher version matrix; SAP SSO 3.0 browser support
- Design sections: system landscape (DEV/QAS/PRD), instance sizing (SAPS, memory), transport routes, interface landscape (IDOc / RFC / BAPI), authorisation concept, high availability (HSR / Pacemaker), backup strategy (Backint), monitoring (Solution Manager / FocusRun)
- RTM rows: SAP ACTIVATE workstream gates, functional go-live acceptance criteria, interface testing sign-off

**OpsMentor specialisation:** knows SAP ACTIVATE Explore → Realize → Deploy phases; understands SPDD/SPAU notes; knows HANA memory sizing formula; can detect SAP kernel version / SP stack mismatches against PAM in real time

---

### 2.2 Salesforce PM

**Who:** Salesforce implementation PMs, release managers, org-split/merge PMs

**Unique workflow gates:**
- Org strategy (full sandbox / scratch org) → Metadata design → Development (Apex / LWC / Flows) → UAT → Release (change set / SFDX) → Go-live → Hypercare

**Key catalogs:**
- Tasks: sandbox refresh, permission set design, apex trigger review, LWC component unit tests (Jest), change set deployment validation, data migration (Dataloader / MuleSoft), integration testing (Salesforce → ERP), duplicate management baseline
- Incidents: governor limit breach (SOQL 101 / DML limits), mixed-DML error, APEX CPU timeout, batch job failure, platform event consumer lag, Flow error
- UUM items: Workflow Rules → Flow migration (WFR deprecation 2026), Process Builder → Flow migration, legacy API version retirement (v20 → v59+), Classic → Lightning migration
- Compat rules: Salesforce API version support matrix, AppExchange package compatibility per API version, MuleSoft connector compatibility matrix, Heroku Stack (cedar-14 EOL)
- Design sections: org design (single/multi-org), data model, security model (profiles/permission sets), integration architecture, automation layer (Flows vs Apex), reporting & dashboards, release strategy
- RTM rows: business requirement → Salesforce component mapping, acceptance criteria per user story

---

### 2.3 Oracle EBS / Fusion PM

**Who:** Oracle EBS upgrade PMs, Oracle Fusion implementation PMs

**Unique workflow gates:**
Similar to SAP but with Oracle's own upgrade paths (12.1.3 → 12.2.x, then Fusion Cloud)

**Key catalogs:**
- Tasks: AD (Applications DBA) patch apply, ADOP (online patching) cycle, custom code (CEMLI) re-validation, Oracle Forms → ADF migration, concurrent request baseline
- Incidents: Concurrent manager crash, FND_CONCURRENT_REQUESTS table growth, Oracle Forms session timeout, autoconfig failure, XML Publisher report error
- UUM items: Oracle EBS 12.1.3 → 12.2.13 upgrade, E-Business Suite SOA Gateway migration, OAF → ADF migration
- Compat rules: Oracle EBS certified database matrix (must use Oracle DB, specific versions only), Oracle JDK vs OpenJDK (EBS certification is JDK only), browser support matrix (EBS 12.2 IE/Chrome versions)

---

### 2.4 Microsoft Dynamics 365 PM

**Who:** Dynamics 365 implementation PMs, Business Central upgrade PMs

**Unique workflow gates:**
- Environment provisioning (sandbox / UAT / prod) → Solution design → Customisation (AL extensions) → Data migration → Integration (Azure Integration Services) → UAT → Go-live

**Key catalogs:**
- Tasks: LCS environment setup, AL extension validation, data migration (DIXF), Azure AD app registration, Power Platform integration, Common Data Model validation
- Incidents: duplicate detection rule mismatch, plugin execution timeout, async workflow queue backlog, integration connector throttle (429)
- Compat rules: D365 Business Central per-country payroll support matrix; Power Platform connector version; Azure AD B2C compatibility per D365 release wave

---

## Phase 3 — Industry Verticals (Q2–Q3 2027)

Industry verticals layer compliance and domain knowledge on top of the horizontal PM framework.

---

### 3.1 BFSI PM (Banking, Financial Services, Insurance)

**Who:** Core banking transformation PMs, payment gateway PMs, regulatory reporting PMs

**Compliance frameworks baked in:**
- PCI-DSS v4.0 — RTM rows map to 12 requirements
- Basel III / IV — capital calculation system delivery checklist
- RBI / MAS / FCA regulatory timelines — built into change period calendar
- SWIFT messaging standards (MT → MX / ISO 20022 migration)

**Unique elements:**
- Tasks: core banking migration (Finacle / Temenos T24 → Temenos Transact / Finastra Fusion), payment switch cutover (RTGS / NEFT / UPI), reconciliation framework validation, fraud detection model deployment
- Incidents: payment reconciliation failure, settlement file generation error, AML alert queue overflow, HSM key ceremony failure
- Compat rules: SWIFT MX message format migration deadline map, PCI-DSS cipher requirement timeline, PCI PIN v3.0 approved algorithm list
- Design sections: network segmentation (CDE isolation), encryption at rest/transit, HSM integration, tokenisation, audit logging, DR/BCP (RTO/RPO per criticality tier)
- RTM rows: PCI-DSS requirement → control → evidence mapping; RBI circular compliance checklist

**Differentiator:** first tool to map infra Gantt tasks directly to PCI-DSS controls in RTM

---

### 3.2 Healthcare PM

**Who:** EMR implementation PMs, HL7 integration PMs, HIPAA compliance PMs, NHS Digital PMs

**Compliance frameworks:**
- HIPAA (US): Privacy Rule, Security Rule, Breach Notification Rule
- NHS DSPT (UK): Data Security and Protection Toolkit
- ABDM (India): Ayushman Bharat Digital Mission standards
- HL7 FHIR R4 / R5 — interface design sections

**Unique elements:**
- Tasks: ePHI data classification, BAA (Business Associate Agreement) execution, HL7 v2 → FHIR R4 interface build, ICD-10-CM code mapping validation, EMR go-live (Epic / Cerner / Meditech) cutover, disaster recovery test (clinical continuity)
- Incidents: EMR downtime (downtime procedures activation), HL7 ADT message drop, medication order interface failure, PACS image retrieval failure
- Compat rules: Epic certification matrix (OS, DB, hardware); Cerner Millennium certified OS list; FDA-cleared device software version lock requirements
- Design sections: ePHI data flows, access control (Role-Based, Break-Glass), encryption (FIPS 140-2), audit logging (minimum 6-year retention), BAA counterparties, DR (RTO ≤4h for clinical systems)
- RTM rows: HIPAA § mapping → technical control → evidence; NHS DSPT assertion → control

---

### 3.3 Manufacturing / Industry 4.0 PM

**Who:** MES/SCADA implementation PMs, OT/IT convergence PMs, PLM upgrade PMs

**Unique elements:**
- OT/IT network segmentation (Purdue model zones) as a design section
- Tasks: PLC firmware upgrade, SCADA historian migration, MES (SAP MII / Rockwell FactoryTalk) cutover, OPC-UA integration test, production line qualification (IQ/OQ/PQ)
- Incidents: PLC program checksum error, SCADA historian data gap, OPC server licence exhaustion
- Compat rules: Siemens TIA Portal version matrix; Rockwell RSLogix5000 firmware compatibility; Wonderware / AVEVA System Platform version support; OPC-UA server interop matrix

---

### 3.4 Telecom PM

**Who:** BSS/OSS transformation PMs, 5G core network PMs, VoIP migration PMs

**Unique elements:**
- Telecom-specific incidents: CDR (call detail record) generation failure, SIP trunk capacity breach, IMS core failover, billing mediation file format mismatch
- Compat rules: 3GPP Release compatibility matrix; SIP RFC compliance per vendor; ENUM DNS resolution for VoIP routing
- Design sections: network function virtualisation (NFV), SIP trunk design, CDR/mediation, OSS/BSS integration, regulatory (TRAI/Ofcom/FCC) reporting

---

### 3.5 Retail / e-Commerce PM

**Who:** e-Commerce platform migration PMs, POS upgrade PMs, OMS implementation PMs

**Unique elements:**
- Blackout windows: Black Friday / Cyber Monday / festive season freeze hardcoded into change period calendar
- Tasks: Magento → Shopify/Salesforce Commerce migration, ERP → OMS integration (SAP S/4 → Manhattan / Blue Yonder), POS terminal rollout, payment gateway switch (Stripe / Adyen), loyalty platform migration
- Compat rules: PCI-DSS for cardholder data environment; Shopify API version sunset schedule; Magento 1.x EOL (June 2020 — flag legacy installs); Google Shopping feed schema version

---

## Phase 4 — App Development PM Module (Q3 2027)

This is the most requested horizontal after infra — PMs managing software delivery, not ops.

**Who:** Software delivery PMs, Agile delivery leads, product managers running large enterprise builds

**Core difference from infra:** delivery is iterative (sprints) not phased (CAB → RTM). The workflow gate model becomes:

Discovery → Architecture → Sprint Planning → Build (sprint log) → Integration → UAT → Release → Hypercare

**Unique elements:**
- Design sections: functional requirements, non-functional requirements (NFRs: performance / security / scalability), API design, data model, integration design, test strategy, release strategy, compliance (GDPR, accessibility, WCAG)
- Tasks: backlog grooming, sprint planning, API contract (OpenAPI spec), unit test baseline (coverage ≥80%), integration test suite, load test (k6 / JMeter), security scan (SAST/DAST), accessibility audit (axe-core), app store submission, CDN configuration
- Incidents: production bug (P1/P2/P3 classification), data regression (post-deploy), auth provider outage, third-party API degradation
- UUM items: framework version upgrade (React 18→19, Spring Boot 2→3, .NET 6→8), database schema migration, API version deprecation, SDK upgrade
- Compat rules: Node.js LTS support matrix, Spring Boot support timeline, .NET support matrix, React 18 vs 19 breaking changes, OpenJDK version support

**Gantt model:** sprints map to Gantt swimlanes; tasks within each sprint are parallel by default with sequential gates (sprint review, retrospective) at the end

**RAID log additions:** sprint risks, scope creep decisions, technical debt log, dependency risks on third-party APIs

**RTM:** requirement → user story → acceptance criterion → test case → test result

---

## Phase 5 — Cross-Domain Intelligence Layer (Q4 2027)

Once 3+ domains are live, the following become possible:

### 5.1 Cross-Domain Risk Benchmarking

Anonymised aggregated risk scores across all builds (by domain, industry, stack). OpsMentor can say:
> "SAP ECC → S/4HANA migrations typically finish 3 weeks late. Your current Gantt has zero buffer on the ABOP transport track. Median risk score at this phase for similar builds is 14 (HIGH). Yours is 22."

### 5.2 Domain-Adaptive OpsMentor

Single OpsMentor that detects the active domain and injects domain-specific:
- System prompt context block
- Quick-action chips (domain vocabulary)
- Compatible incident / task suggestions
- Relevant compat rules from the domain's rule database

### 5.3 Multi-Domain Build

A single project that spans domains (e.g., SAP S/4HANA migration that also involves OS/DB infra refresh and a cloud landing zone). Each tab can be scoped to a domain sub-module. Coherence engine checks cross-domain consistency (e.g., "Your SAP HANA design requires RHEL 8.6 minimum but your infra module has RHEL 7.9 selected").

### 5.4 RegTech Intelligence

For BFSI and Healthcare, OpsMentor proactively monitors:
- RBI / SEBI / IRDAI circular calendar — flags upcoming compliance deadlines
- PCI-DSS sunset dates (cipher, protocol, API version)
- FDA 510(k) submission timelines
- NHS DSPT annual submission window

### 5.5 Portfolio View

Multi-build dashboard: portfolio of all active projects across an org, showing aggregate risk scores, overdue gates, CAB approval backlogs, and team utilisation across Gantt schedules.

---

## Module Activation Model (Business Model)

| Module | Included in plan | Add-on |
|---|---|---|
| Infra PM (current) | All plans | — |
| Cloud Migration | Professional+ | — |
| DevOps / Platform | Professional+ | — |
| App Development | Professional+ | — |
| Cybersecurity | Professional+ | — |
| Network Refresh | Professional+ | — |
| Data & Analytics | Team+ | — |
| SAP | Enterprise or add-on | $49/mo per seat |
| Salesforce | Enterprise or add-on | $39/mo per seat |
| Oracle EBS/Fusion | Enterprise or add-on | $49/mo per seat |
| BFSI (PCI + Basel) | Enterprise or add-on | $99/mo per seat |
| Healthcare (HIPAA + HL7) | Enterprise or add-on | $99/mo per seat |
| Manufacturing / OT | Enterprise or add-on | $79/mo per seat |
| Telecom | Enterprise or add-on | $79/mo per seat |
| Retail | Team+ | — |

Domain add-ons are activated per-org by the admin. A PM in a bank buys the BFSI module; a PM in a hospital buys Healthcare — they're not paying for SAP compat rules they'll never use.

---

## Indicative Timeline

| Quarter | Deliverable |
|---|---|
| Q3 2026 | Phase 0 — platform hardening (custom domain, SSO, billing live) |
| Q3 2026 | Phase 1a — Cloud Migration + Cybersecurity modules |
| Q4 2026 | Phase 1b — DevOps/Platform + Network Refresh modules |
| Q1 2027 | Phase 1c — Data & Analytics module |
| Q1 2027 | Phase 2a — SAP module (highest revenue potential) |
| Q2 2027 | Phase 2b — Salesforce module |
| Q2 2027 | Phase 2c — Oracle EBS/Fusion module |
| Q3 2027 | Phase 3a — BFSI module |
| Q3 2027 | Phase 3b — Healthcare module |
| Q3 2027 | Phase 4 — App Development PM module |
| Q4 2027 | Phase 5 — Cross-domain intelligence + portfolio view |

---

## What Stays the Same Across All Domains

The following are **domain-agnostic** and require no changes per domain:

- Zustand store (workflow gate booleans, RAID log, RTM rows, closure checks)
- Gantt engine (CPM, change periods, parallel task scheduling)
- OpsMentor UI and TTS voice layer
- Firebase cloud sync + Dexie local storage
- CAB approval / decline / revision workflow
- Excel export engine (14-sheet template adapts to domain-specific section labels)
- Coherence engine (cross-tab alerts — just new rules per domain)
- Billing / auth / plan system
- MSIX / PWA / web distribution

**Total reuse: ~70% of the codebase per new domain.** The 30% per-domain work is the knowledge catalogs (tasks, incidents, UUM, compat rules, design defaults) and OpsMentor prompt tuning. The hardest part is getting the catalog right — the engineering scaffolding is already there.
