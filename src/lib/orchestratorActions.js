// Action type → store call mapping + RACI permission check.
// All functions are pure / synchronous except executeAction (calls store setters).

import { getUserRolesForBuild, canEditDesignSection, isQATeamLead } from './roleAccess.js';
import { runSmartScan } from './smartScan.js';
import { getDefaultDesignValues } from './designDefaults.js';
import { useStore } from '../store/useStore.js';

// ── Permission check ──────────────────────────────────────────────────────────
// Returns { allowed: true } or { allowed: false, reason: string }

export function checkPermission(action, authUser, s) {
  const isPM = !!(authUser?.email && authUser.email === s.requirements?.pmEmail);
  if (isPM) return { allowed: true };

  const userRoles = getUserRolesForBuild(authUser, s.roleAssignments);

  switch (action.type) {
    case 'SET_CTX':
    case 'SET_REQUIREMENT':
      // Allow when no PM is assigned (Phase 1 setup or guest mode)
      if (!s.requirements?.pmEmail) return { allowed: true };
      return { allowed: false, reason: 'Only the PM can change stack or project settings.' };

    case 'RUN_SCAN':
      // Allow if stack is built and scan not yet done
      if (!s.isBuilt) return { allowed: false, reason: 'Build the stack first before running a scan.' };
      return { allowed: true };

    case 'SET_DESIGN_FIELD': {
      const ok = canEditDesignSection(userRoles, action.params?.section);
      return ok
        ? { allowed: true }
        : { allowed: false, reason: `Your role does not own the "${action.params?.section}" design section.` };
    }

    case 'SET_ROLE_ASSIGNMENT':
      if (!s.requirements?.pmEmail) return { allowed: true };
      return { allowed: false, reason: 'Only the PM can assign roles.' };

    case 'BUILD':
      // Allow in Phase 1 (pre-build) when no PM gate set
      if (!s.requirements?.pmEmail) return { allowed: true };
      return isPM ? { allowed: true } : { allowed: false, reason: 'Only the PM can trigger the build.' };

    case 'APPLY_DESIGN':
    case 'INJECT_PHASE2':
    case 'SUBMIT_CAB':
      if (!s.requirements?.pmEmail) return { allowed: true };
      return { allowed: false, reason: 'Only the PM can advance major workflow gates.' };

    case 'SIGN_RTM': {
      if (!s.requirements?.pmEmail) return { allowed: true };
      const qaLead = isQATeamLead(authUser, s.roleAssignments);
      return qaLead
        ? { allowed: true }
        : { allowed: false, reason: 'RTM sign-off requires PM or QA Team Lead.' };
    }

    case 'PROMOTE':
      if (!s.requirements?.pmEmail) return { allowed: true };
      return { allowed: false, reason: 'Only the PM can promote to live production.' };

    case 'TOGGLE_INC':
    case 'TOGGLE_UUM':
    case 'SET_RTM_ROW':
    case 'ADD_INCIDENT':
    case 'ADD_UUM_ITEM':
      // Any assigned role can adjust scope / set RTM rows
      return userRoles.length > 0
        ? { allowed: true }
        : { allowed: false, reason: 'No role assigned for you in this build.' };

    case 'UNLOCK_FOR_REVISION':
    case 'RESUBMIT_CAB':
      if (!s.requirements?.pmEmail) return { allowed: true };
      return { allowed: false, reason: 'Only the PM can manage the CAB revision cycle.' };

    case 'SET_CLOSURE_CHECK':
      // Anyone on the team can tick closure items
      return { allowed: true };

    default:
      return { allowed: true };
  }
}

// ── Action executor ───────────────────────────────────────────────────────────
// store = useStore() result (contains both state and action setters)

