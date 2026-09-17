// Data & Analytics domain catalog — data warehouse/lake migration, ETL/ELT
// pipeline builds, BI rollout, governance, MDM, and streaming programs.
// Shape mirrors infra's ALL_INC/ALL_UUM/getRealTasks/DESIGN_SECTIONS
// exactly (see src/domains/applyDomain.js for how this plugs in).

export const incidents = [
  { code: 'da_inc_1', grp: 'Pipeline', short: 'DA-001', txt: 'DA-001: Airflow DAG stuck in retry loop blocking downstream nightly load', layers: ['app'] },
  { code: 'da_inc_2', grp: 'Pipeline', short: 'DA-002', txt: 'DA-002: dbt model failure due to upstream schema drift', layers: ['app', 'db'] },
  { code: 'da_inc_3', grp: 'Warehouse', short: 'DA-003', txt: 'DA-003: Snowflake/BigQuery warehouse cost spike from an unbounded query', layers: ['db'] },
  { code: 'da_inc_4', grp: 'Warehouse', short: 'DA-004', txt: 'DA-004: Warehouse concurrency limit reached during month-end reporting', layers: ['db'] },
  { code: 'da_inc_5', grp: 'Data Quality', short: 'DA-005', txt: 'DA-005: Duplicate customer records detected post-MDM merge job', layers: ['db'] },
  { code: 'da_inc_6', grp: 'Streaming', short: 'DA-006', txt: 'DA-006: Kafka consumer group lag growing unbounded on high-volume topic', layers: ['app', 'network'] },
  { code: 'da_inc_7', grp: 'BI / Reporting', short: 'DA-007', txt: 'DA-007: BI dashboard showing stale data after extract refresh failure', layers: ['app'] },
  { code: 'da_inc_8', grp: 'Governance', short: 'DA-008', txt: 'DA-008: Sensitive PII column found unmasked in a shared reporting schema', layers: ['db', 'security'] },
];

export const fixes = {
  da_inc_1: 'Clear stuck task instance; add timeout and circuit breaker to the DAG task.',
  da_inc_2: 'Update dbt model to handle new schema; add source freshness/schema test to catch drift earlier.',
  da_inc_3: 'Kill runaway query; apply warehouse resource monitor/budget alert.',
  da_inc_4: 'Scale warehouse size or add a dedicated reporting warehouse; queue non-critical jobs.',
  da_inc_5: 'Re-run dedup/match rules with corrected logic; manually merge affected golden records.',
  da_inc_6: 'Scale consumer group partitions/instances; investigate slow consumer processing.',
  da_inc_7: 'Re-run failed extract; add monitoring/alerting on extract job success.',
  da_inc_8: 'Apply column-level masking/RLS policy immediately; audit access logs for exposure window.',
};

export const incidentFixTasks = {
  da_inc_1: [
    { role: 'Data Eng', name: 'Inspect DAG task logs to find retry loop cause', dep: 'Nightly load delay alert fired', validate: 'Root cause identified (bad data, resource limit, or dependency)' },
    { role: 'Data Eng', name: 'Clear stuck task instance and add timeout/circuit breaker', dep: 'Root cause identified', validate: 'DAG completes; downstream load unblocked' },
  ],
  da_inc_2: [
    { role: 'Analytics Eng', name: 'Identify schema drift from upstream source vs dbt model expectation', dep: 'dbt run failure reported', validate: 'Drifted column(s) identified' },
    { role: 'Analytics Eng', name: 'Update dbt model and add source freshness/schema test', dep: 'Drift identified', validate: 'dbt run passes; schema test catches future drift' },
  ],
  da_inc_3: [
    { role: 'Data Platform Eng', name: 'Identify runaway query from warehouse query history', dep: 'Cost spike alert fired', validate: 'Offending query and user/service identified' },
    { role: 'Data Platform Eng', name: 'Kill query and apply resource monitor/budget alert', dep: 'Query identified', validate: 'Cost trend returns to baseline; monitor active' },
  ],
  da_inc_4: [
    { role: 'Data Platform Eng', name: 'Review concurrency queue during month-end window', dep: 'Reporting team reports slow queries', validate: 'Concurrency bottleneck confirmed' },
    { role: 'Data Platform Eng', name: 'Scale warehouse or provision dedicated reporting warehouse', dep: 'Bottleneck confirmed', validate: 'Month-end queries complete within SLA' },
  ],
  da_inc_5: [
    { role: 'Data Quality Eng', name: 'Identify scope of duplicate records from MDM merge job log', dep: 'Duplicates reported by business user', validate: 'Affected record set and root cause identified' },
    { role: 'Data Quality Eng', name: 'Correct match/merge rules and re-run for affected records', dep: 'Root cause identified', validate: 'Golden records deduplicated; business confirms accuracy' },
  ],
  da_inc_6: [
    { role: 'Data Eng', name: 'Check consumer group lag metrics and partition distribution', dep: 'Lag alert fired', validate: 'Slow consumer or under-partitioned topic identified' },
    { role: 'Data Eng', name: 'Scale consumer instances/partitions or optimize processing', dep: 'Cause identified', validate: 'Lag trending back to near-zero' },
  ],
  da_inc_7: [
    { role: 'BI Developer', name: 'Check extract/refresh job logs for failure point', dep: 'Stale dashboard reported', validate: 'Extract failure cause identified' },
    { role: 'BI Developer', name: 'Re-run extract and add job success/failure alerting', dep: 'Cause identified', validate: 'Dashboard shows current data; alert active for future failures' },
  ],
  da_inc_8: [
    { role: 'Data Governance Analyst', name: 'Confirm scope of unmasked PII column and who has accessed it', dep: 'Exposure reported', validate: 'Exposure scope and access log reviewed' },
    { role: 'Data Governance Analyst', name: 'Apply column-level masking/RLS policy', dep: 'Exposure scope documented', validate: 'Column masked for all non-authorized roles; policy verified' },
  ],
};

