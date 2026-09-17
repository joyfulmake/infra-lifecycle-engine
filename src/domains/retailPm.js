// Retail / e-Commerce domain catalog — platform migration, omnichannel
// inventory, PCI-DSS payment compliance, and peak-season capacity programs.

export const incidents = [
  { code: 'rtl_inc_1', grp: 'E-Commerce', short: 'RTL-001', txt: 'RTL-001: Checkout API returning 500 errors during flash-sale traffic spike', layers: ['app', 'network'] },
  { code: 'rtl_inc_2', grp: 'E-Commerce', short: 'RTL-002', txt: 'RTL-002: Product catalog search index stale after bulk price update', layers: ['app', 'db'] },
  { code: 'rtl_inc_3', grp: 'POS', short: 'RTL-003', txt: 'RTL-003: In-store POS terminals losing connectivity to payment gateway', layers: ['network', 'app'] },
  { code: 'rtl_inc_4', grp: 'Inventory', short: 'RTL-004', txt: 'RTL-004: Omnichannel inventory showing in-stock for items sold out at DC', layers: ['app', 'db'] },
  { code: 'rtl_inc_5', grp: 'Payments', short: 'RTL-005', txt: 'RTL-005: PCI-DSS scan finds cardholder data logged in plaintext application logs', layers: ['security', 'app'] },
  { code: 'rtl_inc_6', grp: 'Warehouse', short: 'RTL-006', txt: 'RTL-006: WMS pick-pack workflow stalling during peak-season order volume', layers: ['app', 'db'] },
  { code: 'rtl_inc_7', grp: 'Loyalty', short: 'RTL-007', txt: 'RTL-007: Loyalty points not crediting after order completion webhook failure', layers: ['app', 'network'] },
  { code: 'rtl_inc_8', grp: 'Capacity', short: 'RTL-008', txt: 'RTL-008: CDN cache miss rate spiking, origin servers overloaded on peak day', layers: ['network', 'app'] },
];

export const fixes = {
  rtl_inc_1: 'Scale checkout service pods; enable queue-based load shedding.',
  rtl_inc_2: 'Trigger full search index rebuild; verify price feed pipeline.',
  rtl_inc_3: 'Restore POS network path to payment gateway; failover to backup processor.',
  rtl_inc_4: 'Resync inventory feed from DC; correct oversell buffer threshold.',
  rtl_inc_5: 'Remove PAN from logs; redeploy with tokenization/masking applied.',
  rtl_inc_6: 'Restart WMS workflow engine; rebalance pick-pack queue across stations.',
  rtl_inc_7: 'Replay failed webhook events; verify loyalty service idempotency.',
  rtl_inc_8: 'Adjust CDN cache rules; scale origin capacity for remainder of peak day.',
};

export const incidentFixTasks = {
  rtl_inc_1: [
    { role: 'E-Commerce Eng', name: 'Check checkout service pod utilization and error logs during spike', dep: '500 error spike detected', validate: 'Capacity bottleneck or code fault identified' },
    { role: 'E-Commerce Eng', name: 'Scale checkout service and enable load shedding for excess traffic', dep: 'Bottleneck identified', validate: 'Checkout success rate returns to baseline' },
  ],
  rtl_inc_2: [
    { role: 'E-Commerce Eng', name: 'Confirm search index staleness against latest price feed', dep: 'Stale prices reported', validate: 'Index lag and affected SKUs quantified' },
    { role: 'E-Commerce Eng', name: 'Trigger full index rebuild and verify price feed pipeline', dep: 'Lag quantified', validate: 'Search results show current prices' },
  ],
  rtl_inc_3: [
    { role: 'Store Systems Eng', name: 'Check POS network path and payment gateway connectivity', dep: 'Terminal connectivity loss reported', validate: 'Network segment or gateway fault identified' },
    { role: 'Store Systems Eng', name: 'Restore path or failover to backup payment processor', dep: 'Fault identified', validate: 'Terminals processing transactions normally' },
  ],
  rtl_inc_4: [
    { role: 'Inventory Systems Eng', name: 'Compare omnichannel inventory feed against DC actuals', dep: 'Oversell/phantom stock reported', validate: 'Feed lag or sync fault identified' },
    { role: 'Inventory Systems Eng', name: 'Resync inventory feed and correct oversell buffer', dep: 'Fault identified', validate: 'Displayed inventory matches DC actuals' },
  ],
  rtl_inc_5: [
    { role: 'PCI Compliance Lead', name: 'Confirm scope and duration of cardholder data found in application logs', dep: 'PCI scan finding reported', validate: 'Exposure scope documented' },
    { role: 'E-Commerce Eng', name: 'Remove PAN from logging and redeploy with masking/tokenization', dep: 'Exposure scope documented', validate: 'Re-scan confirms no cardholder data in logs' },
  ],
  rtl_inc_6: [
    { role: 'WMS Eng', name: 'Identify stalled workflow step and affected pick-pack stations', dep: 'Peak-volume stall reported', validate: 'Stalled step and cause identified' },
    { role: 'WMS Eng', name: 'Restart workflow engine and rebalance queue across stations', dep: 'Cause identified', validate: 'Pick-pack throughput returns to target rate' },
  ],
  rtl_inc_7: [
    { role: 'Loyalty Platform Eng', name: 'Identify failed order-completion webhook events', dep: 'Missing points credit reported', validate: 'Failed event batch identified' },
    { role: 'Loyalty Platform Eng', name: 'Replay failed events and verify idempotent crediting', dep: 'Failed batch identified', validate: 'Affected customers show correct point balance' },
  ],
  rtl_inc_8: [
    { role: 'Platform Eng', name: 'Check CDN cache hit rate and origin server load', dep: 'Origin overload reported on peak day', validate: 'Cache rule gap or traffic pattern identified' },
    { role: 'Platform Eng', name: 'Adjust CDN cache rules and scale origin capacity', dep: 'Gap identified', validate: 'Cache hit rate recovers; origin load stabilizes' },
  ],
};

