/**
 * Smart keyword analysis for custom UUM and Incident entries.
 * Detects layers, type, and severity from free-text so that custom entries
 * generate accurate Gantt tasks, RTM rows, and Matrix dependencies.
 */

const LAYER_PATTERNS = {
  hardware: [/\b(power\s*[789]|power10|blade|rack|lpar|esxi|vmware|vm\b|hba|san\s*fabric|proliant|idrac|ilo|asmi|ibm\s*power|sparc|x86)/i],
  os:       [/\b(aix|rhel|linux|windows\s*server|solaris|suse|sles|ubuntu|centos|almalinux|rocky|debian|kernel|leapp|operating\s*system|os\s+upg|in[- ]place|boot|grub|init|systemd)/i],
  db:       [/\b(oracle|sybase|ase\b|db2\b|sql\s*server|postgres|postgresql|mysql|mariadb|hana|sap\s*hana|database|tablespace|schema|rman|data\s*pump|redo\s*log|listener|replicat|goldengate|standby|dataguard|rac\b|asm\b)/i],
  app:      [/\b(weblogic|websphere|jboss|eap\b|tomcat|spring|java\b|jdk|jre|\.net|dotnet|middleware|app\s*server|application\s*server|open\s*liberty|netweaver|sap\s*net|nodejs|python\b|ruby\b)/i],
  web:      [/\b(apache|nginx|iis\b|httpd|web\s*server|http\b|reverse\s*proxy|modsecurity|waf\b|vhost)/i],
  storage:  [/\b(san\b|nfs\b|lun\b|disk\b|volume|filesystem|asm\b|veeam|tsm\b|spectrum\s*protect|netapp|pure\s*storage|nvme|fiber\s*channel|fc\b|iscsi|multipath|lvol|vg\b|pv\b)/i],
  network:  [/\b(vlan|firewall|network|switch|router|load\s*balanc|lb\b|f5\b|haproxy|nic\b|bond\b|interface|bgp|ospf|nat\b|acl\b|ipv[46]|dns\b|ntp\b)/i],
  security: [/\b(ssl\b|tls\b|certificate|cert\b|openssl|pki\b|ssh\b|siem\b|fips|cve\b|vulnerability|patch|hardening|scan\b|audit\b|compliance|iam\b|sso\b|ldap\b|saml\b)/i],
  backup:   [/\b(backup|restore|dr\b|disaster\s*recovery|rpo\b|rto\b|snapshot|veeam|tsm\b|spectrum\s*protect|bacula|commvault)/i],
};

const TYPE_PATTERNS = [
  { type: 'migration', patterns: [/\b(migrat|side[- ]by[- ]side|cross[- ]platform|cutover|move\s*(to|from)|port\s*(to|from)|consolidat)/i] },
  { type: 'upgrade',   patterns: [/\b(upgrad|tl\d|sp\d|fixpack|fix\s*pack|version\s*bump|major\s*version|eos\b|eol\b|ltsr|lts\b)/i] },
  { type: 'update',    patterns: [/\b(update|quarterly|annual|refresh|remediat|cpu\s*patch|patch\s*bundle|apply\s*patch)/i] },
  { type: 'patch',     patterns: [/\b(hotfix|emergency\s*patch|security\s*fix|zero[- ]day|cve[- ]\d)/i] },
];

/**
 * Detect which infrastructure layers a free-text string touches.
 * Returns an array of layer ids, e.g. ['os', 'db']
 */
export function detectLayersFromText(text) {
  const t = (text || '').toLowerCase();
  const found = [];
  for (const [layer, patterns] of Object.entries(LAYER_PATTERNS)) {
    if (patterns.some(p => p.test(t))) found.push(layer);
  }
  return found.length ? found : ['os']; // default to OS if nothing detected
}

/**
 * Detect the operation type from a free-text string.
 * Returns 'migration' | 'upgrade' | 'update' | 'patch' (defaults to 'upgrade')
 */
export function detectTypeFromText(text) {
  const t = (text || '').toLowerCase();
  for (const { type, patterns } of TYPE_PATTERNS) {
    if (patterns.some(p => p.test(t))) return type;
  }
  return 'upgrade';
}