export const uumItems = [
  { code: 'da_uum_1', grp: 'Warehouse', short: 'DWH-001', txt: 'DWH-001: Data warehouse migration to cloud platform (Snowflake/Databricks/BigQuery)', layers: ['db'], type: 'migration' },
  { code: 'da_uum_2', grp: 'Pipeline', short: 'ETL-001', txt: 'ETL-001: ETL/ELT pipeline build on orchestration platform (Airflow/dbt/Fivetran)', layers: ['app'], type: 'migration' },
  { code: 'da_uum_3', grp: 'Lake', short: 'LAKE-001', txt: 'LAKE-001: Data lake architecture build with medallion (bronze/silver/gold) layering', layers: ['db', 'storage'], type: 'migration' },
  { code: 'da_uum_4', grp: 'BI', short: 'BI-001', txt: 'BI-001: BI tool rollout (Tableau/Power BI/Looker) replacing legacy reporting', layers: ['app'], type: 'migration' },
  { code: 'da_uum_5', grp: 'Governance', short: 'GOV-001', txt: 'GOV-001: Data governance and catalog rollout (Collibra/Alation)', layers: ['app', 'db'], type: 'migration' },
  { code: 'da_uum_6', grp: 'MDM', short: 'MDM-001', txt: 'MDM-001: Master data management program for customer/product golden records', layers: ['db'], type: 'migration' },
  { code: 'da_uum_7', grp: 'Streaming', short: 'STR-001', txt: 'STR-001: Real-time streaming pipeline build on Kafka', layers: ['app', 'network'], type: 'migration' },
  { code: 'da_uum_8', grp: 'Data Quality', short: 'DQ-001', txt: 'DQ-001: Data quality monitoring framework rollout (Great Expectations/Monte Carlo)', layers: ['app'], type: 'update' },
];