export const uumItems = [
  { code: 'rtl_uum_1', grp: 'E-Commerce', short: 'ECM-001', txt: 'ECM-001: E-commerce platform migration (Shopify Plus/SFCC/Adobe Commerce)', layers: ['app', 'db'], type: 'migration' },
  { code: 'rtl_uum_2', grp: 'POS', short: 'POS-001', txt: 'POS-001: POS system upgrade across store fleet', layers: ['app', 'network'], type: 'upgrade' },
  { code: 'rtl_uum_3', grp: 'Inventory', short: 'INV-001', txt: 'INV-001: Omnichannel inventory unification (single view of stock)', layers: ['app', 'db'], type: 'migration' },
  { code: 'rtl_uum_4', grp: 'Payments', short: 'PCI-001', txt: 'PCI-001: PCI-DSS v4 compliance remediation for payment processing', layers: ['security', 'app'], type: 'update' },
  { code: 'rtl_uum_5', grp: 'Architecture', short: 'HDL-001', txt: 'HDL-001: Headless commerce architecture migration (API-first storefront)', layers: ['app'], type: 'migration' },
  { code: 'rtl_uum_6', grp: 'Warehouse', short: 'WMS-001', txt: 'WMS-001: Warehouse management system (WMS) implementation', layers: ['app', 'db'], type: 'migration' },
  { code: 'rtl_uum_7', grp: 'Loyalty', short: 'LOY-001', txt: 'LOY-001: Loyalty program platform implementation', layers: ['app'], type: 'migration' },
  { code: 'rtl_uum_8', grp: 'Capacity', short: 'CAP-001', txt: 'CAP-001: Peak-season (Black Friday) capacity planning and load test', layers: ['network', 'app'], type: 'update' },
];

