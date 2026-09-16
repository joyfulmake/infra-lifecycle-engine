import { ALL_INC, FIXES } from '../lib/incidents.js';
import { ALL_UUM } from '../lib/uumItems.js';
import { DESIGN_SECTIONS, FIELD_LABELS, HW_OPTIONS, OS_OPTIONS, DB_OPTIONS, APP_OPTIONS } from './infra.js';
import { setCurrentDomainId } from './currentDomain.js';
import { getNonInfraCatalog } from './lookup.js';

// Switching domains mutates the SAME array/object references ALL_INC,
// ALL_UUM, DESIGN_SECTIONS, FIELD_LABELS, and the four axis-option arrays
// already export — so every existing tab (Gantt, RAID, RTM, Matrix,
// Closure, PhasePanel, the Dependency Graph engine) picks up the new
// domain's catalog automatically, with zero changes to those files. Task
// generation (getRealTasks/buildDesignTasks/getIncidentFixTasks) is handled
// separately — those files check getCurrentDomainId() themselves at call
// time (see src/lib/realTasks.js, designTasks.js, incidentFixTasks.js).

function mutateArray(target, source) {
  target.length = 0;
  target.push(...source);
}
function mutateObject(target, source) {
  Object.keys(target).forEach(k => delete target[k]);
  Object.assign(target, source);
}

// Captured once, the first time applyDomain runs — infra's own original
// content, exactly as it shipped, before any domain switch ever mutates it.
let infraSnapshot = null;

function takeInfraSnapshotOnce() {
  if (infraSnapshot) return;
  infraSnapshot = {
    incidents: ALL_INC.slice(),
    fixes: { ...FIXES },
    uumItems: ALL_UUM.slice(),
    designSections: DESIGN_SECTIONS.map(s => ({ ...s, fields: s.fields.slice() })),
    fieldLabels: { ...FIELD_LABELS },
    axisOptions: [HW_OPTIONS.slice(), OS_OPTIONS.slice(), DB_OPTIONS.slice(), APP_OPTIONS.slice()],
  };
}

export function applyDomain(domainId) {
  takeInfraSnapshotOnce();
  setCurrentDomainId(domainId);

  const catalog = domainId === 'infra' ? null : getNonInfraCatalog(domainId);
  const source = catalog || infraSnapshot;

  mutateArray(ALL_INC, source.incidents);
  mutateObject(FIXES, source.fixes);
  mutateArray(ALL_UUM, source.uumItems);
  mutateArray(DESIGN_SECTIONS, source.designSections);
  mutateObject(FIELD_LABELS, source.fieldLabels);
  const axis = catalog ? catalog.axisOptions : infraSnapshot.axisOptions;
  mutateArray(HW_OPTIONS, axis[0]);
  mutateArray(OS_OPTIONS, axis[1]);
  mutateArray(DB_OPTIONS, axis[2]);
  mutateArray(APP_OPTIONS, axis[3]);
}
