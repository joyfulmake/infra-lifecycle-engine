// DevOps / Platform Engineering domain catalog — platform charter through
// GA: toolchain design, pipeline build, environment provisioning, developer
// onboarding, SLO baseline. Shape mirrors infra's ALL_INC/ALL_UUM/
// getRealTasks/DESIGN_SECTIONS exactly (see src/domains/applyDomain.js for
// how this plugs in).

export const incidents = [
  { code: 'dv_inc_1', grp: 'CI/CD', short: 'DV-001', txt: 'DV-001: CI pipeline queue backlog blocking all merges to main', layers: ['app'] },
  { code: 'dv_inc_2', grp: 'CI/CD', short: 'DV-002', txt: 'DV-002: Deployment pipeline stuck mid-rollout, workloads in mixed version state', layers: ['app', 'compute'] },
  { code: 'dv_inc_3', grp: 'Kubernetes', short: 'DV-003', txt: 'DV-003: Cluster node pool autoscaler failing to scale under load spike', layers: ['compute'] },
  { code: 'dv_inc_4', grp: 'Kubernetes', short: 'DV-004', txt: 'DV-004: Pods stuck in CrashLoopBackOff after ConfigMap rollout', layers: ['app', 'compute'] },
  { code: 'dv_inc_5', grp: 'GitOps', short: 'DV-005', txt: 'DV-005: ArgoCD/Flux sync drift — cluster state diverged from Git source of truth', layers: ['app'] },
  { code: 'dv_inc_6', grp: 'Observability', short: 'DV-006', txt: 'DV-006: Prometheus scrape targets down, SLO dashboards showing stale data', layers: ['app', 'network'] },
  { code: 'dv_inc_7', grp: 'Secrets', short: 'DV-007', txt: 'DV-007: Vault seal event — all pipeline secret lookups failing', layers: ['security'] },
  { code: 'dv_inc_8', grp: 'IaC', short: 'DV-008', txt: 'DV-008: Terraform state lock stuck after a failed apply, blocking all infra changes', layers: ['compute', 'network'] },
];

export const fixes = {
  dv_inc_1: 'Scale CI runners horizontally; clear stuck jobs from the queue.',
  dv_inc_2: 'Pause rollout, roll back to last known-good revision, resume once root cause fixed.',
  dv_inc_3: 'Manually scale node pool; investigate autoscaler quota/API throttling.',
  dv_inc_4: 'Roll back ConfigMap; validate new config in a canary pod before re-applying.',
  dv_inc_5: 'Force sync from Git; investigate and revert the out-of-band cluster change.',
  dv_inc_6: 'Restart scrape targets/exporters; verify service discovery config.',
  dv_inc_7: 'Unseal Vault with quorum of unseal keys; rotate seal key post-incident.',
  dv_inc_8: 'Force-unlock Terraform state after confirming no concurrent apply is running.',
};

export const incidentFixTasks = {
  dv_inc_1: [
    { role: 'Platform Eng', name: 'Check CI runner utilization and queue depth', dep: 'Merge backlog reported', validate: 'Bottleneck confirmed as runner capacity' },
    { role: 'Platform Eng', name: 'Scale runners horizontally and clear stuck jobs', dep: 'Bottleneck confirmed', validate: 'Queue drains; new merges pick up within SLA' },
  ],
  dv_inc_2: [
    { role: 'Platform Eng', name: 'Identify stuck rollout stage and affected workload versions', dep: 'Mixed-version state detected', validate: 'Stuck stage and blast radius identified' },
    { role: 'Platform Eng', name: 'Roll back to last known-good revision', dep: 'Blast radius identified', validate: 'All replicas on consistent, known-good version' },
  ],
  dv_inc_3: [
    { role: 'SRE', name: 'Check autoscaler logs and cloud provider quota/API throttling', dep: 'Scale failure under load reported', validate: 'Root cause identified (quota, throttling, or config)' },
    { role: 'SRE', name: 'Manually scale node pool and raise quota if needed', dep: 'Root cause identified', validate: 'Node pool scaled; workload scheduling recovers' },
  ],
  dv_inc_4: [
    { role: 'Platform Eng', name: 'Review pod logs and diff new ConfigMap against last-known-good', dep: 'CrashLoopBackOff detected', validate: 'Breaking config change identified' },
    { role: 'Platform Eng', name: 'Roll back ConfigMap and validate in canary before re-applying', dep: 'Breaking change identified', validate: 'Pods healthy; canary validates fixed config' },
  ],
  dv_inc_5: [
    { role: 'Platform Eng', name: 'Diff live cluster state against Git source of truth', dep: 'Sync drift alert fired', validate: 'Drifted resources identified' },
    { role: 'Platform Eng', name: 'Force sync from Git and investigate out-of-band change', dep: 'Drifted resources identified', validate: 'Cluster state matches Git; offending change reverted or committed' },
  ],
  dv_inc_6: [
    { role: 'SRE', name: 'Check exporter/service-discovery health for down scrape targets', dep: 'Stale dashboard data reported', validate: 'Down targets identified' },
    { role: 'SRE', name: 'Restart exporters and verify service discovery config', dep: 'Down targets identified', validate: 'Scrape targets healthy; dashboards show live data' },
  ],
  dv_inc_7: [
    { role: 'Platform Eng', name: 'Confirm Vault seal status and identify seal cause', dep: 'Pipeline secret lookups failing', validate: 'Seal event confirmed and cause identified' },
    { role: 'Platform Eng', name: 'Unseal with quorum of unseal keys', dep: 'Seal cause identified', validate: 'Vault unsealed; secret lookups succeed' },
  ],
  dv_inc_8: [
    { role: 'Platform Eng', name: 'Confirm no concurrent Terraform apply is actually running', dep: 'State lock stuck reported', validate: 'No live apply process confirmed' },
    { role: 'Platform Eng', name: 'Force-unlock state and re-run apply', dep: 'No live process confirmed', validate: 'Apply completes cleanly; state lock released normally' },
  ],
};

