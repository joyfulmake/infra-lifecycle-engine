// EOL / EOS reference data for known components
// status: 'active' | 'eos_soon' (< 12 months) | 'eol' (past or vendor-declared)
// Today: 2026-05-27 — update periodically

export const EOL_DATA = {
  // ── Hardware ───────────────────────────────────────────────────────────────
  'IBM Power10 / Power11':           { eos: '2030-09-30', status: 'active' },
  'IBM Power9':                      { eos: '2025-09-30', status: 'eol' },
  'IBM Power7 / Power8':             { eos: '2022-04-30', status: 'eol' },
  'IBM z16 Mainframe':               { eos: '2031-03-31', status: 'active' },
  'Oracle Exadata X10M':             { eos: '2031-12-31', status: 'active' },
  'Dell PowerEdge (x86_64)':         { eos: '2030-12-31', status: 'active' },
  'HPE ProLiant (x86_64)':           { eos: '2030-12-31', status: 'active' },
  'Cisco UCS (x86_64)':              { eos: '2030-06-30', status: 'active' },
  'Lenovo ThinkSystem (x86_64)':     { eos: '2030-12-31', status: 'active' },
  'AWS Graviton4 ARM64':             { eos: '2030-12-31', status: 'active' },
  'AWS Graviton5 ARM64':             { eos: '2032-12-31', status: 'active' },
  'Azure Cobalt 100/200 ARM64':      { eos: '2031-12-31', status: 'active' },
  'GCP Axion ARM64':                 { eos: '2032-12-31', status: 'active' },
  'AMD EPYC Turin x86_64':           { eos: '2031-12-31', status: 'active' },
  'Intel Xeon SP 4th Gen':           { eos: '2027-12-31', status: 'active' },
  'NVIDIA DGX H100':                 { eos: '2029-12-31', status: 'active' },
  'x86_64 Legacy':                   { eos: '2023-12-31', status: 'eol' },
  'x86_64 Cloud':                    { eos: '2030-12-31', status: 'active' },

  // ── Operating Systems ─────────────────────────────────────────────────────
  'RHEL 9.x':                        { eos: '2032-05-31', status: 'active' },
  'RHEL 8.x':                        { eos: '2029-05-31', status: 'active' },
  'RHEL 7.x (EOL)':                  { eos: '2024-06-30', status: 'eol' },
  'Ubuntu 24.04 LTS':                { eos: '2029-04-25', status: 'active' },
  'Ubuntu 22.04 LTS':                { eos: '2027-04-01', status: 'active' },
  'AIX 7.3':                         { eos: '2025-09-30', status: 'eol' },
  'AIX 7.2':                         { eos: '2023-04-30', status: 'eol' },
  'AIX 6.1 (EOL)':                   { eos: '2017-04-30', status: 'eol' },
  'Solaris 11.4':                    { eos: '2034-11-01', status: 'active' },
  'Solaris 10 (EOL)':                { eos: '2024-01-31', status: 'eol' },
  'Windows Server 2025':             { eos: '2034-10-10', status: 'active' },
  'Windows Server 2022':             { eos: '2031-10-14', status: 'active' },
  'Windows Server 2019':             { eos: '2029-01-09', status: 'active' },
  'Windows Server 2016':             { eos: '2027-01-12', status: 'eos_soon' },
  'SUSE SLES 15 SP6':                { eos: '2031-07-31', status: 'active' },
  'SUSE SLES 12 SP5':                { eos: '2024-10-31', status: 'eol' },
  'Debian 12':                       { eos: '2028-06-10', status: 'active' },
  'Rocky Linux 9':                   { eos: '2032-05-31', status: 'active' },
  'AlmaLinux 9':                     { eos: '2032-05-31', status: 'active' },
  'Oracle Linux 9':                  { eos: '2032-05-31', status: 'active' },
  'z/OS 3.1':                        { eos: '2027-09-30', status: 'active' },

  // ── Databases ─────────────────────────────────────────────────────────────
  'Oracle 19c (LTS)':                { eos: '2027-04-30', status: 'eos_soon' },
  'Oracle 23ai':                     { eos: '2033-04-30', status: 'active' },
  'Oracle 12cR2':                    { eos: '2022-03-31', status: 'eol' },
  'Oracle 11gR2 (EOL)':              { eos: '2020-12-31', status: 'eol' },
  'PostgreSQL 16':                   { eos: '2028-11-09', status: 'active' },
  'PostgreSQL 15':                   { eos: '2027-11-11', status: 'active' },
  'MySQL 8.4 LTS':                   { eos: '2032-04-30', status: 'active' },
  'MySQL 8.0':                       { eos: '2026-04-30', status: 'eol' },
  'MariaDB 11.4 LTS':                { eos: '2029-05-29', status: 'active' },
  'IBM DB2 LUW 12.1':                { eos: '2030-09-30', status: 'active' },
  'IBM DB2 LUW 11.5':                { eos: '2027-09-30', status: 'active' },
  'SAP Sybase ASE 16.0 SP04':        { eos: '2027-12-31', status: 'active' },
  'SAP Sybase ASE 15.7':             { eos: '2023-12-31', status: 'eol' },
  'SAP HANA 2.0 SPS07':              { eos: '2028-10-31', status: 'active' },
  'SQL Server 2022':                 { eos: '2033-01-11', status: 'active' },
  'SQL Server 2019':                 { eos: '2030-01-08', status: 'active' },
  'MongoDB 7.0 LTS':                 { eos: '2027-10-01', status: 'active' },
  'Redis 7.2':                       { eos: '2026-09-30', status: 'eos_soon' },
  'Cassandra 5.0':                   { eos: '2027-03-01', status: 'active' },
  'Elasticsearch 8.x':               { eos: '2027-02-28', status: 'active' },

  // ── Application / Middleware ──────────────────────────────────────────────
  'Apache Tomcat 10.1 (Jakarta EE 10)': { eos: '2029-12-31', status: 'active' },
  'Apache Tomcat 9.0':               { eos: '2026-12-31', status: 'eos_soon' },
  'IBM WebSphere 9.0.5':             { eos: '2027-04-30', status: 'eos_soon' },
  'IBM Open Liberty 24.x':           { eos: '2030-12-31', status: 'active' },
  'Oracle WebLogic 14.1.2':          { eos: '2033-01-31', status: 'active' },
  'Oracle WebLogic 12.2.1':          { eos: '2026-12-31', status: 'eos_soon' },
  'JBoss EAP 8.0 (Jakarta EE 10)':   { eos: '2031-11-01', status: 'active' },
  'JBoss EAP 7.4':                   { eos: '2029-11-01', status: 'active' },
  'Spring Boot 3.x':                 { eos: '2029-12-31', status: 'active' },
  'Spring Boot 2.x':                 { eos: '2023-11-24', status: 'eol' },
  'Node.js 22 LTS':                  { eos: '2027-04-30', status: 'eos_soon' },
  'Node.js 20 LTS':                  { eos: '2026-04-30', status: 'eol' },
  'Python 3.12 / Django 5':          { eos: '2028-10-01', status: 'active' },
  'Python 3.11 / FastAPI':           { eos: '2027-10-24', status: 'active' },
  'SAP NetWeaver 7.50':              { eos: '2027-12-31', status: 'active' },
  'Quarkus 3.x':                     { eos: '2029-12-31', status: 'active' },
  'WildFly 32':                      { eos: '2029-12-31', status: 'active' },
  '.NET 8 LTS (ASP.NET Core)':       { eos: '2026-11-10', status: 'eos_soon' },
  'NGINX 1.26':                      { eos: '2029-12-31', status: 'active' },
  'Apache HTTPD 2.4':                { eos: '2029-12-31', status: 'active' },
};

const TODAY_MS = new Date('2026-05-27').getTime();
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function getEolInfo(component) {
  if (!component) return null;

  // Exact match first, then starts-with match
  let data = EOL_DATA[component];
  if (!data) {
    const key = Object.keys(EOL_DATA).find(k => component.startsWith(k.split(' ')[0]) || k.startsWith(component.split(' ')[0]));
    data = key ? EOL_DATA[key] : null;
  }
  if (!data) return { status: 'unknown', label: 'Unknown', date: null, badge: 'badge-slate' };

  const eosMs = new Date(data.eos).getTime();
  let status = data.status;

  if (eosMs < TODAY_MS) {
    status = 'eol';
  } else if (eosMs - TODAY_MS < ONE_YEAR_MS) {
    status = 'eos_soon';
  }

  const labels = { active: 'Active', eos_soon: 'EOS Soon', eol: 'EOL', unknown: 'Unknown' };
  const badges = { active: 'badge-green', eos_soon: 'badge-amber', eol: 'badge-red', unknown: 'badge-slate' };

  return { status, label: labels[status], date: data.eos, badge: badges[status] };
}