export const uumTasks = {
  da_uum_1: [
    { role: 'Data Architect', name: 'Design target warehouse schema and workload isolation strategy', dep: 'Target platform selected', validate: 'Schema and workload design peer-reviewed', window: 'Working hours', est_hours: 8 },
    { role: 'Data Eng', name: 'Migrate historical data with validation checksums', dep: 'Target schema provisioned', validate: 'Row counts and checksums match source', window: 'Working hours', est_hours: 16 },
    { role: 'Analytics Eng', name: 'Cut over reporting/BI connections to new warehouse', dep: 'Data migration validated', validate: 'All downstream reports reproduce source-system results', window: 'Weekend window', est_hours: 6 },
  ],
  da_uum_2: [
    { role: 'Data Eng', name: 'Build source connectors and land raw data (bronze layer)', dep: 'Source system access and credentials confirmed', validate: 'Raw data landing successfully on schedule', window: 'Working hours', est_hours: 12 },
    { role: 'Analytics Eng', name: 'Build transformation models (dbt) for silver/gold layers', dep: 'Raw data landing validated', validate: 'Transformation tests pass; output matches business logic', window: 'Working hours', est_hours: 16 },
    { role: 'Data Eng', name: 'Schedule and monitor pipeline in production orchestrator', dep: 'Transformations validated', validate: 'Pipeline runs on schedule with alerting active', window: 'Working hours', est_hours: 4 },
  ],
  da_uum_3: [
    { role: 'Data Architect', name: 'Design medallion layer structure and access zones', dep: 'Lake storage platform provisioned', validate: 'Layer design peer-reviewed and approved' },
    { role: 'Data Eng', name: 'Implement bronze/silver/gold ingestion and transformation jobs', dep: 'Layer design approved', validate: 'Data flows correctly through all three layers with quality checks' },
  ],
  da_uum_4: [
    { role: 'BI Developer', name: 'Rebuild top-priority legacy reports in new BI tool', dep: 'BI tool provisioned and connected to warehouse', validate: 'Rebuilt reports reconcile against legacy report output', window: 'Working hours', est_hours: 16 },
    { role: 'BI Developer', name: 'Roll out to business users with training', dep: 'Priority reports signed off', validate: 'User adoption tracked; legacy tool usage declining' },
  ],
  da_uum_5: [
    { role: 'Data Governance Analyst', name: 'Onboard priority data domains into catalog with ownership tags', dep: 'Catalog platform provisioned', validate: 'Priority domains cataloged with assigned data owners' },
    { role: 'Data Governance Analyst', name: 'Define and publish data classification and access policies', dep: 'Domains cataloged', validate: 'Policies approved and enforced for at least one domain' },
  ],
  da_uum_6: [
    { role: 'Data Quality Eng', name: 'Define match/merge rules for golden record creation', dep: 'Source systems and survivorship rules agreed with business', validate: 'Match rules validated against sample data set' },
    { role: 'Data Quality Eng', name: 'Run initial golden record build and reconcile with source systems', dep: 'Match rules validated', validate: 'Golden records reconcile; duplicate rate below target threshold' },
  ],
  da_uum_7: [
    { role: 'Data Eng', name: 'Provision Kafka cluster/topics with partitioning strategy', dep: 'Throughput and retention requirements confirmed', validate: 'Cluster passes load test at expected volume', window: 'Working hours', est_hours: 8 },
    { role: 'Data Eng', name: 'Build and deploy producer/consumer applications', dep: 'Cluster provisioned', validate: 'End-to-end message flow verified with expected latency' },
  ],
  da_uum_8: [
    { role: 'Data Quality Eng', name: 'Define data quality rules/expectations for priority tables', dep: 'Priority tables identified with business', validate: 'Rules validated against known-good and known-bad data' },
    { role: 'Data Quality Eng', name: 'Deploy monitoring with alerting on rule failures', dep: 'Rules validated', validate: 'Alerts fire correctly on injected test failures' },
  ],
};

export const designSections = [
  { key: 'warehouse', label: 'Warehouse / Lake', owner: 'Data Architect', fields: ['platform', 'schema_design', 'workload_isolation', 'storage_tiering', 'notes'] },
  { key: 'pipeline', label: 'Pipeline / Orchestration', owner: 'Data Eng', fields: ['orchestration_tool', 'ingestion_pattern', 'transformation_tool', 'notes'] },
  { key: 'bi', label: 'BI / Reporting', owner: 'BI Developer', fields: ['bi_tool', 'semantic_layer', 'refresh_schedule', 'notes'] },
  { key: 'governance', label: 'Governance', owner: 'Data Governance Analyst', fields: ['catalog_tool', 'classification_policy', 'data_ownership_model', 'notes'] },
  { key: 'quality', label: 'Data Quality', owner: 'Data Quality Eng', fields: ['quality_framework', 'monitoring_scope', 'sla_targets', 'notes'] },
  { key: 'streaming', label: 'Streaming', owner: 'Data Eng', fields: ['streaming_platform', 'partitioning_strategy', 'retention_policy', 'notes'] },
];

export const fieldLabels = {
  platform: 'Target Platform', schema_design: 'Schema Design', workload_isolation: 'Workload Isolation Strategy', storage_tiering: 'Storage Tiering Policy',
  orchestration_tool: 'Orchestration Tool', ingestion_pattern: 'Ingestion Pattern (Batch/CDC/Streaming)', transformation_tool: 'Transformation Tool',
  bi_tool: 'BI Tool', semantic_layer: 'Semantic Layer / Metrics Model', refresh_schedule: 'Refresh Schedule',
  catalog_tool: 'Data Catalog Tool', classification_policy: 'Data Classification Policy', data_ownership_model: 'Data Ownership Model',
  quality_framework: 'Data Quality Framework', monitoring_scope: 'Monitoring Scope (Tables/Domains)', sla_targets: 'Data SLA Targets',
  streaming_platform: 'Streaming Platform', partitioning_strategy: 'Partitioning Strategy', retention_policy: 'Retention Policy',
  notes: 'Notes / Comments',
};

export const axisOptions = [
  ['Snowflake', 'Databricks', 'Google BigQuery', 'Amazon Redshift', 'Azure Synapse'],
  ['Airflow', 'dbt Cloud', 'Fivetran', 'Azure Data Factory', 'AWS Glue'],
  ['Batch (Nightly)', 'Micro-Batch', 'CDC (Change Data Capture)', 'Real-Time Streaming'],
  ['Tableau', 'Power BI', 'Looker', 'Sigma', 'Custom / Embedded Analytics'],
];