export const uumItems = [
  { code: 'dv_uum_1', grp: 'Toolchain', short: 'PLT-001', txt: 'PLT-001: Stand up CI/CD toolchain (GitHub Actions/GitLab CI/Jenkins)', layers: ['app'], type: 'migration' },
  { code: 'dv_uum_2', grp: 'Platform', short: 'PLT-002', txt: 'PLT-002: Kubernetes cluster build-out (control plane + node pools)', layers: ['compute', 'network'], type: 'migration' },
  { code: 'dv_uum_3', grp: 'IaC', short: 'PLT-003', txt: 'PLT-003: Terraform module library and remote state backend setup', layers: ['compute'], type: 'migration' },
  { code: 'dv_uum_4', grp: 'GitOps', short: 'PLT-004', txt: 'PLT-004: GitOps rollout — ArgoCD/Flux continuous deployment', layers: ['app'], type: 'migration' },
  { code: 'dv_uum_5', grp: 'Observability', short: 'PLT-005', txt: 'PLT-005: Observability stack deployment (Prometheus/Grafana/Datadog)', layers: ['app', 'network'], type: 'migration' },
  { code: 'dv_uum_6', grp: 'Secrets', short: 'PLT-006', txt: 'PLT-006: Centralized secrets management rollout (Vault)', layers: ['security'], type: 'migration' },
  { code: 'dv_uum_7', grp: 'Developer Experience', short: 'PLT-007', txt: 'PLT-007: Developer self-service portal (Backstage) launch', layers: ['app'], type: 'migration' },
  { code: 'dv_uum_8', grp: 'SLO', short: 'PLT-008', txt: 'PLT-008: SLO/error-budget baseline definition for GA services', layers: ['app'], type: 'update' },
];

