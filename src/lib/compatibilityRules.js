/**
 * Vendor compatibility rule database.
 *
 * Each rule describes a known platform incompatibility documented by the vendor.
 * `match` is a predicate over { hw, os, db, app } (all lowercased strings).
 * `check` receives the full ctx object and returns true when the incompatibility applies.
 * `refs` are authoritative public URLs for the claim — always shown to the user.
 */

export const COMPAT_RULES = [
  // ── SAP ASE (Sybase) ───────────────────────────────────────────────────────
  {
    id: 'sybase_rhel_power',
    severity: 'critical',
    vendor: 'SAP',
    product: 'SAP ASE (Sybase)',
    title: 'SAP ASE is not supported on RHEL for IBM Power (ppc64le)',
    detail:
      'SAP ASE 16.x does not ship a ppc64le (RHEL for IBM Power little-endian) build. ' +
      'The SAP Product Availability Matrix (PAM) lists only x86_64 Linux, AIX (Power BE), ' +
      'and Windows as supported OS/hardware combinations. Running ASE on RHEL Power LE is ' +
      'unsupported and will produce a binary not found / wrong ELF class error at install.',
    refs: [
      { label: 'SAP ASE Product Availability Matrix (PAM)', url: 'https://support.sap.com/content/dam/launchpad/en_us/pam/pam-essentials/SAP_PAM_ASE.pdf' },
      { label: 'SAP Note 1554717 — ASE platform support', url: 'https://me.sap.com/notes/1554717' },
    ],
    check: ({ db, hw, os }) =>
      /sybase|sap.?ase|adaptive.?server/i.test(db) &&
      (/power|ibm.?power|p9|p10/i.test(hw) || /power/i.test(os)) &&
      /rhel|red.?hat|linux/i.test(os) &&
      !/aix/i.test(os),
    compatFix: {
      type: 'switch_db',
      summary: 'SAP ASE has no ppc64le binary — switch to a DB with native RHEL Power LE support',
      alternatives: [
        { label: 'PostgreSQL 15+ (native ppc64le, fully certified on RHEL 8/9 Power)', ctxKey: 'db', ctxValue: 'PostgreSQL 15' },
        { label: 'Oracle 19c on RHEL 8 ppc64le (PAM-certified)', ctxKey: 'db', ctxValue: 'Oracle 19c' },
        { label: 'IBM Db2 11.5.8+ (native ppc64le with fix pack)', ctxKey: 'db', ctxValue: 'IBM Db2 11.5' },
        { label: 'MySQL 8.0 Community (ppc64le available for RHEL 8)', ctxKey: 'db', ctxValue: 'MySQL 8.0' },
      ],
    },
  },
  {
    id: 'sybase_aix_ok',
    severity: 'info',
    vendor: 'SAP',
    product: 'SAP ASE (Sybase)',
    title: 'SAP ASE on AIX/Power: supported — use Power BE (big-endian) build',
    detail:
      'SAP ASE 16.x is certified on AIX 7.1 and 7.2 (IBM Power, big-endian). ' +
      'Ensure you download the AIX build from SAP Software Center, not the Linux binary.',
    refs: [
      { label: 'SAP ASE PAM — AIX support matrix', url: 'https://support.sap.com/content/dam/launchpad/en_us/pam/pam-essentials/SAP_PAM_ASE.pdf' },
    ],
    check: ({ db, os }) =>
      /sybase|sap.?ase|adaptive.?server/i.test(db) && /aix/i.test(os),
  },

  // ── Oracle Database ────────────────────────────────────────────────────────
  {
    id: 'oracle_aix_73',
    severity: 'critical',
    vendor: 'Oracle',
    product: 'Oracle Database',
    title: 'Oracle DB is not certified on AIX 7.3 in any version — last certified AIX is 7.2 TL5+',
    detail:
      'No version of Oracle Database is certified on AIX 7.3. Oracle 19c (the last AIX-certified ' +
      'Oracle DB version) is certified on AIX 7.1 TL5+ and AIX 7.2 TL5+ only. AIX 7.3 was never ' +
      'added to the Oracle 19c, 21c, or 23c certification matrix. Additionally, AIX 7.2 itself ' +
      'reached IBM End of Support on April 30, 2025, which means Oracle 19c on AIX 7.2 now runs ' +
      'on an unsupported OS. There is no supported Oracle+AIX path beyond this combination. ' +
      'The only forward options are: upgrade the DB to Oracle 19c on AIX 7.3 (unsupported by Oracle) ' +
      'or migrate the DB to RHEL (Oracle 19c/21c/23c on RHEL x86_64 or Power LE are certified).',
    refs: [
      { label: 'Oracle DB 19c/21c Certification Matrix (Doc 742060.1)', url: 'https://support.oracle.com/epmos/faces/DocumentDisplay?id=742060.1' },
      { label: 'Oracle Lifetime Support Policy', url: 'https://www.oracle.com/us/assets/lifetime-support-technology-069183.pdf' },
    ],
    check: ({ db, os }) =>
      /oracle/i.test(db) &&
      /aix.?7\.3|aix 7\.3/i.test(os),
  },
  {
    id: 'oracle_power_rhel_check',
    severity: 'critical',
    vendor: 'Oracle',
    product: 'Oracle Database',
    title: 'Oracle DB support on RHEL for IBM Power (ppc64le) is version-gated — verify before migrating',
    detail:
      'Oracle Database 19c and 21c are certified on RHEL 8 for IBM Power LE (ppc64le). ' +
      'Oracle 12c and earlier are NOT certified on ppc64le — only on AIX Power (big-endian). ' +
      'Oracle 23c AI is certified on ppc64le RHEL 8.6/9.2 but verify the exact OS version. ' +
      'Migrating from AIX (big-endian) to RHEL Power LE (ppc64le) requires a full data export/import — ' +
      'binary datafiles are NOT portable between big-endian AIX and little-endian RHEL Power. ' +
      'This is a documented Oracle PAM restriction. Verify your exact Oracle version and target RHEL ' +
      'minor version against the current certification matrix before provisioning.',
    refs: [
      { label: 'Oracle Certification Matrix — Linux for IBM Power (Doc 742060.1)', url: 'https://support.oracle.com/epmos/faces/DocumentDisplay?id=742060.1' },
      { label: 'Oracle DB on IBM Power Linux — Installation Guide', url: 'https://docs.oracle.com/en/database/oracle/oracle-database/19/ladbi/' },
      { label: 'Migrating from AIX to Linux: Export/Import required (endian change)', url: 'https://support.oracle.com/epmos/faces/DocumentDisplay?id=1401597.1' },
    ],
    check: ({ db, hw, os }) =>
      /oracle/i.test(db) &&
      /power|ibm.?power/i.test(hw) &&
      /rhel|red.?hat/i.test(os),
  },

  // ── Microsoft SQL Server ───────────────────────────────────────────────────
  {
    id: 'mssql_aix',
    severity: 'critical',
    vendor: 'Microsoft',
    product: 'SQL Server',
    title: 'SQL Server has never supported AIX — Windows or Linux x86_64/ARM64 only',
    detail:
      'Microsoft SQL Server does not exist for AIX, HP-UX, or Solaris. SQL Server on Linux ' +
      'supports only x86_64 and ARM64 architectures (since SQL Server 2019 CU21+). ' +
      'No Power (ppc64le/ppc64be), SPARC, or Itanium builds have ever been released.',
    refs: [
      { label: 'SQL Server on Linux — supported platforms', url: 'https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-release-notes-2022' },
      { label: 'SQL Server hardware and software requirements', url: 'https://learn.microsoft.com/en-us/sql/sql-server/install/hardware-and-software-requirements-for-installing-sql-server-2022' },
    ],
    check: ({ db, os, hw }) =>
      /sql.?server|mssql|microsoft.?sql/i.test(db) &&
      (/aix/i.test(os) || /power/i.test(hw) && !/windows/i.test(os)),
    compatFix: {
      type: 'switch_db',
      summary: 'SQL Server has never shipped an AIX or Power build — switch to an AIX-certified DB',
      alternatives: [
        { label: 'Oracle 19c on AIX 7.2 TL5+ (PAM-certified, last AIX-supported Oracle)', ctxKey: 'db', ctxValue: 'Oracle 19c' },
        { label: 'IBM Db2 11.5 on AIX (IBM-certified native AIX build)', ctxKey: 'db', ctxValue: 'IBM Db2 11.5' },
        { label: 'PostgreSQL 14 on AIX (community-supported; limited IBM support)', ctxKey: 'db', ctxValue: 'PostgreSQL 14' },
      ],
    },
  },
  {
    id: 'mssql_power_linux',
    severity: 'critical',
    vendor: 'Microsoft',
    product: 'SQL Server',
    title: 'SQL Server does not support IBM Power (ppc64le) on Linux',
    detail:
      'SQL Server on Linux only supports x86_64 and ARM64. IBM Power (ppc64le or ppc64be) ' +
      'is not a supported architecture even with RHEL for Power. There is no SQL Server binary ' +
      'for Power processors.',
    refs: [
      { label: 'SQL Server 2022 Linux compatibility list', url: 'https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-release-notes-2022' },
    ],
    check: ({ db, hw, os }) =>
      /sql.?server|mssql|microsoft.?sql/i.test(db) &&
      /power|ibm.?power|ppc/i.test(hw) &&
      /linux|rhel|sles|ubuntu|centos/i.test(os),
    compatFix: {
      type: 'switch_db',
      summary: 'SQL Server has no ppc64le binary — switch to a DB with native RHEL Power LE support',
      alternatives: [
        { label: 'PostgreSQL 15+ (native ppc64le, fully certified on RHEL 8/9 Power)', ctxKey: 'db', ctxValue: 'PostgreSQL 15' },
        { label: 'IBM Db2 11.5.8+ (native ppc64le with glibc 2.34 fix pack)', ctxKey: 'db', ctxValue: 'IBM Db2 11.5' },
        { label: 'Oracle 19c on RHEL 8 ppc64le (Oracle PAM-certified)', ctxKey: 'db', ctxValue: 'Oracle 19c' },
      ],
    },
  },

  // ── IBM Db2 LUW ────────────────────────────────────────────────────────────
  {
    id: 'db2_arm',
    severity: 'warn',
    vendor: 'IBM',
    product: 'IBM Db2 LUW',
    title: 'IBM Db2 LUW does not support Linux ARM64 (aarch64)',
    detail:
      'IBM Db2 LUW (Linux/UNIX/Windows) is not certified on aarch64 / ARM64 Linux. ' +
      'Supported Linux architectures are x86_64, ppc64le (Power LE), and s390x (IBM Z). ' +
      'If your target is an ARM64 cloud instance, use PostgreSQL or another ARM-certified RDBMS.',
    refs: [
      { label: 'Db2 LUW system requirements', url: 'https://www.ibm.com/support/pages/db2-luw-supported-operating-systems' },
    ],
    check: ({ db, hw }) =>
      /db2|ibm.?db/i.test(db) && /arm|aarch64|graviton|ampere/i.test(hw),
  },

  // ── MySQL / MariaDB on AIX ─────────────────────────────────────────────────
  {
    id: 'mysql_aix',
    severity: 'warn',
    vendor: 'Oracle / MariaDB Foundation',
    product: 'MySQL / MariaDB',
    title: 'MySQL and MariaDB are not officially supported on AIX — use at your own risk',
    detail:
      'MySQL Community and Enterprise editions do not ship AIX binaries as of MySQL 8.x. ' +
      'MariaDB similarly has no official AIX packages. Community-compiled builds exist but are ' +
      'unsupported. For DB on AIX, consider IBM Db2, SAP ASE, or Oracle 19c.',
    refs: [
      { label: 'MySQL 8.0 supported platforms', url: 'https://www.mysql.com/support/supportedplatforms/database.html' },
      { label: 'MariaDB platform support', url: 'https://mariadb.com/kb/en/mariadb-supported-platforms/' },
    ],
    check: ({ db, os }) =>
      /mysql|mariadb/i.test(db) && /aix/i.test(os),
  },

  // ── Oracle WebLogic on AIX ─────────────────────────────────────────────────
  {
    id: 'weblogic_aix_drop',
    severity: 'warn',
    vendor: 'Oracle',
    product: 'Oracle WebLogic Server',
    title: 'Oracle WebLogic dropped AIX support from WLS 14c — confirm version before deploying',
    detail:
      'Oracle WebLogic Server 12.2.1.3 was the last version to certify on AIX. ' +
      'WebLogic 14c (14.1.1.0) dropped AIX from the certification matrix. ' +
      'If your target is AIX, you must use WebLogic 12.2.1.4 LTS and validate the EOL window.',
    refs: [
      { label: 'WebLogic Server Certification Matrix', url: 'https://www.oracle.com/middleware/technologies/fusion-certification.html' },
      { label: 'WLS 14c supported configurations', url: 'https://www.oracle.com/middleware/technologies/weblogic/weblogic-certification.html' },
    ],
    check: ({ app, os }) =>
      /weblogic/i.test(app) && /aix/i.test(os),
  },

  // ── JBoss EAP on AIX ──────────────────────────────────────────────────────
  {
    id: 'jboss_aix',
    severity: 'warn',
    vendor: 'Red Hat',
    product: 'JBoss EAP',
    title: 'JBoss EAP on AIX: limited support — check specific version and JDK compatibility',
    detail:
      'Red Hat JBoss EAP 7.4 has tested configurations on AIX with IBM JDK, but support is ' +
      'narrower than on RHEL x86_64. Ensure you are using IBM Semeru (OpenJ9) JDK and that your ' +
      'EAP patch level has been validated against the RHEL/AIX configuration matrix.',
    refs: [
      { label: 'JBoss EAP supported configurations', url: 'https://access.redhat.com/articles/2026253' },
    ],
    check: ({ app, os }) =>
      /jboss|eap/i.test(app) && /aix/i.test(os),
  },

  // ── WebSphere on RHEL 9 ────────────────────────────────────────────────────
  {
    id: 'websphere_rhel9_check',
    severity: 'warn',
    vendor: 'IBM',
    product: 'IBM WebSphere Application Server',
    title: 'WebSphere Traditional 8.5.5 on RHEL 9: fix pack 22+ required',
    detail:
      'IBM WebSphere Application Server Traditional 8.5.5 requires fix pack 8.5.5.22 or later ' +
      'for RHEL 9 (Glibc 2.34+) compatibility. Earlier fix packs will fail to start due to ' +
      'incompatible native library bindings. WebSphere Liberty 23.x has full RHEL 9 support.',
    refs: [
      { label: 'WebSphere system requirements — RHEL 9 support', url: 'https://www.ibm.com/support/pages/websphere-application-server-85-system-requirements' },
    ],
    check: ({ app, os }) =>
      /websphere/i.test(app) && /rhel.?9|red.?hat.?9|rhel 9/i.test(os),
  },

  // ── PostgreSQL on AIX ──────────────────────────────────────────────────────
  {
    id: 'postgres_aix_limited',
    severity: 'info',
    vendor: 'PostgreSQL Global Development Group',
    product: 'PostgreSQL',
    title: 'PostgreSQL on AIX: community supported but no official binaries — compile from source',
    detail:
      'The PostgreSQL project lists AIX as a "tier 2" platform — tested but with no official ' +
      'packages from postgresql.org. You must compile from source or use EnterpriseDB (EDB) ' +
      'PostgreSQL which provides AIX builds with commercial support.',
    refs: [
      { label: 'PostgreSQL platform support tiers', url: 'https://www.postgresql.org/developer/backend/' },
      { label: 'EDB PostgreSQL for AIX', url: 'https://www.enterprisedb.com/edb-supported-platforms' },
    ],
    check: ({ db, os }) =>
      /postgres|postgresql|pgSQL/i.test(db) && /aix/i.test(os),
  },

  // ── EOL Operating Systems ──────────────────────────────────────────────────
  {
    id: 'rhel_centos_6_eol',
    severity: 'critical',
    vendor: 'Red Hat / CentOS',
    product: 'RHEL 6 / CentOS 6',
    title: 'RHEL 6 / CentOS 6: EOL November 2020 — permanently unpatched CVEs',
    detail:
      'Red Hat Enterprise Linux 6 reached End of Life in November 2020. All CVEs discovered after ' +
      'that date will never receive official patches, creating an indefinitely growing unpatched ' +
      'attack surface. Extended Life Cycle Support (ELS) ended in November 2024 — even paid ELS ' +
      'subscribers no longer receive patches. Migrate to RHEL 8 or RHEL 9 immediately.',
    refs: [
      { label: 'RHEL life cycle — Red Hat', url: 'https://access.redhat.com/support/policy/updates/errata/' },
      { label: 'RHEL product life cycles', url: 'https://access.redhat.com/product-life-cycles/?product=Red%20Hat%20Enterprise%20Linux' },
    ],
    check: ({ os }) => /rhel.?6|centos.?6|red.?hat.{0,20}linux.?6/i.test(os),
  },
  {
    id: 'rhel_centos_7_eol',
    severity: 'critical',
    vendor: 'Red Hat / CentOS',
    product: 'RHEL 7 / CentOS 7',
    title: 'RHEL 7 / CentOS 7: EOL June 2024 — mainstream support ended',
    detail:
      'Red Hat Enterprise Linux 7 mainstream support ended June 30, 2024. CentOS 7 also reached ' +
      'full EOL on the same date with no Extended Life Cycle Support available. After EOL, no new ' +
      'CVE patches are published to standard channels. Paid Red Hat ELS provides limited security ' +
      'patches until June 2028 but does not restore full support coverage. Plan migration to RHEL 8 or RHEL 9.',
    refs: [
      { label: 'RHEL 7 life cycle', url: 'https://access.redhat.com/support/policy/updates/errata/' },
      { label: 'CentOS 7 EOL announcement', url: 'https://blog.centos.org/2023/04/end-dates-are-coming-for-centos-stream-8-and-centos-linux-7/' },
    ],
    check: ({ os }) => /rhel.?7|centos.?7|red.?hat.{0,20}linux.?7/i.test(os),
  },
  {
    id: 'ubuntu_1804_eol',
    severity: 'critical',
    vendor: 'Canonical',
    product: 'Ubuntu 18.04 LTS (Bionic Beaver)',
    title: 'Ubuntu 18.04 LTS: standard support EOL April 2023 — community edition fully unpatched',
    detail:
      'Ubuntu 18.04 LTS (Bionic Beaver) standard security maintenance ended April 2023. ' +
      "Canonical's Extended Security Maintenance (ESM) covers only a narrowed set of packages " +
      'through April 2028 for paid Ubuntu Pro subscribers — community-edition deployments receive ' +
      'no patches at all after April 2023. Upgrade to Ubuntu 22.04 LTS (Jammy) or 24.04 LTS (Noble).',
    refs: [
      { label: 'Ubuntu release lifecycle', url: 'https://ubuntu.com/about/release-cycle' },
      { label: 'Ubuntu 18.04 ESM details', url: 'https://ubuntu.com/security/esm' },
    ],
    check: ({ os }) => /ubuntu.?18|ubuntu.?bionic/i.test(os),
  },
  {
    id: 'windows_server_2012_eol',
    severity: 'critical',
    vendor: 'Microsoft',
    product: 'Windows Server 2012 / 2012 R2',
    title: 'Windows Server 2012 / 2012 R2: EOL October 2023 — no more security patches',
    detail:
      'Microsoft ended Extended Support for Windows Server 2012 and 2012 R2 on October 10, 2023. ' +
      'No further security patches are released for on-premises deployments. Paid Extended Security ' +
      'Updates (ESU) via Azure Arc are available until October 2026 but require enrollment and ' +
      'additional licensing. Deployments not enrolled in ESU are permanently unpatched. Migrate to Windows Server 2022.',
    refs: [
      { label: 'Windows Server 2012 lifecycle', url: 'https://learn.microsoft.com/en-us/lifecycle/products/windows-server-2012' },
      { label: 'Windows Server 2012 R2 lifecycle', url: 'https://learn.microsoft.com/en-us/lifecycle/products/windows-server-2012-r2' },
    ],
    check: ({ os }) => /windows.{0,10}(server.{0,5})?2012/i.test(os),
  },
  {
    id: 'aix_71_eol',
    severity: 'critical',
    vendor: 'IBM',
    product: 'IBM AIX 7.1',
    title: 'AIX 7.1: IBM support ended September 2023 — no further security PTFs',
    detail:
      'IBM AIX 7.1 reached End of Support on April 30, 2023 (standard), with extended date of ' +
      'September 2023. No further security PTFs (patches) or new TL/SP levels are released. ' +
      'Running workloads on AIX 7.1 exposes the platform to unpatched OS-level vulnerabilities. ' +
      'Upgrade to AIX 7.2 (supported through May 2025) or AIX 7.3.',
    refs: [
      { label: 'IBM AIX support lifecycle', url: 'https://www.ibm.com/support/pages/aix-support-lifecycle-information' },
      { label: 'IBM software lifecycle tool', url: 'https://www.ibm.com/support/pages/ibm-software-product-lifecycle' },
    ],
    check: ({ os }) => /aix.?7\.1(\b|$)|aix 7\.1/i.test(os),
  },

  // ── EOL Database Versions ──────────────────────────────────────────────────
  {
    id: 'postgres_11_eol',
    severity: 'critical',
    vendor: 'PostgreSQL Global Development Group',
    product: 'PostgreSQL 11',
    title: 'PostgreSQL 11: EOL November 2023 — no security fixes released after this date',
    detail:
      'PostgreSQL 11 reached its end-of-life on November 9, 2023. The PostgreSQL GDG no longer ' +
      'issues security advisories or patch releases for PG 11. Any CVE affecting the PostgreSQL ' +
      'engine after November 2023 will remain unpatched. Upgrade to PostgreSQL 15 or 16 ' +
      '(both in active support with security releases).',
    refs: [
      { label: 'PostgreSQL versioning policy', url: 'https://www.postgresql.org/support/versioning/' },
    ],
    check: ({ db }) => /postgres(ql)?.?11(\b|$)/i.test(db),
  },
  {
    id: 'postgres_12_eol',
    severity: 'critical',
    vendor: 'PostgreSQL Global Development Group',
    product: 'PostgreSQL 12',
    title: 'PostgreSQL 12: EOL November 2024 — no further patches',
    detail:
      'PostgreSQL 12 reached end-of-life on November 14, 2024. No new security patches or bug ' +
      'fixes will be issued for this major version. Distributions that shipped PG 12 as their ' +
      'default (e.g., Ubuntu 20.04, RHEL 8 via SCL) may provide distro-backported patches, but ' +
      'these are not guaranteed. Upgrade to PostgreSQL 16 or 17.',
    refs: [
      { label: 'PostgreSQL versioning policy', url: 'https://www.postgresql.org/support/versioning/' },
    ],
    check: ({ db }) => /postgres(ql)?.?12(\b|$)/i.test(db),
  },
  {
    id: 'mysql_57_eol',
    severity: 'critical',
    vendor: 'Oracle',
    product: 'MySQL 5.7',
    title: 'MySQL 5.7: EOL October 2023 — active CVEs permanently unaddressed',
    detail:
      'Oracle ended support for MySQL 5.7 on October 31, 2023. All security vulnerabilities ' +
      'discovered after that date remain unpatched in the 5.7 branch, including known privilege ' +
      'escalation and authentication bypass CVEs (e.g., CVE-2023-21980) that will not be ' +
      'backported. Upgrade to MySQL 8.0 (LTS) or MySQL 8.4.',
    refs: [
      { label: 'MySQL 5.7 end of life', url: 'https://endoflife.date/mysql' },
      { label: 'MySQL lifecycle policy', url: 'https://www.mysql.com/support/supportedplatforms/database.html' },
    ],
    check: ({ db }) => /mysql.?5\.7/i.test(db),
  },
  {
    id: 'oracle_12c_eol',
    severity: 'critical',
    vendor: 'Oracle',
    product: 'Oracle Database 12c',
    title: 'Oracle DB 12c: Premier Support ended July 2022 (12.1) / Dec 2022 (12.2) — Extended Support expiring',
    detail:
      'Oracle Database 12.1.0.2 Premier Support ended July 2022; 12.2.0.1 ended December 2022. ' +
      'Extended Support (paid add-on) runs through March 2025 (12.1) and December 2025 (12.2). ' +
      'After Extended Support ends, Sustaining Support only — no new patches or CVE fixes are ' +
      'issued. New OS certifications and security patches have already stopped. Migrate to Oracle 19c (LTS, supported until 2027).',
    refs: [
      { label: 'Oracle Lifetime Support Policy — Database', url: 'https://www.oracle.com/us/assets/lifetime-support-technology-069183.pdf' },
      { label: 'Oracle DB support dates (MOS Doc 742060.1)', url: 'https://support.oracle.com/epmos/faces/DocumentDisplay?id=742060.1' },
    ],
    check: ({ db }) => /oracle.{0,10}12c|oracle.{0,10}12\.1|oracle.{0,10}12\.2/i.test(db),
  },
  {
    id: 'mssql_2012_eol',
    severity: 'critical',
    vendor: 'Microsoft',
    product: 'SQL Server 2012',
    title: 'SQL Server 2012: EOL July 2022 — no security patches since',
    detail:
      'Microsoft SQL Server 2012 reached End of Extended Support on July 12, 2022. No security ' +
      'updates, hotfixes, or compliance updates are issued. Paid ESU via Azure Arc was available ' +
      'for three years (through July 2025) and is also expiring. Any deployment not migrated is ' +
      'running with a multi-year backlog of unpatched vulnerabilities. Migrate to SQL Server 2022.',
    refs: [
      { label: 'SQL Server 2012 lifecycle', url: 'https://learn.microsoft.com/en-us/lifecycle/products/sql-server-2012' },
      { label: 'SQL Server ESU details', url: 'https://learn.microsoft.com/en-us/sql/sql-server/end-of-support/sql-server-extended-security-updates' },
    ],
    check: ({ db }) => /sql.?server.?2012|mssql.?2012/i.test(db),
  },
  {
    id: 'mssql_2014_eol',
    severity: 'critical',
    vendor: 'Microsoft',
    product: 'SQL Server 2014',
    title: 'SQL Server 2014: EOL July 2024 — extended support ended',
    detail:
      'SQL Server 2014 Extended Support ended on July 9, 2024. No new security patches are issued ' +
      'for standard deployments. Extended Security Updates (ESU) can be purchased through July 2027 ' +
      'for on-premises deployments enrolled via Azure Arc, but require additional Microsoft ' +
      'licensing. Migrate to SQL Server 2019 or SQL Server 2022.',
    refs: [
      { label: 'SQL Server 2014 lifecycle', url: 'https://learn.microsoft.com/en-us/lifecycle/products/sql-server-2014' },
    ],
    check: ({ db }) => /sql.?server.?2014|mssql.?2014/i.test(db),
  },

  // ── EOL Middleware / Application Servers ───────────────────────────────────
  {
    id: 'apache_httpd_22_eol',
    severity: 'critical',
    vendor: 'Apache Software Foundation',
    product: 'Apache HTTP Server 2.2',
    title: 'Apache HTTP Server 2.2: EOL December 2017 — years of unpatched CVEs accumulating',
    detail:
      'Apache HTTP Server 2.2 reached end of life on December 31, 2017. All security ' +
      'vulnerabilities discovered since then are permanently unpatched on the 2.2 branch, ' +
      'including numerous critical CVEs covering path traversal, remote code execution, and DoS. ' +
      'The 2.2 branch predates HTTP/2 and TLS 1.3 support entirely. Upgrade to Apache 2.4 immediately.',
    refs: [
      { label: 'Apache HTTP Server end of life', url: 'https://httpd.apache.org/dev/roadmap.html' },
      { label: 'Apache HTTP Server supported versions', url: 'https://httpd.apache.org/' },
    ],
    check: ({ app }) =>
      /apache.{0,10}(http.?server|httpd).?2\.2|httpd.?2\.2|apache.?2\.2/i.test(app),
  },
  {
    id: 'tomcat_85_eol',
    severity: 'critical',
    vendor: 'Apache Software Foundation',
    product: 'Apache Tomcat 8.5',
    title: 'Apache Tomcat 8.5: EOL March 2024 — no further security releases',
    detail:
      'Apache Tomcat 8.5 reached end of life on March 31, 2024. The ASF will no longer provide ' +
      'patches, security fixes, or community support for this branch. Tomcat 8.5 uses the ' +
      'javax.* namespace (Java EE 8) and does not support Jakarta EE 9+ APIs. Upgrade to ' +
      'Tomcat 10.1 (Jakarta EE 10) or Tomcat 9.0 (still active, javax.* namespace).',
    refs: [
      { label: 'Apache Tomcat 8.5 EOL notice', url: 'https://tomcat.apache.org/tomcat-85-eol.html' },
      { label: 'Tomcat supported versions', url: 'https://tomcat.apache.org/whichversion.html' },
    ],
    check: ({ app }) => /tomcat.?8\.5/i.test(app),
  },
  {
    id: 'php_7x_eol',
    severity: 'critical',
    vendor: 'The PHP Group',
    product: 'PHP 7.x',
    title: 'PHP 7.x: EOL November 2022 — all 7.x branches permanently unpatched',
    detail:
      'All PHP 7.x releases (7.0 through 7.4) reached end of life by November 28, 2022. The PHP ' +
      'Group no longer issues security advisories or patches for any PHP 7.x branch. PHP 7.x is ' +
      'missing security backports for numerous CVEs including type juggling, deserialization, and ' +
      'memory corruption vulnerabilities fixed in PHP 8.x. Upgrade to PHP 8.1 (security through December 2025) or PHP 8.3.',
    refs: [
      { label: 'PHP supported versions', url: 'https://www.php.net/supported-versions.php' },
      { label: 'PHP EOL dates', url: 'https://www.php.net/eol.php' },
    ],
    check: ({ app }) => /php.?7\.[0-9]/i.test(app),
  },
  {
    id: 'java8_rhel9',
    severity: 'warn',
    vendor: 'Red Hat',
    product: 'Java 8 / OpenJDK 8',
    title: 'Java 8 (OpenJDK 8) is not in RHEL 9 default repos — use Java 11/17/21',
    detail:
      'RHEL 9 ships OpenJDK 11, 17, and 21 as the supported Java runtimes. OpenJDK 8 is not ' +
      "available from Red Hat's standard RHEL 9 repositories. Third-party distributions " +
      '(Adoptium Temurin, Amazon Corretto, Azul Zulu) provide Java 8 for RHEL 9, but running ' +
      'an unofficial JDK may create support gaps for your application vendor. Validate that your ' +
      'middleware vendor supports Java 11+ on RHEL 9 before migrating.',
    refs: [
      { label: 'RHEL 9 OpenJDK packages', url: 'https://access.redhat.com/documentation/en-us/openjdk/11/html/installing_and_using_openjdk_11_on_rhel/' },
      { label: 'RHEL 9 application compatibility', url: 'https://access.redhat.com/solutions/6966842' },
    ],
    check: ({ app, os }) =>
      /java.?8|jdk.?8|openjdk.?8|jre.?8/i.test(app) &&
      /rhel.?9|red.?hat.{0,20}linux.?9|rhel 9/i.test(os),
  },
  {
    id: 'jboss_eap_6x_eol',
    severity: 'critical',
    vendor: 'Red Hat',
    product: 'JBoss EAP 6.x',
    title: 'JBoss EAP 6.x: EOL June 2023 — no security patches for Java EE 6 platform',
    detail:
      'Red Hat JBoss Enterprise Application Platform 6.x (based on JBoss AS 7 / Java EE 6) ' +
      'reached end of life on June 30, 2023. Red Hat no longer provides security patches, errata, ' +
      'or technical support for EAP 6.x. EAP 6 relies on the Java EE 6 spec and predates Jakarta ' +
      'EE — applications must be migrated to EAP 7.4 or EAP 8.0 (Jakarta EE 10).',
    refs: [
      { label: 'JBoss EAP 6 lifecycle', url: 'https://access.redhat.com/support/policy/updates/jboss_notes/' },
      { label: 'JBoss EAP supported configurations', url: 'https://access.redhat.com/articles/2026253' },
    ],
    check: ({ app }) => /jboss.{0,10}eap.?6|eap.?6\.[0-9]/i.test(app),
  },

  // ── ARM64 / Architecture Gaps ──────────────────────────────────────────────
  {
    id: 'sap_hana_arm64',
    severity: 'critical',
    vendor: 'SAP',
    product: 'SAP HANA',
    title: 'SAP HANA does not support ARM64 (aarch64) — x86_64 and IBM POWER only',
    detail:
      'SAP HANA is certified exclusively on x86_64 and IBM POWER (big-endian AIX, little-endian ' +
      'RHEL for Power). No ARM64 (aarch64) build has ever been released. Deploying HANA on ' +
      'Graviton, Ampere, or any other ARM-based server is unsupported and will fail at the SAP ' +
      'kernel installation phase. Use certified x86_64 (Intel Xeon, AMD EPYC) or IBM Power LE hardware.',
    refs: [
      { label: 'SAP HANA platform availability matrix (PAM)', url: 'https://support.sap.com/en/my-support/software-downloads/support-package-stacks/product-versions.html' },
      { label: 'SAP HANA hardware directory', url: 'https://www.sap.com/dmc/exp/2014-09-02-hana-hardware/enEN/#/solutions?filters=v:deCertified' },
    ],
    check: ({ db, app, hw }) =>
      /sap.?hana|hana.?db/i.test((db || '') + ' ' + (app || '')) &&
      /arm|aarch64|graviton|ampere/i.test(hw),
  },
  {
    id: 'ibm_mq_arm64',
    severity: 'critical',
    vendor: 'IBM',
    product: 'IBM MQ',
    title: 'IBM MQ 9.3 has no ARM64 (aarch64) Linux build',
    detail:
      'IBM MQ does not provide an ARM64 (aarch64) binary for Linux as of IBM MQ 9.3 LTS. ' +
      'Supported Linux architectures are x86_64, ppc64le (Power LE), and s390x (IBM Z). ' +
      'IBM MQ on ARM64 cloud instances (AWS Graviton, Oracle Ampere) is not supported. Use ' +
      'an x86_64 instance for IBM MQ, or migrate to a cloud-native message queue if ARM64 is a hard requirement.',
    refs: [
      { label: 'IBM MQ system requirements', url: 'https://www.ibm.com/support/pages/system-requirements-ibm-mq' },
      { label: 'IBM MQ 9.3 supported platforms', url: 'https://www.ibm.com/docs/en/ibm-mq/9.3?topic=mq-system-requirements' },
    ],
    check: ({ app, hw }) =>
      /ibm.?mq|websphere.?mq|wmq/i.test(app) &&
      /arm|aarch64|graviton|ampere/i.test(hw),
  },
  {
    id: 'weblogic_arm64',
    severity: 'critical',
    vendor: 'Oracle',
    product: 'Oracle WebLogic Server',
    title: 'Oracle WebLogic is not certified on Linux ARM64 (aarch64)',
    detail:
      'Oracle WebLogic Server certification covers x86_64 Linux (RHEL, OEL, SLES) and Windows ' +
      'x64. ARM64 (aarch64) Linux has no WebLogic certification as of WebLogic 14.1.2. While the ' +
      'JVM itself runs on ARM64, WebLogic native libraries (node manager, Coherence adapters) and ' +
      "Oracle's support contract are x86_64 only. Running WebLogic on ARM64 is unsupported and may void your Oracle support entitlement.",
    refs: [
      { label: 'WebLogic Server certification matrix', url: 'https://www.oracle.com/middleware/technologies/fusion-certification.html' },
      { label: 'Oracle WebLogic 14c supported configurations', url: 'https://www.oracle.com/middleware/technologies/weblogic/weblogic-certification.html' },
    ],
    check: ({ app, hw }) =>
      /weblogic/i.test(app) &&
      /arm|aarch64|graviton|ampere/i.test(hw),
  },
  {
    id: 'sap_ase_arm64',
    severity: 'critical',
    vendor: 'SAP',
    product: 'SAP ASE (Sybase)',
    title: 'SAP ASE (Sybase) has no ARM64 build — x86_64, AIX Power BE, and Windows only',
    detail:
      'SAP Adaptive Server Enterprise 16.x ships binaries for x86_64 Linux, AIX (IBM Power, ' +
      'big-endian), and Windows x64. No ARM64 (aarch64) binary is provided. Attempting to ' +
      'install SAP ASE on an ARM64 Linux server (Graviton, Ampere) will fail with ' +
      '"wrong ELF class: ELFCLASS64 (architecture mismatch)" errors at install time.',
    refs: [
      { label: 'SAP ASE Product Availability Matrix', url: 'https://support.sap.com/content/dam/launchpad/en_us/pam/pam-essentials/SAP_PAM_ASE.pdf' },
    ],
    check: ({ db, hw }) =>
      /sybase|sap.?ase|adaptive.?server/i.test(db) &&
      /arm|aarch64|graviton|ampere/i.test(hw),
  },
  {
    id: 'informatica_arm64',
    severity: 'warn',
    vendor: 'Informatica',
    product: 'Informatica PowerCenter',
    title: 'Informatica PowerCenter is not certified on ARM64 (aarch64)',
    detail:
      'Informatica PowerCenter and IDMC on-premises components are certified only on x86_64 ' +
      'Linux and Windows. No ARM64 Linux certification exists as of PowerCenter 10.5.3. Running ' +
      'PowerCenter on ARM-based instances (Graviton, Ampere) is unsupported; native code ' +
      'components in the PowerCenter Data Integration Service will fail to load.',
    refs: [
      { label: 'Informatica PowerCenter system requirements', url: 'https://docs.informatica.com/data-integration/powercenter/10-5-3/installation-and-configuration-guide/powercenter-installation/before-you-begin.html' },
    ],
    check: ({ app, hw }) =>
      /informatica|powercenter/i.test(app) &&
      /arm|aarch64|graviton|ampere/i.test(hw),
  },

  // ── OS / Application Version Matrix ───────────────────────────────────────
  {
    id: 'oracle_19c_rhel7_min',
    severity: 'warn',
    vendor: 'Oracle',
    product: 'Oracle Database 19c',
    title: 'Oracle DB 19c requires RHEL 7.5+ (kernel 3.10.0-514.el7+) — earlier RHEL 7.x fails prereqs',
    detail:
      'Oracle Database 19c installation prerequisites include RHEL 7.5 or later ' +
      '(kernel 3.10.0-514.el7+). On RHEL 7.0–7.4, the Oracle Universal Installer (OUI) ' +
      'prerequisite checks will fail due to missing library versions and kernel parameter defaults. ' +
      'The oracheck / orachk tool will report FAILED for glibc and compat-libstdc++ on RHEL 7 releases earlier than 7.5.',
    refs: [
      { label: 'Oracle DB 19c installation guide — Linux (Doc 2669806.1)', url: 'https://support.oracle.com/epmos/faces/DocumentDisplay?id=2669806.1' },
      { label: 'Oracle DB 19c certification matrix', url: 'https://support.oracle.com/epmos/faces/DocumentDisplay?id=742060.1' },
    ],
    check: ({ db, os }) =>
      /oracle.{0,10}19c|oracle.{0,10}19\.0/i.test(db) &&
      /rhel.?7\.[0-4]\b|red.?hat.{0,20}linux.?7\.[0-4]\b/i.test(os),
  },
  {
    id: 'websphere_855_rhel8_fixpack',
    severity: 'warn',
    vendor: 'IBM',
    product: 'IBM WebSphere Application Server Traditional 8.5.5',
    title: 'WebSphere Traditional 8.5.5 on RHEL 8: requires fix pack 8.5.5.18+ for Glibc 2.28',
    detail:
      'IBM WebSphere Application Server Traditional 8.5.5 fix packs prior to 8.5.5.18 were ' +
      'built against Glibc 2.17 (RHEL 7 baseline) and fail with SIGILL or dynamic linker errors ' +
      'on RHEL 8 (Glibc 2.28). Fix pack 8.5.5.18 and later are required for RHEL 8 compatibility. ' +
      'WebSphere Liberty 22.0.0.12+ has native RHEL 8 support without this restriction.',
    refs: [
      { label: 'WebSphere 8.5.5 system requirements', url: 'https://www.ibm.com/support/pages/websphere-application-server-85-system-requirements' },
      { label: 'IBM tech note: WAS 8.5.5 on RHEL 8', url: 'https://www.ibm.com/support/pages/websphere-application-server-traditional-rhel-8' },
    ],
    check: ({ app, os }) =>
      /websphere/i.test(app) &&
      /rhel.?8|red.?hat.{0,20}linux.?8/i.test(os),
  },
  {
    id: 'db2_115_rhel9_fixpack',
    severity: 'warn',
    vendor: 'IBM',
    product: 'IBM Db2 LUW 11.5',
    title: 'IBM Db2 11.5 on RHEL 9: requires fix pack 11.5.8+ for Glibc 2.34 compatibility',
    detail:
      'IBM Db2 LUW 11.5 fix packs prior to 11.5.8 were not built against RHEL 9\'s Glibc 2.34 ' +
      'baseline. Earlier fix packs fail during instance creation (db2icrt) with "cannot open ' +
      'shared object file" errors for libstdc++ and libpam. Db2 11.5.8 (GA December 2022) is ' +
      'the minimum supported fix pack for RHEL 9.',
    refs: [
      { label: 'Db2 LUW 11.5 supported operating systems', url: 'https://www.ibm.com/support/pages/db2-luw-supported-operating-systems' },
      { label: 'Db2 11.5 fix pack history', url: 'https://www.ibm.com/support/pages/db2-distributed-fix-pack-central' },
    ],
    check: ({ db, os }) =>
      /db2.{0,10}11\.5|ibm.?db2/i.test(db) &&
      /rhel.?9|red.?hat.{0,20}linux.?9/i.test(os),
  },
  {
    id: 'tomcat_10_javax_break',
    severity: 'critical',
    vendor: 'Apache Software Foundation',
    product: 'Apache Tomcat 10.x',
    title: 'Tomcat 10.x uses Jakarta EE 9+ namespace (jakarta.*) — javax.* apps will not deploy',
    detail:
      'Apache Tomcat 10.0 and later moved from the Java EE javax.* package namespace to the ' +
      'Jakarta EE jakarta.* namespace. Applications compiled against Tomcat 9.x or earlier ' +
      '(javax.servlet, javax.ws.rs, etc.) will fail to load on Tomcat 10.x with ' +
      'ClassNotFoundException or NoClassDefFoundError. Apps must be recompiled with Jakarta EE 9+ ' +
      'dependencies (e.g., jakarta.servlet-api) before deploying to Tomcat 10.x.',
    refs: [
      { label: 'Tomcat 10.x migration guide', url: 'https://tomcat.apache.org/migration-10.html' },
      { label: 'Jakarta EE 9 namespace change', url: 'https://jakarta.ee/specifications/servlet/5.0/' },
    ],
    check: ({ app }) => /tomcat.?10/i.test(app),
  },

  // ── Storage / Backup / Network / Security Design Rules ─────────────────────
  {
    id: 'nfs_v3_oracle_rac',
    severity: 'critical',
    vendor: 'Oracle',
    product: 'Oracle RAC / NFS',
    title: 'NFS v3 is not supported for Oracle RAC shared storage — use NFS v4.1 with dNFS or OCFS2',
    detail:
      'Oracle does not support NFS version 3 as shared storage for Oracle Real Application ' +
      'Clusters (RAC). The locking semantics required for RAC shared disk access are only ' +
      'guaranteed by NFS v4.1 with the Oracle Direct NFS (dNFS) client, or by OCFS2 (Oracle ' +
      'Cluster File System 2). NFS v3 with Oracle RAC can result in silent data corruption due to ' +
      'insufficient cache coherence guarantees between RAC nodes.',
    refs: [
      { label: 'Oracle RAC storage best practices (Doc 359515.1)', url: 'https://support.oracle.com/epmos/faces/DocumentDisplay?id=359515.1' },
      { label: 'Direct NFS Client configuration guide', url: 'https://docs.oracle.com/en/database/oracle/oracle-database/19/racad/using-direct-nfs.html' },
    ],
    check: ({ db, os, app }) =>
      /oracle/i.test(db) &&
      /rac|real.?application.?cluster/i.test(db + ' ' + os + ' ' + app) &&
      /nfs.?v?3\b|nfs\s+version\s+3/i.test(os + ' ' + app),
  },
  {
    id: 'oracle_asm_zfs',
    severity: 'critical',
    vendor: 'Oracle',
    product: 'Oracle ASM / ZFS',
    title: 'Oracle ASM is not supported on ZFS volumes — requires raw disks, LVM, or EXT4/XFS',
    detail:
      'Oracle Automatic Storage Management (ASM) is not certified on ZFS volumes (including ZFS ' +
      "on Linux via OpenZFS or Oracle Solaris ZFS). ASM requires direct block device access and " +
      "does not interoperate with ZFS's copy-on-write semantics. Attempting to create ASM disk " +
      'groups on ZFS-backed LUNs risks silent data corruption and an unsupported configuration. ' +
      'Use raw block devices, LVM physical volumes, or EXT4/XFS filesystems for ASM candidate disks.',
    refs: [
      { label: 'Oracle ASM administration guide', url: 'https://docs.oracle.com/en/database/oracle/oracle-database/19/ostmg/asm-intro.html' },
      { label: 'Oracle MOS Note: ASM disk group requirements (Doc 265633.1)', url: 'https://support.oracle.com/epmos/faces/DocumentDisplay?id=265633.1' },
    ],
    check: ({ db, os, hw }) =>
      /oracle/i.test(db) &&
      /\basm\b|automatic.?storage/i.test(db + ' ' + os + ' ' + hw) &&
      /\bzfs\b/i.test(os + ' ' + hw),
  },
  {
    id: 'veeam_v10_rhel9',
    severity: 'critical',
    vendor: 'Veeam',
    product: 'Veeam Backup & Replication v10',
    title: 'Veeam Backup & Replication v10 is not compatible with RHEL 9 — requires v12+',
    detail:
      'Veeam Backup & Replication version 10 (and v11) does not support RHEL 9 as a protected ' +
      'workload or as a Linux Backup Repository host. The Veeam transport agent for Linux requires ' +
      'Glibc 2.28+ compatibility which was added in Veeam B&R v12. Running Veeam v10 agents on ' +
      'RHEL 9 will fail with transport service start errors. Upgrade to Veeam B&R v12 or later.',
    refs: [
      { label: 'Veeam B&R v12 system requirements', url: 'https://www.veeam.com/kb2182' },
      { label: 'Veeam support lifecycle policy', url: 'https://www.veeam.com/product-lifecycle.html' },
    ],
    check: ({ app, os }) =>
      /veeam.{0,15}(v?10|10\.)/i.test(app) &&
      /rhel.?9|red.?hat.{0,20}linux.?9/i.test(os),
  },
  {
    id: 'fips_oracle_12c',
    severity: 'critical',
    vendor: 'Oracle',
    product: 'Oracle Database 12c / FIPS 140-2',
    title: 'Oracle DB 12c is not FIPS-140-2 compliant on modern RHEL FIPS policies',
    detail:
      'Oracle Database 12c does not fully support the RHEL system-wide FIPS 140-2 cryptographic ' +
      'policy. Enabling FIPS mode on RHEL 7.4+ with Oracle 12c causes ORA-28890 errors (FIPS mode ' +
      'required) or SSL/TLS handshake failures because Oracle 12c\'s network encryption layer does ' +
      'not interoperate with OpenSSL\'s FIPS provider. Oracle DB 19c with FIPS_MODE=TRUE is required ' +
      'for compliant operation; Oracle Advanced Security TDE has additional FIPS key management requirements.',
    refs: [
      { label: 'Oracle DB 19c FIPS configuration (Doc 2739354.1)', url: 'https://support.oracle.com/epmos/faces/DocumentDisplay?id=2739354.1' },
      { label: 'RHEL 9 FIPS 140-2 compliance guide', url: 'https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/security_hardening/assembly_installing-the-system-in-fips-mode_security-hardening' },
    ],
    check: ({ db, os }) =>
      /oracle.{0,10}12c|oracle.{0,10}12\.[12]/i.test(db) &&
      /fips/i.test(os),
  },
  {
    id: 'oracle_listener_ipv6_only',
    severity: 'warn',
    vendor: 'Oracle',
    product: 'Oracle Database Net Listener',
    title: 'Oracle DB listener does not support IPv6-only networks without dual-stack configuration',
    detail:
      'The Oracle Net listener (lsnrctl) defaults to IPv4 binding. In an IPv6-only environment ' +
      '(no IPv4 stack), the listener will fail to start or bind to an unexpected interface unless ' +
      'LOCAL_LISTENER is explicitly set with an IPv6 address format ' +
      '(e.g., (ADDRESS=(PROTOCOL=TCP)(HOST=::1)(PORT=1521))). Oracle 19c on RHEL 9 with IPv6-only ' +
      'networking requires listener.ora and tnsnames.ora entries to use square-bracket IPv6 notation.',
    refs: [
      { label: 'Oracle Net Services admin guide — listener configuration', url: 'https://docs.oracle.com/en/database/oracle/oracle-database/19/netag/enabling-advanced-features-of-oracle-net-services.html' },
    ],
    check: ({ db, os, hw }) =>
      /oracle/i.test(db) &&
      /ipv6.?only|ipv6-only|ipv6\s+only/i.test(os + ' ' + hw),
  },

  // ── Hardware Platform Restrictions ─────────────────────────────────────────
  {
    id: 'ibm_power_vmware',
    severity: 'critical',
    vendor: 'VMware / Broadcom',
    product: 'VMware vSphere',
    title: 'VMware vSphere does not support IBM Power (ppc64le) — use PowerVM LPAR or KVM',
    detail:
      'VMware vSphere (ESXi) has never supported IBM Power processors (ppc64le or ppc64be). IBM ' +
      'Power virtualization is provided by PowerVM (LPARs) for production enterprise workloads or ' +
      'KVM for open-source use. Specifying VMware as the hypervisor on Power hardware means the ' +
      'environment will not build — ESXi simply has no ppc64 port. Use IBM PowerVM (LPAR) for enterprise SLAs.',
    refs: [
      { label: 'VMware vSphere hardware compatibility guide', url: 'https://www.vmware.com/resources/compatibility/search.php' },
      { label: 'IBM PowerVM overview', url: 'https://www.ibm.com/products/powervm' },
    ],
    check: ({ hw, app }) =>
      /power|ibm.?power|ppc|ppc64/i.test(hw) &&
      /vmware|vsphere|esxi/i.test(app),
  },
  {
    id: 'itanium_ia64_eol',
    severity: 'critical',
    vendor: 'Multiple vendors',
    product: 'Itanium (ia64)',
    title: 'Itanium (ia64): all major enterprise vendors dropped support — no viable DB/OS/middleware stack',
    detail:
      'Intel discontinued the Itanium processor in 2021. HP-UX on Itanium ended support in ' +
      'December 2022. All major database vendors dropped Itanium support before this — Oracle DB ' +
      'last supported ia64 in 12c; SAP HANA never supported ia64; SQL Server dropped ia64 in 2012. ' +
      'No modern enterprise middleware (WebSphere, JBoss EAP 7+) ships ia64 binaries. An Itanium ' +
      'target has no viable enterprise stack available.',
    refs: [
      { label: 'Intel Itanium end of life', url: 'https://www.intel.com/content/www/us/en/support/articles/000055892/processors.html' },
      { label: 'HP-UX on Itanium lifecycle', url: 'https://h20195.www2.hpe.com/V2/GetDocument.aspx?docname=a00113958enw' },
    ],
    check: ({ hw, os }) =>
      /itanium|ia64/i.test(hw + ' ' + os),
  },
  {
    id: 'sparc_enterprise_limited',
    severity: 'warn',
    vendor: 'Oracle',
    product: 'Oracle SPARC / Solaris',
    title: 'SPARC T-series: Oracle Solaris is the only enterprise-supported OS — Linux on SPARC has no enterprise DB/middleware certification',
    detail:
      'Oracle SPARC T-series servers run Oracle Solaris as their enterprise-supported OS. Linux ' +
      'on SPARC (Debian, Ubuntu, Gentoo SPARC ports) exists as community projects but has zero ' +
      'enterprise vendor certifications for databases, middleware, or backup agents. Oracle DB is ' +
      'certified on Solaris/SPARC but not Linux/SPARC; WebLogic and WebSphere have no Linux/SPARC ' +
      'build. If SPARC is a hard requirement, use Oracle Solaris and the Solaris-certified software stack.',
    refs: [
      { label: 'Oracle Solaris support lifecycle', url: 'https://www.oracle.com/a/ocom/docs/oracle-solaris-support-policy.pdf' },
      { label: 'Oracle DB on Solaris SPARC certification', url: 'https://www.oracle.com/us/assets/lifetime-support-technology-069183.pdf' },
    ],
    check: ({ hw, os }) =>
      /sparc/i.test(hw) &&
      /linux|rhel|ubuntu|centos/i.test(os),
  },

  // ── EOL — OS (additional) ──────────────────────────────────────────────────
  {
    id: 'aix_72_eol',
    severity: 'critical',
    vendor: 'IBM',
    product: 'IBM AIX 7.2',
    title: 'AIX 7.2: IBM End of Support April 2025 — no further security PTFs',
    detail:
      'IBM AIX 7.2 reached End of Support on April 30, 2025. No further security PTFs ' +
      '(program temporary fixes), TL or SP levels, or new hardware enablement are published. ' +
      'This directly affects Oracle 19c on AIX — Oracle 19c was the last DB version certified on ' +
      'AIX 7.2 TL5+, and that certification cannot be extended to an unsupported OS. ' +
      'Upgrade to AIX 7.3 (supported through at least 2028) or plan migration to RHEL.',
    refs: [
      { label: 'IBM AIX 7.2 support lifecycle', url: 'https://www.ibm.com/support/pages/aix-support-lifecycle-information' },
      { label: 'IBM software product lifecycle tool', url: 'https://www.ibm.com/support/pages/ibm-software-product-lifecycle' },
    ],
    check: ({ os }) => /aix.?7\.2(\b|$)|aix 7\.2/i.test(os),
  },
  {
    id: 'windows_server_2016_eol_soon',
    severity: 'warn',
    vendor: 'Microsoft',
    product: 'Windows Server 2016',
    title: 'Windows Server 2016: Extended Support ends January 2027 — plan migration now',
    detail:
      'Microsoft Windows Server 2016 Extended Support ends January 12, 2027. After that date, ' +
      'no security patches, hotfixes, or compliance updates will be released for standard deployments. ' +
      'ESU via Azure Arc may be available for an additional three years but requires enrollment and ' +
      'additional licensing. Begin migration planning to Windows Server 2022 or 2025 now to avoid ' +
      'operating in an unpatched state.',
    refs: [
      { label: 'Windows Server 2016 lifecycle', url: 'https://learn.microsoft.com/en-us/lifecycle/products/windows-server-2016' },
    ],
    check: ({ os }) => /windows.{0,10}(server.{0,5})?2016/i.test(os),
  },
  {
    id: 'oracle_solaris_10_eol',
    severity: 'critical',
    vendor: 'Oracle',
    product: 'Oracle Solaris 10',
    title: 'Oracle Solaris 10: Extended Support ended January 2024 — permanently unpatched',
    detail:
      'Oracle Solaris 10 Extended Support ended January 26, 2024. No further security patches, ' +
      'Critical Patch Updates (CPUs), or new driver updates are issued. Any CVE affecting the ' +
      'Solaris kernel, OpenSSL, or built-in network services since January 2024 is permanently ' +
      'unaddressed. Upgrade to Oracle Solaris 11.4 (supported through at least 2034).',
    refs: [
      { label: 'Oracle Solaris 10 lifecycle', url: 'https://www.oracle.com/a/ocom/docs/oracle-solaris-support-policy.pdf' },
      { label: 'Oracle Support Lifetime Policies', url: 'https://www.oracle.com/support/lifetime-support/' },
    ],
    check: ({ os }) => /solaris.?10|sunos.?5\.10/i.test(os),
  },

  // ── EOL — Database (additional) ────────────────────────────────────────────
  {
    id: 'oracle_11g_eol',
    severity: 'critical',
    vendor: 'Oracle',
    product: 'Oracle Database 11g',
    title: 'Oracle DB 11g: Extended Support ended December 2020 — no CVE patches since',
    detail:
      'Oracle Database 11.1.0.7 Premier Support ended August 2012. ' +
      'Oracle 11.2.0.4 Extended Support ended December 31, 2020. ' +
      'The product is now in Sustaining Support only — Oracle does not issue new security patches, ' +
      'CVE fixes, or new OS/platform certifications for Oracle 11g. Any security vulnerability ' +
      'discovered after December 2020 is permanently unpatched in the 11g branch. ' +
      'Migrate to Oracle 19c (LTS, Premier Support through April 2024, Extended through April 2027).',
    refs: [
      { label: 'Oracle Lifetime Support Policy — Database (PDF)', url: 'https://www.oracle.com/us/assets/lifetime-support-technology-069183.pdf' },
      { label: 'MOS Doc 742060.1 — Oracle DB support dates', url: 'https://support.oracle.com/epmos/faces/DocumentDisplay?id=742060.1' },
    ],
    check: ({ db }) => /oracle.{0,10}11g|oracle.{0,10}11\.1|oracle.{0,10}11\.2/i.test(db),
  },
  {
    id: 'postgres_13_eol',
    severity: 'critical',
    vendor: 'PostgreSQL Global Development Group',
    product: 'PostgreSQL 13',
    title: 'PostgreSQL 13: EOL November 2025 — no further security releases',
    detail:
      'PostgreSQL 13 reached end of life on November 13, 2025. The PostgreSQL GDG no longer ' +
      'issues security advisories or patch releases for PG 13. Any CVE affecting the PostgreSQL ' +
      'engine is permanently unpatched in the 13 branch. Upgrade to PostgreSQL 16 (LTS) or ' +
      'PostgreSQL 17 (both in active support with regular security releases).',
    refs: [
      { label: 'PostgreSQL versioning and support policy', url: 'https://www.postgresql.org/support/versioning/' },
    ],
    check: ({ db }) => /postgres(ql)?.?13(\b|$)/i.test(db),
  },
  {
    id: 'postgres_14_eol_soon',
    severity: 'warn',
    vendor: 'PostgreSQL Global Development Group',
    product: 'PostgreSQL 14',
    title: 'PostgreSQL 14: EOL November 2026 — plan upgrade now',
    detail:
      'PostgreSQL 14 reaches end of life in November 2026. After that date, no security patches ' +
      'or bug fixes will be issued. PG 14 ships in Ubuntu 22.04 LTS as the default version — ' +
      'dist-provided packages may provide limited backports but are not guaranteed. Upgrade to ' +
      'PostgreSQL 16 (active LTS) before EOL to avoid an unplanned migration under time pressure.',
    refs: [
      { label: 'PostgreSQL versioning and support policy', url: 'https://www.postgresql.org/support/versioning/' },
    ],
    check: ({ db }) => /postgres(ql)?.?14(\b|$)/i.test(db),
  },
  {
    id: 'mysql_80_eol',
    severity: 'critical',
    vendor: 'Oracle',
    product: 'MySQL 8.0',
    title: 'MySQL 8.0: EOL April 2026 — migrate to MySQL 8.4 LTS or MySQL 9.x',
    detail:
      'Oracle MySQL 8.0 reached end of life on April 30, 2026. No further security patches, ' +
      'bug fixes, or platform updates are issued for the 8.0 branch. MySQL 8.4 is the current ' +
      'Long-Term Support (LTS) release (supported through April 2032) and is a drop-in compatible ' +
      'upgrade from MySQL 8.0 for most workloads. MySQL 9.x is the Innovation track. ' +
      'Remaining on MySQL 8.0 post-EOL creates an accumulating unpatched CVE exposure.',
    refs: [
      { label: 'MySQL lifecycle policy', url: 'https://www.mysql.com/support/supportedplatforms/database.html' },
      { label: 'MySQL EOL dates — endoflife.date', url: 'https://endoflife.date/mysql' },
    ],
    check: ({ db }) => /mysql.?8\.0/i.test(db),
  },
  {
    id: 'mssql_2016_eol_imminent',
    severity: 'critical',
    vendor: 'Microsoft',
    product: 'SQL Server 2016',
    title: 'SQL Server 2016: Extended Support ends July 14, 2026 — immediately migrate',
    detail:
      'Microsoft SQL Server 2016 Extended Support ends July 14, 2026. After this date, no further ' +
      'security patches, hotfixes, or compliance updates will be issued. SQL Server 2016 is the ' +
      'last version that included SSRS bundled in the main installer. ' +
      'ESU via Azure Arc is available for up to three additional years but requires enrollment. ' +
      'Migrate to SQL Server 2022 (supported through January 2033) without delay.',
    refs: [
      { label: 'SQL Server 2016 lifecycle', url: 'https://learn.microsoft.com/en-us/lifecycle/products/sql-server-2016' },
      { label: 'SQL Server ESU details', url: 'https://learn.microsoft.com/en-us/sql/sql-server/end-of-support/sql-server-extended-security-updates' },
    ],
    check: ({ db }) => /sql.?server.?2016|mssql.?2016/i.test(db),
  },

  // ── EOL — Middleware (additional) ──────────────────────────────────────────
  {
    id: 'was_traditional_855_eol',
    severity: 'critical',
    vendor: 'IBM',
    product: 'IBM WebSphere Application Server Traditional 8.5.5',
    title: 'WebSphere Traditional 8.5.5: IBM support ended September 2025',
    detail:
      'IBM WebSphere Application Server Traditional 8.5.5 reached End of Support on ' +
      'September 30, 2025. IBM no longer provides security fixes, interim fixes, or defect ' +
      'support for WAS Traditional 8.5.5. Deployments on 8.5.5 are running with a growing ' +
      'backlog of unpatched Java EE runtime CVEs. Migrate to WebSphere Liberty 24.x (actively ' +
      'supported, Jakarta EE 10 compatible) or Red Hat JBoss EAP 8.0 as a migration path. ' +
      'Note: WebSphere Liberty is NOT the same product as WAS Traditional — application code ' +
      'changes are required for the Liberty migration.',
    refs: [
      { label: 'IBM WebSphere lifecycle policy', url: 'https://www.ibm.com/support/pages/ibm-websphere-application-server-support-lifecycle-policy' },
      { label: 'WAS Traditional 8.5.5 EOL notice', url: 'https://www.ibm.com/support/pages/withdrawal-notice-ibm-websphere-application-server-traditional-855' },
    ],
    check: ({ app }) =>
      /websphere.{0,30}(traditional|was).{0,10}8\.5|was.{0,10}8\.5\.5/i.test(app) ||
      (/websphere/i.test(app) && /8\.5\.5|8\.5\b/i.test(app)),
  },

  // ── Platform Incompatibilities (additional) ────────────────────────────────
  {
    id: 'sap_hana_aix',
    severity: 'critical',
    vendor: 'SAP',
    product: 'SAP HANA',
    title: 'SAP HANA is NOT supported on AIX — certified only on x86_64 and IBM Power LE (RHEL)',
    detail:
      'SAP HANA is certified exclusively on x86_64 (Intel/AMD) and IBM POWER LE (little-endian ' +
      'ppc64le, running RHEL for IBM Power). AIX (IBM Power big-endian, ppc64be) is NOT in the ' +
      'SAP HANA PAM. This is a common misconception for enterprises migrating SAP from AIX to ' +
      'HANA — you cannot run HANA on your existing AIX server. The target must be a certified ' +
      'HANA appliance or IBM Power LE (RHEL) server, not AIX. See the SAP HANA hardware directory ' +
      'for a list of certified appliances.',
    refs: [
      { label: 'SAP HANA Platform Availability Matrix (PAM)', url: 'https://support.sap.com/en/my-support/software-downloads/support-package-stacks/product-versions.html' },
      { label: 'SAP HANA Certified Hardware Directory', url: 'https://www.sap.com/dmc/exp/2014-09-02-hana-hardware/enEN/#/solutions?filters=v:deCertified' },
    ],
    check: ({ db, app, os }) =>
      /sap.?hana|hana.?db/i.test((db || '') + ' ' + (app || '')) &&
      /aix/i.test(os),
    compatFix: {
      type: 'switch_db',
      summary: 'SAP HANA cannot run on AIX — requires x86_64 or IBM Power LE (RHEL). Choose an AIX-certified DB or change platform.',
      alternatives: [
        { label: 'Oracle 19c on AIX 7.2 (AIX-certified, last Oracle on AIX)', ctxKey: 'db', ctxValue: 'Oracle 19c' },
        { label: 'IBM Db2 11.5 on AIX (IBM-certified native AIX build)', ctxKey: 'db', ctxValue: 'IBM Db2 11.5' },
        { label: 'SAP ASE (Sybase) 16.x on AIX (SAP-certified on AIX Power BE)', ctxKey: 'db', ctxValue: 'SAP ASE 16' },
      ],
    },
  },
  {
    id: 'oracle_23c_aix',
    severity: 'critical',
    vendor: 'Oracle',
    product: 'Oracle Database 23c (AI)',
    title: 'Oracle DB 23c is NOT certified on AIX — Oracle 19c is the last AIX-certified Oracle version',
    detail:
      'Oracle Database 23c (AI) does not include AIX in its certification matrix. Oracle 19c ' +
      '(LTS, supported through April 2027 in Premier, April 2029 Extended) is the last Oracle ' +
      'Database version certified on AIX 7.2 TL5+. If you are planning a new Oracle deployment ' +
      'on AIX, Oracle 19c is the only viable version. Note: AIX 7.2 itself is now EOL (April 2025) ' +
      'so the only supported Oracle+AIX combination (Oracle 19c on AIX 7.2) runs on an unsupported OS.',
    refs: [
      { label: 'Oracle DB 23c Certification Matrix (MOS 742060.1)', url: 'https://support.oracle.com/epmos/faces/DocumentDisplay?id=742060.1' },
      { label: 'Oracle Lifetime Support Policy', url: 'https://www.oracle.com/us/assets/lifetime-support-technology-069183.pdf' },
    ],
    check: ({ db, os }) =>
      /oracle.{0,10}23c|oracle.{0,10}23\.0|oracle.{0,10}23ai/i.test(db) &&
      /aix/i.test(os),
    compatFix: {
      type: 'version_downgrade',
      summary: 'Oracle 23c is not available on AIX — downgrade to the last AIX-certified Oracle version',
      alternatives: [
        { label: 'Oracle 19c (LTS — last Oracle certified on AIX 7.2 TL5+, supported through 2027)', ctxKey: 'db', ctxValue: 'Oracle 19c' },
      ],
    },
  },
  {
    id: 'oracle_23c_rhel7',
    severity: 'critical',
    vendor: 'Oracle',
    product: 'Oracle Database 23c (AI)',
    title: 'Oracle DB 23c requires RHEL 8.6+ or RHEL 9 — RHEL 7 is not supported',
    detail:
      'Oracle Database 23c is certified on RHEL 8.6 (minimum) and RHEL 9.2 (minimum). RHEL 7 ' +
      'is NOT in the Oracle 23c certification matrix. This matters for brownfield deployments ' +
      'where Oracle 12c or 19c runs on RHEL 7 — migrating to Oracle 23c requires upgrading ' +
      'the OS to RHEL 8.6+ simultaneously. Plan and test the OS upgrade independently before ' +
      'attempting the Oracle 23c installation.',
    refs: [
      { label: 'Oracle DB 23c Installation Guide — Linux', url: 'https://docs.oracle.com/en/database/oracle/oracle-database/23/ladbi/' },
      { label: 'Oracle DB 23c Certification Matrix (MOS 742060.1)', url: 'https://support.oracle.com/epmos/faces/DocumentDisplay?id=742060.1' },
    ],
    check: ({ db, os }) =>
      /oracle.{0,10}23c|oracle.{0,10}23\.0|oracle.{0,10}23ai/i.test(db) &&
      /rhel.?7|centos.?7|red.?hat.{0,20}linux.?7/i.test(os),
    compatFix: {
      type: 'version_downgrade',
      summary: 'Oracle 23c requires RHEL 8.6+ — downgrade DB or upgrade OS',
      alternatives: [
        { label: 'Oracle 19c (LTS — certified on RHEL 7, 8, 9; in Premier Support through April 2027)', ctxKey: 'db', ctxValue: 'Oracle 19c' },
        { label: 'Upgrade OS to RHEL 8 (allows Oracle 23c)', ctxKey: 'os', ctxValue: 'RHEL 8' },
      ],
    },
  },
  {
    id: 'jboss_eap_rhel9_min',
    severity: 'warn',
    vendor: 'Red Hat',
    product: 'JBoss EAP 7.4',
    title: 'JBoss EAP 7.4 on RHEL 9: minimum EAP 7.4.2 required — earlier releases fail to start',
    detail:
      'JBoss EAP 7.4.0 and 7.4.1 were built against Glibc 2.28 (RHEL 8 baseline) and fail to ' +
      'start on RHEL 9 (Glibc 2.34+) with "cannot open shared object file" errors in native ' +
      'libraries used by the Undertow I/O subsystem. EAP 7.4.2+ resolved the Glibc 2.34 ' +
      'compatibility issues. JBoss EAP 8.0 (Jakarta EE 10) has full RHEL 9 support from GA.',
    refs: [
      { label: 'JBoss EAP supported configurations on RHEL 9', url: 'https://access.redhat.com/articles/2026253' },
      { label: 'JBoss EAP 7.4 release notes', url: 'https://access.redhat.com/documentation/en-us/red_hat_jboss_enterprise_application_platform/7.4/html/7.4.2_release_notes/' },
    ],
    check: ({ app, os }) =>
      /jboss.{0,10}eap.?7\.4|eap.?7\.4/i.test(app) &&
      /rhel.?9|red.?hat.{0,20}linux.?9/i.test(os),
  },
  {
    id: 'sql_server_power_bi_arm',
    severity: 'critical',
    vendor: 'Microsoft',
    product: 'SQL Server / Power BI Report Server',
    title: 'SQL Server Reporting Services and Power BI Report Server require Windows — no Linux/AIX build',
    detail:
      'SQL Server Reporting Services (SSRS) and Power BI Report Server run exclusively on ' +
      'Windows Server. There is no Linux build. If your target OS is RHEL, Ubuntu, or AIX, ' +
      'SSRS cannot be deployed. Alternatives: Power BI Service (cloud), or third-party Linux-native ' +
      'reporting tools (Jaspersoft, Pentaho). Plan this as a separate workload when migrating ' +
      'SQL Server off Windows.',
    refs: [
      { label: 'SSRS installation requirements', url: 'https://learn.microsoft.com/en-us/sql/reporting-services/install-windows/hardware-and-software-requirements-for-reporting-services' },
      { label: 'Power BI Report Server system requirements', url: 'https://learn.microsoft.com/en-us/power-bi/report-server/system-requirements' },
    ],
    check: ({ app, os }) =>
      /ssrs|reporting.?services|power.?bi.?report.?server/i.test(app) &&
      /linux|rhel|ubuntu|centos|aix/i.test(os),
  },
  {
    id: 'db2_aix_72_eol_impact',
    severity: 'warn',
    vendor: 'IBM',
    product: 'IBM Db2 LUW on AIX',
    title: 'IBM Db2 LUW on AIX 7.2: AIX EOL (April 2025) ends Db2 platform eligibility',
    detail:
      'IBM Db2 LUW 11.5 is certified on AIX 7.1 and 7.2. However, AIX 7.2 reached End of Support ' +
      'on April 30, 2025, which means IBM can no longer certify or patch Db2 on that OS ' +
      'combination. While Db2 itself continues to work, running Db2 on an EOL OS is outside ' +
      'IBM\'s supportable configuration — any Db2 issue on AIX 7.2 after April 2025 may be ' +
      'refused support until the OS is upgraded. Upgrade to AIX 7.3 or migrate Db2 to RHEL.',
    refs: [
      { label: 'Db2 LUW supported operating systems', url: 'https://www.ibm.com/support/pages/db2-luw-supported-operating-systems' },
      { label: 'IBM AIX 7.2 end of support', url: 'https://www.ibm.com/support/pages/aix-support-lifecycle-information' },
    ],
    check: ({ db, os }) =>
      /db2|ibm.?db/i.test(db) && /aix.?7\.2/i.test(os),
  },
  {
    id: 'vmware_esxi_67_eol',
    severity: 'critical',
    vendor: 'VMware / Broadcom',
    product: 'VMware vSphere ESXi 6.7',
    title: 'VMware ESXi 6.7: End of General Support October 2022 — unpatched hypervisor CVEs',
    detail:
      'VMware vSphere ESXi 6.7 reached End of General Support on October 15, 2022. Broadcom (VMware) ' +
      'no longer releases security patches, critical fixes, or hardware driver updates for ESXi 6.7. ' +
      'Known hypervisor CVEs (including VM escape vulnerabilities in the SVGA/SCSI device emulation ' +
      'layer) remain unpatched on ESXi 6.7. Upgrade to ESXi 8.x (supported through October 2029).',
    refs: [
      { label: 'VMware vSphere 6.7 lifecycle', url: 'https://lifecycle.vmware.com/' },
      { label: 'VMware Product Lifecycle Matrix', url: 'https://lifecycle.vmware.com/#/' },
    ],
    check: ({ hw, app }) =>
      /vmware|vsphere|esxi.?6\.7/i.test(app + ' ' + hw) &&
      /6\.7/i.test(app + ' ' + hw),
  },
  {
    id: 'tomcat_9_jakarta_note',
    severity: 'info',
    vendor: 'Apache Software Foundation',
    product: 'Apache Tomcat 9.x',
    title: 'Tomcat 9.x: uses javax.* namespace — apps must be rebuilt for Tomcat 10+',
    detail:
      'Apache Tomcat 9.x uses the Java EE javax.* namespace (Servlet 4.0, JSP 2.3, etc.). ' +
      'Tomcat 9.x is still actively maintained and is the correct choice for Java EE 8 / javax.* ' +
      'applications. However, if you plan to upgrade to Tomcat 10+ in future, all application ' +
      'code imports (javax.servlet → jakarta.servlet) must be migrated. Tomcat 9.x reaches EOL ' +
      'when Java SE 11 reaches EOL — plan accordingly.',
    refs: [
      { label: 'Tomcat version comparison', url: 'https://tomcat.apache.org/whichversion.html' },
      { label: 'Tomcat 10.x migration guide', url: 'https://tomcat.apache.org/migration-10.html' },
    ],
    check: ({ app }) => /tomcat.?9\./i.test(app),
  },
];

