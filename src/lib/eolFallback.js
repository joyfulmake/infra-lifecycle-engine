// Bundled EOL data for the most common enterprise stack components.
// Used when the live API and localStorage cache are both unavailable (offline, API down).
// Sourced from endoflife.date — update quarterly or trigger a rebuild when dates change.
// Last verified: June 2026.

export const STATIC_EOL = {
  rhel: [
    { cycle: '9',   releaseDate: '2022-05-17', support: '2027-05-31', eol: '2032-05-31', latest: '9.4',   lts: true,  extendedSupport: '2035-05-31' },
    { cycle: '8',   releaseDate: '2019-05-07', support: '2024-05-31', eol: '2029-05-31', latest: '8.10',  lts: true,  extendedSupport: '2032-05-31' },
    { cycle: '7',   releaseDate: '2014-06-10', support: '2019-08-06', eol: '2024-06-30', latest: '7.9',   lts: false, extendedSupport: '2028-06-30' },
  ],
  ubuntu: [
    { cycle: '24.04', releaseDate: '2024-04-25', support: '2029-04-25', eol: '2034-04-25', latest: '24.04.1', lts: true, extendedSupport: '2036-04-25' },
    { cycle: '22.04', releaseDate: '2022-04-21', support: '2027-04-01', eol: '2032-04-01', latest: '22.04.4', lts: true, extendedSupport: '2034-04-01' },
    { cycle: '20.04', releaseDate: '2020-04-23', support: '2025-04-02', eol: '2030-04-02', latest: '20.04.6', lts: true, extendedSupport: '2032-04-02' },
  ],
  aix: [
    { cycle: '7.3', releaseDate: '2022-01-28', support: '2026-01-28', eol: '2029-01-28', latest: '7.3.0', lts: false },
    { cycle: '7.2', releaseDate: '2015-12-04', support: '2022-10-01', eol: '2027-04-30', latest: '7.2.5', lts: false },
    { cycle: '7.1', releaseDate: '2010-09-10', support: '2018-04-30', eol: '2023-04-30', latest: '7.1.5', lts: false },
  ],
  'oracle-database': [
    { cycle: '21c', releaseDate: '2021-01-01', support: '2024-04-30', eol: '2027-04-30', latest: '21.14', lts: false, extendedSupport: '2030-04-30' },
    { cycle: '19c', releaseDate: '2019-04-01', support: '2024-04-30', eol: '2027-04-30', latest: '19.23', lts: true,  extendedSupport: '2030-04-30' },
  ],
  postgresql: [
    { cycle: '16', releaseDate: '2023-09-14', support: '2028-11-09', eol: '2028-11-09', latest: '16.3', lts: false },
    { cycle: '15', releaseDate: '2022-10-13', support: '2027-11-11', eol: '2027-11-11', latest: '15.7', lts: false },
    { cycle: '14', releaseDate: '2021-09-30', support: '2026-11-12', eol: '2026-11-12', latest: '14.12', lts: false },
    { cycle: '13', releaseDate: '2020-09-24', support: '2025-11-13', eol: '2025-11-13', latest: '13.15', lts: false },
  ],
  mysql: [
    { cycle: '8.4', releaseDate: '2024-04-30', support: '2026-04-30', eol: '2032-04-30', latest: '8.4.0', lts: true },
    { cycle: '8.0', releaseDate: '2018-04-19', support: '2023-10-31', eol: '2026-04-30', latest: '8.0.37', lts: false },
  ],
  sqlserver: [
    { cycle: '2022', releaseDate: '2022-11-16', support: '2028-01-11', eol: '2033-01-11', latest: '16.0.4135.4', lts: false, extendedSupport: '2033-01-11' },
    { cycle: '2019', releaseDate: '2019-11-04', support: '2025-02-28', eol: '2030-01-08', latest: '15.0.4385.2',  lts: false, extendedSupport: '2030-01-08' },
    { cycle: '2017', releaseDate: '2017-10-02', support: '2022-10-11', eol: '2027-10-12', latest: '14.0.3471.2',  lts: false },
  ],
  'windows-server': [
    { cycle: '2025', releaseDate: '2024-11-01', support: '2029-10-09', eol: '2034-10-10', latest: '26100', lts: false },
    { cycle: '2022', releaseDate: '2021-08-18', support: '2026-10-13', eol: '2031-10-14', latest: '20348', lts: false },
    { cycle: '2019', releaseDate: '2018-11-13', support: '2024-01-09', eol: '2029-01-09', latest: '17763', lts: false },
  ],
  'websphere-as': [
    { cycle: '9.0', releaseDate: '2016-06-13', support: '2030-09-30', eol: '2030-09-30', latest: '9.0.5.23', lts: false },
    { cycle: '8.5', releaseDate: '2012-06-22', support: '2025-09-30', eol: '2025-09-30', latest: '8.5.5.26', lts: false },
  ],
  'jboss-eap': [
    { cycle: '8.0', releaseDate: '2023-11-30', support: '2028-11-30', eol: '2033-11-30', latest: '8.0.2', lts: false },
    { cycle: '7.4', releaseDate: '2021-06-29', support: '2026-06-29', eol: '2031-06-29', latest: '7.4.18', lts: false },
  ],
  tomcat: [
    { cycle: '11.0', releaseDate: '2024-10-11', support: '2027-03-31', eol: '2027-03-31', latest: '11.0.2', lts: false },
    { cycle: '10.1', releaseDate: '2022-09-23', support: '2026-03-31', eol: '2026-03-31', latest: '10.1.24', lts: false },
    { cycle: '9.0',  releaseDate: '2017-09-27', support: '2025-03-31', eol: '2025-03-31', latest: '9.0.89',  lts: false },
  ],
  nginx: [
    { cycle: 'stable', releaseDate: '2024-02-14', support: false, eol: false, latest: '1.26.1', lts: false },
    { cycle: 'mainline', releaseDate: '2024-05-29', support: false, eol: false, latest: '1.27.0', lts: false },
  ],
  apache: [
    { cycle: '2.4', releaseDate: '2012-02-21', support: false, eol: false, latest: '2.4.62', lts: false },
  ],
  sap: [
    { cycle: 'S/4HANA 2023', releaseDate: '2023-10-01', support: '2028-10-01', eol: '2033-10-01', latest: '2023 FPS02', lts: false },
    { cycle: 'S/4HANA 2022', releaseDate: '2022-10-01', support: '2027-10-01', eol: '2032-10-01', latest: '2022 FPS03', lts: false },
  ],
  kubernetes: [
    { cycle: '1.31', releaseDate: '2024-08-13', support: false, eol: '2025-10-28', latest: '1.31.0', lts: false },
    { cycle: '1.30', releaseDate: '2024-04-17', support: false, eol: '2025-06-28', latest: '1.30.4', lts: false },
    { cycle: '1.29', releaseDate: '2023-12-13', support: false, eol: '2025-02-28', latest: '1.29.8', lts: false },
  ],
  'amazon-linux': [
    { cycle: '2023', releaseDate: '2023-03-15', support: '2028-03-15', eol: '2028-03-15', latest: '2023.5', lts: false },
    { cycle: '2',    releaseDate: '2018-06-26', support: '2025-06-30', eol: '2025-06-30', latest: '2 kernel 5.10', lts: false },
  ],
};

// Lookup: given an endoflife.date slug, return bundled cycles or null
export function getStaticEolCycles(slug) {
  return STATIC_EOL[slug] || null;
}
