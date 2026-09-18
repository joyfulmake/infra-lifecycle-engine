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
//
// `category` groups domains for the PhasePanel selector so it stays simple
// to navigate at 16 domains instead of one flat list — see CATEGORIES below.
// infra used to have a category of its own ('core') — a leftover from this
// app having started as an infra-only tool, not a real distinction: in an
// actual enterprise, infra is a substrate underneath a project (every one of
// these 16 domains sits on some infra), not itself the thing a project is
// "centered" on. It's grouped with the other horizontals (DevOps, Cloud
// Migration, Cybersecurity, ...) now, and no category implies primacy —
// whichever domain the user picks is that project's core.
//
// `icon` is a lucide-react component (not a string) — every consumer renders
// it as `<Icon .../>`, never interpolates it into text. lucide-react was
// picked over emoji for a consistent, resolution-independent, enterprise-
// grade icon set that ships as plain SVG React components (no icon font, no
// external request — same "everything self-hosted" reasoning as the fonts).

import {
  Server, Cloud, Workflow, ShieldCheck, RadioTower, BarChart3, Puzzle, Zap,
  Database, Diamond, Landmark, Hospital, Factory, Signal, ShoppingCart, Smartphone,
} from 'lucide-react';

export const CATEGORIES = [
  { id: 'horizontal', label: 'Horizontals' },
  { id: 'enterprise', label: 'Enterprise Apps' },
  { id: 'industry', label: 'Industries' },
  { id: 'appdev', label: 'App Delivery' },
];