/**
 * Maps rule IDs to their endoflife.date live-check coordinates.
 * On every app open, useLiveCompatSync fetches live EOL dates for each
 * slug and stores results in store.liveCompatData[ruleId].
 * Only EOL/lifecycle rules appear here — platform incompatibility rules
 * (SQL Server on AIX, SAP HANA on AIX, etc.) have no live API equivalent
 * and remain statically authoritative.
 */
export const EOL_RULE_SLUGS = {
  // OS
  rhel_centos_6_eol:            { slug: 'rhel',            cycle: '6'        },
  rhel_centos_7_eol:            { slug: 'rhel',            cycle: '7'        },
  ubuntu_1804_eol:              { slug: 'ubuntu',          cycle: '18.04'    },
  windows_server_2012_eol:      { slug: 'windows-server',  cycle: '2012'     },
  windows_server_2016_eol_soon: { slug: 'windows-server',  cycle: '2016'     },
  oracle_solaris_10_eol:        { slug: 'oracle-solaris',  cycle: '10'       },
  aix_71_eol:                   { slug: 'aix',             cycle: '7.1'      }, // prefix-matches 7.1.5
  aix_72_eol:                   { slug: 'aix',             cycle: '7.2'      }, // prefix-matches 7.2.x
  // Database — oracle-database uses dotted cycles (12.2, 11.2); mssqlserver uses build versions
  oracle_11g_eol:               { slug: 'oracle-database', cycle: '11.2'     },
  oracle_12c_eol:               { slug: 'oracle-database', cycle: '12.2'     },
  postgres_11_eol:              { slug: 'postgresql',      cycle: '11'       },
  postgres_12_eol:              { slug: 'postgresql',      cycle: '12'       },
  postgres_13_eol:              { slug: 'postgresql',      cycle: '13'       },
  postgres_14_eol_soon:         { slug: 'postgresql',      cycle: '14'       },
  mysql_57_eol:                 { slug: 'mysql',           cycle: '5.7'      },
  mysql_80_eol:                 { slug: 'mysql',           cycle: '8.0'      },
  mssql_2012_eol:               { slug: 'mssqlserver',     cycle: '11.0'     }, // SQL Server 2012 = 11.x
  mssql_2014_eol:               { slug: 'mssqlserver',     cycle: '12.0'     }, // SQL Server 2014 = 12.x
  mssql_2016_eol_imminent:      { slug: 'mssqlserver',     cycle: '13.0-sp3' }, // SP3 EOL: 2026-07-14
  // Middleware / App
  apache_httpd_22_eol:          { slug: 'apache',          cycle: '2.2'      },
  tomcat_85_eol:                { slug: 'tomcat',          cycle: '8.5'      }, // slug is 'tomcat', not 'apache-tomcat'
  php_7x_eol:                   { slug: 'php',             cycle: '7.4'      },
  jboss_eap_6x_eol:            { slug: 'jboss-eap',       cycle: '6'        }, // API tracks major only (6, 7, 8)
  vmware_esxi_67_eol:           { slug: 'vmware-esxi',     cycle: '6.7'      },
  // was_traditional_855_eol — no endoflife.date slug for IBM WebSphere; static rule only
};

