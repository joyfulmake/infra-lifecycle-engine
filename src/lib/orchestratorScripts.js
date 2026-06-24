// Pure function — no React, no deps.
// Reads a Zustand state snapshot and returns a contextual dialogue script
// (Guide + Learner lines) with Cartesia Sonic-2 voice/emotion metadata.
//
// Voice roles:
//   guide   — warm female voice (b7d50908) — narrates, explains, guides
//   learner — clear male voice  (694f9389) — asks, clarifies, reflects
//
// Each line: { voice, text, speed, emotion: string[], pauseAfter?: ms }
// speed: 'slowest'|'slow'|'normal'|'fast'|'fastest'
// emotion: Cartesia emotion strings e.g. 'positivity:high', 'curiosity:medium'

function g(text, speed = 'normal', emotion = [], pauseAfter = 0) {
  return { voice: 'guide', text, speed, emotion, pauseAfter };
}
function l(text, speed = 'normal', emotion = [], pauseAfter = 0) {
  return { voice: 'learner', text, speed, emotion, pauseAfter };
}

function rtmCount(rtmRows, status) {
  return Object.values(rtmRows || {}).filter(v => v === status).length;
}

export function generateScript(s) {
  const {
    isBuilt          = false,
    scanComplete     = false,
    designApplied    = false,
    phase2Active     = false,
    cabApproved      = false,
    cabDeclined      = false,
    rtmSigned        = false,
    promoted         = false,
    tasksStaleReason = null,
    rtmStale         = false,
    unlockedForRevision = false,
    coherenceAlerts  = [],
    selInc           = [],
    selUUM           = [],
    ctx              = {},
    requirements     = {},
    rtmRows          = {},
    closureChecks    = {},
  } = s;

  const stack   = [ctx.hw, ctx.os, ctx.db, ctx.app].filter(Boolean).join(' / ') || 'your stack';
  const project = requirements?.projectName || 'this project';
  const warns   = coherenceAlerts.filter(a => a.severity === 'warn');
  const failRows    = rtmCount(rtmRows, 'FAIL');
  const pendingRows = rtmCount(rtmRows, 'PENDING');

  // Priority order: most urgent state first

  // 1. Live with stale RTM — potential rollback risk
  if (promoted && rtmStale) {
    return {
      id: 'live_rtm_stale',
      title: 'Live system — RTM has drifted',
      nextAction: 'Review RTM — assess rollback',
      nextTab: 'rtm',
      lines: [
        g(`${project} is live, but the Requirements Traceability Matrix has drifted since sign-off.`,
          'slow', ['positivity:low', 'curiosity:high'], 500),
        l('Does that mean we deployed against a stale baseline?',
          'normal', ['curiosity:high'], 200),
        g('Correct. Changes were made after RTM sign-off. Open the RTM tab, review every row, then either dismiss the flag or initiate a rollback assessment with the CAB board.',
          'slow', ['positivity:low'], 0),
      ],
    };
  }

  // 2. CAB declined — revision mode unlocked
  if (unlockedForRevision) {
    return {
      id: 'revision_mode',
      title: 'Revision mode — CAB declined',
      nextAction: 'Revise scope → resubmit to CAB',
      nextTab: 'design',
      lines: [
        g('CAB declined the change request. All tab locks have been lifted for revision.',
          'slow', ['positivity:low'], 400),
        l('What should we update first?',
          'normal', ['curiosity:high'], 200),
        g('Address the CAB feedback in the relevant tabs — system design, incident scope, or the RTM. Once corrections are complete, click Resubmit to CAB in the sidebar to re-enter the approval gate.',
          'normal', ['positivity:medium'], 0),
      ],
    };
  }

  // 3. Live — work through closure
  if (promoted) {
    const done  = Object.values(closureChecks).filter(Boolean).length;
    const total = Object.keys(closureChecks).length;
    return {
      id: 'promoted',
      title: 'System live — complete closure',
      nextAction: 'Complete closure checklist',
      nextTab: 'closure',
      lines: [
        g(`${project} is live on ${stack}. ${done} of ${total || 'the'} closure checks are complete.`,
          'normal', ['positivity:high'], 400),
        l('What is still left to wrap up?',
          'normal', ['curiosity:medium'], 200),
        g('Use the Closure tab to tick off hypercare monitoring, CMDB updates, lesson-learned notes, and formal sign-off from all team leads. Do not declare the project closed until every item is green.',
          'slow', ['positivity:medium'], 0),
      ],
    };
  }

  // 4. All gates clear — cutover ready
  if (rtmSigned && cabApproved && !promoted) {
    return {
      id: 'ready_cutover',
      title: 'All gates cleared — proceed to cutover',
      nextAction: 'Initiate cutover in the sidebar',
      nextTab: null,
      lines: [
        g(`CAB approval confirmed and the RTM is signed for ${project}. All pre-conditions for cutover are met.`,
          'normal', ['positivity:high'], 400),
        l('So we can promote to production now?',
          'fast', ['positivity:high', 'curiosity:medium'], 200),
        g('Yes. Confirm your outage window is active and all leads are on the bridge call, then click Promote to Live in the left sidebar. That action is the point of no return.',
          'slow', ['positivity:high'], 0),
      ],
    };
  }

  // 5. CAB approved but RTM has drifted
  if (cabApproved && rtmStale) {
    return {
      id: 'cab_rtm_stale',
      title: 'RTM stale — re-review before cutover',
      nextAction: 'Re-review and re-sign RTM',
      nextTab: 'rtm',
      lines: [
        g(`CAB approved ${project}, but the scope changed after RTM sign-off.`,
          'slow', ['positivity:medium'], 400),
        l('Does that invalidate the CAB approval?',
          'normal', ['curiosity:high'], 200),
        g('Potentially. Walk through each RTM row to confirm the new changes are fully covered, then re-sign. If the delta is material, raise it with the change manager before cutting over.',
          'normal', ['positivity:medium'], 0),
      ],
    };
  }

  // 6. CAB approved — sign off the RTM
  if (cabApproved && !rtmSigned) {
    const issues = failRows + pendingRows;
    return {
      id: 'rtm_pending',
      title: 'CAB approved — sign off the RTM',
      nextAction: issues > 0 ? `Resolve ${issues} RTM rows` : 'Sign RTM',
      nextTab: 'rtm',
      lines: [
        g(`CAB approved the change. ${issues > 0
            ? `${issues} RTM row${issues !== 1 ? 's' : ''} still need attention.`
            : 'All RTM rows look good — ready for sign-off.'}`,
          'normal', ['positivity:high'], 300),
        l(issues > 0 ? `Which rows have problems?` : 'Then we just sign it off?',
          'normal', ['curiosity:medium'], 200),
        g(issues > 0
            ? `Open the RTM tab. ${failRows > 0 ? `${failRows} FAIL` : ''}${failRows > 0 && pendingRows > 0 ? ' and ' : ''}${pendingRows > 0 ? `${pendingRows} PENDING` : ''} — each needs a disposition before you sign.`
            : 'Correct. Open the RTM tab, verify the rows, and click Sign RTM to lock the scope baseline for cutover.',
          'normal', ['positivity:medium'], 0),
      ],
    };
  }

  // 7. CAB declined — not yet unlocked for revision
  if (cabDeclined && !unlockedForRevision) {
    return {
      id: 'cab_declined',
      title: 'CAB declined — unlock for revision',
      nextAction: 'Click Unlock for Revision in the sidebar',
      nextTab: null,
      lines: [
        g('The CAB board has declined this change request.',
          'slow', ['positivity:low'], 400),
        l('What do we do now?',
          'normal', ['curiosity:high'], 200),
        g('In the left sidebar, click Unlock Tabs for Revision. That lifts all phase gates so you can update the design, scope, and task schedule before resubmitting.',
          'normal', ['positivity:medium'], 0),
      ],
    };
  }

  // 8. Tasks stale — regenerate before CAB
  if (tasksStaleReason && phase2Active) {
    return {
      id: 'tasks_stale',
      title: 'Gantt tasks are stale',
      nextAction: 'Regenerate tasks in the Gantt tab',
      nextTab: 'gantt',
      lines: [
        g(`The task schedule is out of sync with the current scope. ${tasksStaleReason}`,
          'slow', ['positivity:low'], 400),
        l('Do we need to redo all the tasks?',
          'normal', ['curiosity:high'], 200),
        g('Open the Gantt tab and click Regenerate. The scheduler will rebuild the task list from your current UUM items, incidents, and design fields. Do this before submitting to CAB — the board reviews the task schedule.',
          'normal', ['positivity:medium'], 0),
      ],
    };
  }

  // 9. Cross-tab coherence warnings
  if (warns.length > 0 && phase2Active) {
    const w = warns[0];
    return {
      id: 'coherence_warn',
      title: `${warns.length} cross-tab conflict${warns.length !== 1 ? 's' : ''} detected`,
      nextAction: 'Review highlighted tabs',
      nextTab: w.tabs?.[0] || null,
      lines: [
        g(`There ${warns.length === 1 ? 'is' : 'are'} ${warns.length} cross-tab conflict${warns.length !== 1 ? 's' : ''} flagged in the coherence panel.`,
          'normal', ['positivity:medium', 'curiosity:low'], 400),
        l('What kind of conflicts?',
          'normal', ['curiosity:high'], 200),
        g(`The most urgent: "${w.message}". ${w.action ? w.action : 'Check the highlighted tabs for details.'}`,
          'slow', ['positivity:medium'], 0),
      ],
    };
  }

  // 10. Phase 2 active — working toward CAB
  if (phase2Active && !cabApproved && !cabDeclined) {
    return {
      id: 'phase2_active',
      title: 'Phase 2 in progress — build toward CAB',
      nextAction: 'Complete Gantt schedule → submit to CAB',
      nextTab: 'gantt',
      lines: [
        g(`Phase 2 is active for ${project} on ${stack}. You have ${selInc.length} incident${selInc.length !== 1 ? 's' : ''} and ${selUUM.length} UUM item${selUUM.length !== 1 ? 's' : ''} in scope.`,
          'normal', ['positivity:medium'], 300),
        l('What is the path from here to CAB submission?',
          'normal', ['curiosity:medium'], 200),
        g('Complete the Gantt schedule — review the task list, set the project start date, confirm no stale tasks. Then use the Submit to CAB button in the sidebar once the design is locked and the schedule is clean.',
          'slow', ['positivity:high'], 0),
      ],
    };
  }

  // 11. Design applied — inject Phase 2
  if (designApplied && !phase2Active) {
    return {
      id: 'inject_phase2',
      title: 'Design locked — inject Phase 2',
      nextAction: 'Inject Phase 2 in the sidebar',
      nextTab: null,
      lines: [
        g(`The system design for ${stack} is locked. Phase 2 is next — it injects the incident triage, UUM task matrix, and Gantt schedule.`,
          'normal', ['positivity:medium'], 400),
        l('Where do I trigger Phase 2?',
          'normal', ['curiosity:high'], 200),
        g('Scroll to Phase 2 in the left sidebar and click Inject Phase 2. You will then select incidents and UUM items relevant to your migration scope before the Gantt and RTM tabs unlock.',
          'slow', ['positivity:high'], 0),
      ],
    };
  }

  // 12. Scan done — apply design
  if (scanComplete && !designApplied) {
    return {
      id: 'apply_design',
      title: 'Scan complete — review and apply design',
      nextAction: 'Open System Design tab → fill 8 sections → click Generate Task Plan',
      nextTab: 'design',
      lines: [
        g(`The AI Smart Scan is complete for ${stack}. Design defaults have been suggested based on your hardware and software choices.`,
          'normal', ['positivity:high'], 400),
        l('Should I review those defaults before applying?',
          'normal', ['curiosity:high'], 200),
        g('Always review, never skip. Open System Design and step through all eight sections — pay particular attention to TLS version, backup RPO/RTO, and SIEM. Those three are the most common CAB rejection triggers. When every field is set, click Generate Task Plan to lock the design and build the Gantt schedule in one action.',
          'slow', ['positivity:medium'], 0),
      ],
    };
  }

  // 13. Built — run scan
  if (isBuilt && !scanComplete) {
    return {
      id: 'run_scan',
      title: 'Stack selected — run AI Smart Scan',
      nextAction: 'Run AI Smart Scan in the sidebar',
      nextTab: null,
      lines: [
        g(`${stack} is selected for ${project}. The AI Smart Scan checks CVEs, end-of-life status, and compatibility before you lock the design.`,
          'normal', ['positivity:high'], 400),
        l('How long does the scan take?',
          'normal', ['curiosity:medium'], 200),
        g('It runs entirely in the browser — no API key needed. Usually under two seconds. It cross-references your stack against known CVE patterns and lifecycle dates, then surfaces recommended incidents and UUM items.',
          'normal', ['positivity:high'], 0),
      ],
    };
  }

  // 14. Welcome / blank state
  return {
    id: 'welcome',
    title: 'Welcome — start with your stack',
    nextAction: 'Select hardware, OS, DB, and App in the sidebar',
    nextTab: null,
    lines: [
      g('I am OpsMentor — your embedded infrastructure lifecycle advisor. I read your entire build at every phase and surface the risks that matter, before they become blockers.',
        'slow', ['positivity:high'], 600),
      l('What should I enter first?',
        'normal', ['curiosity:high'], 300),
      g('Start in the left sidebar: Hardware, OS, Database, and Application. I cross-check for EOL dates and compatibility conflicts the moment each field is set. Once all four are in, I run the AI Smart Scan and generate your design baseline automatically.',
        'slow', ['positivity:medium'], 0),
    ],
  };
}

// ── Workflow state checklist for the panel header ─────────────────────────

export function getWorkflowChecklist(s) {
  const allClosed = Object.values(s.closureChecks || {}).length > 0 &&
    Object.values(s.closureChecks || {}).every(Boolean);
  return [
    { id: 'build',   label: 'Stack',    done: s.isBuilt,      warn: false },
    { id: 'scan',    label: 'Scan',     done: s.scanComplete,  warn: false },
    { id: 'design',  label: 'Design',   done: s.designApplied, warn: false },
    { id: 'phase2',  label: 'Phase 2',  done: s.phase2Active,  warn: false },
    { id: 'cab',     label: 'CAB',      done: s.cabApproved,   warn: s.cabDeclined },
    { id: 'rtm',     label: 'RTM',      done: s.rtmSigned,     warn: s.rtmStale },
    { id: 'live',    label: 'Live',     done: s.promoted,      warn: false },
    { id: 'closure', label: 'Closure',  done: s.promoted && allClosed, warn: false },
  ];
}
