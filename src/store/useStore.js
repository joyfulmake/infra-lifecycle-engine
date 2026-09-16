import { create } from 'zustand';
import { DESIGN_SECTIONS, FIELD_LABELS, HW_OPTIONS, OS_OPTIONS, DB_OPTIONS, APP_OPTIONS } from '../domains/infra.js';
import { applyDomain } from '../domains/applyDomain.js';

const initDesignData = () => {
  const d = {};
  DESIGN_SECTIONS.forEach(s => { d[s.key] = {}; s.fields.forEach(f => { d[s.key][f] = ''; }); });
  return d;
};

export { DESIGN_SECTIONS, FIELD_LABELS, HW_OPTIONS, OS_OPTIONS, DB_OPTIONS, APP_OPTIONS };

// Migrate old single-freeze fields to changePeriods array format
function migrateLegacyFreeze(b) {
  const periods = [];
  if (b.requirements?.changeFreezeStart) {
    periods.push({ id: '1', type: 'freeze', label: 'Change Freeze', start: b.requirements.changeFreezeStart, end: b.requirements.changeFreezeEnd || '' });
  }
  if (b.requirements?.holidays) {
    b.requirements.holidays.split(',').map(h => h.trim()).filter(Boolean).forEach((h, i) => {
      periods.push({ id: 'h' + i, type: 'holiday', label: 'Holiday', start: h, end: h });
    });
  }
  return periods;
}