/**
 * Detect the primary layer (single value for the layer dropdown) from text.
 * Priority: db > app > os > web > storage > security > network > hardware > backup
 */
export function detectPrimaryLayerFromText(text) {
  const layers = detectLayersFromText(text);
  const priority = ['db', 'app', 'os', 'web', 'storage', 'security', 'network', 'hardware', 'backup'];
  for (const l of priority) {
    if (layers.includes(l)) return l;
  }
  return layers[0] || 'os';
}

/**
 * Infer a severity for a custom incident from its text.
 * Returns 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
 */
export function detectSeverityFromText(text) {
  const t = (text || '').toLowerCase();
  if (/\b(outage|down\b|unavailable|p1\b|critical|production\s*down|data\s*loss|corrupt|breach|zero[- ]day|ransomware)/i.test(t)) return 'CRITICAL';
  if (/\b(degraded|slow|high\s*cpu|memory\s*pressure|disk\s*(full|90%)|certificate\s*expir|ssl\s*expir|eol|replication\s*lag|p2\b)/i.test(t)) return 'HIGH';
  if (/\b(warning|latency|intermittent|occasional|minor\s*error|alert|p3\b)/i.test(t)) return 'MEDIUM';
  return 'HIGH'; // default
}

/**
 * Infer a group/category for a custom incident from its text.
 * Returns a group name matching the RTM/Gantt incident grouping conventions.
 */
export function detectIncidentGroupFromText(text) {
  const t = (text || '').toLowerCase();
  if (/\b(ssl|tls|cert|cve|security|breach|vulnerability|compliance|audit)/i.test(t)) return 'Security & Compliance';
  if (/\b(oracle|sybase|postgres|mysql|db2|sql\s*server|hana|database|tablespace|schema|replication|goldengate)/i.test(t)) return 'Database';
  if (/\b(aix|rhel|linux|windows\s*server|solaris|kernel|os\b|operating\s*system|boot|cpu|memory|oom)/i.test(t)) return 'OS & Platform';
  if (/\b(san|nfs|lun|disk|volume|storage|multipath|filesystem|io\b|iops)/i.test(t)) return 'Storage';
  if (/\b(network|vlan|firewall|lb|f5|haproxy|routing|interface|dns|latency|packet)/i.test(t)) return 'Network';
  if (/\b(weblogic|websphere|jboss|tomcat|java|app\s*server|middleware|.net)/i.test(t)) return 'Middleware & App';
  if (/\b(apache|nginx|iis|httpd|web\s*server|http|waf|proxy)/i.test(t)) return 'Web Server';
  if (/\b(backup|restore|dr\b|disaster|rpo|rto|snapshot|veeam|tsm)/i.test(t)) return 'Backup & DR';
  return 'Infrastructure';
}

/**
 * Build a rich technical description from user's title, description, detected layers and type.
 * Used to populate the `txt` field of custom UUM entries.
 */
export function buildUUMDescription(title, desc, layers, type) {
  const LAYER_LABEL = {
    hardware: 'server hardware', os: 'OS/platform', db: 'database',
    app: 'application/middleware', web: 'web server', storage: 'storage/SAN',
    network: 'network layer', security: 'security controls',
    backup: 'backup/DR infrastructure',
  };
  const TYPE_LABEL = {
    migration: 'platform migration', upgrade: 'version upgrade',
    update: 'patch/update cycle', patch: 'emergency patch application',
  };
  const layerNames = (layers || ['os']).map(l => LAYER_LABEL[l] || l).join(', ');
  const typeName = TYPE_LABEL[type] || type;
  const scope = desc ? ` Scope: ${desc}.` : '';
  return `${title}: ${typeName} affecting ${layerNames}.${scope} Requires pre-execution planning, change window authorisation, execution with rollback capability, and post-change health validation per ITIL change management policy.`;
}