/**
 * Check a ctx { hw, os, db, app } against all compatibility rules.
 * Returns an array of matching rules (with full rule objects).
 */
export function checkCompatibility(ctx) {
  if (!ctx) return [];
  const c = {
    hw:  (ctx.hw  || '').toLowerCase(),
    os:  (ctx.os  || '').toLowerCase(),
    db:  (ctx.db  || '').toLowerCase(),
    app: (ctx.app || '').toLowerCase(),
  };
  return COMPAT_RULES.filter(r => {
    try { return r.check(c); } catch { return false; }
  });
}

/**
 * Check a free-text description against all rules.
 * Handles migration patterns ("from X to Y") by extracting the TARGET platform.
 */
export function checkCompatibilityForText(text, ctx) {
  if (!text) return [];
  const pseudoCtx = extractMigrationCtx(text, ctx);
  return checkCompatibility(pseudoCtx);
}

// ── Text extractors — pull stack hints out of free-text entry descriptions ────
// For migration phrases ("from X to Y"), the TARGET platform is what matters for
// compatibility checking — extract it preferentially over the source.

const HW_PAT  = /\b(ibm.?power|power\s*\d?|ppc64le|ppc64be|ppc|p9|p10|powerpc|graviton|arm64?|aarch64|sparc|itanium|x86_64|amd64)\b/i;
const OS_PAT  = /\b(rhel|rh\b|red.?hat|aix[\s\d.]*|sles|suse|ubuntu[\s\d.]*lts?|centos|windows.?server[\s\d.]*|linux)\b/i;
const DB_PAT  = /\b(oracle|sybase|sap.?ase|adaptive.?server|mysql|mariadb|postgres(?:ql)?|db2|ibm.?db2|sql.?server|mssql)\b/i;
const APP_PAT = /\b(websphere|weblogic|jboss|eap|tomcat|nginx|iis)\b/i;

