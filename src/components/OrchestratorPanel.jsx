import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ── Pre-built command token set — O(1) per word vs O(regex_count × text_len) ──
// Words/phrases that signal the user is issuing a command, not answering a field prompt.
// Compiled once at module load; checked by splitting the message into words.
const COMMAND_TOKENS = new Set([
  'build','build it','build now','run scan','scan','skip','next','cancel','help',
  'status','what','done','ready','inject','submit cab','sign rtm','go live','promote',
  'ai scan','add','set','update','log','record','note','track','create','insert',
  'risk','task','issue','decision','assumption','gantt','raid','design','incident',
  'uum','field','section','network','storage','backup','security','server','firewall',
  'load balancer','tls','ssl','certificate','patch','monitoring','alert','sla','rto',
  'rpo','add to','update in','set in','change in','what is','what are','show me',
  'how do','explain','describe','list','overview','summary',
  'compare','comparison','difference','different','versus','vs','competing','market',
  'how','why','when','where','who','tell me','is it','are there','can you','does it',
]);
// Single-word trigger prefixes — message starts with these AND is > 10 chars
const COMMAND_PREFIXES = new Set(['add','set','update','log','note','create','show','explain','compare','how','why','when','where','who','what','is','are','can','does','did','would','should','tell']);

function isCommandMessage(tl) {
  // Any question is always for the LLM — never treat as a field value
  if (tl.includes('?')) return true;
  // Messages starting with interrogative or comparison words
  if (/^(how|why|when|where|who|compare|tell me|explain|is |are |can |does |did |would |should |what about|what if)/.test(tl)) return true;
  // Fast path: split into unigrams and bigrams, check against Set
  const words = tl.split(/\s+/);
  for (const w of words) {
    if (COMMAND_TOKENS.has(w)) return true;
  }
  // Bigram check
  for (let i = 0; i < words.length - 1; i++) {
    if (COMMAND_TOKENS.has(`${words[i]} ${words[i + 1]}`)) return true;
  }
  // Prefix check: starts with command word + long enough to not be a field value
  if (COMMAND_PREFIXES.has(words[0]) && tl.length > 10) return true;
  return false;
}
import { useStore } from '../store/useStore.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useBuildsDb } from '../lib/useBuildsDb.js';
import { generateScript, getWorkflowChecklist } from '../lib/orchestratorScripts.js';
import { buildStateContext, checkPermission, executeAction } from '../lib/orchestratorActions.js';
import { sendChatMessage, ruleBasedResponse, parseRelativeDate, parseCompoundDateRange, scanInputLive } from '../lib/orchestratorChat.js';
import { computeAllRisks, riskScore, riskLabel } from '../lib/riskEngine.js';

