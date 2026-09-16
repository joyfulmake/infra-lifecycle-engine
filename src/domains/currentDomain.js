// Tiny module-level singleton so lib functions that aren't React components
// (getRealTasks, buildDesignTasks, getIncidentFixTasks) can check which
// domain is active without importing the Zustand store directly (which
// would create a circular import back through applyDomain.js). Kept
// deliberately dependency-free.

let current = 'infra';

export function getCurrentDomainId() {
  return current;
}

export function setCurrentDomainId(id) {
  current = id;
}