// ---------------------------------------------------------------------------
// Product name → endoflife.date slug mapping
// Keys are lowercase keywords users might type; values are exact API slugs.
// ---------------------------------------------------------------------------
const PRODUCT_SLUG_ALIASES = {
  // OS
  'aix':              'aix',
  'ibm aix':          'aix',
  'rhel':             'rhel',
  'red hat':          'rhel',
  'redhat':           'rhel',
  'centos':           'centos',
  'ubuntu':           'ubuntu',
  'debian':           'debian',
  'suse':             'sles',
  'sles':             'sles',
  'opensuse':         'opensuse',
  'solaris':          'oracle-solaris',
  'oracle solaris':   'oracle-solaris',
  'windows server':   'windows-server',
  'win server':       'windows-server',
  'rocky linux':      'rocky-linux',
  'almalinux':        'almalinux',
  'oracle linux':     'oracle-linux',
  'alma':             'almalinux',
  // DB
  'sybase':           'sap-ase',
  'sap ase':          'sap-ase',
  'sybase ase':       'sap-ase',
  'oracle db':        'oracle-db',
  'oracle database':  'oracle-db',
  'oracle 11':        'oracle-db',
  'oracle 12':        'oracle-db',
  'oracle 19':        'oracle-db',
  'oracle 23':        'oracle-db',
  'postgresql':       'postgresql',
  'postgres':         'postgresql',
  'mysql':            'mysql',
  'mariadb':          'mariadb',
  'sql server':       'mssqlserver',
  'mssql':            'mssqlserver',
  'db2':              'ibm-db2-luw',
  'ibm db2':          'ibm-db2-luw',
  'sap hana':         'sap-hana',
  'hana':             'sap-hana',
  'mongodb':          'mongodb',
  'redis':            'redis',
  'elasticsearch':    'elasticsearch',
  'cassandra':        'cassandra',
  // Middleware / App
  'websphere':        'ibm-websphere-application-server-liberty',
  'weblogic':         'oracle-weblogic',
  'jboss':            'jboss-eap',
  'jboss eap':        'jboss-eap',
  'tomcat':           'tomcat',
  'apache tomcat':    'tomcat',
  'spring boot':      'spring-boot',
  'spring':           'spring-boot',
  'java':             'java',
  'jdk':              'java',
  'node':             'nodejs',
  'nodejs':           'nodejs',
  'python':           'python',
  'dotnet':           'dotnet',
  '.net':             'dotnet',
  'php':              'php',
  'ruby':             'ruby',
  // Web servers
  'nginx':            'nginx',
  'apache httpd':     'apache',
  'httpd':            'apache',
  // Platform
  'kubernetes':       'kubernetes',
  'k8s':              'kubernetes',
  'docker':           'docker-engine',
  'open liberty':     'ibm-websphere-application-server-liberty',
};

/**
 * Extract endoflife.date slugs from a free-text query.
 * Checks multi-word phrases first (longer matches win), then single words.
 * Returns at most 5 unique slugs to avoid excessive API calls.
 */
export function extractProductSlugs(text) {
  const lower = text.toLowerCase();
  const found = new Map(); // slug → matched keyword (first match wins)

  // Sort aliases by keyword length descending so "windows server" beats "windows"
  const sorted = Object.entries(PRODUCT_SLUG_ALIASES).sort((a, b) => b[0].length - a[0].length);

  for (const [kw, slug] of sorted) {
    if (!found.has(slug) && lower.includes(kw)) {
      found.set(slug, kw);
    }
  }

  return Array.from(found.keys()).slice(0, 5);
}

/**
 * Format an EOL date field (may be boolean or date string) to a short human label.
 */
export function formatEolDate(eol) {
  if (eol === true) return "EOL'd";
  if (eol === false || eol == null) return 'Ongoing';
  try {
    const d = new Date(eol);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return String(eol); }
}

/**
 * Build a short group label for a custom UUM entry.
 */
export function buildUUMGroup(layers, type) {
  if (layers.includes('db') && type === 'migration') return 'Database Migrations';
  if (layers.includes('db')) return 'Database Migrations';
  if (layers.includes('os') && type === 'migration') return 'Cross-Platform and Cost Reduction Migrations';
  if (layers.includes('os')) return 'OS Upgrades';
  if (layers.includes('app') || layers.includes('web')) return 'Middleware and App Updates';
  if (layers.includes('security')) return 'Security and Compliance Updates';
  if (layers.includes('storage') || layers.includes('hardware')) return 'Platform and Storage Migrations';
  if (layers.includes('backup')) return 'Platform and Storage Migrations';
  return 'Custom Operations';
}