function buildPastBuildsSummary(builds, currentBuildId, currentCtx) {
  if (!builds || builds.length === 0) return null;
  const past = builds.filter(b =>
    b.id !== currentBuildId &&
    (b.ctx?.hw || b.ctx?.os || b.ctx?.db || b.ctx?.app)
  );
  if (past.length === 0) return null;

  const score = b => {
    let s = 0;
    if (currentCtx?.hw && b.ctx?.hw && currentCtx.hw === b.ctx.hw) s += 3;
    if (currentCtx?.os && b.ctx?.os && currentCtx.os === b.ctx.os) s += 2;
    if (currentCtx?.db && b.ctx?.db && currentCtx.db === b.ctx.db) s += 3;
    if (currentCtx?.app && b.ctx?.app && currentCtx.app === b.ctx.app) s += 2;
    return s;
  };

  return past
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3)
    .map(b => {
      const phase = b.promoted ? 'LIVE' : b.rtmSigned ? 'RTM_SIGNED' : b.cabApproved ? 'CAB_APPROVED'
        : b.phase2Active ? 'PHASE2_ACTIVE' : b.designApplied ? 'DESIGN_APPLIED' : b.isBuilt ? 'BUILT' : 'BLANK';
      const stack = [b.ctx?.hw, b.ctx?.os, b.ctx?.db, b.ctx?.app].filter(Boolean).join('/');
      const raid = (b.raidLog || []).slice(0, 3).map(r => `${r.type}: ${r.description}`).join('; ');
      const inc = (b.selInc || []).length;
      const uum = (b.selUUM || []).length;
      const date = b.updatedAt ? new Date(b.updatedAt).toLocaleDateString() : null;
      return [
        `"${b.name || 'Unnamed'}" [${stack}] Phase:${phase}${date ? ' Updated:' + date : ''}`,
        `  Incidents:${inc} UUM:${uum}${raid ? '\n  RAID: ' + raid : ''}`,
      ].join('\n');
    })
    .join('\n');
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg, onChipClick, onSuggestionClick }) {
  const isUser   = msg.role === 'user';
  const isResult = msg.role === 'result';
  const isLog    = msg.role === 'log';
  const isNudge  = msg.role === 'nudge';

  if (isResult) {
    return (
      <div className="flex justify-center">
        <span className="text-xs px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
          {msg.text}
        </span>
      </div>
    );
  }

  // Auto-logged workflow events — compact single-line strip
  if (isLog) {
    return (
      <div className="flex items-start gap-2 py-1">
        <span className="text-teal-500 flex-shrink-0 mt-0.5" style={{ fontSize: 10 }}>✓</span>
        <span className="text-xs text-slate-500 leading-snug">{msg.text}</span>
      </div>
    );
  }

  // Inactivity nudge — subtle prompt
  if (isNudge) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-xs text-slate-500 italic">
        <span className="text-slate-400">→</span>
        {msg.text}
      </div>
    );
  }

  return (
    <div className={['flex gap-2.5', isUser ? 'justify-end' : 'justify-start'].join(' ')}>
      {!isUser && (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-sm"
          style={{ fontSize: 9, fontWeight: 800, background: 'linear-gradient(135deg, #0f172a 0%, #0d4f4f 100%)' }}
        >AI</div>
      )}
      <div className="flex flex-col gap-1.5 max-w-[85%]">
        <div className={[
          'rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-tr-sm shadow-sm'
            : 'orch-bubble-ai bg-slate-50 text-slate-800 rounded-tl-sm border-l-2 border-teal-500 shadow-sm',
        ].join(' ')}>
          {msg.text}
        </div>
        {!isUser && msg.chips && msg.chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-0.5">
            {msg.chips.map((chip, i) => (
              <button
                key={i}
                onClick={() => onChipClick?.(chip)}
                className="px-3 py-1 rounded-full text-xs font-semibold border border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors cursor-pointer"
              >
                {chip.label} →
              </button>
            ))}
          </div>
        )}
        {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-0.5 mt-0.5">
            {msg.suggestions.map((q, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick?.(q)}
                className="px-2.5 py-1 rounded-lg text-xs border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-colors cursor-pointer text-left"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Confirmation card ─────────────────────────────────────────────────────────

function ConfirmCard({ actions, onConfirm, onCancel }) {
  const significant = actions.filter(a => a.requiresConfirmation);
  const immediate   = actions.filter(a => !a.requiresConfirmation);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 space-y-2.5">
      <div className="text-xs font-semibold text-amber-800">Here's what I'd do — your call</div>
      {[...immediate, ...significant].map((a, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <span className={[
            'mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold',
            a.requiresConfirmation ? 'bg-amber-500' : 'bg-teal-500',
          ].join(' ')} style={{ fontSize: 8 }}>
            {a.requiresConfirmation ? '?' : '✓'}
          </span>
          <span className="text-slate-700 leading-snug">{a.description}</span>
        </div>
      ))}
      <div className="flex gap-2 pt-1.5">
        <button
          onClick={onConfirm}
          className="flex-1 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-colors"
        >
          Yes, go ahead
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-white text-slate-600 text-sm font-medium border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Workflow checklist ────────────────────────────────────────────────────────

function WorkflowStrip({ items }) {
  return (
    <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-slate-100 bg-slate-50 flex-shrink-0">
      {items.map(item => (
        <span key={item.id} className={[
          'text-xs px-1.5 py-0.5 rounded font-medium',
          item.done ? 'bg-teal-100 text-teal-700'
          : item.warn ? 'bg-amber-100 text-amber-700'
          : 'bg-white text-slate-400 border border-slate-100',
        ].join(' ')}>
          {item.done ? '✓' : item.warn ? '!' : '○'} {item.label}
        </span>
      ))}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function OrchestratorPanel({ docked = false, onCollapsedChange, initialCollapsed = false }) {
  const store = useStore();
  const { authUser } = useAuth();
  const { builds } = useBuildsDb(authUser);

  const s = {
    isBuilt:             store.isBuilt,
    scanComplete:        store.scanComplete,
    designApplied:       store.designApplied,
    phase2Active:        store.phase2Active,
    cabApproved:         store.cabApproved,
    cabDeclined:         store.cabDeclined,
    rtmSigned:           store.rtmSigned,
    promoted:            store.promoted,
    tasksStaleReason:    store.tasksStaleReason,
    rtmStale:            store.rtmStale,
    unlockedForRevision: store.unlockedForRevision,
    coherenceAlerts:     store.coherenceAlerts,
    selInc:              store.selInc,
    selUUM:              store.selUUM,
    ctx:                 store.ctx,
    requirements:        store.requirements,
    rtmRows:             store.rtmRows,
    roleAssignments:     store.roleAssignments,
    closureChecks:       store.closureChecks,
    sysDesignData:       store.sysDesignData,
    activeTab:           store.activeTab,
    vulnRegistry:        store.vulnRegistry        || [],
    stakeholderDiscussions: store.stakeholderDiscussions || [],
    actionAuditLog:      store.actionAuditLog       || [],
    riskAcknowledgments: store.riskAcknowledgments  || {},
    costConfig:          store.costConfig            || {},
    liveEolData:         store.liveEolData           || {},
    selFix:              store.selFix                || [],
    scanResults:         store.scanResults           || {},
    raidLog:             store.raidLog               || [],
    aiTasks:             store.aiTasks               || [],
  };

  // Primitive extracts for stable dependency arrays
  const ctxHw  = store.ctx?.hw  || '';
  const ctxOs  = store.ctx?.os  || '';
  const ctxDb  = store.ctx?.db  || '';
  const ctxApp = store.ctx?.app || '';
  const reqProjectName      = store.requirements?.projectName      || '';
  const reqEnvType          = store.requirements?.envType          || '';
  const reqGoLiveDate       = store.requirements?.goLiveDate       || '';
  const reqSla              = store.requirements?.sla              || '';
  const reqProjectStartDate = store.requirements?.projectStartDate || '';

  // Stable primitives for deep state sync — each drives a separate useEffect dependency
  const selIncCount        = (store.selInc  || []).length;
  const selUumCount        = (store.selUUM  || []).length;
  const rtmPassCount       = Object.values(store.rtmRows || {}).filter(v => v === 'PASS').length;
  const rtmFailCount       = Object.values(store.rtmRows || {}).filter(v => v === 'FAIL').length;
  const rtmNaCount         = Object.values(store.rtmRows || {}).filter(v => v === 'NA').length;
  const closureCheckCount  = Object.values(store.closureChecks || {}).filter(Boolean).length;
  const closureTotalCount  = Object.keys(store.closureChecks || {}).length;
  const rolesFilledCount   = Object.values(store.roleAssignments || {}).filter(v => v?.name).length;
  const coherenceWarnCount = (store.coherenceAlerts || []).filter(a => a.severity === 'warn').length;
  const raidCount          = (store.raidLog || []).length;
  const rtmTotalCount      = Object.keys(store.rtmRows || {}).length;

  const pastBuildsSummary = useMemo(
    () => buildPastBuildsSummary(builds, store.currentBuildId, store.ctx),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [builds?.length, store.currentBuildId]
  );

  const [open,        setOpen]        = useState(false);  // OpsMentor activated
  const [panelVisible, setPanelVisible] = useState(false);  // panel UI shown
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [thinking,    setThinking]    = useState(false);
  const [userName,    setUserName]    = useState('');
  const [workerOk,    setWorkerOk]    = useState(null); // null=unknown, true=ok, false=blocked
  const [chipsField,  setChipsField]  = useState(null); // 'hw'|'os'|'db'|'app'|'envType'|null
  const [fullscreen,  setFullscreen]  = useState(false);
  const [collapsed,   setCollapsed]   = useState(initialCollapsed);
  const [liveHints,   setLiveHints]   = useState(null); // { eol, compat, detected } from scanInputLive

  // Notify parent (App.jsx) when collapsed state changes so container can resize
  const onCollapsedChangeRef = useRef(onCollapsedChange);
  onCollapsedChangeRef.current = onCollapsedChange;
  useEffect(() => { onCollapsedChangeRef.current?.(collapsed); }, [collapsed]);

  const abortRef        = useRef(null);
  const inputRef        = useRef(null);
  const bottomRef       = useRef(null);
  const msgId           = useRef(0);
  const pendingConfirmRef = useRef(null);
  // Tracks compat rule IDs confirmed this session — prevents re-prompting the same risk
  const acknowledgedCompatIds = useRef(new Set());
  // Rate limiter: timestamps of recent LLM calls — max 10 per minute
  const msgTimestampsRef = useRef([]);
  // Live input scanner timer
  const liveHintTimerRef = useRef(null);

  // Always-current refs to avoid stale closures in timers
  const userNameRef       = useRef('');
  const awaitingNameRef   = useRef(false); // name-asking removed — no gate on commands
  const awaitingFieldRef  = useRef(null); // 'hw'|'os'|'db'|'app'|'projectName'|'envType'|'goLiveDate'|null
  const pendingTaskRef    = useRef(null); // { title } waiting for gantt/raid choice
  const sRef                  = useRef(s);
  const authUserRef           = useRef(authUser);
  const messagesRef           = useRef([]);
  useEffect(() => { sRef.current = s; });
  useEffect(() => { authUserRef.current = authUser; }, [authUser]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);


  function getHistory(msgs) {
    return (msgs || [])
      .filter(m => m.role === 'user' || m.role === 'orchestrator')
      .slice(-12)
      .map(m => ({ role: m.role, text: m.text }));
  }

  const script    = generateScript(s);
  const checklist = getWorkflowChecklist(s);
  const hasAlerts = (s.coherenceAlerts || []).some(a => a.severity === 'warn')
    || !!s.tasksStaleReason || s.rtmStale;

  function nextId() { return ++msgId.current; }

  // Chat message — observational/agent-style, not interrogating.
  // Accepts optional state snapshot.
  function buildWelcome(state) {
    const st = state || s;
    const { hw, os, db, app } = st.ctx || {};
    const r = st.requirements || {};
    const proj = r.projectName;
    const goLive = r.goLiveDate ? ` — go-live ${r.goLiveDate}` : '';

    if (st.promoted)
      return `Hypercare window is open${proj ? ` for "${proj}"` : ''}. The first 48 hours are the highest-risk window — watch for connection pool exhaustion, job scheduler drift, and CMDB sync gaps. Those are the most common post-cutover surprises. Closure tab tracks every sign-off; export the audit trail once every item is green.`;
    if (st.rtmSigned && st.cabApproved)
      return `Every gate is cleared${goLive}. Before initiating cutover: confirm the bridge team is assembled, the rollback plan is rehearsed, and the change window is formally open with the CAB chair. The "Promote to Live" action in the sidebar is the point of no return.`;
    if (st.rtmSigned && !st.cabApproved)
      return `RTM is signed — scope is locked. CAB is the remaining gate. The board will focus on RAID log completeness, the Gantt critical path, and design-to-RTM traceability. Review those three before submitting.`;
    if (st.cabApproved)
      return `CAB approved${goLive}. RTM sign-off is next — every requirement row needs a disposition. A single FAIL or BLOCKED row blocks cutover; BLOCKED rows need an owner and a mitigation in the RAID log before sign-off.`;
    if (st.cabDeclined)
      return `CAB declined. The board most often pushes back on three things: an incomplete RAID log, a Gantt schedule that doesn't account for change freeze windows, or a gap between the design fields and the RTM requirements. Unlock the tabs, address those specifically, then resubmit.`;
    if (st.phase2Active)
      return `Phase 2 is active — incident and change tasks are now on the schedule. Before going to CAB: open the Gantt and look at tasks flagged CP (critical path). Any delay on those propagates directly to the go-live date.`;
    if (st.designApplied)
      return `Design is the locked baseline — every downstream RTM row traces back to a field you just set. Phase 2 maps your incident codes and UUM items to real change tasks; that's what populates the Gantt and the full RTM requirement list.`;
    if (st.scanComplete)
      return `Scan complete. System Design is next — all 8 sections (Network, Security, Storage, Backup, DR, Compliance, HA, Monitoring) set fields that downstream RTM rows will trace to. Gaps here become FAIL rows at sign-off, so go through each section deliberately.`;
    if (st.isBuilt) {
      if (/oracle/i.test(db) && /power|ppc/i.test(hw))
        return `For this platform and database combination, the scan will surface ppc64le Oracle certification gaps and fix-pack currency issues — those are the two most common CAB blockers for Power migrations. Run it before touching the design.`;
      if (/websphere/i.test(app))
        return `WebSphere Traditional carries TLS 1.0/1.1 cipher exposure and fix-pack requirements that will surface in the scan — run it now so the compliance section in System Design reflects real findings, not assumptions.`;
      if (/aix/i.test(os))
        return `AIX migrations carry extended support window risk — the scan will quantify exactly where this platform sits on the EOL timeline. That finding feeds directly into the CAB migration urgency question.`;
      if (/oracle/i.test(db))
        return `Oracle on this stack will surface RAC compatibility flags and fix-pack currency issues in the scan — important to capture before the design locks in the database tier configuration.`;
      return `The scan cross-checks this stack against live CVE feeds and EOL timelines — run it before locking 240+ fields of system design. Findings auto-populate the incident scope for Phase 2.`;
    }

    if (!hw)
      return `I'm OpsMentor — I guide the delivery team through the full provisioning lifecycle from platform selection to production cutover. Start with the hardware platform — AIX, IBM Power, and x86 each have fundamentally different middleware constraints, EOL timelines, and migration playbooks.`;
    if (!os) {
      const isAIX = /aix/i.test(hw);
      return isAIX
        ? `AIX is selected — the OS version will determine the extended support window and migration scope. AIX 7.1 is well into extended support; flag it early because the CAB board will ask.`
        : `OS version anchors the patch cycle, EOL timeline, and middleware compatibility. It's the foundation every other selection sits on — pick deliberately.`;
    }
    if (!db)
      return `Database engine is the next critical layer — it determines the maintenance window, backup strategy, and migration complexity. Oracle RAC and legacy Sybase have the longest change tails.`;
    if (!app)
      return `Last layer — application or middleware determines TLS configuration, clustering requirements, and session management approach. WebSphere and JBoss have specific fix-pack dependencies worth knowing upfront.`;
    if (!r.projectName)
      return `Give this build a name the CAB board will recognise — typically system name, environment, and purpose in one phrase. It appears on every export and every sign-off document.`;
    if (!r.envType)
      return `Environment type changes the approval path: Production means full CAB review and strict change windows. QA and Dev have faster tracks but different SLA thresholds and different RTM scrutiny.`;
    if (!r.projectStartDate)
      return `Project start date anchors the Gantt. The critical path calculation needs it to determine whether the go-live window is achievable given the full task scope.`;
    if (!r.goLiveDate)
      return `Go-live date sets the constraint everything is measured against. Add it now — the Gantt will immediately show whether the window is comfortable or dangerously tight.`;
    if (!r.sla)
      return `SLA tier sets incident response targets and shapes CAB criteria. High-SLA builds get more RTM scrutiny — the board will verify every row matches the declared SLA.`;

    return `All fields are set${proj ? ` for "${proj}"` : ''}. Click Build in the sidebar to lock the stack and start the AI scan workflow.`;
  }

  // ── Quick actions — contextual buttons for the current workflow phase ──────

  function getQuickActions() {
    if (!s.isBuilt) return [
      { id: 'set_hw',  label: 'Set Hardware',    fill: !!s.ctx?.hw },
      { id: 'set_os',  label: 'Set OS',          fill: !!s.ctx?.os },
      { id: 'set_db',  label: 'Set Database',    fill: !!s.ctx?.db },
      { id: 'set_app', label: 'Set App / MW',    fill: !!s.ctx?.app },
    ];
    if (!s.scanComplete) return [
      { id: 'run_scan', label: '▶ Run AI Scan', primary: true },
    ];
    if (!s.designApplied) return [
      { id: 'nav_design',    label: 'Open System Design', primary: true },
      { id: 'apply_design',  label: 'Apply Design' },
    ];
    if (!s.phase2Active) return [
      { id: 'inject_phase2', label: '▶ Inject Phase 2', primary: true },
    ];
    if (s.cabDeclined) return [
      { id: 'unlock_revision', label: 'Unlock for Revision', primary: true },
      { id: 'nav_design', label: 'Update Design' },
    ];
    if (!s.cabApproved && !s.cabDeclined) return [
      { id: 'nav_gantt',  label: 'Review Gantt' },
      { id: 'nav_raid',   label: 'RAID Log' },
      { id: 'submit_cab', label: '▶ Submit to CAB', primary: true },
    ];
    if (!s.rtmSigned) return [
      { id: 'nav_rtm',  label: 'Open RTM', primary: true },
      { id: 'sign_rtm', label: 'Sign RTM Off' },
    ];
    if (!s.promoted) return [
      { id: 'nav_closure', label: 'Closure Checklist' },
      { id: 'promote',     label: '▶ Go Live', primary: true },
    ];
    return [
      { id: 'nav_closure', label: 'Closure', primary: true },
    ];
  }

  function handleQuickAction(id) {
    switch (id) {
      case 'set_hw': case 'set_os': case 'set_db': case 'set_app': {
        const key = id.replace('set_', '');
        awaitingFieldRef.current = key;
        setChipsField(FIELD_CHIPS[key] ? key : null);
        setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: FIELD_QUESTIONS[key] }]);
        if (!FIELD_CHIPS[key]) setTimeout(() => inputRef.current?.focus(), 50);
        break;
      }
      case 'run_scan': {
        const stack = [sRef.current.ctx?.hw, sRef.current.ctx?.os, sRef.current.ctx?.db, sRef.current.ctx?.app].filter(Boolean).join(' / ');
        setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text:
          `Opening AI Smart Scan for ${stack || 'your stack'} — review findings in the popup, then click "Apply Results".` }]);
        // Dispatch event: PhasePanel opens the ScanModal with its animated popup
        window.dispatchEvent(new CustomEvent('opsmanifest-run-scan'));
        break;
      }
      case 'nav_design':
        applyActionsWithRefs([{ type: 'NAVIGATE_TAB', params: { tab: 'design' }, description: 'Go to System Design', requiresConfirmation: false }]);
        break;
      case 'apply_design':
        setMessages(m => [...m, { id: nextId(), role: 'confirm', actions: [{ type: 'APPLY_DESIGN', params: {}, description: 'Apply System Design — locks design and generates task plan', requiresConfirmation: true }] }]);
        break;
      case 'inject_phase2':
        setMessages(m => [...m, { id: nextId(), role: 'confirm', actions: [{ type: 'INJECT_PHASE2', params: {}, description: 'Inject Phase 2 — activates incident / UUM scope and unlocks Gantt + RTM', requiresConfirmation: true }] }]);
        break;
      case 'nav_gantt':
        applyActionsWithRefs([{ type: 'NAVIGATE_TAB', params: { tab: 'gantt' }, description: 'Go to Gantt', requiresConfirmation: false }]);
        break;
      case 'nav_raid':
        applyActionsWithRefs([{ type: 'NAVIGATE_TAB', params: { tab: 'raid' }, description: 'Go to RAID', requiresConfirmation: false }]);
        break;
      case 'submit_cab':
        setMessages(m => [...m, { id: nextId(), role: 'confirm', actions: [{ type: 'SUBMIT_CAB', params: {}, description: 'Submit to CAB for change approval', requiresConfirmation: true }] }]);
        break;
      case 'unlock_revision':
        store.setUnlockedForRevision(true);
        setMessages(m => [...m, { id: nextId(), role: 'result', text: 'All tabs unlocked for revision.' }]);
        break;
      case 'nav_rtm':
        applyActionsWithRefs([{ type: 'NAVIGATE_TAB', params: { tab: 'rtm' }, description: 'Go to RTM', requiresConfirmation: false }]);
        break;
      case 'sign_rtm':
        setMessages(m => [...m, { id: nextId(), role: 'confirm', actions: [{ type: 'SIGN_RTM', params: {}, description: 'Sign RTM — locks the requirements baseline for cutover', requiresConfirmation: true }] }]);
        break;
      case 'nav_closure':
        applyActionsWithRefs([{ type: 'NAVIGATE_TAB', params: { tab: 'closure' }, description: 'Go to Closure', requiresConfirmation: false }]);
        break;
      case 'promote':
        setMessages(m => [...m, { id: nextId(), role: 'confirm', actions: [{ type: 'PROMOTE', params: {}, description: 'Promote to Live — irreversible, system goes live now', requiresConfirmation: true }] }]);
        break;
      default: break;
    }
  }

  // Opening assessment — LLM for signed-in builds with data; natural greeting for guests and blank
  useEffect(() => {
    if (!open || messages.length !== 0) return;
    const isGuest = !authUserRef.current;
    const st = sRef.current;

    // Guests always get the natural greeting — no LLM, no hasData check.
    if (isGuest) {
      setMessages([{ id: nextId(), role: 'orchestrator', text:
        `Welcome to OpsManifest.\n\nI'm OpsMentor — I'll guide your team through the full provisioning lifecycle, from platform selection to production cutover.\n\nYou're in guest mode right now. Sign in any time (link at the bottom) to save and sync your builds — or let's go ahead as-is either way.\n\nWhat should I call you?`
      }]);
      awaitingNameRef.current = true;
      return;
    }

    // LLM assessment is only warranted once the workflow has genuinely started.
    const workflowStarted = !!(st.isBuilt || st.scanComplete || st.designApplied ||
                                st.phase2Active || st.cabApproved || st.cabDeclined ||
                                st.rtmSigned || st.promoted);

    if (!workflowStarted) {
      // Signed in, pre-build — greet, then pick up from wherever they left off
      const email = authUserRef.current?.email || '';
      const raw = email.split('@')[0].split('.')[0];
      const name = raw.charAt(0).toUpperCase() + raw.slice(1);
      userNameRef.current = name;
      setUserName(name);
      setMessages([{ id: nextId(), role: 'orchestrator', text:
        `Welcome back, ${name}. I'm OpsMentor — here to keep your team aligned from platform selection to production cutover.`
      }]);
      // Find the first missing Phase 1 field and prompt for it
      const firstMissing = nextFieldPrompt(st, null);
      awaitingFieldRef.current = firstMissing || null;
      setTimeout(() => {
        // Abort if user has already started chatting — don't inject workflow prompts over conversation
        if ((messagesRef.current || []).some(m => m.role === 'user')) return;
        if (firstMissing) {
          setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: FIELD_QUESTIONS[firstMissing] }]);
          if (FIELD_CHIPS[firstMissing]) setChipsField(firstMissing);
        } else {
          setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text:
            `All Phase 1 fields are set. Click Build in the sidebar to lock the stack and start the AI scan.`
          }]);
        }
      }, 1000);
      return;
    }

    // Workflow has started — show field chips for any missing stack field while LLM assesses
    if (!st.isBuilt) {
      const firstMissing = nextFieldPrompt(st, null);
      if (firstMissing) {
        awaitingFieldRef.current = firstMissing;
        if (FIELD_CHIPS[firstMissing]) setChipsField(firstMissing);
      }
    }

    // Extract name from email for all workflow-started builds (not just pre-build)
    if (!userNameRef.current) {
      const email = authUserRef.current?.email || '';
      const raw   = email.split('@')[0].split('.')[0];
      const n     = raw.charAt(0).toUpperCase() + raw.slice(1);
      if (n) { userNameRef.current = n; setUserName(n); }
    }
    const openingName = userNameRef.current;

    // Greet immediately — don't make the user wait for the LLM before being acknowledged.
    const greeting = openingName
      ? `Good day, ${openingName}! I'm OpsMentor — here to keep your team aligned from platform selection to go-live. Let me pull up where this build stands.`
      : `Good day! I'm OpsMentor — here to keep your team aligned from platform selection to go-live. Let me review this build.`;
    setMessages([{ id: nextId(), role: 'orchestrator', text: greeting }]);

    // Generate intelligent opening assessment via LLM
    setThinking(true);
    const pastSummary = buildPastBuildsSummary(builds, store.currentBuildId, st.ctx);
    const ctx = buildStateContext(st, authUserRef.current, pastSummary);
    const stack = [st.ctx?.hw, st.ctx?.os, st.ctx?.db, st.ctx?.app].filter(Boolean).join(' / ');
    const alertSummary = (st.coherenceAlerts || []).filter(a => a.severity === 'warn').map(a => a.message).join('; ') || 'none';
    const designFilled = st.sysDesignData ? Object.entries(st.sysDesignData).flatMap(([sec, fields]) =>
      Object.entries(fields || {}).filter(([, v]) => v).map(([k]) => `${sec}.${k}`)
    ).length : 0;

    const assessmentPrompt = `INITIAL_ASSESSMENT

You have full visibility into this build. The user has already been greeted — do NOT introduce yourself or say hello. Get straight to the most important insight.

Do NOT narrate what the user has already entered. Your job is to surface what is non-obvious.

Current build snapshot:
- Stack: ${stack || 'not yet selected'}
- User: ${openingName || 'unknown'}
- Project: ${st.requirements?.projectName || 'unnamed'} | Env: ${st.requirements?.envType || 'not set'}
- Go-live: ${st.requirements?.goLiveDate || 'not set'} | SLA: ${st.requirements?.sla || 'not set'}
- Phase: ${ctx.phase}
- Incidents in scope: ${(st.selInc || []).length} | UUM items: ${(st.selUUM || []).length}
- Design sections filled: ${designFilled} fields
- Active warnings: ${alertSummary}
- Tasks stale: ${!!st.tasksStaleReason} | RTM stale: ${st.rtmStale}
${pastSummary ? `\nPast builds with similar setup:\n${pastSummary}` : ''}

Respond with:
1. The single most important risk or insight for this build RIGHT NOW -- specific to the actual stack, dates, and active warnings. Name real components and real EOL timelines where you know them. If there are active warnings, lead with the most critical one. If past builds show a relevant lesson, weave it in naturally.
2. Whether the build is clear to advance, or if there is a specific blocker. One sentence.
3. If design sections are empty or sparse and the stack is known, include 2-3 SET_DESIGN_FIELD actions with specific realistic values derived from the stack.
4. If you see a risk worth logging, include an ADD_RAID_ENTRY action.
5. If there is a critical missing task for this stack/incident combination, include an ADD_CUSTOM_TASK action.
6. Include 2-3 suggestions (questions the user might naturally ask next given the build state).

Rules:
- Do not greet or introduce yourself -- the greeting is already shown.
- Do not tell the user to "run the scan" if it is already complete.
- If the build looks clean with no warnings, say so in one sentence and confirm the natural next action.
- Lead with the most important insight or warning, not a process summary.
- Keep the reply to 2-4 sentences max. Let the actions carry the detail.`;

    sendChatMessage(assessmentPrompt, ctx, [])
      .then(result => {
        setThinking(false);
        const { reply, actions = [], suggestions = [] } = result;
        setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: reply, suggestions }]);
        const immediate = actions.filter(a => !a.requiresConfirmation);
        const needsConfirm = actions.filter(a => a.requiresConfirmation);
        if (immediate.length > 0) applyActionsWithRefs(immediate);
        if (needsConfirm.length > 0) {
          setMessages(m => [...m, { id: nextId(), role: 'confirm', actions: needsConfirm }]);
        }
      })
      .catch(() => {
        setThinking(false);
        // Worker unavailable — give a contextual fallback without echoing the stack
        const st2 = sRef.current;
        const hasStack = !!(st2.ctx?.hw || st2.ctx?.db || st2.ctx?.app);
        const fallback = hasStack
          ? `Here with you on this build — ask me anything or use the sidebar to continue.`
          : `Here when you need me — ask me anything or use the sidebar to continue.`;
        setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: fallback }]);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Worker connectivity check
  useEffect(() => {
    if (!open || workerOk !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/health', { signal: AbortSignal.timeout(3500) });
        if (r.ok && !cancelled) { setWorkerOk(true); return; }
      } catch { /* unreachable */ }
      if (!cancelled) setWorkerOk(false);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workerOk]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // ── Action logging — watch key state transitions and auto-post log entries ──
  const prevState = useRef({
    isBuilt: false, scanComplete: false, designApplied: false,
    phase2Active: false, cabApproved: false, cabDeclined: false,
    rtmSigned: false, promoted: false, rtmStale: false, tasksStaleReason: null,
    vulnCount: 0, pendingDiscCount: 0, riskScore: 0,
    // Deep sync tracking
    selIncCount: 0, selUumCount: 0,
    selInc: [], selUUM: [],
    rtmPassCount: 0, rtmFailCount: 0, rtmNaCount: 0, rtmTotalCount: 0,
    closureCheckCount: 0, closureTotalCount: 0,
    rolesFilledCount: 0, coherenceWarnCount: 0, raidCount: 0,
  });

  // Compute live risk score for proactive warnings
  const liveRisks = computeAllRisks(s);
  const liveScore = riskScore(liveRisks);
  const liveRl    = riskLabel(liveScore);

  useEffect(() => {
    const prev = prevState.current;
    // orc = prominent messages for major workflow gates
    // log = compact one-liners for minor events
    const orc = [];
    const log = [];

    if (!prev.isBuilt && s.isBuilt) {
      awaitingFieldRef.current = null;
      setChipsField(null);
      const _db  = s.ctx?.db  || '';
      const _hw  = s.ctx?.hw  || '';
      const _app = s.ctx?.app || '';
      const _os  = s.ctx?.os  || '';
      const name = userNameRef.current ? ` ${userNameRef.current}` : '';

      const msg = /oracle/i.test(_db) && /power|ppc/i.test(_hw)
        ? `Well done${name} — Phase 1 is locked. Power architecture with Oracle is a technically demanding combination: the ppc64le certification matrix restricts which fix-pack levels are officially supported, and that's typically the first thing CAB will interrogate. The scan surfaces those gaps before you invest time in the design. Worth running it now.`
        : /websphere/i.test(_app)
          ? `Phase 1 locked${name ? ',' + name : ''}. The app tier you've chosen brings TLS cipher compliance into scope — CAB boards specifically look for TLS 1.0/1.1 deprecation, and it's the kind of thing that sends a build back for revision if it surfaces late. The scan makes it visible now, before it becomes design debt.`
          : /aix/i.test(_os)
            ? `Phase 1 locked${name ? ',' + name : ''}. The OS you've chosen has a support timeline with a hard deadline, and that deadline tends to define the project window more than any other factor — it's almost always CAB's first question. The scan quantifies exactly where you sit, so you're not guessing when the board asks.`
            : /sql.?server|mssql/i.test(_db)
              ? `Phase 1 locked${name ? ',' + name : ''}. The database tier you've chosen typically surfaces two things in migrations: patch-level currency and Always On certification gaps. Both are easier to address before the design baseline is set. The scan checks for both — worth running now.`
              : /postgres|pg\b/i.test(_db)
                ? `Phase 1 locked${name ? ',' + name : ''}. Good selection — PostgreSQL is a clean migration target. The scan validates version-specific CVE exposure and extension compatibility, which occasionally surprises teams late in the process. Quick to run, and anything it finds is far easier to address here than after the design commits.`
                : /oracle/i.test(_db)
                  ? `Phase 1 locked${name ? ',' + name : ''}. The database platform you've chosen has specific patch-currency and certification requirements that vary by release and hardware combination — and they define what's actually supportable at go-live. The scan validates those against the current matrix before the design locks in.`
                  : `Phase 1 locked${name ? ',' + name : ''}. This is the right moment to run the scan — any EOL exposure or CVE gaps in the stack are far easier to address here than after the design baseline is set. Everything the scan surfaces shapes both the design and the RTM.`;

      orc.push(msg);
    }
    if (!prev.scanComplete && s.scanComplete) {
      const incCount = (s.selInc || []).length;
      const uumCount = (s.selUUM || []).length;
      const findings = (s.scanResults?.findings || []);
      const critical = findings.filter(f => f.sev === 'CRITICAL');
      const riskLvl  = s.scanResults?.riskLevel || 'UNKNOWN';
      const name     = userNameRef.current ? `, ${userNameRef.current}` : '';

      log.push([
        `Scan — Risk: ${riskLvl} · ${findings.length} finding${findings.length !== 1 ? 's' : ''}`,
        critical.length > 0 ? `CRITICAL: ${critical.map(f => f.component).join(', ')}` : null,
        `${incCount} incident${incCount !== 1 ? 's' : ''}, ${uumCount} UUM items`,
      ].filter(Boolean).join(' · '));

      const critNote = critical.length > 0
        ? `${critical.length} critical finding${critical.length !== 1 ? 's' : ''} need attention before the design — `
        : '';
      const scopeNote = incCount + uumCount >= 10
        ? `That's real scope — `
        : incCount + uumCount >= 5
          ? `Good coverage — `
          : incCount + uumCount === 0
            ? `Lean scope — worth checking the selections before moving on. `
            : '';
      orc.push(`Scan done${name}. ${critNote}${scopeNote}${incCount} incident${incCount !== 1 ? 's' : ''} and ${uumCount} UUM operation${uumCount !== 1 ? 's' : ''} confirmed. Every item you keep here becomes a traceable row in the RTM — System Design is ready when you are.`);
    }
    if (!prev.designApplied && s.designApplied) {
      awaitingFieldRef.current = null;
      const name = userNameRef.current ? `, ${userNameRef.current}` : '';
      orc.push(`Design locked${name} — that's now the RTM baseline. Every field you filled is a traceable requirement that sign-off will verify before cutover. Phase 2 maps your incident scope into real Gantt tasks — inject it from the sidebar when ready.`);
    }
    if (!prev.phase2Active && s.phase2Active) {
      awaitingFieldRef.current = null;
      const name = userNameRef.current ? `, ${userNameRef.current}` : '';
      orc.push(`Phase 2 is live${name}. Solid progress — the Gantt has your full task plan. Check the tasks flagged CP first: any slip on the critical path shifts your go-live date. Once the schedule looks right, CAB submission is ready from the sidebar.`);
    }
    if (!prev.cabApproved && s.cabApproved) {
      const name = userNameRef.current ? `, ${userNameRef.current}` : '';
      orc.push(`CAB approved${name} — well done. RTM is the final technical gate. Every row needs a clear disposition; one unresolved FAIL or BLOCKED is a hard stop before cutover. Worth going straight there now.`);
    }
    if (!prev.cabDeclined && s.cabDeclined) {
      orc.push(`CAB came back declined. Boards most often push back on RAID completeness, schedule vs freeze windows, or design-to-RTM traceability. Unlock the tabs, close those gaps, then resubmit. Where would you like to start?`);
    }
    if (!prev.rtmSigned && s.rtmSigned) {
      const name = userNameRef.current ? `, ${userNameRef.current}` : '';
      orc.push(`RTM signed${name} — every pre-cutover gate is cleared. The change window is the last thing between here and live. Any last concerns worth capturing in RAID before you initiate?`);
    }
    if (!prev.promoted && s.promoted) {
      const name = userNameRef.current ? `, ${userNameRef.current}` : '';
      orc.push(`You're live${name}. The first 48 hours carry the highest risk — watch for connection pool exhaustion, job scheduler drift, and CMDB sync gaps. Closure tab handles the remaining sign-offs.`);
    }
    if (!prev.rtmStale && s.rtmStale) {
      orc.push(`Scope shifted after the RTM was signed — it's now out of sync with the current plan. Worth a re-check before initiating cutover.`);
    }
    if (!prev.tasksStaleReason && s.tasksStaleReason) {
      orc.push(`Gantt is flagged stale — ${s.tasksStaleReason}. The schedule may not reflect the current scope. Regenerate it from the Gantt tab or let me know how you'd like to handle it.`);
    }

    const activeVulns = (s.vulnRegistry || []).filter(v => v.status === 'ACTIVE').length;
    const pendingDisc = (s.stakeholderDiscussions || []).filter(d => d.status === 'PENDING').length;

    if (prev.vulnCount === 0 && activeVulns > 0) {
      log.push(`${activeVulns} active vulnerability${activeVulns !== 1 ? 'ies' : 'y'} in the registry. Open the Vulnerabilities tab to review and set dispositions.`);
    } else if (activeVulns > prev.vulnCount && prev.vulnCount > 0) {
      log.push(`New vulnerability added (active: ${activeVulns}). Check the Vulnerabilities tab.`);
    }
    if (prev.pendingDiscCount === 0 && pendingDisc > 0) {
      log.push(`${pendingDisc} stakeholder discussion${pendingDisc !== 1 ? 's' : ''} pending — team/client agreement required. Vulnerabilities tab → Stakeholder Discussions.`);
    }

    const prevScore = prev.riskScore || 0;
    if (prevScore < 10 && liveScore >= 10) {
      log.push(`Risk score hit ${liveScore} (${liveRl.label}) — ${liveRisks.filter(r => r.severity === 'CRITICAL').length} critical risk(s) need attention. Check the Risk Tracker tab.`);
    } else if (prevScore < 18 && liveScore >= 18) {
      log.push(`Risk score is ${liveScore} — CRITICAL. Project may be blocked. Review the Risk Tracker tab urgently.`);
    }

    // ── Deep sync: incident / UUM scope changes ───────────────────────────────
    if (prev.selInc !== undefined) {
      const prevInc = prev.selInc || [];
      const currInc = s.selInc || [];
      const addedInc = currInc.filter(x => !prevInc.includes(x));
      const removedInc = prevInc.filter(x => !currInc.includes(x));
      addedInc.forEach(code => log.push(`Incident added: ${code}`));
      removedInc.forEach(code => log.push(`Incident removed: ${code}`));
    }
    if (prev.selUUM !== undefined) {
      const prevUUM = prev.selUUM || [];
      const currUUM = s.selUUM || [];
      const addedUUM = currUUM.filter(x => !prevUUM.includes(x));
      const removedUUM = prevUUM.filter(x => !currUUM.includes(x));
      addedUUM.forEach(code => log.push(`UUM added: ${code}`));
      removedUUM.forEach(code => log.push(`UUM removed: ${code}`));
    }

    // ── Deep sync: RTM progress ───────────────────────────────────────────────
    if (s.cabApproved && !s.rtmSigned && rtmTotalCount > 0) {
      const prevPassed = (prev.rtmPassCount || 0) + (prev.rtmNaCount || 0);
      const nowPassed  = rtmPassCount + rtmNaCount;
      if (nowPassed > prevPassed) {
        if (nowPassed >= rtmTotalCount) {
          orc.push(`All ${rtmTotalCount} RTM rows verified — clean sweep. Ready to sign off?`);
        } else if (nowPassed % 5 === 0 || nowPassed === Math.floor(rtmTotalCount / 2)) {
          log.push(`RTM: ${nowPassed}/${rtmTotalCount} rows verified (${Math.round(nowPassed / rtmTotalCount * 100)}%).`);
        }
      }
      if (rtmFailCount > (prev.rtmFailCount || 0)) {
        log.push(`RTM: ${rtmFailCount} FAIL row${rtmFailCount !== 1 ? 's' : ''} — needs resolution before sign-off.`);
      }
    }

    // ── Deep sync: RAID entries added outside OpsMentor ──────────────────────
    if (raidCount > (prev.raidCount || 0) && prev.raidCount !== undefined) {
      const delta = raidCount - prev.raidCount;
      log.push(`+${delta} RAID entr${delta !== 1 ? 'ies' : 'y'} added — ${raidCount} total on record.`);
    }

    // ── Deep sync: Closure checklist progress ─────────────────────────────────
    if (s.promoted && closureCheckCount > (prev.closureCheckCount || 0)) {
      if (closureTotalCount > 0 && closureCheckCount >= closureTotalCount) {
        orc.push(`Closure complete — every item signed off. Export the audit trail from the sidebar when you're ready.`);
      } else if (closureCheckCount % 3 === 0 && closureCheckCount > 0 && closureTotalCount > 0) {
        log.push(`Closure: ${closureCheckCount}/${closureTotalCount} items done.`);
      }
    }

    // ── Deep sync: Team RACI filling up ──────────────────────────────────────
    if (rolesFilledCount > (prev.rolesFilledCount || 0)) {
      if (rolesFilledCount >= 20 && prev.rolesFilledCount < 20) {
        orc.push(`All 20 RACI roles assigned — good. Worth confirming the email contacts are current in the Roles tab.`);
      } else if (rolesFilledCount === 10 && (prev.rolesFilledCount || 0) < 10) {
        log.push(`Halfway there — ${rolesFilledCount}/20 roles assigned.`);
      }
    }

    // ── Deep sync: New coherence warnings ────────────────────────────────────
    if (coherenceWarnCount > (prev.coherenceWarnCount || 0)) {
      const warns = (s.coherenceAlerts || []).filter(a => a.severity === 'warn');
      if (warns.length > 0) {
        const latest = warns[warns.length - 1];
        const action = latest.action ? ` ${latest.action}.` : '';
        orc.push(`One thing worth flagging — ${latest.message}.${action} How would you like to proceed?`);
      }
    }

    const allNew = [
      ...orc.map(text => ({ id: nextId(), role: 'orchestrator', text })),
      ...log.map(text => ({ id: nextId(), role: 'log', text })),
    ];
    if (allNew.length > 0) setMessages(m => [...m, ...allNew]);

    prevState.current = {
      isBuilt: s.isBuilt, scanComplete: s.scanComplete, designApplied: s.designApplied,
      phase2Active: s.phase2Active, cabApproved: s.cabApproved, cabDeclined: s.cabDeclined,
      rtmSigned: s.rtmSigned, promoted: s.promoted, rtmStale: s.rtmStale,
      tasksStaleReason: s.tasksStaleReason,
      vulnCount: activeVulns, pendingDiscCount: pendingDisc, riskScore: liveScore,
      selIncCount, selUumCount,
      selInc: [...(s.selInc || [])],
      selUUM: [...(s.selUUM || [])],
      rtmPassCount, rtmFailCount, rtmNaCount, rtmTotalCount,
      closureCheckCount, closureTotalCount,
      rolesFilledCount, coherenceWarnCount, raidCount,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.isBuilt, s.scanComplete, s.designApplied, s.phase2Active, s.cabApproved,
      s.cabDeclined, s.rtmSigned, s.promoted, s.rtmStale, s.tasksStaleReason,
      s.vulnRegistry?.length, s.stakeholderDiscussions?.length, liveScore,
      selIncCount, selUumCount, rtmPassCount, rtmFailCount, rtmNaCount, rtmTotalCount,
      closureCheckCount, closureTotalCount, rolesFilledCount, coherenceWarnCount, raidCount]);

  // ── Inactivity prompt — if panel open and user idle 9s after last orch message ─
  const inactivityTimerRef = useRef(null);
  const nudgeSentRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    clearTimeout(inactivityTimerRef.current);
    nudgeSentRef.current = false; // reset on new message
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'orchestrator') return;
    // Wait 9 seconds; if user hasn't typed anything, send a contextual nudge
    inactivityTimerRef.current = setTimeout(() => {
      if (nudgeSentRef.current) return;
      nudgeSentRef.current = true;
      const sc = generateScript(sRef.current); // always use latest state
      const nudge = sc.nextAction
        ? `Next up: ${sc.nextAction}`
        : 'Build looks complete — ask me anything or export your audit trail.';
      setMessages(m => [...m, { id: nextId(), role: 'nudge', text: nudge }]);
    }, 9000);
    return () => clearTimeout(inactivityTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, open]);

  // Cancel inactivity timer when user starts typing; trigger live keyword scan with 280ms debounce
  const handleInputChange = useCallback((e) => {
    clearTimeout(inactivityTimerRef.current);
    nudgeSentRef.current = true; // suppress nudge once typing starts
    const val = e.target.value;
    setInput(val);
    // Live scan: debounce to avoid scanning on every keystroke
    clearTimeout(liveHintTimerRef.current);
    if (val.length < 4) { setLiveHints(null); return; }
    liveHintTimerRef.current = setTimeout(() => {
      try {
        const hints = scanInputLive(val, sRef.current?.ctx);
        const hasHints = hints.eol.length > 0 || hints.compat.length > 0 || Object.keys(hints.detected).length > 0;
        setLiveHints(hasHints ? hints : null);
      } catch { setLiveHints(null); }
    }, 280);
  }, []);

  // When docked, always open immediately — no button needed
  useEffect(() => {
    if (docked) { setOpen(true); setPanelVisible(true); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docked]);

  // Open when ExecOverview "OpsMentor" button is clicked (floating mode)
  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setPanelVisible(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    };
    window.addEventListener('opsmanifest-orchestrator-open', handler);
    return () => window.removeEventListener('opsmanifest-orchestrator-open', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open after tour dismisses
  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        setOpen(true);
        setPanelVisible(true);
        setTimeout(() => inputRef.current?.focus(), 150);
      }, 500);
    };
    window.addEventListener('opsmanifest-tour-dismissed', handler);
    return () => window.removeEventListener('opsmanifest-tour-dismissed', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Field change tracking — refs only, no chat echo
  const prevCtx = useRef({ hw: undefined, os: undefined, db: undefined, app: undefined });
  const prevReqs = useRef({ projectName: undefined, envType: undefined, projectStartDate: undefined, goLiveDate: undefined, sla: undefined });

  useEffect(() => {
    prevCtx.current = { hw: ctxHw, os: ctxOs, db: ctxDb, app: ctxApp };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxHw, ctxOs, ctxDb, ctxApp]);

  useEffect(() => {
    prevReqs.current = { projectName: reqProjectName, envType: reqEnvType, projectStartDate: reqProjectStartDate, goLiveDate: reqGoLiveDate, sla: reqSla };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqProjectName, reqEnvType, reqProjectStartDate, reqGoLiveDate, reqSla]);

  // ── Field interview sync — advance/close interview when user fills via UI ──
  const thinkingRef = useRef(false);
  useEffect(() => { thinkingRef.current = thinking; }, [thinking]);

  useEffect(() => {
    if (!open || awaitingNameRef.current || !awaitingFieldRef.current) return;
    if (thinkingRef.current) return; // LLM in flight — wait
    const currS = sRef.current;
    const { hw, os, db, app } = currS.ctx || {};
    const r = currS.requirements || {};
    const filled = { hw: !!hw, os: !!os, db: !!db, app: !!app,
      projectName: !!r.projectName, envType: !!r.envType,
      projectStartDate: !!r.projectStartDate, goLiveDate: !!r.goLiveDate, sla: !!r.sla };
    const curr = awaitingFieldRef.current;
    if (!filled[curr]) return; // not yet filled — still waiting for user
    const next = nextFieldPrompt(currS, curr);
    awaitingFieldRef.current = next;
    if (!next) {
      // All Phase 1 fields collected — tell user to click Build
      const alreadyBuilt = currS.isBuilt;
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text:
        alreadyBuilt
          ? 'All fields are set. Say "run scan" to run the AI Smart Scan, or use the sidebar to continue.'
          : 'All Phase 1 fields complete. Click **Build Environment** in the left sidebar to set up your environment — or just say "build" here. The AI Smart Scan unlocks straight after.'
      }]);
    } else {
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: FIELD_QUESTIONS[next] }]);
      // For text fields (no chip picker), focus the input
      if (!FIELD_CHIPS[next]) setTimeout(() => inputRef.current?.focus(), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxHw, ctxOs, ctxDb, ctxApp, reqProjectName, reqEnvType, reqProjectStartDate, reqGoLiveDate, reqSla, open]);

  // ── Tab change logging ────────────────────────────────────────────────────
  const prevActiveTab = useRef('');
  useEffect(() => {
    if (!prevActiveTab.current) { prevActiveTab.current = s.activeTab; return; }
    if (prevActiveTab.current === s.activeTab) return;
    prevActiveTab.current = s.activeTab;
    // User is navigating the app directly — stop field interview
    if (!awaitingNameRef.current) awaitingFieldRef.current = null;
    const n = userNameRef.current ? `, ${userNameRef.current}` : '';
    const criticalRisks = liveRisks.filter(r => r.severity === 'CRITICAL').length;
    const failRtm = Object.values(s.rtmRows || {}).filter(v => v === 'FAIL').length;
    const pendingRtm = Object.values(s.rtmRows || {}).filter(v => v === 'PENDING').length;
    const rolesWithEmail = Object.values(s.roleAssignments || {}).filter(v => v?.email).length;
    const closureDone = Object.values(s.closureChecks || {}).filter(Boolean).length;
    const closureTotal = Object.keys(s.closureChecks || {}).length;

    const tabHints = {
      exec: s.promoted
        ? `Executive Summary${n}. ${s.requirements?.projectName || 'The build'} is live — review KPIs against the SLA baseline and confirm the risk score is trending down post-cutover.`
        : `Executive Summary${n}. Live risk score, KPI tiles, and incident scope at a glance.${criticalRisks > 0 ? ` ${criticalRisks} critical risk${criticalRisks !== 1 ? 's' : ''} flagged — address before CAB.` : ' Risk posture looks clear.'}`,

      design: s.designApplied
        ? s.unlockedForRevision
          ? `System Design${n} — temporarily unlocked for CAB revision. Address the board's concerns, then resubmit. Changes here will mark the Gantt tasks stale.`
          : `System Design${n} — locked. Use the Tech Review toggle to make targeted field corrections without breaking the schedule. Any full re-open will require Gantt regeneration.`
        : s.scanComplete
          ? `System Design${n}. Scan defaults are loaded for your stack. Step through all 8 sections — Network, Storage, Security, Backup, Compliance, Monitoring, DR, HA — and verify every field. Click "Generate Task Plan" to lock the design and build your Gantt in one step.`
          : `System Design${n}. Run the AI Smart Scan from the sidebar first — it auto-fills defaults from your stack and flags EOL and CVE issues before you touch the design.`,

      gantt: !s.phase2Active
        ? `Gantt${n} — locked until Phase 2 is injected. Inject Phase 2 from the sidebar first; the task schedule generates from your incident and UUM scope.`
        : s.tasksStaleReason
          ? `Gantt${n} — tasks are stale: ${s.tasksStaleReason}. Click Regenerate to rebuild from current scope. Do this before CAB submission — the board reviews the schedule.`
          : s.cabApproved
            ? `Gantt${n} — schedule is CAB-approved. Any changes from here constitute a scope change and should be raised with the change manager before cutover.`
            : `Gantt${n}. Review the critical path — CP-flagged tasks are on the longest chain; any delay there delays go-live. Confirm task owners and durations before submitting to CAB.`,

      rtm: !s.phase2Active
        ? `RTM${n} — locked until Phase 2 is active. The matrix is built from your selected incidents and UUM items. Inject Phase 2 from the sidebar to populate it.`
        : s.rtmSigned && !s.rtmStale
          ? s.promoted
            ? `RTM${n} — signed and locked for audit. Any post-go-live scope changes are formal change requests, not RTM updates.`
            : `RTM${n} — signed. All pre-cutover gates are clear. Initiate cutover from the sidebar when your change window is confirmed.`
          : s.rtmStale
            ? `RTM${n} — scope drifted after sign-off. Review every row against the updated scope, update dispositions, and re-sign before proceeding.`
            : `RTM${n}. ${failRtm > 0 ? `${failRtm} FAIL row${failRtm !== 1 ? 's' : ''} — each needs a mitigation and owner in RAID before sign-off.` : pendingRtm > 0 ? `${pendingRtm} PENDING row${pendingRtm !== 1 ? 's' : ''} remaining.` : 'All rows set.'} Every row must be PASS or NA before you can sign off.`,

      matrix:  `Cross-Stack Dependency Matrix${n}. 8 swimlane layers — Hardware through Security. Use this to identify blocking chains between roles and verify no single owner is overloaded in the critical change window.`,

      raid: `RAID Log${n}. ${(s.raidLog || []).filter(r => r.status === 'OPEN' && r.severity === 'CRITICAL').length > 0 ? `${(s.raidLog || []).filter(r => r.status === 'OPEN' && r.severity === 'CRITICAL').length} critical open item${(s.raidLog || []).filter(r => r.status === 'OPEN' && r.severity === 'CRITICAL').length !== 1 ? 's' : ''} need mitigation and an owner before CAB. ` : ''}Log every known risk, assumption, issue, and decision — this is your formal change governance record. CAB boards examine the RAID log as part of their approval review.`,

      roles: `Roles and RACI${n}. ${rolesWithEmail < 5 ? 'Critical contacts missing — CAB boards ask for PM, DBA, Unix Admin, SecOps, and App Admin at minimum. Add email contacts before submission.' : rolesWithEmail < 15 ? `${rolesWithEmail}/20 roles assigned. Confirm all key leads have contacts and backup names.` : 'Team is fully assigned. Verify email addresses — these are used for RTM attribution and sign-off.'}`,

      closure: !s.promoted
        ? `Closure${n} — this tab activates after go-live. Complete the cutover first, then return here for hypercare monitoring, CMDB updates, lessons learned, and formal team sign-off.`
        : closureTotal > 0
          ? `Closure${n} — ${closureDone}/${closureTotal} items complete. ${closureDone >= closureTotal ? 'All items done — export the audit trail from the sidebar to formally close the project.' : 'Work through every item before declaring the project closed. The lessons-learned section is required for the audit record.'}`
          : `Closure${n}. Tick off every post-go-live item — hypercare monitoring, CMDB updates, lessons learned, and team sign-off — then export the full audit trail.`,

      diagram: `Infrastructure Diagram${n}. Three views: Visual topology (layered stack), ASCII Map (copy directly into your CAB document), Mission Intel (business, functional, and technical analysis). The ASCII Map view is the fastest way to add architecture context to a change request.`,

      cmdb: `CMDB live EOL data${n}. ${!s.scanComplete ? 'Run the AI Smart Scan first — it loads your stack components automatically.' : 'Check the EOSL and Security-Only columns. Any component entering security-only mode during your project window is a material CAB risk that needs a mitigation plan.'}`,

      vuln:    `Vulnerability Registry${n}. CVEs, EOL exposure, stakeholder sign-offs, and the full OpsMentor action audit trail. ${(s.vulnRegistry || []).filter(v => v.status === 'ACTIVE').length > 0 ? `${(s.vulnRegistry || []).filter(v => v.status === 'ACTIVE').length} active — each needs a disposition before go-live.` : 'All clear — log new CVE findings here as they surface.'}`,

      risks: `Risk Tracker${n}. Score: ${liveScore} — ${liveRl.label}. ${liveScore >= 18 ? 'CRITICAL posture — address red items immediately; the project may be blocked.' : liveScore >= 10 ? 'HIGH — CAB will challenge these. Ensure every risk has an owner and a mitigation logged in RAID.' : 'Risk posture is acceptable. Keep monitoring as scope evolves.'}`,

      cost: `Cost Management${n}. ${s.costConfig?.enabled ? 'Cost tracking active — estimate is derived from task hours × team rate. Review the number before CAB; the board may ask for budget justification.' : 'Enable cost tracking to generate a project cost estimate from your Gantt schedule. Useful for CAB documentation and stakeholder reporting.'}`,
    };
    const hint = tabHints[s.activeTab];
    if (hint) setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: hint }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.activeTab]);

  // ── Action execution ─────────────────────────────────────────────────────

  function auditLog(action, status) {
    const currS = sRef.current;
    const phase = currS.promoted ? 'LIVE' : currS.rtmSigned ? 'RTM_SIGNED' : currS.cabApproved ? 'CAB_APPROVED'
      : currS.phase2Active ? 'PHASE2' : currS.designApplied ? 'DESIGN' : currS.scanComplete ? 'SCANNED'
      : currS.isBuilt ? 'BUILT' : 'BLANK';
    store.logAuditAction({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      ts: new Date().toISOString(),
      type: action.type,
      description: action.description || action.type,
      user: authUserRef.current?.email || 'guest',
      phase,
      status,
    });
  }

  function applyActions(actions) {
    const blocked = [];
    const done    = [];

    for (const action of actions) {
      const perm = checkPermission(action, authUser, s);
      if (!perm.allowed) {
        blocked.push(`${action.description}: ${perm.reason}`);
        auditLog(action, 'blocked');
        continue;
      }
      if (action.type === 'RUN_SCAN') {
        window.dispatchEvent(new CustomEvent('opsmanifest-run-scan'));
        auditLog(action, 'executed');
        done.push(action.description);
        continue;
      }
      executeAction(action, store);
      auditLog(action, 'executed');
      done.push(action.description);
    }

    if (done.length > 0) {
      setMessages(m => [...m, { id: nextId(), role: 'result', text: `Done: ${done.join(' · ')}` }]);
    }
    if (blocked.length > 0) {
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: `Could not complete: ${blocked.join(' ')}` }]);
    }
  }

  // Returns a single next-step sentence based on current workflow state, or null to stay silent.
  function getWorkflowNudge(freshS, confirmedActions) {
    // Major gate actions speak for themselves — the UI transitions visually. Stay silent.
    const GATE_TYPES = new Set(['INJECT_PHASE2', 'APPLY_DESIGN', 'SUBMIT_CAB', 'SIGN_RTM',
                                'PROMOTE', 'UNLOCK_FOR_REVISION', 'RESUBMIT_CAB']);
    if ((confirmedActions || []).some(a => GATE_TYPES.has(a.type))) return null;

    const { isBuilt, scanComplete, designApplied, phase2Active,
            cabApproved, cabDeclined, rtmSigned, promoted, ctx } = freshS;

    if (promoted) return null;
    if (!isBuilt) {
      const stackFull = ctx?.hw && ctx?.os && ctx?.db && ctx?.app;
      return stackFull
        ? 'Ready to continue — click **Build Environment** in the sidebar to set up your environment.'
        : 'Set the remaining stack fields (hardware, OS, database, application) to continue.';
    }
    if (!scanComplete) return 'Click **AI Smart Scan** in the sidebar to detect EOL, CVE, and compatibility issues before designing.';
    if (!designApplied) return 'Open the **System Design** tab — review the auto-filled 240 fields and apply the design to lock it.';
    if (!phase2Active) return 'Click **Inject Phase 2** in the sidebar to activate incident and UUM scope and unlock Gantt and RTM.';
    if (!cabApproved && !cabDeclined) return 'Review the **Gantt** tab for task schedule and scope — then submit to CAB when ready.';
    if (!rtmSigned) return 'Head to **RTM** tab to verify all requirements are traced and signed off before cutover.';
    if (cabApproved && rtmSigned && !promoted) return 'All gates cleared. Confirm your change window is active and initiate **Promote to Live** from the sidebar. Closure opens once the system is live.';
    return null;
  }

  function handleConfirm(actions) {
    setMessages(m => m.filter(msg => msg.role !== 'confirm'));
    pendingConfirmRef.current = null;
    // Record confirmed compat risk IDs so the same warning is never re-prompted this session
    actions.forEach(a => {
      if (a.type === 'ADD_RAID_ENTRY' && a.params?._ruleId) {
        acknowledgedCompatIds.current.add(a.params._ruleId);
      }
    });
    applyActions(actions);

    // Brief delay so the result pill renders first, then emit the next-step nudge.
    setTimeout(() => {
      const freshS = sRef.current;
      const nudge  = getWorkflowNudge(freshS, actions);
      if (nudge) {
        setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: nudge }]);
      }
    }, 320);
  }

  function handleCancel() {
    setMessages(m => m.filter(msg => msg.role !== 'confirm'));
    pendingConfirmRef.current = null;
    setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: 'Cancelled — no changes made.' }]);
  }

  // ── Chip selection — direct field update without text parsing ─────────────
  function handleChipSelect(field, value) {
    setChipsField(null);
    // Log as user message
    setMessages(m => [...m, { id: nextId(), role: 'user', text: value }]);

    if (field === 'envType') {
      applyActionsWithRefs([{
        type: 'SET_REQUIREMENT',
        description: `Set Environment to ${value}`,
        params: { key: 'envType', value },
        requiresConfirmation: false,
      }]);
      const next = nextFieldPrompt(sRef.current, 'envType');
      awaitingFieldRef.current = next;
      const envReply = next ? FIELD_QUESTIONS[next] : "All Phase 1 fields done — building and running AI Smart Scan now.";
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: envReply }]);
      if (!next && !sRef.current.isBuilt) {
        applyActionsWithRefs([
          { type: 'BUILD', description: 'Build environment', requiresConfirmation: false },
          { type: 'RUN_SCAN', description: 'Run AI Smart Scan', requiresConfirmation: false },
        ]);
      }
      return;
    }

    // ctx fields: hw / os / db / app
    const CTX_LABEL = { hw: 'Hardware', os: 'OS', db: 'Database', app: 'Application' };
    applyActionsWithRefs([{
      type: 'SET_CTX',
      description: `Set ${CTX_LABEL[field] || field} to ${value}`,
      params: { key: field, value },
      requiresConfirmation: false,
    }]);

    const updatedS = { ...sRef.current, ctx: { ...(sRef.current.ctx || {}), [field]: value } };
    const next = nextFieldPrompt(updatedS, field);
    awaitingFieldRef.current = next;

    let reply = '';

    if (!next && !updatedS.isBuilt) {
      // All 4 ctx fields set — build + scan
      applyActionsWithRefs([
        { type: 'BUILD', description: 'Build environment from stack selection', requiresConfirmation: false },
        { type: 'RUN_SCAN', description: 'Auto-run AI Smart Scan', requiresConfirmation: false },
      ]);
      reply = 'All stack fields set — building and running AI Smart Scan now.';
    } else if (next && FIELD_CHIPS[next]) {
      reply = FIELD_QUESTIONS[next];
    } else if (next) {
      reply = FIELD_QUESTIONS[next];
    }

    setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: reply }]);
  }

  function applyActionsWithRefs(actions) {
    const currS    = sRef.current;
    const currAuth = authUserRef.current;
    const blocked = [], done = [];
    for (const action of actions) {
      const perm = checkPermission(action, currAuth, currS);
      if (!perm.allowed) {
        blocked.push(`${action.description}: ${perm.reason}`);
        auditLog(action, 'blocked');
        continue;
      }
      // RUN_SCAN: show the PhasePanel ScanModal popup instead of running scan directly.
      if (action.type === 'RUN_SCAN') {
        window.dispatchEvent(new CustomEvent('opsmanifest-run-scan'));
        auditLog(action, 'executed');
        done.push(action.description);
        continue;
      }
      executeAction(action, store);
      auditLog(action, 'executed');
      done.push(action.description);
    }
    // Don't show generic "Done:" for RUN_SCAN — the state-change handler shows rich results
    const nonScan = done.filter((_, i) => actions[i]?.type !== 'RUN_SCAN');
    if (nonScan.length > 0) setMessages(m => [...m, { id: nextId(), role: 'result', text: `Done: ${nonScan.join(' · ')}` }]);
    if (blocked.length > 0) setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: `Could not complete: ${blocked.join(' ')}` }]);
  }

  // ── Field interview constants ──────────────────────────────────────────────

  // Field interview order — projectStartDate comes before goLiveDate
  const FIELD_ORDER = ['hw', 'os', 'db', 'app', 'projectName', 'envType', 'projectStartDate', 'goLiveDate', 'sla'];

  // Clickable chip options for each field — user picks instead of typing
  const FIELD_CHIPS = {
    hw:      ['Dell PowerEdge R750', 'HPE ProLiant DL380', 'IBM Power9', 'Cisco UCS B-Series', 'Supermicro SuperServer'],
    os:      ['RHEL 9.2', 'RHEL 8.6', 'Ubuntu 22.04 LTS', 'Windows Server 2022', 'AIX 7.2', 'Oracle Linux 8'],
    db:      ['Oracle 19c', 'PostgreSQL 15', 'MySQL 8.0', 'SQL Server 2022', 'MongoDB 6', 'MariaDB 10.11'],
    app:     ['WebSphere 9.0', 'JBoss EAP 7.4', 'Apache Tomcat 10', 'nginx 1.24', 'WebLogic 14c', 'IIS 10'],
    envType: ['Production', 'UAT', 'DR', 'Dev', 'SIT'],
    sla:     ['Tier 1 (99.99%)', 'Tier 2 (99.9%)', 'Tier 3 (99.5%)'],
  };
  const FIELD_QUESTIONS = {
    hw:               'Which hardware platform?',
    os:               'Which operating system?',
    db:               'Which database engine?',
    app:              'Which application or middleware?',
    projectName:      'What should we call this project? (type a name and press Enter)',
    envType:          'What environment type — Production, UAT, DR, Dev, or SIT?',
    projectStartDate: 'When does the project start? (type a date e.g. 2026-09-01 or use the sidebar date picker)',
    goLiveDate:       "What's the target go-live date? (type a date e.g. 2026-11-30 or use the sidebar date picker)",
    sla:              'SLA tier — Tier 1 (99.99%), Tier 2 (99.9%), or Tier 3 (99.5%)?',
  };
  // Editable placeholder text shown in the input when the agent is awaiting a specific field.
  // User sees a pre-filled suggestion they can modify or replace entirely before sending.
  const FIELD_PLACEHOLDERS = {
    hw:               'e.g. Dell PowerEdge R750, HPE ProLiant DL380, IBM Power9',
    os:               'e.g. RHEL 8.6, Ubuntu 22.04 LTS, Windows Server 2022, AIX 7.2',
    db:               'e.g. Oracle 19c, PostgreSQL 15, MySQL 8.0, SQL Server 2022',
    app:              'e.g. WebSphere 9.0, JBoss EAP 7.4, Apache Tomcat 10, nginx',
    projectName:      'e.g. Q3 Server Migration — Oracle to PostgreSQL',
    envType:          'e.g. Production',
    projectStartDate: 'e.g. 2026-09-01 or "in 2 weeks" or "next Monday"',
    goLiveDate:       'e.g. 2026-11-30 or "Q4 2026" or "in 3 months"',
    sla:              'e.g. Tier 1 (99.99%)',
  };
  const FIELD_CTX_MAP = {
    hw: 'hardware', os: 'OS', db: 'database', app: 'application',
  };
  const FIELD_REQ_MAP = {
    projectName: 'project name', envType: 'environment',
    projectStartDate: 'project start date', goLiveDate: 'go-live date', sla: 'SLA',
  };

  function nextFieldPrompt(currS, afterField) {
    const { hw, os, db, app } = currS.ctx || {};
    const r = currS.requirements || {};
    const order = FIELD_ORDER;
    for (const f of order) {
      if (afterField && order.indexOf(f) <= order.indexOf(afterField)) continue;
      if (f === 'hw' && !hw) return f;
      if (f === 'os' && !os) return f;
      if (f === 'db' && !db) return f;
      if (f === 'app' && !app) return f;
      if (f === 'projectName' && !r.projectName) return f;
      if (f === 'envType' && !r.envType) return f;
      if (f === 'projectStartDate' && !r.projectStartDate) return f;
      if (f === 'goLiveDate' && !r.goLiveDate) return f;
      if (f === 'sla' && !r.sla) return f;
    }
    return null;
  }

  function handleNameReply(text) {
    awaitingNameRef.current = false;
    const raw = text.trim().split(/[\s,!.]+/)[0];
    const name = raw ? raw.charAt(0).toUpperCase() + raw.slice(1).replace(/[^a-zA-Z]/g, '') : '';
    userNameRef.current = name || 'there';
    setUserName(name);

    const currS = sRef.current;
    const firstField = nextFieldPrompt(currS, null);
    awaitingFieldRef.current = firstField; // gate input immediately

    const sc = generateScript(currS);

    if (currS.isBuilt) {
      const step = sc.nextAction || 'All phases complete';
      const reply = name
        ? `Good to know, ${name}. Your build is already in progress — ${step}. Ask me anything or tell me what you need.`
        : `Build is already in progress — ${step}. Ask me anything.`;
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: reply }]);
    } else {
      // Acknowledge name as its own beat, then field question after a pause
      const ack = name ? `Good to know, ${name}.` : `Alright, let's get started.`;
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: ack }]);
      setTimeout(() => {
        const fieldQ = firstField ? FIELD_QUESTIONS[firstField] : 'All Phase 1 fields are set — say "run scan" to continue.';
        setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: fieldQ }]);
        if (firstField && FIELD_CHIPS[firstField]) setChipsField(firstField);
      }, 900);
    }
  }

  // ── Send message ─────────────────────────────────────────────────────────

  async function handleSend(overrideText) {
    const text = (overrideText || input).trim();
    if (!text || thinking) return;

    // Duplicate-send guard: ignore if identical to the last user message sent
    const lastUser = messagesRef.current.filter(m => m.role === 'user').slice(-1)[0];
    if (lastUser?.text?.trim().toLowerCase() === text.toLowerCase()) {
      setInput('');
      return;
    }

    // Rate limit: max 12 LLM messages per 60 seconds
    const now = Date.now();
    msgTimestampsRef.current = msgTimestampsRef.current.filter(t => now - t < 60000);
    if (msgTimestampsRef.current.length >= 12) {
      setMessages(m => [...m, { id: nextId(), role: 'nudge', text: 'Slow down a moment — I\'m still processing your last few requests. Try again in a few seconds.' }]);
      return;
    }
    msgTimestampsRef.current.push(now);

    if (!overrideText) setInput('');
    setLiveHints(null);

    // First reply = user's name
    if (awaitingNameRef.current) {
      setMessages(m => [...m, { id: nextId(), role: 'user', text }]);
      handleNameReply(text);
      return;
    }

    // ── Auto-confirm/cancel pending ConfirmCard ───────────────────────────
    const pendingConfirm = messagesRef.current.find(m => m.role === 'confirm');
    if (pendingConfirm) {
      if (/^(yes|yeah|yep|sure|ok|okay|go ahead|add|confirm|do it|proceed|apply|run it|add it|add them|add all|sounds good|absolutely|correct|right|affirmative|please do|go on|do that)(\s|$|[,!.])/i.test(text)) {
        setMessages(m => [...m, { id: nextId(), role: 'user', text }]);
        handleConfirm(pendingConfirm.actions);
        return;
      }
      if (/^(no|nope|cancel|abort|never mind|skip|not now|stop|discard|ignore)(\s|$|[,!.])/i.test(text)) {
        setMessages(m => [...m, { id: nextId(), role: 'user', text }]);
        handleCancel();
        return;
      }
    }

    setMessages(m => [...m, { id: nextId(), role: 'user', text }]);

    // ── Pending task destination choice (gantt / raid) ────────────────────
    if (pendingTaskRef.current) {
      const taskTitle = pendingTaskRef.current;
      pendingTaskRef.current = null;
      const dest = text.toLowerCase().trim();
      if (/gantt|schedule|task/.test(dest)) {
        const taskId = `mentor-${Date.now()}`;
        applyActions([{
          type: 'ADD_CUSTOM_TASK',
          description: `Add "${taskTitle}" to Gantt`,
          params: { id: taskId, title: taskTitle, est_hours: 4, addedAt: new Date().toISOString(), notes: 'Added via OpsMentor' },
          requiresConfirmation: false,
        }, {
          type: 'NAVIGATE_TAB',
          description: 'Navigate to Gantt tab',
          params: { tab: 'gantt' },
          requiresConfirmation: false,
        }]);
        setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: `Added "${taskTitle}" to the Gantt schedule. I've estimated 4 hours — you can adjust it in the Gantt tab.` }]);
      } else {
        const raidId = `raid-${Date.now()}`;
        applyActions([{
          type: 'ADD_RAID_ENTRY',
          description: `Add "${taskTitle}" to RAID`,
          params: { id: raidId, type: 'ISSUE', description: taskTitle, severity: 'MED', mitigation: 'Pending', status: 'OPEN', owner: 'PM', addedAt: new Date().toISOString() },
          requiresConfirmation: false,
        }, {
          type: 'NAVIGATE_TAB',
          description: 'Navigate to RAID tab',
          params: { tab: 'raid' },
          requiresConfirmation: false,
        }]);
        setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: `Added "${taskTitle}" to the RAID log as an issue. Open the RAID tab to set mitigation details.` }]);
      }
      return;
    }

    // ── Guided field interview ─────────────────────────────────────────────
    const awField = awaitingFieldRef.current;
    if (awField && !awaitingNameRef.current) {
      const tl = text.toLowerCase().trim();

      // Let workflow commands AND free-form content commands escape the field interview.
      // Uses pre-built COMMAND_TOKENS Set — O(words) not O(regex_count × text_length).
      const isCommand = isCommandMessage(tl);

      if (isCommand) {
        // User asked a real question — pause the field interview so it doesn't resume
        // mid-conversation or fire from the welcome timeout after an LLM response.
        awaitingFieldRef.current = null;
      }

      if (!isCommand) {
        // Date fields — check for compound range first ("from today to 3 months")
        if (awField === 'projectStartDate') {
          const range = parseCompoundDateRange(text);
          if (range) {
            awaitingFieldRef.current = null;
            applyActionsWithRefs([
              { type: 'SET_REQUIREMENT', description: `Set start to ${range.start}`, params: { key: 'projectStartDate', value: range.start }, requiresConfirmation: false },
              { type: 'SET_REQUIREMENT', description: `Set go-live to ${range.end}`,  params: { key: 'goLiveDate',        value: range.end   }, requiresConfirmation: false },
            ]);
            const updatedReqs = { ...sRef.current.requirements, projectStartDate: range.start, goLiveDate: range.end };
            const next = nextFieldPrompt({ ...sRef.current, requirements: updatedReqs }, 'goLiveDate');
            awaitingFieldRef.current = next;
            if (next && FIELD_CHIPS[next]) setChipsField(next);
            const nextQ = next ? FIELD_QUESTIONS[next] : 'All fields set — say "build" to continue.';
            setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: nextQ }]);
            return;
          }
        }

        // Single date parse
        if (awField === 'projectStartDate' || awField === 'goLiveDate') {
          const parsed = parseRelativeDate(text) || parseRelativeDate(text.replace(/^.*?\s+(?:is|:)\s+/i, ''));
          if (parsed) {
            awaitingFieldRef.current = null;
            applyActionsWithRefs([{
              type: 'SET_REQUIREMENT',
              params: { key: awField, value: parsed },
              requiresConfirmation: false,
            }]);
            const updatedReqs = { ...sRef.current.requirements, [awField]: parsed };
            const next = nextFieldPrompt({ ...sRef.current, requirements: updatedReqs }, awField);
            awaitingFieldRef.current = next;
            if (next && FIELD_CHIPS[next]) setChipsField(next);
            const nextQ = next ? FIELD_QUESTIONS[next] : 'All fields set — say "build" to continue.';
            setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: nextQ }]);
            return;
          }
        }

        awaitingFieldRef.current = null;
        let syntheticText;
        if (FIELD_CTX_MAP[awField]) {
          syntheticText = `${FIELD_CTX_MAP[awField]} is ${text}`;
        } else if (FIELD_REQ_MAP[awField]) {
          syntheticText = `${FIELD_REQ_MAP[awField]} is ${text}`;
        }
        if (syntheticText) {
          const result = ruleBasedResponse(syntheticText, sRef.current, authUserRef.current, acknowledgedCompatIds.current);
          if (result) {
            const { reply, actions = [] } = typeof result === 'string' ? { reply: result } : result;
            if (actions.length > 0) applyActionsWithRefs(actions);
            const next = nextFieldPrompt(sRef.current, awField);
            awaitingFieldRef.current = next;
            if (next && FIELD_CHIPS[next]) setChipsField(next);
            // Only show reply if it has risk/warning content — never echo what user typed
            const hasRisk = reply && (reply.includes('⚠️') || reply.includes('⬡') || reply.includes('EOL') || reply.includes('Stakeholder'));
            const nextQ = next ? FIELD_QUESTIONS[next] : 'All fields complete — say "build" to continue.';
            const fullReply = hasRisk ? `${reply}\n\n${nextQ}` : nextQ;
            setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: fullReply }]);
            return;
          }
        }
        // Restore awaitingFieldRef if nothing matched
        awaitingFieldRef.current = awField;
      }
      // Fall through to normal rule-based / Groq handling for commands
    }

    setThinking(true);

    try {
      // Rule-based mentor — handles phase guidance, field-setting, status queries
      const fast = ruleBasedResponse(text, s, authUser, acknowledgedCompatIds.current);
      if (fast) {
        setThinking(false);
        const { reply, actions = [], chips: fastChips = [], _pendingTask } = typeof fast === 'string' ? { reply: fast } : fast;
        if (_pendingTask) pendingTaskRef.current = _pendingTask;
        const immediate = actions.filter(a => !a.requiresConfirmation);
        const needsConfirm = actions.filter(a => a.requiresConfirmation);
        if (immediate.length > 0) applyActions(immediate);
        // Skip empty bubbles — actions already do the work and will log a result pill
        if (reply) setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: reply, chips: fastChips }]);
        if (needsConfirm.length > 0) {
          setMessages(m => [...m, { id: nextId(), role: 'confirm', actions: needsConfirm }]);
        }
        return;
      }

      // Groq-powered NLP
      const ctx    = buildStateContext(s, authUser, pastBuildsSummary);
      const result = await sendChatMessage(text, ctx, getHistory(messagesRef.current));

      setThinking(false);

      const { reply, actions = [], suggestions = [] } = result;
      const replyText = reply;

      const needsConfirm = actions.some(a => a.requiresConfirmation);
      const immediate    = actions.filter(a => !a.requiresConfirmation);

      if (immediate.length > 0) applyActions(immediate);

      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: replyText, suggestions }]);

      if (needsConfirm) {
        const confirmActions = actions.filter(a => a.requiresConfirmation);
        pendingConfirmRef.current = confirmActions;
        setMessages(m => [...m, {
          id: nextId(),
          role: 'confirm',
          actions: confirmActions,
        }]);
      }

    } catch (e) {
      setThinking(false);
      const fallback = ruleBasedResponse('help', s, authUser, acknowledgedCompatIds.current);
      const fallbackText = typeof fallback === 'string' ? fallback : fallback?.reply;
      setMessages(m => [...m, {
        id: nextId(),
        role: 'orchestrator',
        text: fallbackText || 'I can answer questions about your build status, roles, RTM, stack, and guide you through each phase. Try: "what\'s the current status?" or "what\'s next?"',
      }]);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Collapsed docked mode — thin vertical strip
  if (docked && collapsed) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        className="flex flex-col items-center justify-center h-full cursor-pointer select-none"
        style={{ width: 36, borderLeft: '1px solid rgba(13,148,136,0.18)', background: 'linear-gradient(180deg, #0f172a 0%, #0d4f4f 100%)' }}
        title="Expand OpsMentor"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          <div className="text-white font-bold" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 11, letterSpacing: 2 }}>
            OpsMentor
          </div>
          <div className="text-teal-300" style={{ fontSize: 14 }}>›</div>
        </div>
      </div>
    );
  }

  // Fullscreen mode — fills entire viewport
  const wrapperClass = fullscreen
    ? 'flex flex-col bg-white overflow-hidden fixed z-[200]'
    : docked
    ? 'flex flex-col h-full bg-white overflow-hidden'
    : 'orchestrator-panel fixed z-50 bg-white flex flex-col overflow-hidden';
  const wrapperStyle = fullscreen
    ? { inset: 0 }
    : docked
    ? {}
    : { width: 480, maxHeight: 680, bottom: 72, right: 20, display: panelVisible ? 'flex' : 'none', borderRadius: 16, boxShadow: '0 25px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(13,148,136,0.15)', border: '1px solid rgba(13,148,136,0.1)' };

  return (
    <>
      {/* Floating trigger — only shown in non-docked (small screen) mode */}
      {!docked && <button
        onClick={() => {
          if (!open) {
            setOpen(true);
            setPanelVisible(true);
            setTimeout(() => inputRef.current?.focus(), 100);
          } else {
            setPanelVisible(v => !v);
            if (!panelVisible) setTimeout(() => inputRef.current?.focus(), 100);
          }
        }}
        className={[
          'fixed bottom-5 right-5 z-50 rounded-2xl shadow-2xl',
          'flex items-center gap-2 px-4 py-2.5 text-white text-sm font-bold',
          'transition-all duration-200',
          hasAlerts && !panelVisible ? 'ring-2 ring-amber-400 ring-offset-2' : '',
        ].join(' ')}
        style={{
          background: open && panelVisible
            ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)'
            : 'linear-gradient(135deg, #0f172a 0%, #0d4f4f 100%)',
        }}
        title={open && !panelVisible ? 'OpsMentor active — click to restore' : 'Open OpsMentor'}
      >
        <span className={[
          'w-2 h-2 rounded-full flex-shrink-0 transition-all',
          open ? 'bg-teal-300 animate-pulse' : 'bg-teal-400',
        ].join(' ')} />
        <span>{open && panelVisible ? '× Close' : 'OpsMentor'}</span>
        {hasAlerts && !panelVisible && (
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
        )}
      </button>}

      {/* Panel — docked: always rendered, fills the right column. Floating: shown when open */}
      {(docked || open) && (
        <div className={wrapperClass} style={wrapperStyle}>
          {/* Header — premium gradient, full identity */}
          <div
            className="text-white px-4 pt-3 pb-2.5 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #0d4f4f 100%)' }}
          >
            {/* Row 1: Brand + controls */}
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-extrabold tracking-tight">OpsMentor</span>
                <span className="text-teal-300 text-xs ml-2 font-medium opacity-90">AI Lifecycle Admin</span>
              </div>
              {/* Fullscreen toggle */}
              <button
                onClick={() => setFullscreen(f => !f)}
                className="text-xs w-6 h-6 rounded font-bold bg-white/10 hover:bg-white/20 text-teal-200 transition-colors flex-shrink-0 flex items-center justify-center"
                title={fullscreen ? 'Exit full screen' : 'Full screen'}
              >{fullscreen ? '⊡' : '⊞'}</button>
              {/* Collapse — docked only */}
              {docked && !fullscreen && (
                <button
                  onClick={() => setCollapsed(true)}
                  className="text-slate-400 hover:text-white w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0"
                  title="Collapse panel"
                >‹</button>
              )}
              {!docked && (
                <button
                  onClick={() => setPanelVisible(false)}
                  className="text-slate-400 hover:text-white w-6 h-6 flex items-center justify-center text-xl leading-none flex-shrink-0 ml-0.5"
                  title="Minimise"
                >−</button>
              )}
            </div>
            {/* Row 2: Stack context + phase badge */}
            <div className="flex items-center gap-2 mt-1.5 min-w-0">
              {(s.ctx?.hw || s.ctx?.os || s.ctx?.db || s.ctx?.app) ? (
                <span className="text-xs text-teal-200/60 font-mono truncate flex-1">
                  {[s.ctx?.hw, s.ctx?.os, s.ctx?.db, s.ctx?.app].filter(Boolean).join(' · ')}
                </span>
              ) : (
                <span className="text-xs text-slate-400 flex-1 italic">Tell me your platform to begin</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                s.promoted      ? 'bg-green-500 text-white' :
                s.rtmSigned     ? 'bg-teal-500 text-white' :
                s.cabApproved   ? 'bg-blue-500 text-white' :
                s.phase2Active  ? 'bg-purple-500 text-white' :
                s.designApplied ? 'bg-amber-500 text-white' :
                s.isBuilt       ? 'bg-slate-500 text-white' :
                                  'bg-slate-700 text-slate-300'
              }`}>
                {s.promoted      ? 'LIVE' :
                 s.rtmSigned     ? 'RTM ✓' :
                 s.cabApproved   ? 'CAB ✓' :
                 s.phase2Active  ? 'Phase 2' :
                 s.designApplied ? 'Design ✓' :
                 s.isBuilt       ? 'Built' : 'Ready'}
              </span>
            </div>
          </div>

          {/* Checklist */}
          <div className="orch-workflow-strip">
            <WorkflowStrip items={checklist} />
          </div>

          {/* Worker connectivity warning */}
          {workerOk === false && (
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex-shrink-0">
              <span className="text-xs text-amber-700">
                ⚠ AI proxy unreachable — Groq may take an extra second. All text commands work immediately.
              </span>
            </div>
          )}

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0"
            aria-live="polite"
            aria-label="OpsMentor conversation"
            role="log"
          >
            {messages.map(msg =>
              msg.role === 'confirm' ? (
                <ConfirmCard
                  key={msg.id}
                  actions={msg.actions}
                  onConfirm={() => handleConfirm(msg.actions)}
                  onCancel={handleCancel}
                />
              ) : (
                <Bubble
                  key={msg.id}
                  msg={msg}
                  onChipClick={chip => {
                    if (chip.action === 'OPEN_SCAN') {
                      window.dispatchEvent(new CustomEvent('opsmanifest-run-scan'));
                    } else if (chip.action === 'NAVIGATE_TAB' && chip.tab) {
                      store.setActiveTab(chip.tab);
                    }
                  }}
                  onSuggestionClick={q => handleSend(q)}
                />
              )
            )}
            {thinking && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-sm" style={{ fontSize: 9, fontWeight: 800, background: 'linear-gradient(135deg, #0f172a 0%, #0d4f4f 100%)' }}>AI</div>
                <div className="orch-bubble-ai bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  {[0, 0.2, 0.4].map(d => (
                    <div key={d} className="w-2 h-2 rounded-full bg-slate-400" style={{ animation: `splash-pulse 1.2s ease-in-out ${d}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Field chips — shown when OpsMentor is awaiting a specific field selection */}
          {chipsField && FIELD_CHIPS[chipsField] && (
            <div className="px-3 py-2.5 border-t border-teal-100 flex-shrink-0 bg-teal-50/60">
              <div className="text-xs text-teal-700 mb-2 font-semibold uppercase tracking-wide flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                Select {chipsField === 'envType' ? 'environment' : chipsField.toUpperCase()} — or type your own below
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FIELD_CHIPS[chipsField].map(v => (
                  <button
                    key={v}
                    onClick={() => handleChipSelect(chipsField, v)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold border bg-white border-teal-200 text-teal-700 hover:bg-teal-600 hover:text-white hover:border-teal-600 transition-all shadow-sm"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick suggestions — shown when no chips and input empty */}
          {!chipsField && !input && !thinking && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
              {(s.isBuilt
                ? [
                    "What's next?",
                    (s.vulnRegistry || []).some(v => v.status === 'ACTIVE') ? 'Check vulnerabilities' : 'Show alerts',
                    (s.stakeholderDiscussions || []).some(d => d.status === 'PENDING') ? 'Stakeholder discussions' : 'RTM ready?',
                    liveScore >= 10 ? `Risk score: ${liveScore}` : 'Check incompatibilities',
                  ]
                : ['Phase 1 fields?', "What's next?", 'Current status?', 'Can I share details here?']
              ).map(q => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className="text-xs px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 hover:border-teal-400 hover:text-teal-600 transition-colors bg-white"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Quick action buttons — contextual per workflow phase */}
          {!chipsField && (() => {
            const qa = getQuickActions();
            if (!qa.length) return null;
            return (
              <div className="px-3 py-2.5 border-t border-slate-100 flex-shrink-0 bg-slate-50">
                <div className="text-xs text-slate-400 mb-1.5 font-semibold uppercase tracking-wide">Quick actions</div>
                <div className="flex flex-wrap gap-1.5">
                  {qa.map(a => (
                    <button
                      key={a.id}
                      onClick={() => handleQuickAction(a.id)}
                      className={[
                        'text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all',
                        a.fill
                          ? 'bg-teal-50 border-teal-200 text-teal-700 line-through opacity-50'
                          : a.primary
                          ? 'bg-teal-600 border-teal-600 text-white hover:bg-teal-700 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-700',
                      ].join(' ')}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Typing indicator */}
          {input.trim() && (
            <div className="px-4 pb-1 flex items-center gap-2 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse flex-shrink-0" />
              <span className="text-xs text-slate-400 italic">typing…</span>
            </div>
          )}

          {/* Live hints strip — shown while typing when keywords detected */}
          {liveHints && (
            <div className="px-4 pb-1.5 flex flex-wrap gap-1.5">
              {Object.entries(liveHints.detected).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
                  <span className="font-bold">{k.toUpperCase()}</span> {v}
                </span>
              ))}
              {liveHints.eol.map((e, i) => (
                <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${e.severity === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  ⚠ EOL: {e.short} ({e.eolDate})
                </span>
              ))}
              {liveHints.compat.map((r, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                  🔴 {r.title.slice(0, 48)}{r.title.length > 48 ? '…' : ''}
                </span>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="orch-input-area flex gap-2 px-4 py-3 border-t border-slate-100 flex-shrink-0 bg-white">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                awaitingFieldRef.current && FIELD_PLACEHOLDERS[awaitingFieldRef.current]
                  ? FIELD_PLACEHOLDERS[awaitingFieldRef.current]
                  : 'Ask anything about your build…'
              }
              disabled={thinking}
              rows={1}
              className="orch-input flex-1 resize-none text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 placeholder:text-slate-400 disabled:opacity-50 transition-all"
              style={{ minHeight: 42, maxHeight: 96 }}
            />
            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || thinking}
              className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-sm"
            >
              ↵
            </button>
          </div>

          {/* RACI context hint — email + resolved role label */}
          <div className="orch-footer px-4 pb-2.5 text-xs text-slate-400 flex-shrink-0">
            {authUser ? (() => {
              const pm = s.requirements?.pmEmail;
              const pmBackup = s.requirements?.pmBackupEmail;
              const email = authUser.email;
              if (email === pm) return (
                <><span className="font-medium text-slate-500">{email}</span><span className="text-teal-600"> · PM</span><span> — full access</span></>
              );
              if (email === pmBackup) return (
                <><span className="font-medium text-slate-500">{email}</span><span className="text-teal-600"> · PM Backup</span><span> — full access</span></>
              );
              // Resolve actual RACI role(s) from roleAssignments
              const assignments = s.roleAssignments || {};
              const roles = Object.entries(assignments)
                .filter(([, v]) => v?.email === email || v?.backup === email)
                .map(([role, v]) => v?.backup === email ? `${role} (backup)` : role);
              if (roles.length > 0) return (
                <><span className="font-medium text-slate-500">{email}</span><span className="text-blue-600"> · {roles.slice(0, 2).join(', ')}</span></>
              );
              return (
                <><span className="font-medium text-slate-500">{email}</span><span> · No role assigned in this build</span></>
              );
            })()
            : <span className="text-slate-400">Guest mode — sign in to save builds and execute actions</span>
            }
          </div>
        </div>
      )}
    </>
  );
}
