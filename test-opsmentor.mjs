// OpsMentor integration test — pure logic only (no DOM, no React).
// Run with: node test-opsmentor.mjs

import { ruleBasedResponse } from './src/lib/orchestratorChat.js';
import { checkPermission, executeAction, buildStateContext } from './src/lib/orchestratorActions.js';
import { generateScript, getWorkflowChecklist } from './src/lib/orchestratorScripts.js';

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

// ── Baseline state ────────────────────────────────────────────────────────────

const BLANK = {
  ctx: {}, requirements: {}, isBuilt: false, scanComplete: false,
  designApplied: false, phase2Active: false, cabApproved: false,
  cabDeclined: false, rtmSigned: false, promoted: false,
  selInc: [], selUUM: [], rtmRows: {}, closureChecks: {},
  coherenceAlerts: [], roleAssignments: {}, sysDesignData: {},
  tasksStaleReason: null, rtmStale: false, unlockedForRevision: false,
  customMentorTasks: [], customRaidEntries: [],
};

function state(overrides) {
  return { ...BLANK, ...overrides, ctx: { ...BLANK.ctx, ...(overrides.ctx || {}) }, requirements: { ...BLANK.requirements, ...(overrides.requirements || {}) } };
}

const PM_USER   = { email: 'pm@example.com' };
const GUEST     = null;
const OTHER     = { email: 'other@example.com' };
const BUILT_S   = state({ isBuilt: true, ctx: { hw: 'Dell R750', os: 'RHEL 8.6', db: 'Oracle 19c', app: 'WebSphere 9' } });
const SCANNED_S = state({ ...BUILT_S, scanComplete: true });
const DESIGNED_S = state({ ...SCANNED_S, designApplied: true });
const PHASE2_S  = state({ ...DESIGNED_S, phase2Active: true });
const CAB_S     = state({ ...PHASE2_S, cabApproved: true });
const RTM_S     = state({ ...CAB_S, rtmSigned: true });
const LIVE_S    = state({ ...RTM_S, promoted: true });

// ═══════════════════════════════════════════════════════════════════════════════
// 1. FIELD SETTING — the bug that was just fixed
// ═══════════════════════════════════════════════════════════════════════════════
section('1. Field-setting via chat (SET_CTX / SET_REQUIREMENT)');

{
  const r = ruleBasedResponse('hardware is Dell PowerEdge R750', BLANK, GUEST);
  assert('Returns a reply', !!r?.reply);
  assert('Returns SET_CTX action', r?.actions?.[0]?.type === 'SET_CTX');
  assert('Action has params (not payload)', !!r?.actions?.[0]?.params, JSON.stringify(r?.actions?.[0]));
  assert('params.key === hw', r?.actions?.[0]?.params?.key === 'hw', JSON.stringify(r?.actions?.[0]?.params));
  assert('params.value === Dell PowerEdge R750', r?.actions?.[0]?.params?.value === 'Dell PowerEdge R750');
}

{
  const r = ruleBasedResponse('OS is RHEL 8.6', BLANK, GUEST);
  assert('OS field: SET_CTX with key=os', r?.actions?.[0]?.params?.key === 'os');
  assert('OS field: value = RHEL 8.6', r?.actions?.[0]?.params?.value === 'RHEL 8.6');
}

{
  const r = ruleBasedResponse('database is Oracle 19c', BLANK, GUEST);
  assert('DB field: key=db', r?.actions?.[0]?.params?.key === 'db');
}

{
  const r = ruleBasedResponse('application is WebSphere 9.0', BLANK, GUEST);
  assert('App field: key=app', r?.actions?.[0]?.params?.key === 'app');
}

{
  const r = ruleBasedResponse('project name is Server Migration Q3', BLANK, GUEST);
  assert('projectName: SET_REQUIREMENT', r?.actions?.[0]?.type === 'SET_REQUIREMENT');
  assert('projectName: has params (not payload)', !!r?.actions?.[0]?.params);
  assert('projectName: key=projectName', r?.actions?.[0]?.params?.key === 'projectName');
  assert('projectName: value correct', r?.actions?.[0]?.params?.value === 'Server Migration Q3');
}

{
  const r = ruleBasedResponse('environment is Production', BLANK, GUEST);
  assert('envType: key=envType', r?.actions?.[0]?.params?.key === 'envType');
}