function normOS(s) { return s ? s.toLowerCase().replace(/\brh\b/, 'rhel') : ''; }

function extractBothSides(t, pat) {
  // Find all matches; for migration text ("from X to Y") return [source, target]
  const all = [];
  let re = new RegExp(pat.source, 'gi');
  let m;
  while ((m = re.exec(t)) !== null) all.push(m[0]);
  return all; // caller decides which to use
}

function extractHW(t) {
  // Prefer the token immediately after "to" (migration target)
  const toMatch = t.match(/\bto\b[^a-z]*(?:\S+\s+){0,3}?(ibm.?power|power\s*\d?|ppc64le|ppc64be|ppc|p9|p10|powerpc|graviton|arm64?|aarch64|sparc|itanium|x86_64|amd64)\b/i);
  if (toMatch) return toMatch[1];
  const m = t.match(HW_PAT);
  return m ? m[0] : '';
}
function extractOS(t) {
  // Prefer the token immediately after "to" (migration target)
  const toMatch = t.match(/\bto\b[^a-z]*(?:\S+\s+){0,3}?(rhel|rh\b|red.?hat|aix[\s\d.]*|sles|suse|ubuntu[\s\d.]*|centos|windows.?server[\s\d.]*|linux)\b/i);
  if (toMatch) return normOS(toMatch[1]);
  const m = t.match(OS_PAT);
  return m ? normOS(m[0]) : '';
}
function extractDB(t) {
  const m = t.match(DB_PAT);
  return m ? m[0] : '';
}
function extractApp(t) {
  const m = t.match(APP_PAT);
  return m ? m[0] : '';
}

/**
 * Parse a migration description ("oracle from aix power to rhel power") and return
 * a pseudo-ctx that reflects the TARGET stack — the compat rules apply to where
 * you are going, not where you came from.
 */
export function extractMigrationCtx(text, existingCtx) {
  const t = text || '';
  return {
    hw:  (existingCtx?.hw  || '') + ' ' + extractHW(t),
    os:  (existingCtx?.os  || '') + ' ' + extractOS(t),
    db:  (existingCtx?.db  || '') + ' ' + extractDB(t),
    app: (existingCtx?.app || '') + ' ' + extractApp(t),
  };
}