export const DOMAINS = [
  {
    id: 'infra',
    label: 'Infrastructure Provisioning',
    shortLabel: 'Infra',
    icon: Server,
    accent: '#0D9488',
    category: 'horizontal',
    description: 'Server/platform lifecycle — hardware through app tier, CAB/RTM governed.',
    axisLabels: ['Hardware', 'OS', 'Database', 'Application'],
  },
  {
    id: 'cloudMigration',
    label: 'Cloud Migration',
    shortLabel: 'Cloud Migration',
    icon: Cloud,
    accent: '#3B82F6',
    category: 'horizontal',
    description: 'Discovery through cutover for a lift-shift, replatform, or refactor migration.',
    axisLabels: ['Source Platform', 'Target Cloud', 'Migration Pattern', 'Landing Zone'],
  },
  {
    id: 'devOps',
    label: 'DevOps / Platform Engineering',
    shortLabel: 'DevOps',
    icon: Workflow,
    accent: '#06B6D4',
    category: 'horizontal',
    description: 'Platform charter through GA — toolchain, pipelines, Kubernetes, observability.',
    axisLabels: ['Org Profile', 'CI/CD Tool', 'Platform', 'IaC Tool'],
  },
  {
    id: 'cybersecurity',
    label: 'Cybersecurity',
    shortLabel: 'Cybersecurity',
    icon: ShieldCheck,
    accent: '#DC2626',
    category: 'horizontal',
    description: 'SOC operations, vulnerability management, pentest, zero-trust, and compliance audits.',
    axisLabels: ['SOC Model', 'SIEM/EDR Platform', 'Target Framework', 'Environment'],
  },
  {
    id: 'networkRefresh',
    label: 'Network Refresh',
    shortLabel: 'Network Refresh',
    icon: RadioTower,
    accent: '#0EA5E9',
    category: 'horizontal',
    description: 'Switch/router hardware lifecycle, SD-WAN, wireless, segmentation, and firewall replacement.',
    axisLabels: ['Network Vendor', 'WAN Transport', 'Site Scope', 'Management Model'],
  },
  {
    id: 'dataAnalytics',
    label: 'Data & Analytics',
    shortLabel: 'Data & Analytics',
    icon: BarChart3,
    accent: '#EC4899',
    category: 'horizontal',
    description: 'Warehouse/lake migration, ETL/ELT pipelines, BI rollout, governance, and streaming.',
    axisLabels: ['Warehouse Platform', 'Orchestration Tool', 'Ingestion Pattern', 'BI Tool'],
  },
  {
    id: 'sapPm',
    label: 'SAP Program',
    shortLabel: 'SAP',
    icon: Puzzle,
    accent: '#F97316',
    category: 'enterprise',
    description: 'ECC-to-S/4HANA and greenfield/brownfield SAP programs.',
    axisLabels: ['SAP Product', 'Release', 'Deployment Model', 'Module Scope'],
  },
  {
    id: 'salesforcePm',
    label: 'Salesforce Program',
    shortLabel: 'Salesforce',
    icon: Zap,
    accent: '#EAB308',
    category: 'enterprise',
    description: 'Sales/Service/Experience Cloud implementations, CPQ rollouts, org consolidation.',
    axisLabels: ['Cloud Product', 'Edition', 'Implementation Type', 'Integration Scope'],
  },
  {
    id: 'oracleEbsPm',
    label: 'Oracle EBS / Fusion',
    shortLabel: 'Oracle EBS',
    icon: Database,
    accent: '#65A30D',
    category: 'enterprise',
    description: 'EBS upgrades, EBS-to-Fusion Cloud migrations, and Fusion module rollouts.',
    axisLabels: ['Source System', 'Target Platform', 'Deployment Approach', 'Module Scope'],
  },
  {
    id: 'dynamics365Pm',
    label: 'Dynamics 365',
    shortLabel: 'Dynamics 365',
    icon: Diamond,
    accent: '#6366F1',
    category: 'enterprise',
    description: 'F&O/Sales/Customer Service implementations, Business Central migrations, Power Platform.',
    axisLabels: ['Product Line', 'Source System', 'Deployment Model', 'Power Platform Scope'],
  },
  {
    id: 'bfsiPm',
    label: 'Banking / Financial Services',
    shortLabel: 'BFSI',
    icon: Landmark,
    accent: '#8B5CF6',
    category: 'industry',
    description: 'Core banking, payments, and regulated financial infrastructure change.',
    axisLabels: ['Institution Type', 'Core System', 'Regulatory Region', 'Channel'],
  },
  {
    id: 'healthcarePm',
    label: 'Healthcare',
    shortLabel: 'Healthcare',
    icon: Hospital,
    accent: '#F43F5E',
    category: 'industry',
    description: 'EHR/EMR implementation, clinical interoperability, HIPAA compliance, medical device and imaging change.',
    axisLabels: ['Care Setting', 'EHR Platform', 'Regulatory Region', 'Channel'],
  },
  {
    id: 'manufacturingPm',
    label: 'Manufacturing / Industry 4.0',
    shortLabel: 'Manufacturing',
    icon: Factory,
    accent: '#64748B',
    category: 'industry',
    description: 'MES/SCADA, IIoT, predictive maintenance, digital twin, and OT/IT convergence on the shop floor.',
    axisLabels: ['Manufacturing Type', 'MES/SCADA Platform', 'Plant Scope', 'Program Type'],
  },
  {
    id: 'telecomPm',
    label: 'Telecom',
    shortLabel: 'Telecom',
    icon: Signal,
    accent: '#A855F7',
    category: 'industry',
    description: '5G core rollout, OSS/BSS migration, NFV, RAN upgrades, and fiber/FTTH buildout.',
    axisLabels: ['Operator Type', 'Equipment Vendor', 'Coverage Area', 'Program Type'],
  },
  {
    id: 'retailPm',
    label: 'Retail / e-Commerce',
    shortLabel: 'Retail',
    icon: ShoppingCart,
    accent: '#10B981',
    category: 'industry',
    description: 'Platform migration, omnichannel inventory, PCI-DSS payment compliance, and peak-season capacity.',
    axisLabels: ['Retail Model', 'Commerce Platform', 'Regulatory Region', 'Program Type'],
  },
  {
    id: 'appDev',
    label: 'App Development',
    shortLabel: 'App Dev',
    icon: Smartphone,
    accent: '#22C55E',
    category: 'appdev',
    description: 'Sprint-based web/mobile delivery — discovery through release and hypercare.',
    axisLabels: ['App Type', 'Frontend Stack', 'Backend Stack', 'Deployment Target'],
  },
];

export function getDomainMeta(id) {
  return DOMAINS.find(d => d.id === id) || DOMAINS[0];
}

export function getDomainsByCategory() {
  return CATEGORIES.map(cat => ({ ...cat, domains: DOMAINS.filter(d => d.category === cat.id) }));
}