{
  const r = ruleBasedResponse('go-live date is 2026-09-15', BLANK, GUEST);
  assert('goLiveDate: key=goLiveDate', r?.actions?.[0]?.params?.key === 'goLiveDate');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. WORKFLOW GATE ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════
section('2. Workflow gate commands');

{
  const r = ruleBasedResponse('run scan', BUILT_S, GUEST);
  assert('run scan: returns RUN_SCAN action', r?.actions?.[0]?.type === 'RUN_SCAN');
  assert('run scan: no confirmation required', r?.actions?.[0]?.requiresConfirmation === false);
}

{
  const r = ruleBasedResponse('run scan', BLANK, GUEST);
  assert('run scan before build: blocked with message', r?.reply?.includes('build') || r?.reply?.includes('Build'));
}

{
  const r = ruleBasedResponse('run scan', SCANNED_S, GUEST);
  assert('run scan already done: no action, explains already done', !r?.actions?.length);
}

{
  const r = ruleBasedResponse('inject phase 2', DESIGNED_S, GUEST);
  assert('inject phase 2: returns INJECT_PHASE2', r?.actions?.[0]?.type === 'INJECT_PHASE2');
  assert('inject phase 2: requires confirmation', r?.actions?.[0]?.requiresConfirmation === true);
}

{
  const r = ruleBasedResponse('inject phase 2', SCANNED_S, GUEST);
  assert('inject phase 2 before design: blocked', !r?.actions?.length);
}

{
  const r = ruleBasedResponse('submit to cab', PHASE2_S, GUEST);
  assert('submit to CAB: returns SUBMIT_CAB', r?.actions?.[0]?.type === 'SUBMIT_CAB');
  assert('submit to CAB: requires confirmation', r?.actions?.[0]?.requiresConfirmation === true);
}

{
  const r = ruleBasedResponse('sign rtm', CAB_S, GUEST);
  assert('sign RTM: returns SIGN_RTM', r?.actions?.[0]?.type === 'SIGN_RTM');
  assert('sign RTM: requires confirmation', r?.actions?.[0]?.requiresConfirmation === true);
}

{
  const rtmWithFails = state({ ...CAB_S, rtmRows: { r1: 'FAIL', r2: 'PASS' } });
  const r = ruleBasedResponse('sign rtm', rtmWithFails, GUEST);
  assert('sign RTM with FAIL rows: blocked, explains failures', !r?.actions?.length && r?.reply?.includes('FAIL'));
}

{
  const r = ruleBasedResponse('go live', RTM_S, GUEST);
  assert('go live: returns PROMOTE', r?.actions?.[0]?.type === 'PROMOTE');
  assert('go live: requires confirmation', r?.actions?.[0]?.requiresConfirmation === true);
}

{
  const r = ruleBasedResponse('go live', PHASE2_S, GUEST);
  assert('go live before RTM: blocked', !r?.actions?.length);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ADD TASK / RAID
// ═══════════════════════════════════════════════════════════════════════════════
section('3. Add task / RAID commands');

{
  const r = ruleBasedResponse('add task: migrate batch jobs to new scheduler', BLANK, GUEST);
  assert('add task: sets _pendingTask', !!r?._pendingTask);
  assert('add task: pending title matches', r?._pendingTask === 'migrate batch jobs to new scheduler');
  assert('add task: asks gantt or raid', r?.reply?.toLowerCase().includes('gantt') && r?.reply?.toLowerCase().includes('raid'));
}

{
  const r = ruleBasedResponse('add issue: firewall port 8443 not open on target', BLANK, GUEST);
  assert('add issue: returns ADD_RAID_ENTRY', r?.actions?.[0]?.type === 'ADD_RAID_ENTRY');
  assert('add issue: type=ISSUE', r?.actions?.[0]?.params?.type === 'ISSUE');
  assert('add issue: description set', r?.actions?.[0]?.params?.description?.includes('firewall'));
  assert('add issue: NAVIGATE_TAB also included', r?.actions?.[1]?.type === 'NAVIGATE_TAB');
}

{
  const r = ruleBasedResponse('add risk: DB backup window conflict', BLANK, GUEST);
  assert('add risk: type=RISK', r?.actions?.[0]?.params?.type === 'RISK');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SYSTEM DESIGN FIELD UPDATE
// ═══════════════════════════════════════════════════════════════════════════════
section('4. System Design field update via chat');

{
  const r = ruleBasedResponse('set network firewall to pfsense', SCANNED_S, GUEST);
  assert('set design field: returns SET_DESIGN_FIELD', r?.actions?.[0]?.type === 'SET_DESIGN_FIELD');
  assert('set design field: section=network', r?.actions?.[0]?.params?.section === 'network');
  assert('set design field: value=pfsense', r?.actions?.[0]?.params?.value === 'pfsense');
}

{
  const r = ruleBasedResponse('set network firewall to pfsense', BLANK, GUEST);
  assert('set design field before scan: blocked', !r?.actions?.length);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. STATUS QUERIES — no actions, just informational
// ═══════════════════════════════════════════════════════════════════════════════
section('5. Status queries');

{
  const r = ruleBasedResponse('what is the status', PHASE2_S, GUEST);
  assert('status: returns reply (no actions)', !!r?.reply && !r?.actions?.length);
}

{
  const r = ruleBasedResponse('rtm status', CAB_S, GUEST);
  assert('RTM status: contains counts', r?.reply?.includes('PASS') || r?.reply?.includes('PENDING'));
}

{
  const r = ruleBasedResponse('who is the unix admin', state({ roleAssignments: { 'Unix Admin': { name: 'Alice', email: 'alice@co.com' } } }), GUEST);
  assert('who is unix admin: returns name', r?.reply?.includes('Alice'));
}

{
  const r = ruleBasedResponse('what is the stack', BUILT_S, GUEST);
  assert('stack query: shows hw/os/db/app', r?.reply?.includes('Dell R750'));
}

{
  const r = ruleBasedResponse("what's next", DESIGNED_S, GUEST);
  assert('what is next: non-empty reply', !!r?.reply);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PERMISSION CHECKS
// ═══════════════════════════════════════════════════════════════════════════════
section('6. Permission checks');

const s_with_pm = state({ requirements: { pmEmail: 'pm@example.com' } });

{
  const r = checkPermission({ type: 'SET_CTX', params: { key: 'hw', value: 'X' } }, GUEST, s_with_pm);
  assert('SET_CTX by guest when PM is assigned: denied', !r.allowed);
}

{
  const r = checkPermission({ type: 'SET_CTX', params: { key: 'hw', value: 'X' } }, PM_USER, s_with_pm);
  assert('SET_CTX by PM: allowed', r.allowed);
}

{
  const r = checkPermission({ type: 'SET_CTX', params: { key: 'hw', value: 'X' } }, GUEST, BLANK);
  assert('SET_CTX when no PM assigned (guest build): allowed', r.allowed);
}

{
  const r = checkPermission({ type: 'PROMOTE' }, GUEST, s_with_pm);
  assert('PROMOTE by guest when PM assigned: denied', !r.allowed);
}

{
  const r = checkPermission({ type: 'PROMOTE' }, GUEST, BLANK);
  assert('PROMOTE when no PM assigned: allowed', r.allowed);
}

{
  const r = checkPermission({ type: 'RUN_SCAN' }, GUEST, state({ isBuilt: false }));
  assert('RUN_SCAN before build: denied', !r.allowed);
}

{
  const r = checkPermission({ type: 'RUN_SCAN' }, GUEST, BUILT_S);
  assert('RUN_SCAN after build: allowed', r.allowed);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. EXECUTE ACTION — store call simulation
// ═══════════════════════════════════════════════════════════════════════════════
section('7. executeAction — store wiring');

{
  let called = null;
  const fakeStore = {
    ctx: { hw: 'old', os: 'old', db: 'old', app: 'old' },
    requirements: {},
    setCtx: (v) => { called = v; },
    setRequirements: () => {},
    completeScan: () => {},
    startPhase2: () => {},
    setCabApproved: () => {},
    signRtm: () => {},
    promote: () => {},
    applyDesign: () => {},
    setDesignField: () => {},
    toggleInc: () => {},
    toggleUUM: () => {},
    setRtmRow: () => {},
    setRoleAssignment: () => {},
    addCustomMentorTask: () => {},
    addCustomRaidEntry: () => {},
    setActiveTab: () => {},
  };

  executeAction({ type: 'SET_CTX', params: { key: 'hw', value: 'Dell R750' } }, fakeStore);
  assert('executeAction SET_CTX: calls setCtx', !!called);
  assert('executeAction SET_CTX: spreads existing ctx', called?.os === 'old');
  assert('executeAction SET_CTX: sets new key', called?.hw === 'Dell R750');
}

{
  let reqCalled = null;
  const fakeStore = {
    ctx: {},
    requirements: { projectName: 'existing', envType: 'UAT' },
    setRequirements: (v) => { reqCalled = v; },
    setCtx: () => {},
    completeScan: () => {}, startPhase2: () => {}, setCabApproved: () => {},
    signRtm: () => {}, promote: () => {}, applyDesign: () => {}, setDesignField: () => {},
    toggleInc: () => {}, toggleUUM: () => {}, setRtmRow: () => {}, setRoleAssignment: () => {},
    addCustomMentorTask: () => {}, addCustomRaidEntry: () => {}, setActiveTab: () => {},
  };

  executeAction({ type: 'SET_REQUIREMENT', params: { key: 'goLiveDate', value: '2026-09-15' } }, fakeStore);
  assert('executeAction SET_REQUIREMENT: calls setRequirements', !!reqCalled);
  assert('executeAction SET_REQUIREMENT: preserves existing fields', reqCalled?.projectName === 'existing');
  assert('executeAction SET_REQUIREMENT: sets new field', reqCalled?.goLiveDate === '2026-09-15');
}

{
  let tabCalled = null;
  const fakeStore = {
    ctx: {}, requirements: {},
    setCtx: () => {}, setRequirements: () => {}, completeScan: () => {}, startPhase2: () => {},
    setCabApproved: () => {}, signRtm: () => {}, promote: () => {}, applyDesign: () => {},
    setDesignField: () => {}, toggleInc: () => {}, toggleUUM: () => {}, setRtmRow: () => {},
    setRoleAssignment: () => {}, addCustomMentorTask: () => {}, addCustomRaidEntry: () => {},
    setActiveTab: (t) => { tabCalled = t; },
  };

  executeAction({ type: 'NAVIGATE_TAB', params: { tab: 'gantt' } }, fakeStore);
  assert('executeAction NAVIGATE_TAB: calls setActiveTab with gantt', tabCalled === 'gantt');
}

{
  let taskCalled = null;
  const fakeStore = {
    ctx: {}, requirements: {},
    setCtx: () => {}, setRequirements: () => {}, completeScan: () => {}, startPhase2: () => {},
    setCabApproved: () => {}, signRtm: () => {}, promote: () => {}, applyDesign: () => {},
    setDesignField: () => {}, toggleInc: () => {}, toggleUUM: () => {}, setRtmRow: () => {},
    setRoleAssignment: () => {}, addCustomMentorTask: (p) => { taskCalled = p; }, addCustomRaidEntry: () => {},
    setActiveTab: () => {},
  };

  executeAction({ type: 'ADD_CUSTOM_TASK', params: { id: 't1', title: 'Test task', est_hours: 4 } }, fakeStore);
  assert('executeAction ADD_CUSTOM_TASK: calls addCustomMentorTask', !!taskCalled);
  assert('executeAction ADD_CUSTOM_TASK: correct params passed', taskCalled?.title === 'Test task');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. SCRIPT GENERATION — phase routing
// ═══════════════════════════════════════════════════════════════════════════════
section('8. generateScript — phase routing');

{
  const sc = generateScript(BLANK);
  assert('blank state: welcome script', sc.id === 'welcome');
}

{
  const sc = generateScript(BUILT_S);
  assert('built: run_scan script', sc.id === 'run_scan');
}

{
  const sc = generateScript(SCANNED_S);
  assert('scanned: apply_design script', sc.id === 'apply_design');
}

{
  const sc = generateScript(DESIGNED_S);
  assert('design applied: inject_phase2 script', sc.id === 'inject_phase2');
}

{
  const sc = generateScript(PHASE2_S);
  assert('phase2 active: phase2_active script', sc.id === 'phase2_active');
}

{
  const sc = generateScript(CAB_S);
  assert('CAB approved: rtm_pending script', sc.id === 'rtm_pending');
}

{
  const sc = generateScript(RTM_S);
  assert('RTM signed + CAB approved: ready_cutover', sc.id === 'ready_cutover');
}

{
  const sc = generateScript(LIVE_S);
  assert('promoted: closure script', sc.id === 'promoted');
}

{
  const declined = state({ ...PHASE2_S, cabDeclined: true, unlockedForRevision: false });
  const sc = generateScript(declined);
  assert('CAB declined: cab_declined script', sc.id === 'cab_declined');
}

{
  const revision = state({ ...PHASE2_S, cabDeclined: true, unlockedForRevision: true });
  const sc = generateScript(revision);
  assert('revision mode: revision_mode script', sc.id === 'revision_mode');
}

{
  const stale = state({ ...PHASE2_S, tasksStaleReason: 'Design changed' });
  const sc = generateScript(stale);
  assert('tasks stale: tasks_stale script', sc.id === 'tasks_stale');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. WORKFLOW CHECKLIST
// ═══════════════════════════════════════════════════════════════════════════════
section('9. Workflow checklist');

{
  const list = getWorkflowChecklist(LIVE_S);
  assert('live state: all steps done', list.every(s => s.id === 'closure' ? true : s.done));
  assert('live state: 8 checklist items', list.length === 8);
}

{
  const list = getWorkflowChecklist(BLANK);
  assert('blank state: no steps done', list.every(s => !s.done));
}

{
  const declined = state({ ...PHASE2_S, cabDeclined: true });
  const list = getWorkflowChecklist(declined);
  const cab = list.find(s => s.id === 'cab');
  assert('CAB declined: cab warn=true', cab?.warn === true);
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT
// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n${'─'.repeat(50)}`);
console.log(`Result: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failed === 0) {
  console.log('All tests passed.');
} else {
  console.error(`${failed} test(s) FAILED — see ✗ lines above.`);
  process.exit(1);
}
