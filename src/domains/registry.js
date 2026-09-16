// Domain registry — the pluggable-platform foundation. Each entry names a
// domain and its axis labels (the 4 stack-selector dropdowns rebranded per
// domain — e.g. infra's "Hardware/OS/Database/Application" becomes SAP's
// "Product/Version/Deployment/Module"). The actual catalog CONTENT for each
// domain lives in its own file (infra's is the existing src/lib/* files,
// left completely untouched; the others are new under src/domains/).
//
// How switching works (see applyDomain.js): choosing a domain mutates the
// SAME array/object references that ALL_INC, ALL_UUM, DESIGN_SECTIONS, etc.
// already export — so every existing tab (Gantt, RAID, RTM, Matrix,
// Closure, the Dependency Graph engine) picks up the new domain's data with
// zero changes to those files. Infra is the default and is never mutated
// away from its own content unless a different domain is explicitly chosen,
// so existing infra behavior is provably unchanged.

export const DOMAINS = [
  {
    id: 'infra',
    label: 'Infrastructure Provisioning',
    shortLabel: 'Infra',
    icon: '🖥',
    accent: '#0D9488',
    description: 'Server/platform lifecycle — hardware through app tier, CAB/RTM governed.',
    axisLabels: ['Hardware', 'OS', 'Database', 'Application'],
  },
  {
    id: 'cloudMigration',
    label: 'Cloud Migration',
    shortLabel: 'Cloud Migration',
    icon: '☁',
    accent: '#3B82F6',
    description: 'Discovery through cutover for a lift-shift, replatform, or refactor migration.',
    axisLabels: ['Source Platform', 'Target Cloud', 'Migration Pattern', 'Landing Zone'],
  },
  {
    id: 'sapPm',
    label: 'SAP Program',
    shortLabel: 'SAP',
    icon: '🧩',
    accent: '#F97316',
    description: 'ECC-to-S/4HANA and greenfield/brownfield SAP programs.',
    axisLabels: ['SAP Product', 'Release', 'Deployment Model', 'Module Scope'],
  },
  {
    id: 'bfsiPm',
    label: 'Banking / Financial Services',
    shortLabel: 'BFSI',
    icon: '🏦',
    accent: '#8B5CF6',
    description: 'Core banking, payments, and regulated financial infrastructure change.',
    axisLabels: ['Institution Type', 'Core System', 'Regulatory Region', 'Channel'],
  },
  {
    id: 'appDev',
    label: 'App Development',
    shortLabel: 'App Dev',
    icon: '📱',
    accent: '#22C55E',
    description: 'Sprint-based web/mobile delivery — discovery through release and hypercare.',
    axisLabels: ['App Type', 'Frontend Stack', 'Backend Stack', 'Deployment Target'],
  },
];

export function getDomainMeta(id) {
  return DOMAINS.find(d => d.id === id) || DOMAINS[0];
}
