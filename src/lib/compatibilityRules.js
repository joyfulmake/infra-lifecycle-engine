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
    title: 'Oracle DB 21c+ does not support AIX 7.3 — last supported AIX is 7.2',
    detail:
      'Oracle dropped AIX 7.3 from its certification matrix starting with Oracle Database 21c. ' +
      'Oracle 19c (long-term release, supported until 2027) is the last version certified on AIX 7.2. ' +
      'If you require AIX 7.3, you must use Oracle DB 19c and plan migration before its support window closes.',
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
    severity: 'warn',
    vendor: 'Oracle',
    product: 'Oracle Database',
    title: 'Verify Oracle DB version for RHEL IBM Power (ppc64le) — version-specific support',
    detail:
      'Oracle Database support on RHEL for IBM Power (ppc64le) is version-specific. ' +
      'Oracle 19c and 21c are certified on RHEL 8 ppc64le. Oracle 23c (AI) has not been certified ' +
      'on ppc64le as of 2024. Always verify against the current certification matrix before provisioning.',
    refs: [
      { label: 'Oracle Certification Matrix — Linux for Power (Doc 742060.1)', url: 'https://support.oracle.com/epmos/faces/DocumentDisplay?id=742060.1' },
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
];

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
 * Check a free-text UUM/incident entry description against all rules.
 * Appends matching ctx fields to broaden detection.
 */
export function checkCompatibilityForText(text, ctx) {
  if (!text) return [];
  const combined = (text + ' ' + (ctx?.db || '') + ' ' + (ctx?.os || '') + ' ' + (ctx?.hw || '') + ' ' + (ctx?.app || '')).toLowerCase();
  // Synthesise a pseudo-ctx from the text + real ctx so rule checks work
  const pseudoCtx = {
    hw:  (ctx?.hw  || '') + ' ' + extractHW(text),
    os:  (ctx?.os  || '') + ' ' + extractOS(text),
    db:  (ctx?.db  || '') + ' ' + extractDB(text),
    app: (ctx?.app || '') + ' ' + extractApp(text),
  };
  return checkCompatibility(pseudoCtx);
}

// ── Text extractors — pull stack hints out of free-text entry descriptions ────

function extractHW(t) {
  const m = t.match(/\b(ibm.?power|power\s*\d|aix|ppc|p9|p10|powerpc|graviton|arm|sparc|itanium)\b/i);
  return m ? m[0] : '';
}
function extractOS(t) {
  const m = t.match(/\b(rhel|red.?hat|aix[\s\d.]*|sles|suse|ubuntu|centos|windows.?server|linux)\b/i);
  return m ? m[0] : '';
}
function extractDB(t) {
  const m = t.match(/\b(oracle|sybase|sap.?ase|adaptive.?server|mysql|mariadb|postgres|db2|sql.?server|mssql)\b/i);
  return m ? m[0] : '';
}
function extractApp(t) {
  const m = t.match(/\b(websphere|weblogic|jboss|eap|tomcat|nginx|iis)\b/i);
  return m ? m[0] : '';
}
