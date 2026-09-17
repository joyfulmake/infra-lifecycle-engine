// Central registry of every non-infra domain catalog. Infra is deliberately
// excluded — its catalog lives in the original src/lib/* files and infra.js,
// and every consumer (getRealTasks, buildDesignTasks, getIncidentFixTasks)
// falls through to its own existing logic when the active domain is 'infra'
// or unrecognized, so infra behavior never depends on this file.

import * as cloudMigration from './cloudMigration.js';
import * as sapPm from './sapPm.js';
import * as bfsiPm from './bfsiPm.js';
import * as appDev from './appDev.js';
import * as devOps from './devOps.js';
import * as cybersecurity from './cybersecurity.js';
import * as networkRefresh from './networkRefresh.js';
import * as dataAnalytics from './dataAnalytics.js';
import * as salesforcePm from './salesforcePm.js';
import * as oracleEbsPm from './oracleEbsPm.js';
import * as dynamics365Pm from './dynamics365Pm.js';
import * as healthcarePm from './healthcarePm.js';
import * as manufacturingPm from './manufacturingPm.js';
import * as telecomPm from './telecomPm.js';
import * as retailPm from './retailPm.js';

export const NON_INFRA_CATALOGS = { cloudMigration, sapPm, bfsiPm, appDev, devOps, cybersecurity, networkRefresh, dataAnalytics, salesforcePm, oracleEbsPm, dynamics365Pm, healthcarePm, manufacturingPm, telecomPm, retailPm };

export function getNonInfraCatalog(domainId) {
  return NON_INFRA_CATALOGS[domainId] || null;
}