export const uumTasks = {
  dv_uum_1: [
    { role: 'Platform Eng', name: 'Select CI/CD tool and design pipeline templates', dep: 'Platform charter approved', validate: 'Pipeline template reviewed and approved by team leads', window: 'Working hours', est_hours: 8 },
    { role: 'Platform Eng', name: 'Onboard first pilot repository to new pipeline', dep: 'Pipeline template approved', validate: 'Pilot repo builds, tests, and deploys successfully', window: 'Working hours', est_hours: 6 },
    { role: 'Platform Eng', name: 'Roll out pipeline templates to remaining repositories', dep: 'Pilot signed off', validate: 'All target repos migrated and green', window: 'Working hours', est_hours: 16 },
  ],
  dv_uum_2: [
    { role: 'Platform Eng', name: 'Provision control plane and initial node pools', dep: 'Cluster sizing and network design approved', validate: 'Cluster healthy; nodes report Ready', window: 'Working hours', est_hours: 8 },
    { role: 'Platform Eng', name: 'Configure autoscaling, RBAC, and network policies', dep: 'Cluster provisioned', validate: 'Autoscaler test-scales successfully; RBAC least-privilege verified', window: 'Working hours', est_hours: 6 },
    { role: 'SRE', name: 'Run cluster conformance and failure-injection tests', dep: 'Autoscaling and RBAC configured', validate: 'Conformance suite passes; node failure recovers automatically' },
  ],
  dv_uum_3: [
    { role: 'Platform Eng', name: 'Design module structure and remote state backend', dep: 'Cloud accounts/subscriptions provisioned', validate: 'Module structure and state backend peer-reviewed', window: 'Working hours', est_hours: 6 },
    { role: 'Platform Eng', name: 'Migrate first environment to managed IaC', dep: 'Module library ready', validate: 'Environment fully defined as code; plan shows zero drift' },
  ],
  dv_uum_4: [
    { role: 'Platform Eng', name: 'Install GitOps controller and connect to Git source of truth', dep: 'Kubernetes cluster available', validate: 'Controller syncing test application successfully', window: 'Working hours', est_hours: 4 },
    { role: 'Platform Eng', name: 'Migrate production workloads to GitOps-managed deployment', dep: 'Controller validated on test app', validate: 'All target workloads deploy exclusively via Git; manual kubectl applies eliminated' },
  ],
  dv_uum_5: [
    { role: 'SRE', name: 'Deploy metrics/logging/tracing stack and configure scrape targets', dep: 'Kubernetes cluster available', validate: 'Metrics flowing; dashboards render for pilot service', window: 'Working hours', est_hours: 8 },
    { role: 'SRE', name: 'Define alerting rules and on-call routing', dep: 'Metrics pipeline live', validate: 'Test alert fires and routes correctly to on-call' },
  ],
  dv_uum_6: [
    { role: 'Platform Eng', name: 'Deploy Vault cluster and configure auto-unseal', dep: 'Security review of secrets architecture complete', validate: 'Vault healthy and auto-unseal tested' },
    { role: 'Platform Eng', name: 'Migrate pipeline/application secrets from legacy store to Vault', dep: 'Vault operational', validate: 'All target secrets migrated; legacy store references removed' },
  ],
  dv_uum_7: [
    { role: 'Platform Eng', name: 'Deploy portal and integrate service catalog with CI/CD and cluster APIs', dep: 'CI/CD and Kubernetes platform live', validate: 'Portal shows accurate service catalog and golden-path templates' },
    { role: 'Platform Eng', name: 'Onboard pilot team and gather feedback', dep: 'Portal deployed', validate: 'Pilot team completes a self-service deployment without platform team assistance' },
  ],
  dv_uum_8: [
    { role: 'SRE', name: 'Define SLIs and target SLOs per GA service with service owners', dep: 'Observability stack live with historical data', validate: 'SLOs agreed and documented per service' },
    { role: 'SRE', name: 'Configure error-budget burn-rate alerts', dep: 'SLOs defined', validate: 'Burn-rate alert fires correctly in a simulated breach' },
  ],
};

export const designSections = [
  { key: 'toolchain', label: 'CI/CD Toolchain', owner: 'Platform Eng', fields: ['ci_tool', 'pipeline_template', 'branch_strategy', 'artifact_registry', 'notes'] },
  { key: 'platform', label: 'Platform / Kubernetes', owner: 'Platform Eng', fields: ['cluster_topology', 'node_pool_strategy', 'autoscaling_policy', 'rbac_model', 'notes'] },
  { key: 'iac', label: 'Infrastructure as Code', owner: 'Platform Eng', fields: ['iac_tool', 'state_backend', 'module_structure', 'notes'] },
  { key: 'observability', label: 'Observability', owner: 'SRE', fields: ['metrics_stack', 'logging_stack', 'alerting_tool', 'oncall_routing', 'notes'] },
  { key: 'security', label: 'Secrets & Security', owner: 'Platform Eng', fields: ['secrets_tool', 'scanning_gate', 'network_policy', 'notes'] },
  { key: 'slo', label: 'SLO / Reliability', owner: 'SRE', fields: ['slo_targets', 'error_budget_policy', 'oncall_model', 'notes'] },
];

export const fieldLabels = {
  ci_tool: 'CI/CD Tool', pipeline_template: 'Pipeline Template', branch_strategy: 'Branching Strategy', artifact_registry: 'Artifact Registry',
  cluster_topology: 'Cluster Topology', node_pool_strategy: 'Node Pool Strategy', autoscaling_policy: 'Autoscaling Policy', rbac_model: 'RBAC Model',
  iac_tool: 'IaC Tool', state_backend: 'State Backend', module_structure: 'Module Structure',
  metrics_stack: 'Metrics Stack', logging_stack: 'Logging Stack', alerting_tool: 'Alerting Tool', oncall_routing: 'On-Call Routing',
  secrets_tool: 'Secrets Management Tool', scanning_gate: 'Security Scanning Gate', network_policy: 'Network Policy',
  slo_targets: 'SLO Targets', error_budget_policy: 'Error Budget Policy', oncall_model: 'On-Call Model',
  notes: 'Notes / Comments',
};

export const axisOptions = [
  ['Startup / Greenfield', 'Enterprise / Existing Estate', 'Regulated Enterprise', 'Multi-Team Platform'],
  ['GitHub Actions', 'GitLab CI', 'Jenkins', 'CircleCI', 'Azure DevOps'],
  ['Kubernetes (Self-Managed)', 'EKS', 'AKS', 'GKE', 'Nomad', 'ECS'],
  ['Terraform', 'Pulumi', 'CloudFormation', 'Crossplane'],
];
