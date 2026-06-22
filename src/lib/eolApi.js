// Live endoflife.date API client
// Docs: https://endoflife.date/docs/api/

// Production: route through CF Pages Function edge proxy (/api/eol) for 1h edge cache.
// Dev: call endoflife.date directly (Pages Functions not served by Vite dev server).
const BASE = import.meta.env.PROD ? '/api/eol' : 'https://endoflife.date/api';

// Maps internal component display names / ctx values to endoflife.date product slugs
export const EOL_SLUG_MAP = {
  // OS
  'RHEL 9.x': { slug: 'rhel', cycle: '9' },
  'RHEL 8.x': { slug: 'rhel', cycle: '8' },
  'RHEL 7.x (EOL)': { slug: 'rhel', cycle: '7' },
  'Ubuntu 24.04 LTS': { slug: 'ubuntu', cycle: '24.04' },
  'Ubuntu 22.04 LTS': { slug: 'ubuntu', cycle: '22.04' },
  'AIX 7.3': { slug: 'aix', cycle: '7.3' },
  'AIX 7.2': { slug: 'aix', cycle: '7.2' },
  'AIX 6.1 (EOL)': { slug: 'aix', cycle: '6.1' },
  'Solaris 11.4': { slug: 'oracle-solaris', cycle: '11.4' },
  'Solaris 10 (EOL)': { slug: 'oracle-solaris', cycle: '10' },
  'Windows Server 2025': { slug: 'windows-server', cycle: '2025' },
  'Windows Server 2022': { slug: 'windows-server', cycle: '2022' },
  'Windows Server 2019': { slug: 'windows-server', cycle: '2019' },
  'Windows Server 2016': { slug: 'windows-server', cycle: '2016' },
  'SUSE SLES 15 SP6': { slug: 'sles', cycle: '15' },
  'SUSE SLES 12 SP5': { slug: 'sles', cycle: '12' },
  'Debian 12': { slug: 'debian', cycle: '12' },
  'Rocky Linux 9': { slug: 'rocky-linux', cycle: '9' },
  'AlmaLinux 9': { slug: 'almalinux', cycle: '9' },
  'Oracle Linux 9': { slug: 'oracle-linux', cycle: '9' },

  // DB
  'Oracle 19c (LTS)': { slug: 'oracle-db', cycle: '19c' },
  'Oracle 23ai': { slug: 'oracle-db', cycle: '23' },
  'Oracle 12cR2': { slug: 'oracle-db', cycle: '12.2' },
  'Oracle 11gR2 (EOL)': { slug: 'oracle-db', cycle: '11.2' },
  'PostgreSQL 16': { slug: 'postgresql', cycle: '16' },
  'PostgreSQL 15': { slug: 'postgresql', cycle: '15' },
  'MySQL 8.4 LTS': { slug: 'mysql', cycle: '8.4' },
  'MySQL 8.0': { slug: 'mysql', cycle: '8.0' },
  'MariaDB 11.4 LTS': { slug: 'mariadb', cycle: '11.4' },
  'SQL Server 2022': { slug: 'mssqlserver', cycle: '2022' },
  'SQL Server 2019': { slug: 'mssqlserver', cycle: '2019' },
  'MongoDB 7.0 LTS': { slug: 'mongodb', cycle: '7.0' },
  'Redis 7.2': { slug: 'redis', cycle: '7.2' },
  'Cassandra 5.0': { slug: 'cassandra', cycle: '5.0' },
  'Elasticsearch 8.x': { slug: 'elasticsearch', cycle: '8' },
  'SAP HANA 2.0 SPS07': { slug: 'sap-hana', cycle: '2.0' },

  // App / Middleware
  'Apache Tomcat 10.1 (Jakarta EE 10)': { slug: 'apache-tomcat', cycle: '10.1' },
  'Apache Tomcat 9.0': { slug: 'apache-tomcat', cycle: '9.0' },
  'Spring Boot 3.x': { slug: 'spring-boot', cycle: '3.3' },
  'Spring Boot 2.x': { slug: 'spring-boot', cycle: '2.7' },
  'Node.js 22 LTS': { slug: 'nodejs', cycle: '22' },
  'Node.js 20 LTS': { slug: 'nodejs', cycle: '20' },
  'Python 3.12 / Django 5': { slug: 'python', cycle: '3.12' },
  'Python 3.11 / FastAPI': { slug: 'python', cycle: '3.11' },
  '.NET 8 LTS (ASP.NET Core)': { slug: 'dotnet', cycle: '8.0' },
  'NGINX 1.26': { slug: 'nginx', cycle: '1.26' },
  'Apache HTTPD 2.4': { slug: 'apache', cycle: '2.4' },
  'JBoss EAP 8.0 (Jakarta EE 10)': { slug: 'jboss-eap', cycle: '8.0' },
  'JBoss EAP 7.4': { slug: 'jboss-eap', cycle: '7.4' },
};

// Fetch all cycles for a product slug
export async function fetchProductCycles(slug) {
  const res = await fetch(`${BASE}/${slug}.json`);
  if (!res.ok) throw new Error(`${slug}: ${res.status}`);
  return res.json();
}

// Fetch the master product list
export async function fetchProductIndex() {
  const res = await fetch(`${BASE}/all.json`);
  if (!res.ok) throw new Error('Failed to fetch product index');
  return res.json();
}

// Search product index for a keyword
export async function searchProducts(query) {
  const index = await fetchProductIndex();
  const q = query.toLowerCase().trim();
  return index.filter(p => p.includes(q)).slice(0, 6);
}

// Given a component name from ctx, return { slug, cycle, liveData } or null
export async function fetchComponentLiveData(componentName) {
  const mapping = EOL_SLUG_MAP[componentName];
  if (!mapping) return null;
  try {
    const cycles = await fetchProductCycles(mapping.slug);
    const matchedCycle = cycles.find(c => String(c.cycle) === String(mapping.cycle)) || cycles[0];
    return {
      slug: mapping.slug,
      targetCycle: mapping.cycle,
      matchedCycle,
      allCycles: cycles.slice(0, 5),
    };
  } catch {
    return null;
  }
}

// Determine live status from a cycle object
export function cycleLiveStatus(cycle) {
  if (!cycle) return { status: 'unknown', label: 'Unknown' };
  const today = new Date();

  const eolDate = cycle.eol === true ? new Date('1970-01-01') :
    cycle.eol === false ? null :
    cycle.eol ? new Date(cycle.eol) : null;

  const eosDate = cycle.support === true ? null :
    cycle.support === false ? new Date('1970-01-01') :
    cycle.support ? new Date(cycle.support) : null;

  if (eolDate && eolDate < today) return { status: 'eol', label: 'End of Life', color: 'red' };
  if (eosDate && eosDate < today) return { status: 'eos', label: 'End of Support', color: 'amber' };
  if (eolDate && (eolDate - today) / (1000 * 60 * 60 * 24) < 365) return { status: 'eos_soon', label: 'EOL < 12mo', color: 'amber' };
  if (eosDate && (eosDate - today) / (1000 * 60 * 60 * 24) < 365) return { status: 'eos_soon', label: 'EOS < 12mo', color: 'amber' };
  return { status: 'active', label: 'Supported', color: 'green' };
}