export const uumTasks = {
  rtl_uum_1: [
    { role: 'E-Commerce Eng', name: 'Map current catalog, pricing, and promotion rules to target platform', dep: 'Target platform selected', validate: 'Data model mapping signed off by Merchandising', window: 'Working hours', est_hours: 16 },
    { role: 'E-Commerce Eng', name: 'Build storefront on target platform and run parallel UAT', dep: 'Mapping approved', validate: 'UAT storefront passes full checkout regression', window: 'Working hours', est_hours: 40 },
    { role: 'E-Commerce Eng', name: 'Cut over DNS/traffic to new platform', dep: 'UAT signed off', validate: 'Live traffic processes orders correctly on new platform', window: 'Weekend window', est_hours: 8 },
  ],
  rtl_uum_2: [
    { role: 'Store Systems Eng', name: 'Pilot new POS software/hardware in one store', dep: 'Target POS platform selected', validate: 'Pilot store processes transactions without incident for 1 week' },
    { role: 'Store Systems Eng', name: 'Roll out upgrade across store fleet in waves', dep: 'Pilot signed off', validate: 'All stores upgraded; transaction success rate at baseline' },
  ],
  rtl_uum_3: [
    { role: 'Inventory Systems Eng', name: 'Design unified inventory data model across channels (store/DC/3PL)', dep: 'Current inventory sources documented', validate: 'Data model approved by Supply Chain' },
    { role: 'Inventory Systems Eng', name: 'Build real-time sync pipeline and validate accuracy against physical counts', dep: 'Data model approved', validate: 'Unified view matches physical count within tolerance' },
  ],
  rtl_uum_4: [
    { role: 'PCI Compliance Lead', name: 'Run gap assessment against PCI-DSS v4 requirements', dep: 'Current CDE scope documented', validate: 'Gap list produced and prioritized' },
    { role: 'E-Commerce Eng', name: 'Remediate tokenization, logging, and segmentation gaps', dep: 'Gap list prioritized', validate: 'Remediation verified by internal scan' },
    { role: 'PCI Compliance Lead', name: 'Complete QSA assessment for v4 attestation', dep: 'Remediation complete', validate: 'QSA issues v4 Attestation of Compliance' },
  ],
  rtl_uum_5: [
    { role: 'E-Commerce Eng', name: 'Define API contract for headless storefront (product, cart, checkout)', dep: 'Target frontend framework selected', validate: 'API contract reviewed and approved' },
    { role: 'Frontend Eng', name: 'Build storefront against API and run performance/regression test', dep: 'API contract available', validate: 'Storefront passes performance budget and regression suite' },
  ],
  rtl_uum_6: [
    { role: 'WMS Eng', name: 'Configure WMS workflows (receiving, putaway, pick-pack, ship)', dep: 'Warehouse layout and process documented', validate: 'Workflows validated in test warehouse' },
    { role: 'WMS Eng', name: 'Go live in pilot warehouse and monitor throughput', dep: 'Workflows validated', validate: 'Pilot warehouse meets throughput targets for 2 weeks' },
  ],
  rtl_uum_7: [
    { role: 'Loyalty Platform Eng', name: 'Integrate loyalty platform with order and POS systems', dep: 'Loyalty platform provisioned', validate: 'Points accrue correctly across online and in-store orders' },
    { role: 'Loyalty Platform Eng', name: 'Launch to full customer base with migration of existing point balances', dep: 'Integration validated', validate: 'Existing balances migrated accurately; new accruals correct' },
  ],
  rtl_uum_8: [
    { role: 'Platform Eng', name: 'Run load test simulating projected peak-day traffic', dep: 'Peak-day traffic projection available', validate: 'Load test identifies bottlenecks against target capacity' },
    { role: 'Platform Eng', name: 'Remediate bottlenecks and scale infrastructure ahead of peak', dep: 'Bottlenecks identified', validate: 'Re-test passes at target capacity with headroom' },
  ],
};

export const designSections = [
  { key: 'ecommerce', label: 'E-Commerce Platform', owner: 'E-Commerce Eng', fields: ['platform', 'catalog_model', 'checkout_flow', 'notes'] },
  { key: 'pos', label: 'POS', owner: 'Store Systems Eng', fields: ['pos_platform', 'payment_processor', 'store_count_in_scope', 'notes'] },
  { key: 'inventory', label: 'Inventory', owner: 'Inventory Systems Eng', fields: ['inventory_model', 'sync_frequency', 'oversell_buffer', 'notes'] },
  { key: 'payments', label: 'Payments & Compliance', owner: 'PCI Compliance Lead', fields: ['pci_scope', 'tokenization_method', 'fraud_platform', 'notes'] },
  { key: 'warehouse', label: 'Warehouse', owner: 'WMS Eng', fields: ['wms_platform', 'fulfillment_model', 'carrier_integrations', 'notes'] },
  { key: 'capacity', label: 'Capacity & Peak Planning', owner: 'Platform Eng', fields: ['peak_traffic_target', 'cdn_strategy', 'autoscaling_policy', 'notes'] },
];

export const fieldLabels = {
  platform: 'E-Commerce Platform', catalog_model: 'Catalog Data Model', checkout_flow: 'Checkout Flow Design',
  pos_platform: 'POS Platform', payment_processor: 'Payment Processor', store_count_in_scope: 'Store Count in Scope',
  inventory_model: 'Inventory Model (Unified/Siloed)', sync_frequency: 'Sync Frequency', oversell_buffer: 'Oversell Buffer Policy',
  pci_scope: 'PCI-DSS Scope', tokenization_method: 'Tokenization Method', fraud_platform: 'Fraud Detection Platform',
  wms_platform: 'WMS Platform', fulfillment_model: 'Fulfillment Model (DC/3PL/Dropship)', carrier_integrations: 'Carrier Integrations',
  peak_traffic_target: 'Peak Traffic Target (req/s)', cdn_strategy: 'CDN Strategy', autoscaling_policy: 'Autoscaling Policy',
  notes: 'Notes / Comments',
};

export const axisOptions = [
  ['Pure-Play E-Commerce', 'Omnichannel Retailer', 'Brick-and-Mortar + Online', 'Marketplace Seller', 'D2C Brand'],
  ['Shopify Plus', 'Salesforce Commerce Cloud', 'Adobe Commerce (Magento)', 'BigCommerce', 'Custom / Headless'],
  ['North America', 'EU (GDPR + VAT)', 'UK', 'APAC', 'Global Multi-Region'],
  ['Standard Operations', 'Peak Season (Black Friday/Holiday)', 'New Market Launch', 'Platform Replatform'],
];