export function executeAction(action, store) {
  const { type, params } = action;

  switch (type) {
    case 'SET_CTX': {
      // Read FRESH ctx from Zustand getState() to avoid stale closure when
      // multiple SET_CTX actions fire in quick succession (each must see the
      // previous change, not the render-time snapshot).
      const freshCtx = useStore.getState().ctx || {};
      store.setCtx({ ...freshCtx, [params.key]: params.value });
      break;
    }

    case 'SET_REQUIREMENT': {
      const freshReqs = useStore.getState().requirements || {};
      store.setRequirements({ ...freshReqs, [params.key]: params.value });
      break;
    }

    case 'SET_DESIGN_FIELD':
      store.setDesignField(params.section, params.field, params.value);
      break;

    case 'TOGGLE_INC':
      store.toggleInc(params.code);
      break;

    case 'TOGGLE_UUM':
      store.toggleUUM(params.code);
      break;

    case 'SET_RTM_ROW':
      store.setRtmRow(params.id, params.status);
      break;

    case 'SET_ROLE_ASSIGNMENT':
      store.setRoleAssignment(params.role, params.data);
      break;

    case 'BUILD': {
      // Always read fresh ctx so we pick up SET_CTX calls made in the same tick
      const freshCtx = useStore.getState().ctx || {};
      const buildCtx = {
        hw: params?.hw || freshCtx.hw || '',
        os: params?.os || freshCtx.os || '',
        db: params?.db || freshCtx.db || '',
        app: params?.app || freshCtx.app || '',
      };
      if (buildCtx.hw && buildCtx.os && buildCtx.db && buildCtx.app) {
        store.build(buildCtx);
        const defaults = getDefaultDesignValues(buildCtx);
        store.setAllDesignFields(defaults);
      }
      break;
    }

    case 'APPLY_DESIGN':
      store.applyDesign();
      break;

    case 'INJECT_PHASE2':
      store.startPhase2();
      break;

    case 'SUBMIT_CAB':
      store.setCabApproved(false); // resets to pending; PhasePanel handles actual submit
      // Trigger the cabinet submission state (same as clicking Submit in sidebar)
      store.setCabApproved(true);
      break;

    case 'SIGN_RTM':
      store.signRtm();
      break;

    case 'PROMOTE':
      store.promote();
      break;

    case 'RUN_SCAN': {
      const results = runSmartScan(store.ctx);
      store.completeScan(results);
      // Auto-select all suggested incidents and UUM items so the sidebar shows them immediately
      const fresh = useStore.getState();
      const curInc = fresh.selInc || [];
      const curUUM = fresh.selUUM || [];
      (results.suggestedInc || []).forEach(code => { if (!curInc.includes(code)) store.toggleInc(code); });
      (results.suggestedUUM || []).forEach(code => { if (!curUUM.includes(code)) store.toggleUUM(code); });
      break;
    }

    case 'ADD_CUSTOM_TASK':
      store.addCustomMentorTask(params);
      break;

    case 'ADD_RAID_ENTRY':
      store.addCustomRaidEntry(params);
      break;

    case 'ADD_INCIDENT': {
      // params: { id, code, short, txt, grp, sev, owner, layers }
      const incId = params.id || params.code || `INC-MENTOR-${Date.now()}`;
      const incRecord = {
        id: incId,
        code: incId,
        short: params.short || params.title || incId,
        txt: params.txt || params.description || params.short || '',
        grp: params.grp || params.group || 'Custom',
        sev: params.sev || params.severity || 'HIGH',
        owner: params.owner || 'SysAdmin',
        layers: params.layers || [],
      };
      store.addCustomInc(incRecord);
      store.toggleInc(incId);
      break;
    }

    case 'ADD_UUM_ITEM': {
      // params: { id, short, txt, grp, layer, type, layers }
      const uumId = params.id || `UUM-MENTOR-${Date.now()}`;
      const uumRecord = {
        id: uumId,
        short: params.short || params.title || uumId,
        txt: params.txt || params.description || params.short || '',
        grp: params.grp || params.group || 'Custom',
        layer: params.layer || params.primaryLayer || 'os',
        type: params.type || 'upgrade',
        layers: params.layers || [params.layer || 'os'],
      };
      store.addCustomUUM(uumRecord);
      store.toggleUUM(uumId);
      break;
    }

    case 'NAVIGATE_TAB':
      store.setActiveTab(params.tab);
      break;

    case 'ADD_VULNERABILITY': {
      const now = new Date().toISOString();
      store.addVuln({
        id: params.id || `VULN-${Date.now()}`,
        title: params.title || params.short || 'Unknown vulnerability',
        cveId: params.cveId || null,
        component: params.component || params.field || 'Unknown',
        severity: params.severity || 'HIGH',
        description: params.description || params.txt || '',
        status: params.status || 'ACTIVE',
        businessDecision: params.businessDecision || '',
        workaround: params.workaround || '',
        source: params.source || 'mentor-chat',
        addedAt: now,
        updatedAt: now,
        fixTargetDate: params.fixTargetDate || null,
      });
      break;
    }

    case 'ADD_STAKEHOLDER_DISCUSSION': {
      store.addStakeholderDiscussion({
        id: params.id || `DISC-${Date.now()}`,
        topic: params.topic || '',
        question: params.question || '',
        owner: params.owner || 'PM',
        type: params.type || 'team-agreement',
        status: params.status || 'PENDING',
        addedAt: new Date().toISOString(),
        resolvedAt: null,
        notes: params.notes || '',
      });
      break;
    }

    case 'UNLOCK_FOR_REVISION':
      store.setUnlockedForRevision(true);
      break;

    case 'RESUBMIT_CAB':
      store.resubmitCAB();
      break;

    case 'SET_CLOSURE_CHECK':
      store.setClosureCheck(params.id, params.value ?? true);
      break;

    default:
      console.warn('[Orchestrator] Unknown action type:', type);
  }
}

