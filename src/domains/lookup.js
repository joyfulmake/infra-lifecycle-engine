// Central registry of every non-infra domain catalog. Infra is deliberately
// excluded — its catalog lives in the original src/lib/* files and infra.js,
// and every consumer (getRealTasks, buildDesignTasks, getIncidentFixTasks)
// falls through to its own existing logic when the active domain is 'infra'
// or unrecognized, so infra behavior never depends on this file.

import * as cloudMigration from './cloudMigration.js';
import * as sapPm from './sapPm.js';
import * as bfsiPm from './bfsiPm.js';
import * as appDev from './appDev.js';

export const NON_INFRA_CATALOGS = { cloudMigration, sapPm, bfsiPm, appDev };

export function getNonInfraCatalog(domainId) {
  return NON_INFRA_CATALOGS[domainId] || null;
}