export const useStore = create((set, get) => ({
  // Active PM domain — 'infra' (default) | 'cloudMigration' | 'sapPm' | 'bfsiPm' | 'appDev'
  // See src/domains/registry.js. Switching domains swaps the underlying
  // catalogs (incidents, UUM/change items, design sections, task
  // generation) that every tab already reads from — see applyDomain.js.
  activeDomain: 'infra',

  // Core state flags
  isBuilt: false,
  scanComplete: false,
  designApplied: false,
  phase2Active: false,
  cabApproved: false,
  rtmSigned: false,
  rtmStale: false,
  promoted: false,
  rtmBaseline: null, // { ctx, sysDesignData } snapshot captured at RTM sign-off

  // Dirty tracking — true whenever state has changed since last save/load
  isDirty: false,
  currentBuildId: null,

  // Context
  ctx: { hw: '', os: '', db: '', app: '' },

  // Requirements
  requirements: {
    projectName: '', envType: 'Production', goLiveDate: '', sla: '99.9',
    loadProfile: '', dataVolume: '', compliance: '', drTier: 'Tier 1', constraints: '',
    projectStartDate: '', changeFreezeStart: '', changeFreezeEnd: '', holidays: '',
    hoursPerDay: '8', pmEmail: '', pmBackupEmail: '',
    pmDecisionLog: '', // PM-only freeform decision journal (restricted edit)
    projectType: '', // Phase 5 compliance library archetype — see src/lib/compliancePlaybooks.js
    country: '', domain: '', // Phase 6 inferred compliance matrix — see src/lib/complianceMatrix.js
  },

  // Regions in scope
  selRegions: ['Production'],

  // Change periods: [{ id, type: 'freeze'|'holiday'|'break', label, start, end }]
  changePeriods: [],

  // Gantt task overrides: { [taskKey]: { durationHours, dep, parallel } }
  ganttOverrides: {},

  // Selections (as arrays, not Sets, for Zustand serialization)
  selInc: [],
  selUUM: [],
  selFix: [],

  // System design
  sysDesignData: initDesignData(),
  sdAiTasks: [],

  // Scan results
  scanResults: [],

  // Emergency changes
  emergencyChanges: [],

  // RTM row statuses: { [id]: 'PASS' | 'FAIL' | 'PENDING' | 'NA' | 'BLOCKED' }
  rtmRows: {},

  // Custom incidents added by user beyond catalog
  customInc: [],

  // Custom UUM items added by user beyond catalog
  customUUM: [],

  // CAB declined state
  cabDeclined: false,

  // Revision mode — unlocked after CAB decline so PM can update any tab
  unlockedForRevision: false,

  // Live EOL data from endoflife.date API: { [componentName]: { slug, matchedCycle, allCycles, fetchedAt, error } }
  liveEolData: {},

  // Tasks stale reason — set when design/incidents/periods change after tasks generated
  tasksStaleReason: null,

  // Role assignments: { [roleName]: { name, email, backup, raci } }
  roleAssignments: {},

  // Locked design fields: { 'section.field': { lockedBy: string, note: string, value: string } }
  lockedDesignFields: {},

  // Closure checklist manual checks: { [id]: boolean }
  closureChecks: {},

  // Closure notes text
  closureNotes: '',

  // Cross-tab coherence alerts from the agent engine: [{ id, severity, tabs, message, action }]
  coherenceAlerts: [],

  // OpsMentor user-added tasks: [{ id, title, est_hours, addedAt, notes }]
  customMentorTasks: [],

  // OpsMentor user-added RAID entries: [{ id, type, description, severity, mitigation, status, owner, addedAt }]
  customRaidEntries: [],

  // Per-section custom tasks: { [groupKey]: [{ id, title, est_hours, role, notes }] }
  customSectionTasks: {},

  // Vulnerability registry: [{ id, title, cveId, component, severity, description, status, businessDecision, workaround, source, addedAt, updatedAt, fixTargetDate }]
  // status: ACTIVE | PARKED | WORKAROUND | FIXED | ACCEPTED_RISK
  vulnRegistry: [],

  // Risk tracker acknowledgments: { [riskId]: { status, notes, acknowledgedAt } }
  // Keyed by computed risk id. Not all live risks will have an entry (default is 'open').
  riskAcknowledgments: {},

  // Cost management config (optional feature — enabled: false by default)
  costConfig: {
    enabled: false,
    currency: 'USD',
    totalBudget: 0,
    dailyRatePerPerson: 800,
    teamSize: 5,
    contingencyPct: 20,
  },

  // Stakeholder discussion log: [{ id, topic, question, owner, type, status, addedAt, resolvedAt, notes }]
  // type: team-agreement | client-review | acceptance-criteria | compliance-sign-off
  // status: PENDING | IN_DISCUSSION | AGREED | REJECTED
  stakeholderDiscussions: [],

  // Persistent action audit log: [{ id, ts, type, description, user, phase, status }]
  // Capped at 500 entries. Persisted to Dexie + Firestore with the build.
  actionAuditLog: [],

  // Dependency graph engine (Phase 3) — ids of flags a PM has reviewed and
  // dismissed (unlinked RAID rows, out-of-order handoffs). Flag ids are
  // deterministic from graph content, so a dismissal survives regeneration
  // as long as the same condition persists.
  dismissedGraphFlags: [],

  // Math engine (Phase 4) — per-task execution tracking, keyed by the same
  // task id the dependency graph and Gantt overrides use.
  // { [taskId]: { percentComplete: 0-1, actualHours } }
  taskProgress: {},

  // Compliance library (Phase 5) — playbook item descriptions the PM has
  // dismissed as not relevant, so they stop resurfacing as a suggestion.
  // Accepting an item (not dismissing) doesn't need tracking here — it
  // becomes a real customRaidEntries row and the RaidTab dedupe hides the
  // suggestion automatically.
  dismissedPlaybookItems: [],

  // Inferred compliance matrix (Phase 6) — { [ruleId]: 'pending'|'agreed'|'mitigated'|'submitted' }
  // Absent entries default to 'pending'. Advisory, not a hard CAB block —
  // surfaced as a checklist the PM works through, consistent with how
  // every other advisory in this app (coherence alerts, stale banners)
  // informs rather than disables the existing approval actions.
  complianceChecklist: {},

  // Active PM tab
  activeTab: 'exec',

  // System design section expand state
  designSectionOpen: {},

  // UI theme: 'dark' (default navy sidebar) | 'light' (white sidebar)
  theme: (() => {
    const t = (typeof localStorage !== 'undefined' && localStorage.getItem('opsmanifest_theme')) || 'dark';
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', t);
    return t;
  })(),

  // Actions
  setCoherenceAlerts: (alerts) => set({ coherenceAlerts: alerts }),

  toggleTheme: () => set(s => {
    const next = s.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('opsmanifest_theme', next);
    document.documentElement.setAttribute('data-theme', next);
    return { theme: next };
  }),

  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
  setCurrentBuildId: (id) => set({ currentBuildId: id }),

  setCtx: (ctx) => set({ ctx }),
  setRequirements: (req) => set(s => {
    const scheduleChanged = s.designApplied && (
      req.hoursPerDay !== s.requirements.hoursPerDay ||
      req.projectStartDate !== s.requirements.projectStartDate
    );
    return { requirements: req, isDirty: true, ...(scheduleChanged ? { tasksStaleReason: 'Project schedule changed — tasks may not reflect new dates' } : {}) };
  }),

  setSelRegions: (regions) => set({ selRegions: regions, isDirty: true }),
  setChangePeriods: (periods) => set(s => ({
    changePeriods: periods, isDirty: true,
    ...(s.designApplied ? { tasksStaleReason: 'Change periods updated — task schedule may have shifted' } : {}),
  })),
  setGanttOverride: (key, patch) => set(s => ({
    ganttOverrides: { ...s.ganttOverrides, [key]: { ...(s.ganttOverrides[key] || {}), ...patch } },
    isDirty: true,
  })),
  clearGanttOverride: (key) => set(s => {
    const next = { ...s.ganttOverrides };
    delete next[key];
    return { ganttOverrides: next, isDirty: true };
  }),

  // Switching domains swaps the underlying catalogs (see applyDomain.js)
  // and resets any in-progress build, since selections/tasks/RAID items
  // reference the PREVIOUS domain's codes and wouldn't resolve correctly
  // against the new one. Intended to be called only pre-build (gated in
  // the UI), but resets defensively regardless of when it's called.
  setActiveDomain: (id) => {
    applyDomain(id);
    return set({
      activeDomain: id,
      isBuilt: false, scanComplete: false, designApplied: false,
      phase2Active: false, cabApproved: false, cabDeclined: false, rtmSigned: false, promoted: false,
      ctx: { hw: '', os: '', db: '', app: '' }, selInc: [], selUUM: [], selFix: [],
      sdAiTasks: [], customInc: [], customUUM: [],
      customMentorTasks: [], customRaidEntries: [], customSectionTasks: {},
      vulnRegistry: [], stakeholderDiscussions: [], actionAuditLog: [], riskAcknowledgments: {},
      sysDesignData: initDesignData(), scanResults: [], activeTab: 'exec',
      lockedDesignFields: {}, isDirty: false, currentBuildId: null,
      unlockedForRevision: false, tasksStaleReason: null, rtmStale: false, roleAssignments: {},
      dismissedGraphFlags: [], taskProgress: {}, dismissedPlaybookItems: [], complianceChecklist: {},
      rtmRows: {}, closureChecks: {}, closureNotes: '',
    });
  },

  build: (ctx) => set({
    isBuilt: true, scanComplete: false, designApplied: false,
    phase2Active: false, cabApproved: false, cabDeclined: false, rtmSigned: false, promoted: false,
    ctx, selInc: [], selUUM: [], selFix: [], sdAiTasks: [], customInc: [], customUUM: [],
    customMentorTasks: [], customRaidEntries: [], customSectionTasks: {},
    vulnRegistry: [], stakeholderDiscussions: [], actionAuditLog: [], riskAcknowledgments: {},
    sysDesignData: initDesignData(), scanResults: [], activeTab: 'exec',
    lockedDesignFields: {}, isDirty: true, currentBuildId: null,
    unlockedForRevision: false, tasksStaleReason: null, rtmStale: false, roleAssignments: {},
    dismissedGraphFlags: [], taskProgress: {}, dismissedPlaybookItems: [], complianceChecklist: {},
  }),

  completeScan: (results) => set({ scanComplete: true, scanResults: results || [], isDirty: true }),

  applyDesign: () => set({ designApplied: true, isDirty: true }),

  startPhase2: () => set({ phase2Active: true, isDirty: true }),

  toggleInc: (code) => set(s => ({
    selInc: s.selInc.includes(code) ? s.selInc.filter(c => c !== code) : [...s.selInc, code],
    isDirty: true,
    ...(s.phase2Active ? { tasksStaleReason: 'Incidents changed — tasks may not reflect current scope' } : {}),
    ...(s.rtmSigned ? { rtmStale: true } : {}),
  })),

  toggleUUM: (code) => set(s => ({
    selUUM: s.selUUM.includes(code) ? s.selUUM.filter(c => c !== code) : [...s.selUUM, code],
    isDirty: true,
    ...(s.phase2Active ? { tasksStaleReason: 'UUM items changed — task sequences may have changed' } : {}),
    ...(s.rtmSigned ? { rtmStale: true } : {}),
  })),

  toggleFix: (code) => set(s => ({
    selFix: s.selFix.includes(code) ? s.selFix.filter(c => c !== code) : [...s.selFix, code],
    isDirty: true,
  })),

  setCabApproved: (val) => set({ cabApproved: val, cabDeclined: false, isDirty: true }),
  setCabDeclined: (val) => set({ cabDeclined: val, cabApproved: false, isDirty: true }),

  addCustomInc: (inc) => set(s => ({ customInc: [...s.customInc, inc], isDirty: true })),
  removeCustomInc: (id) => set(s => ({ customInc: s.customInc.filter(i => i.id !== id), isDirty: true })),

  addCustomMentorTask: (task) => set(s => ({ customMentorTasks: [...(s.customMentorTasks || []), task], isDirty: true })),
  removeCustomMentorTask: (id) => set(s => ({ customMentorTasks: (s.customMentorTasks || []).filter(t => t.id !== id), isDirty: true })),
  addCustomRaidEntry: (entry) => set(s => ({ customRaidEntries: [...(s.customRaidEntries || []), entry], isDirty: true })),
  removeCustomRaidEntry: (id) => set(s => ({ customRaidEntries: (s.customRaidEntries || []).filter(e => e.id !== id), isDirty: true })),
  updateCustomRaidEntry: (id, patch) => set(s => ({
    customRaidEntries: (s.customRaidEntries || []).map(e => e.id === id ? { ...e, ...patch } : e),
    isDirty: true,
  })),
  addSectionTask: (groupKey, task) => set(s => ({
    customSectionTasks: { ...(s.customSectionTasks || {}), [groupKey]: [...(s.customSectionTasks?.[groupKey] || []), task] },
    isDirty: true,
  })),
  removeSectionTask: (groupKey, taskId) => set(s => ({
    customSectionTasks: { ...(s.customSectionTasks || {}), [groupKey]: (s.customSectionTasks?.[groupKey] || []).filter(t => t.id !== taskId) },
    isDirty: true,
  })),
  updateSectionTask: (groupKey, taskId, patch) => set(s => ({
    customSectionTasks: { ...(s.customSectionTasks || {}), [groupKey]: (s.customSectionTasks?.[groupKey] || []).map(t => t.id === taskId ? { ...t, ...patch } : t) },
    isDirty: true,
  })),

  // Vulnerability registry actions
  addVuln: (vuln) => set(s => ({ vulnRegistry: [...(s.vulnRegistry || []), vuln], isDirty: true })),
  updateVuln: (id, patch) => set(s => ({
    vulnRegistry: (s.vulnRegistry || []).map(v => v.id === id ? { ...v, ...patch, updatedAt: new Date().toISOString() } : v),
    isDirty: true,
  })),
  removeVuln: (id) => set(s => ({ vulnRegistry: (s.vulnRegistry || []).filter(v => v.id !== id), isDirty: true })),

  // Stakeholder discussion actions
  addStakeholderDiscussion: (entry) => set(s => ({ stakeholderDiscussions: [...(s.stakeholderDiscussions || []), entry], isDirty: true })),
  updateStakeholderDiscussion: (id, patch) => set(s => ({
    stakeholderDiscussions: (s.stakeholderDiscussions || []).map(d => d.id === id ? { ...d, ...patch } : d),
    isDirty: true,
  })),

  // Risk acknowledgment
  acknowledgeRisk: (id, data) => set(s => ({
    riskAcknowledgments: { ...s.riskAcknowledgments, [id]: data },
    isDirty: true,
  })),

  // Cost config
  setCostConfig: (cfg) => set({ costConfig: cfg, isDirty: true }),

  // Action audit log
  logAuditAction: (entry) => set(s => {
    const log = [...(s.actionAuditLog || []), entry];
    return { actionAuditLog: log.slice(-500), isDirty: true };
  }),

  // Dependency graph flag review
  dismissGraphFlag: (id) => set(s => ({
    dismissedGraphFlags: s.dismissedGraphFlags.includes(id) ? s.dismissedGraphFlags : [...s.dismissedGraphFlags, id],
    isDirty: true,
  })),
  restoreGraphFlag: (id) => set(s => ({
    dismissedGraphFlags: s.dismissedGraphFlags.filter(f => f !== id), isDirty: true,
  })),

  // Task execution progress (Phase 4 math engine input)
  setTaskProgress: (taskId, patch) => set(s => ({
    taskProgress: { ...s.taskProgress, [taskId]: { ...(s.taskProgress[taskId] || {}), ...patch } },
    isDirty: true,
  })),

  // Compliance playbook suggestions (Phase 5)
  dismissPlaybookItem: (key) => set(s => ({
    dismissedPlaybookItems: s.dismissedPlaybookItems.includes(key) ? s.dismissedPlaybookItems : [...s.dismissedPlaybookItems, key],
    isDirty: true,
  })),

  // Compliance matrix checklist (Phase 6)
  setComplianceStatus: (ruleId, status) => set(s => ({
    complianceChecklist: { ...s.complianceChecklist, [ruleId]: status }, isDirty: true,
  })),

  addCustomUUM: (uum) => set(s => ({ customUUM: [...(s.customUUM || []), uum], isDirty: true })),
  updateCustomUUM: (id, patch) => set(s => ({
    customUUM: (s.customUUM || []).map(u => u.id === id ? { ...u, ...patch } : u),
    isDirty: true,
  })),
  removeCustomUUM: (id) => set(s => ({
    customUUM: (s.customUUM || []).filter(u => u.id !== id),
    selUUM: s.selUUM.filter(c => c !== id),
    isDirty: true,
  })),

  lockDesignField: (key, data) => set(s => ({
    lockedDesignFields: { ...s.lockedDesignFields, [key]: data }, isDirty: true,
  })),
  unlockDesignField: (key) => set(s => {
    const next = { ...s.lockedDesignFields };
    delete next[key];
    return { lockedDesignFields: next, isDirty: true };
  }),

  signRtm: () => set(s => ({
    rtmSigned: true, rtmStale: false, isDirty: true,
    rtmBaseline: { ctx: s.ctx, sysDesignData: s.sysDesignData },
  })),

  promote: () => set({ promoted: true, isDirty: true }),

  setDesignField: (section, field, value) => set(s => ({
    sysDesignData: {
      ...s.sysDesignData,
      [section]: { ...s.sysDesignData[section], [field]: value },
    },
    isDirty: true,
    ...(s.designApplied ? { tasksStaleReason: 'System design changed — tasks may not reflect current configuration' } : {}),
    ...(s.rtmSigned ? { rtmStale: true } : {}),
  })),

  setAllDesignFields: (data) => set(s => ({
    sysDesignData: data, isDirty: true,
    ...(s.designApplied ? { tasksStaleReason: 'System design changed — tasks may not reflect current configuration' } : {}),
    ...(s.rtmSigned ? { rtmStale: true } : {}),
  })),

  setAiTasks: (tasks) => set({ sdAiTasks: tasks, isDirty: true }),
  setTasksStaleReason: (reason) => set({ tasksStaleReason: reason }),
  setRtmStale: (val) => set({ rtmStale: val }),
  setUnlockedForRevision: (val) => set(s => ({
    unlockedForRevision: val,
    ...(val && s.designApplied ? { tasksStaleReason: 'Build unlocked for revision — regenerate tasks to reflect current scope' } : {}),
  })),
  setRoleAssignment: (role, data) => set(s => ({ roleAssignments: { ...s.roleAssignments, [role]: data }, isDirty: true })),
  resubmitCAB: () => set({ cabDeclined: false, unlockedForRevision: false, isDirty: true }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleDesignSection: (key) => set(s => ({
    designSectionOpen: { ...s.designSectionOpen, [key]: !s.designSectionOpen[key] },
  })),

  addEmergencyChange: (change) => set(s => ({
    emergencyChanges: [...s.emergencyChanges, change], isDirty: true,
  })),

  setRtmRow: (id, status) => set(s => ({
    rtmRows: { ...s.rtmRows, [id]: status }, isDirty: true,
  })),

  setClosureCheck: (id, value) => set(s => ({
    closureChecks: { ...s.closureChecks, [id]: value }, isDirty: true,
  })),

  setClosureNotes: (notes) => set({ closureNotes: notes, isDirty: true }),

  setLiveEolData: (componentName, data) => set(s => ({
    liveEolData: { ...s.liveEolData, [componentName]: data },
  })),

  // Live compatibility data — fetched from endoflife.date on every app open.
  // Keyed by COMPAT_RULES rule id. Runtime-only — not persisted.
  liveCompatData: {},
  liveCompatVerifiedAt: null,
  setLiveCompatData: (ruleId, data) => set(s => ({
    liveCompatData: { ...s.liveCompatData, [ruleId]: data },
  })),
  setLiveCompatVerifiedAt: ts => set({ liveCompatVerifiedAt: ts }),

  loadBuild: (b) => {
    // Re-apply the build's own domain catalog BEFORE hydrating state, so
    // selInc/selUUM codes and design sections resolve against the same
    // catalog the build was created under (a build saved under SAP PM must
    // load SAP PM's catalog, not whatever domain is currently active).
    applyDomain(b.activeDomain ?? 'infra');
    return set({
    activeDomain: b.activeDomain ?? 'infra',
    isBuilt: b.isBuilt ?? false,
    scanComplete: b.scanComplete ?? false,
    designApplied: b.designApplied ?? false,
    phase2Active: b.phase2Active ?? false,
    cabApproved: b.cabApproved ?? false,
    cabDeclined: b.cabDeclined ?? false,
    rtmSigned: b.rtmSigned ?? false,
    promoted: b.promoted ?? false,
    ctx: b.ctx ?? { hw: '', os: '', db: '', app: '' },
    requirements: b.requirements ?? {},
    selInc: b.selInc ?? [],
    selUUM: b.selUUM ?? [],
    selFix: b.selFix ?? [],
    customInc: b.customInc ?? [],
    customUUM: b.customUUM ?? [],
    customMentorTasks: b.customMentorTasks ?? [],
    customRaidEntries: b.customRaidEntries ?? [],
    customSectionTasks: b.customSectionTasks ?? {},
    sysDesignData: b.sysDesignData ?? initDesignData(),
    sdAiTasks: b.sdAiTasks ?? [],
    scanResults: b.scanResults ?? [],
    rtmRows: b.rtmRows ?? {},
    closureChecks: b.closureChecks ?? {},
    closureNotes: b.closureNotes ?? '',
    emergencyChanges: b.emergencyChanges ?? [],
    lockedDesignFields: b.lockedDesignFields ?? {},
    selRegions: b.selRegions ?? ['Production'],
    changePeriods: b.changePeriods ?? migrateLegacyFreeze(b),
    ganttOverrides: b.ganttOverrides ?? {},
    unlockedForRevision: b.unlockedForRevision ?? false,
    tasksStaleReason: b.tasksStaleReason ?? null,
    rtmStale: b.rtmStale ?? false,
    roleAssignments: b.roleAssignments ?? {},
    vulnRegistry: b.vulnRegistry ?? [],
    stakeholderDiscussions: b.stakeholderDiscussions ?? [],
    actionAuditLog: b.actionAuditLog ?? [],
    dismissedGraphFlags: b.dismissedGraphFlags ?? [],
    taskProgress: b.taskProgress ?? {},
    dismissedPlaybookItems: b.dismissedPlaybookItems ?? [],
    complianceChecklist: b.complianceChecklist ?? {},
    riskAcknowledgments: b.riskAcknowledgments ?? {},
    costConfig: b.costConfig ?? { enabled: false, currency: 'USD', totalBudget: 0, dailyRatePerPerson: 800, teamSize: 5, contingencyPct: 20 },
    activeTab: 'exec',
    isDirty: false,
    });
  },
}));