// ── Compact state context for Groq ────────────────────────────────────────────

export function buildStateContext(s, authUser) {
  const isPM     = !!(authUser?.email && authUser.email === s.requirements?.pmEmail);
  const userRoles = getUserRolesForBuild(authUser, s.roleAssignments || {});

  const phase = s.promoted    ? 'LIVE'
    : s.rtmSigned             ? 'RTM_SIGNED'
    : s.cabApproved           ? 'CAB_APPROVED'
    : s.cabDeclined           ? 'CAB_DECLINED'
    : s.phase2Active          ? 'PHASE2_ACTIVE'
    : s.designApplied         ? 'DESIGN_APPLIED'
    : s.scanComplete          ? 'SCAN_COMPLETE'
    : s.isBuilt               ? 'BUILT'
    : 'BLANK';

  const rtmCounts = Object.values(s.rtmRows || {}).reduce((acc, v) => {
    acc[v] = (acc[v] || 0) + 1; return acc;
  }, {});

  const assignedRoles = Object.entries(s.roleAssignments || {})
    .filter(([, v]) => v?.name)
    .map(([role, v]) => `${role}=${v.name}<${v.email}>`)
    .join('; ');

  const filledSections = Object.entries(s.sysDesignData || {})
    .filter(([, fields]) => Object.values(fields || {}).some(v => String(v || '').trim()))
    .map(([sec]) => sec)
    .join(', ');

  return {
    phase,
    stack:    `${s.ctx?.hw || '?'}/${s.ctx?.os || '?'}/${s.ctx?.db || '?'}/${s.ctx?.app || '?'}`,
    project:  s.requirements?.projectName || 'Unnamed',
    envType:  s.requirements?.envType     || 'Production',
    goLive:   s.requirements?.goLiveDate  || 'not set',
    sla:      s.requirements?.sla         || 'not set',
    incidents: s.selInc?.length || 0,
    uumItems:  s.selUUM?.length || 0,
    rtmCounts,
    tasksStale:   !!s.tasksStaleReason,
    rtmStale:     s.rtmStale,
    alerts:   (s.coherenceAlerts || []).filter(a => a.severity === 'warn').slice(0, 3).map(a => a.message),
    assignedRoles,
    filledDesignSections: filledSections,
    isPM,
    userRoles,
    userEmail: authUser?.email || 'guest',
  };
}
