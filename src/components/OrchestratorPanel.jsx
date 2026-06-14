import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { generateScript, getWorkflowChecklist } from '../lib/orchestratorScripts.js';
import { speakScript, CARTESIA_CONFIGURED, CARTESIA_WORKER_URL, VOICE_IDS } from '../lib/cartesia.js';
import { buildStateContext, checkPermission, executeAction } from '../lib/orchestratorActions.js';
import { sendChatMessage, ruleBasedResponse } from '../lib/orchestratorChat.js';
import { computeAllRisks, riskScore, riskLabel } from '../lib/riskEngine.js';

// ── Voice helpers — content-aware emotion and speed for Cartesia TTS ─────────

function pickEmotion(text) {
  const t = (text || '').toLowerCase();
  if (/critical|blocked|declined|urgent|failed|error|eol|expired|stale|risk|warning|cannot|can't/.test(t))
    return ['positivity:none', 'anger:low'];
  if (/approved|signed|complete|live|done|great|perfect|success|excellent|locked/.test(t))
    return ['positivity:high'];
  if (/\?|what|which|how|when|why|should|could|would|help|explain|tell me|walk me/.test(t))
    return ['positivity:medium', 'curiosity:high'];
  return ['positivity:medium'];
}

function pickSpeed(text) {
  return (text || '').length > 220 ? 'slow' : 'normal';
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg }) {
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
        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-sm" style={{ fontSize: 9, fontWeight: 800 }}>
          AI
        </div>
      )}
      <div className={[
        'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%] shadow-sm',
        isUser
          ? 'bg-teal-600 text-white rounded-tr-sm'
          : 'orch-bubble-ai bg-slate-100 text-slate-800 rounded-tl-sm',
      ].join(' ')}>
        {msg.text}
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
      <div className="text-xs font-bold text-amber-800 uppercase tracking-wide">Ready to execute</div>
      {[...immediate, ...significant].map((a, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <span className={[
            'mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold',
            a.requiresConfirmation ? 'bg-amber-500' : 'bg-teal-500',
          ].join(' ')} style={{ fontSize: 8 }}>
            {a.requiresConfirmation ? '!' : '✓'}
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

export default function OrchestratorPanel() {
  const store = useStore();
  const { authUser } = useAuth();

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
  };

  // Primitive extracts for stable dependency arrays
  const ctxHw  = store.ctx?.hw  || '';
  const ctxOs  = store.ctx?.os  || '';
  const ctxDb  = store.ctx?.db  || '';
  const ctxApp = store.ctx?.app || '';
  const reqProjectName = store.requirements?.projectName || '';
  const reqEnvType     = store.requirements?.envType     || '';
  const reqGoLiveDate  = store.requirements?.goLiveDate  || '';
  const reqSla         = store.requirements?.sla         || '';

  const [open,        setOpen]        = useState(false);  // OpsMentor activated
  const [panelVisible, setPanelVisible] = useState(false);  // panel UI shown
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [thinking,    setThinking]    = useState(false);
  const [playing,     setPlaying]     = useState(false);
  const [lineIdx,     setLineIdx]     = useState(0);
  const [recording,   setRecording]   = useState(false);
  const [recStatus,   setRecStatus]   = useState('');
  const [userName,    setUserName]    = useState('');

  const abortRef        = useRef(null);
  const inputRef        = useRef(null);
  const bottomRef       = useRef(null);
  const msgId           = useRef(0);
  const pendingConfirmRef = useRef(null);
  // MediaRecorder + Whisper STT (replaces SpeechRecognition API)
  const mediaStreamRef   = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const silenceTimerRef  = useRef(null);
  const maxRecTimerRef   = useRef(null);
  const audioCtxRef      = useRef(null);
  const hasSpeechRef     = useRef(false);
  const audioUnlockedRef = useRef(false);

  // Always-current refs to avoid stale closures in mic/timers
  const userNameRef       = useRef('');
  const awaitingNameRef   = useRef(true);
  const awaitingFieldRef  = useRef(null); // 'hw'|'os'|'db'|'app'|'projectName'|'envType'|'goLiveDate'|null
  const pendingTaskRef    = useRef(null); // { title } waiting for gantt/raid choice
  const recordingRef      = useRef(false);
  const sRef              = useRef(s);
  const authUserRef       = useRef(authUser);
  const messagesRef       = useRef([]);
  useEffect(() => { sRef.current = s; });
  useEffect(() => { authUserRef.current = authUser; }, [authUser]);
  useEffect(() => { recordingRef.current = recording; }, [recording]);
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

  // ── Cartesia TTS queue — human voice for all OpsMentor replies ──────────
  // Uses Cartesia Sonic-2 (warm guide voice). Falls back to Web Speech if
  // Cartesia is unavailable or the fetch fails.

  const cartesiaQueueRef   = useRef([]);
  const cartesiaPlayingRef = useRef(false);
  const currentAudioRef    = useRef(null);

  function cleanText(text) {
    return (text || '')
      .replace(/[•★✓✗→←↑↓]\s*/g, '')
      .replace(/\n+/g, '. ')
      .replace(/\d+\.\s/g, '')
      .trim()
      .slice(0, 600);
  }

  function stopCartesia() {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    cartesiaQueueRef.current = [];
    cartesiaPlayingRef.current = false;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }

  async function runCartesiaQueue() {
    if (cartesiaQueueRef.current.length === 0) {
      cartesiaPlayingRef.current = false;
      return;
    }
    cartesiaPlayingRef.current = true;
    const text = cartesiaQueueRef.current.shift();

    let played = false;
    if (CARTESIA_CONFIGURED) {
      try {
        const res = await fetch(`${CARTESIA_WORKER_URL}/cartesia-tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voiceId: VOICE_IDS.guide,
            speed: pickSpeed(text),
            emotion: pickEmotion(text),
          }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url  = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudioRef.current = audio;
          try {
            await audio.play(); // throws NotAllowedError if autoplay blocked
            await new Promise(resolve => {
              audio.onended = resolve;
              audio.onerror = resolve;
            });
            played = true;
          } catch {
            // Autoplay blocked — fall through to Web Speech
          } finally {
            URL.revokeObjectURL(url);
            currentAudioRef.current = null;
          }
        }
      } catch { /* network error — fall through */ }
    }

    if (!played && typeof speechSynthesis !== 'undefined') {
      await new Promise(resolve => {
        const utt = new SpeechSynthesisUtterance(text);
        utt.rate = 1.0; utt.pitch = 1.05; utt.volume = 1; utt.lang = 'en-US';
        const kv = setInterval(() => { if (speechSynthesis.paused) speechSynthesis.resume(); }, 5000);
        utt.onend  = () => { clearInterval(kv); resolve(); };
        utt.onerror = () => { clearInterval(kv); resolve(); };
        speechSynthesis.speak(utt);
      });
    }

    runCartesiaQueue();
  }

  function speakQueued(text) {
    const clean = cleanText(text);
    if (!clean) return;
    cartesiaQueueRef.current.push(clean);
    if (!cartesiaPlayingRef.current) runCartesiaQueue();
  }

  function buildWelcome() {
    const stack = [s.ctx?.hw, s.ctx?.os, s.ctx?.db, s.ctx?.app].filter(Boolean).join(' / ');
    if (stack) {
      return `OpsMentor activated. Picking up your ${stack} build — I'll keep you on track and flag anything that needs attention.\n\nWhat should I call you?`;
    }
    if (s.isBuilt || s.scanComplete || s.designApplied) {
      const phase = s.promoted ? 'live' : s.rtmSigned ? 'RTM signed off' : s.cabApproved ? 'CAB approved' : s.phase2Active ? 'Phase 2' : s.designApplied ? 'design complete' : s.scanComplete ? 'scan done' : 'Phase 1';
      return `OpsMentor here. Your build is at ${phase} — I'll guide you through the rest and call out any risks I see.\n\nWhat's your name?`;
    }
    return `OpsMentor activated. Tell me your stack and I'll guide you through every phase — from hardware selection all the way to go-live and closure.\n\nWhat should I call you?`;
  }

  // Show welcome (name-ask) when OpsMentor activates for the first time
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ id: nextId(), role: 'orchestrator', text: buildWelcome() }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Open after tour dismisses every time — also ensure voice starts
  // (override existing handler below)

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
  });

  // Compute live risk score for proactive warnings
  const liveRisks = computeAllRisks(s);
  const liveScore = riskScore(liveRisks);
  const liveRl    = riskLabel(liveScore);

  useEffect(() => {
    const prev = prevState.current;
    const logs = [];

    if (!prev.isBuilt && s.isBuilt) {
      const { hw, os, db, app } = s.ctx || {};
      logs.push(`Stack built: ${[hw, os, db, app].filter(Boolean).join(' / ') || 'stack'}. Next: run the AI Smart Scan in the left panel.`);
    }
    if (!prev.scanComplete && s.scanComplete) {
      logs.push(`AI Smart Scan complete — ${(s.selInc || []).length} incident(s) pre-selected. Next: open the System Design tab and fill in the 8 sections, then click "Generate Task Plan".`);
    }
    if (!prev.designApplied && s.designApplied) {
      logs.push(`System Design locked. Next: scroll to Phase 2 in the left panel and click "Inject Phase 2" to activate incident and UUM scope.`);
    }
    if (!prev.phase2Active && s.phase2Active) {
      logs.push(`Phase 2 active — ${(s.selInc || []).length} incident(s), ${(s.selUUM || []).length} UUM item(s) in scope. Open the Gantt tab to review the auto-generated schedule, then submit to CAB.`);
    }
    if (!prev.cabApproved && s.cabApproved) {
      logs.push(`CAB approved the change. You are cleared for cutover. Open the RTM tab to sign off all requirements before going live.`);
    }
    if (!prev.cabDeclined && s.cabDeclined) {
      logs.push(`CAB declined the change request. Click "Unlock Tabs for Revision" in the sidebar, address the feedback, then resubmit.`);
    }
    if (!prev.rtmSigned && s.rtmSigned) {
      logs.push(`RTM signed off. All requirements verified. Proceed to the Closure tab to initiate cutover.`);
    }
    if (!prev.promoted && s.promoted) {
      logs.push(`System is now live. Complete the Closure checklist and export the full audit trail to Excel.`);
    }
    if (!prev.rtmStale && s.rtmStale) {
      logs.push(`RTM has drifted — scope changed after sign-off. Review the RTM tab and re-sign if requirements are still met.`);
    }
    if (!prev.tasksStaleReason && s.tasksStaleReason) {
      logs.push(`Gantt tasks are stale: ${s.tasksStaleReason}. Open the Gantt tab and click "Regenerate Tasks" to refresh the schedule.`);
    }

    const activeVulns = (s.vulnRegistry || []).filter(v => v.status === 'ACTIVE').length;
    const pendingDisc = (s.stakeholderDiscussions || []).filter(d => d.status === 'PENDING').length;

    if (prev.vulnCount === 0 && activeVulns > 0) {
      logs.push(`${activeVulns} vulnerability${activeVulns !== 1 ? 'ies' : 'y'} now active in the registry. Open the Vulnerabilities tab to review, set business decisions, or add workarounds.`);
    } else if (activeVulns > prev.vulnCount && prev.vulnCount > 0) {
      logs.push(`New vulnerability added (total active: ${activeVulns}). Open the Vulnerabilities tab.`);
    }
    if (prev.pendingDiscCount === 0 && pendingDisc > 0) {
      logs.push(`${pendingDisc} stakeholder discussion${pendingDisc !== 1 ? 's' : ''} opened and pending — team/client agreement required. Check the Vulnerabilities tab → Stakeholder Discussions.`);
    }

    // Risk score threshold warnings
    const prevScore = prev.riskScore || 0;
    if (prevScore < 10 && liveScore >= 10) {
      logs.push(`Risk score has reached ${liveScore} (${liveRl.label}). ${liveRisks.filter(r => r.severity === 'CRITICAL').length} critical risk(s) need immediate attention. Open the Risk Tracker tab.`);
    } else if (prevScore < 18 && liveScore >= 18) {
      logs.push(`Risk score is now ${liveScore} — CRITICAL threshold. Project may be blocked without immediate action. Review the Risk Tracker tab urgently.`);
    }

    if (logs.length > 0) {
      setMessages(m => [...m, ...logs.map(text => ({ id: nextId(), role: 'log', text }))]);
    }

    prevState.current = {
      isBuilt: s.isBuilt, scanComplete: s.scanComplete, designApplied: s.designApplied,
      phase2Active: s.phase2Active, cabApproved: s.cabApproved, cabDeclined: s.cabDeclined,
      rtmSigned: s.rtmSigned, promoted: s.promoted, rtmStale: s.rtmStale,
      tasksStaleReason: s.tasksStaleReason,
      vulnCount: activeVulns, pendingDiscCount: pendingDisc, riskScore: liveScore,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.isBuilt, s.scanComplete, s.designApplied, s.phase2Active, s.cabApproved,
      s.cabDeclined, s.rtmSigned, s.promoted, s.rtmStale, s.tasksStaleReason,
      s.vulnRegistry?.length, s.stakeholderDiscussions?.length, liveScore]);

  // ── Inactivity prompt — if panel open and user idle 3s after last orch message ─
  const inactivityTimerRef = useRef(null);
  const nudgeSentRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    clearTimeout(inactivityTimerRef.current);
    nudgeSentRef.current = false; // reset on new message
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'orchestrator') return;
    // Wait 3 seconds; if user hasn't typed anything, send a contextual nudge
    inactivityTimerRef.current = setTimeout(() => {
      if (nudgeSentRef.current) return;
      nudgeSentRef.current = true;
      const sc = generateScript(s);
      const nudge = sc.nextAction
        ? `Still here — next up: ${sc.nextAction}`
        : 'Build looks complete. Ask me anything or export your full audit trail.';
      setMessages(m => [...m, { id: nextId(), role: 'nudge', text: nudge }]);
    }, 9000);
    return () => clearTimeout(inactivityTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, open]);

  // Cancel inactivity timer when user starts typing
  const handleInputChange = useCallback((e) => {
    clearTimeout(inactivityTimerRef.current);
    nudgeSentRef.current = true; // suppress nudge once typing starts
    setInput(e.target.value);
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
  }, []);

  // ── Auto-speak ALL messages via Web Speech queue ──────────────────────────
  // Voice continues even when panel is minimized (checks `open`, not `panelVisible`).
  useEffect(() => {
    if (!open || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (['user', 'confirm', 'result'].includes(last.role)) return;
    let text;
    if (last.role === 'orchestrator') {
      text = last.text.split('\n').find(l => l.trim().length > 10) || last.text;
    } else {
      text = last.text;
    }
    speakQueued(text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, open]);

  // ── Field change logging ──────────────────────────────────────────────────
  // Watches every ctx and requirements field individually.
  const prevCtx = useRef({ hw: undefined, os: undefined, db: undefined, app: undefined });
  const prevReqs = useRef({ projectName: undefined, envType: undefined, goLiveDate: undefined, sla: undefined });

  useEffect(() => {
    const { hw: ph, os: po, db: pd, app: pa } = prevCtx.current;
    const name = userNameRef.current;
    const pre = name ? `${name} — ` : '';
    const logs = [];
    if (ph !== undefined && ph !== ctxHw && ctxHw) logs.push(`${pre}Hardware set to: ${ctxHw}`);
    if (po !== undefined && po !== ctxOs && ctxOs) logs.push(`${pre}OS set to: ${ctxOs}`);
    if (pd !== undefined && pd !== ctxDb && ctxDb) logs.push(`${pre}Database set to: ${ctxDb}`);
    if (pa !== undefined && pa !== ctxApp && ctxApp) logs.push(`${pre}Application set to: ${ctxApp}`);
    if (logs.length > 0) setMessages(m => [...m, ...logs.map(t => ({ id: nextId(), role: 'log', text: t }))]);
    prevCtx.current = { hw: ctxHw, os: ctxOs, db: ctxDb, app: ctxApp };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxHw, ctxOs, ctxDb, ctxApp]);

  useEffect(() => {
    const { projectName: pn, envType: pe, goLiveDate: pg, sla: ps } = prevReqs.current;
    const name = userNameRef.current;
    const pre = name ? `${name} — ` : '';
    const logs = [];
    if (pn !== undefined && pn !== reqProjectName && reqProjectName) logs.push(`${pre}Project name: ${reqProjectName}`);
    if (pe !== undefined && pe !== reqEnvType && reqEnvType) logs.push(`${pre}Environment: ${reqEnvType}`);
    if (pg !== undefined && pg !== reqGoLiveDate && reqGoLiveDate) logs.push(`${pre}Go-live date: ${reqGoLiveDate}`);
    if (ps !== undefined && ps !== reqSla && reqSla) logs.push(`${pre}SLA: ${reqSla}`);
    if (logs.length > 0) setMessages(m => [...m, ...logs.map(t => ({ id: nextId(), role: 'log', text: t }))]);
    prevReqs.current = { projectName: reqProjectName, envType: reqEnvType, goLiveDate: reqGoLiveDate, sla: reqSla };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqProjectName, reqEnvType, reqGoLiveDate, reqSla]);

  // ── Tab change logging ────────────────────────────────────────────────────
  const prevActiveTab = useRef('');
  useEffect(() => {
    if (!prevActiveTab.current) { prevActiveTab.current = s.activeTab; return; }
    if (prevActiveTab.current === s.activeTab) return;
    prevActiveTab.current = s.activeTab;
    const n = userNameRef.current ? `, ${userNameRef.current}` : '';
    const tabHints = {
      exec:    `You opened Executive Summary${n}. Review incident triage, UUM changes, and the project KPI strip.`,
      design:  `You opened System Design${n}. Fill all 8 sections — Network, Storage, Security, Backup, Compliance, Monitoring, DR, HA — then click "Generate Task Plan" to build tasks and lock the design.`,
      gantt:   `You opened the Gantt chart${n}. Review your auto-generated schedule and critical path.${s.tasksStaleReason ? ' Tasks are stale — click Regenerate.' : ''}`,
      rtm:     `You opened the RTM${n}. Every requirement row must be PASS or NA before you can sign off.${s.rtmStale ? ' RTM has drifted — re-review required.' : ''}`,
      matrix:  `You opened Cross-Stack Matrix${n}. View task dependencies across all 8 swimlane layers.`,
      raid:    `You opened RAID Log${n}. Document Risks, Assumptions, Issues, and Decisions here.`,
      roles:   `You opened Roles and RACI${n}. Assign your team members to the 20 standard roles.`,
      closure: `You opened Closure${n}. Tick off every post-go-live check before exporting to Excel.`,
      diagram: `You opened Infrastructure Diagram${n}. Switch between Visual, ASCII Map, and Mission Intel views.`,
      cmdb:    `You opened CMDB${n}. Check live end-of-life data for your stack components.`,
      vuln:    `You opened Vulnerabilities${n}. Track CVEs, EOL risks, stakeholder discussions, and the full action audit trail for this build.`,
      risks:   `You opened Risk Tracker${n}. Risk score is currently ${liveScore} (${liveRl.label}). ${liveRisks.filter(r => r.severity === 'CRITICAL').length} critical risks need attention. Use the action buttons on each card to resolve or accept them.`,
      cost:    `You opened Cost Management${n}. ${s.costConfig?.enabled ? 'Cost tracking is active.' : 'Cost tracking is optional — enable it to estimate project cost from task hours.'}`,
    };
    const hint = tabHints[s.activeTab];
    if (hint) setMessages(m => [...m, { id: nextId(), role: 'log', text: hint }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.activeTab]);

  // ── TTS playback ─────────────────────────────────────────────────────────

  const handlePlay = useCallback(async () => {
    if (playing) { abortRef.current?.abort(); setPlaying(false); return; }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPlaying(true);
    setLineIdx(0);
    await speakScript(script.lines, {
      onLineStart: i => setLineIdx(i),
      signal: ctrl.signal,
    });
    if (!ctrl.signal.aborted) { setPlaying(false); abortRef.current = null; }
  }, [playing, script.lines]);

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

  function handleConfirm(actions) {
    setMessages(m => m.filter(msg => msg.role !== 'confirm'));
    pendingConfirmRef.current = null;
    applyActions(actions);
  }

  function handleCancel() {
    setMessages(m => m.filter(msg => msg.role !== 'confirm'));
    pendingConfirmRef.current = null;
    setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: 'Cancelled — no changes made.' }]);
  }

  // ── Mic / voice input ────────────────────────────────────────────────────
  function processVoiceInput(text) {
    // Delegate to handleSend via setInput + synthetic submit to reuse all logic
    // We set input and immediately call the send logic inline (avoids state timing issues)
    const currS    = sRef.current;
    const currAuth = authUserRef.current;

    if (awaitingNameRef.current) {
      setMessages(m => [...m, { id: nextId(), role: 'user', text }]);
      handleNameReply(text);
      return;
    }

    // For pending task / field interview, delegate to inline logic using refs
    if (pendingTaskRef.current || awaitingFieldRef.current) {
      setInput(text);
      // Trigger via a synthetic submit after a tick
      setTimeout(() => {
        setInput('');
        // Re-run the logic with current state
        const synth = text;
        setMessages(m => [...m, { id: nextId(), role: 'user', text: synth }]);

        if (pendingTaskRef.current) {
          const taskTitle = pendingTaskRef.current;
          pendingTaskRef.current = null;
          const dest = synth.toLowerCase();
          if (/gantt|schedule|task/.test(dest)) {
            const taskId = `mentor-${Date.now()}`;
            applyActionsWithRefs([
              { type: 'ADD_CUSTOM_TASK', description: `Add "${taskTitle}" to Gantt`, params: { id: taskId, title: taskTitle, est_hours: 4, addedAt: new Date().toISOString(), notes: 'Added via OpsMentor' }, requiresConfirmation: false },
              { type: 'NAVIGATE_TAB', description: 'Go to Gantt', params: { tab: 'gantt' }, requiresConfirmation: false },
            ]);
            setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: `Added "${taskTitle}" to Gantt — I estimated 4 hours. Adjust in the Gantt tab if needed.` }]);
          } else {
            const raidId = `raid-${Date.now()}`;
            applyActionsWithRefs([
              { type: 'ADD_RAID_ENTRY', description: `Add "${taskTitle}" to RAID`, params: { id: raidId, type: 'ISSUE', description: taskTitle, severity: 'MED', mitigation: 'Pending', status: 'OPEN', owner: 'PM', addedAt: new Date().toISOString() }, requiresConfirmation: false },
              { type: 'NAVIGATE_TAB', description: 'Go to RAID', params: { tab: 'raid' }, requiresConfirmation: false },
            ]);
            setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: `Added "${taskTitle}" to RAID log as an issue.` }]);
          }
          return;
        }

        const awField = awaitingFieldRef.current;
        if (awField) {
          awaitingFieldRef.current = null;
          const synthText = FIELD_CTX_MAP[awField] ? `${FIELD_CTX_MAP[awField]} is ${synth}` : FIELD_REQ_MAP[awField] ? `${FIELD_REQ_MAP[awField]} is ${synth}` : null;
          if (synthText) {
            const result = ruleBasedResponse(synthText, currS, currAuth);
            if (result) {
              const { reply, actions = [] } = typeof result === 'string' ? { reply: result } : result;
              if (actions.length > 0) applyActionsWithRefs(actions);
              const next = nextFieldPrompt(sRef.current, awField);
              awaitingFieldRef.current = next;
              setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: reply + (next ? `\n\n${FIELD_QUESTIONS[next]}` : '\n\nAll fields done! Say "run scan" to continue.') }]);
              return;
            }
          }
        }
      }, 0);
      return;
    }

    setMessages(m => [...m, { id: nextId(), role: 'user', text }]);
    setThinking(true);

    const fast = ruleBasedResponse(text, currS, currAuth);
    if (fast) {
      setThinking(false);
      const { reply, actions = [], _pendingTask } = typeof fast === 'string' ? { reply: fast } : fast;
      if (_pendingTask) pendingTaskRef.current = _pendingTask;
      const immediate   = actions.filter(a => !a.requiresConfirmation);
      const needsConfirm = actions.filter(a => a.requiresConfirmation);
      if (immediate.length > 0) applyActionsWithRefs(immediate);
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: reply }]);
      if (needsConfirm.length > 0) {
        setMessages(m => [...m, { id: nextId(), role: 'confirm', actions: needsConfirm }]);
      }
    } else {
      // Groq handles free-form voice questions — same path as handleSend
      (async () => {
        try {
          const ctx = buildStateContext(currS, currAuth);
          const result = await sendChatMessage(text, ctx, getHistory(messagesRef.current));
          setThinking(false);
          const { reply, actions = [], nextPrompt } = result;
          const replyText = nextPrompt ? `${reply} ${nextPrompt}` : reply;
          const immediate = actions.filter(a => !a.requiresConfirmation);
          const needsConfirm = actions.filter(a => a.requiresConfirmation);
          if (immediate.length > 0) applyActionsWithRefs(immediate);
          setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: replyText }]);
          if (needsConfirm.length > 0) {
            setMessages(m => [...m, { id: nextId(), role: 'confirm', actions: needsConfirm }]);
          }
        } catch {
          setThinking(false);
          setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: 'Having trouble connecting — try again in a moment, or type your question.' }]);
        }
      })();
    }
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
      executeAction(action, store);
      auditLog(action, 'executed');
      done.push(action.description);
    }
    if (done.length > 0) setMessages(m => [...m, { id: nextId(), role: 'result', text: `Done: ${done.join(' · ')}` }]);
    if (blocked.length > 0) setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: `Could not complete: ${blocked.join(' ')}` }]);
  }

  // ── MediaRecorder + Groq Whisper STT ──────────────────────────────────────
  // Uses MediaRecorder (getUserMedia) — works in ALL browsers including Brave/Edge.
  // Audio is sent to the CF Worker → Groq Whisper → transcript returned.
  // No Google/Microsoft speech API involved — zero browser-level blocking.

  function unlockAudio() {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    try {
      const ctx = new AudioContext();
      ctx.resume().then(() => ctx.close()).catch(() => {});
    } catch {}
  }

  async function startRecording() {
    if (recording) return;
    unlockAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
        .find(t => MediaRecorder.isTypeSupported(t)) || '';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = rec;
      audioChunksRef.current = [];
      hasSpeechRef.current = false;

      rec.ondataavailable = e => { if (e.data?.size > 0) audioChunksRef.current.push(e.data); };
      rec.start(300);

      setRecording(true);
      recordingRef.current = true;
      setRecStatus('listening');

      // Volume analysis for silence detection
      const audioCtx  = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source  = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);

      function checkVolume() {
        if (!recordingRef.current) return;
        analyser.getByteTimeDomainData(buf);
        const rms = Math.sqrt(buf.reduce((s, v) => s + (v - 128) ** 2, 0) / buf.length);
        if (rms > 3.5) { // speech detected
          hasSpeechRef.current = true;
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (recordingRef.current && hasSpeechRef.current) submitAudio();
          }, 1800);
        }
        requestAnimationFrame(checkVolume);
      }
      requestAnimationFrame(checkVolume);

      // Safety cap: submit after 30s regardless of silence
      maxRecTimerRef.current = setTimeout(() => {
        if (recordingRef.current) submitAudio();
      }, 30000);

    } catch (e) {
      setRecording(false);
      recordingRef.current = false;
      setRecStatus('');
      const msg =
        e.name === 'NotAllowedError'  ? 'Microphone access denied.\n\nClick the lock/camera icon in the address bar → Microphone → Allow → reload the page.' :
        e.name === 'NotFoundError'    ? 'No microphone found. Connect a mic and try again.' :
        e.name === 'NotReadableError' ? 'Microphone is in use by another app. Close it and try again.' :
                                        `Mic error: ${e.message}. Try reloading the page.`;
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: msg }]);
    }
  }

  async function submitAudio() {
    clearTimeout(silenceTimerRef.current);
    clearTimeout(maxRecTimerRef.current);
    hasSpeechRef.current = false;
    setRecStatus('processing');

    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      await new Promise(resolve => { rec.onstop = resolve; rec.stop(); });
    }

    const blob = new Blob(audioChunksRef.current, {
      type: mediaRecorderRef.current?.mimeType || 'audio/webm',
    });
    audioChunksRef.current = [];

    if (blob.size < 2000) { // too short — noise only
      if (recordingRef.current) restartCapture();
      return;
    }

    try {
      const res = await fetch(`${CARTESIA_WORKER_URL}/whisper-transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': blob.type || 'audio/webm',
          'X-Audio-Type':  blob.type || 'audio/webm',
        },
        body: blob,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { transcript } = await res.json();
      if (transcript?.trim()) {
        setInput('');
        processVoiceInput(transcript.trim());
      }
    } catch (e) {
      console.error('[Whisper STT]', e);
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: 'Could not transcribe — please type your message or check your connection and try again.' }]);
    }

    if (recordingRef.current) restartCapture();
  }

  function restartCapture() {
    const stream = mediaStreamRef.current;
    if (!stream || !recordingRef.current) { setRecStatus('listening'); return; }
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    mediaRecorderRef.current = rec;
    audioChunksRef.current = [];
    hasSpeechRef.current = false;
    rec.ondataavailable = e => { if (e.data?.size > 0) audioChunksRef.current.push(e.data); };
    rec.start(300);
    setRecStatus('listening');
    maxRecTimerRef.current = setTimeout(() => { if (recordingRef.current) submitAudio(); }, 30000);
  }

  function stopRecording() {
    recordingRef.current = false;
    clearTimeout(silenceTimerRef.current);
    clearTimeout(maxRecTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setRecording(false);
    setRecStatus('');
  }

  function handleMic() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: 'Your browser does not support audio capture. Please type your message.' }]);
      return;
    }
    if (recording) stopRecording();
    else startRecording();
  }

  // ── Name reply handler ───────────────────────────────────────────────────

  // Field interview order and questions
  const FIELD_ORDER = ['hw', 'os', 'db', 'app', 'projectName', 'envType', 'goLiveDate'];
  const FIELD_QUESTIONS = {
    hw:          'What hardware platform? (e.g. Dell PowerEdge R750, HPE ProLiant DL380, IBM Power9, or any custom server)',
    os:          'What operating system? (e.g. RHEL 8.6, Ubuntu 22.04 LTS, AIX 7.2, Windows Server 2022, or any custom OS)',
    db:          'What database? (e.g. Oracle 19c, PostgreSQL 15, MySQL 8.0, SQL Server 2022, or any custom DB)',
    app:         'What application or middleware? (e.g. WebSphere 9.0, JBoss EAP 7.4, Apache Tomcat 10, nginx, or any custom app)',
    projectName: 'What is the project name? (a short identifier for this build)',
    envType:     'What environment? (Production, UAT, DR, Dev, or SIT)',
    goLiveDate:  'What is the target go-live date? (e.g. 2026-09-15)',
  };
  const FIELD_CTX_MAP = {
    hw: 'hardware', os: 'OS', db: 'database', app: 'application',
  };
  const FIELD_REQ_MAP = {
    projectName: 'project name', envType: 'environment', goLiveDate: 'go-live date',
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
      if (f === 'goLiveDate' && !r.goLiveDate) return f;
    }
    return null;
  }

  function handleNameReply(text) {
    awaitingNameRef.current = false;
    const raw = text.split(/[\s,!.]+/)[0];
    const name = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase().replace(/[^a-z]/g, '');
    userNameRef.current = name;
    setUserName(name);

    const currS = sRef.current;
    const firstField = nextFieldPrompt(currS, null);
    awaitingFieldRef.current = firstField;

    const sc = generateScript(currS);
    const alreadyBuilt = currS.isBuilt;
    let reply;
    if (alreadyBuilt) {
      reply = `Great to meet you, ${name}! Your build is already in progress.\n\nCurrent step: ${sc.nextAction || 'All phases complete!'}\n\nYou can say things like:\n• "run scan", "inject phase 2", "approve CAB", "sign RTM", "go live"\n• "add task: [task name]" to add to Gantt or RAID\n• "set network firewall: pfsense" to update System Design\n• Ask me anything — I'll guide you!`;
    } else {
      reply = `Great to meet you, ${name}! Let's build your infrastructure profile step by step.\n\n${firstField ? FIELD_QUESTIONS[firstField] : 'All Phase 1 fields are complete — say "run scan" to continue!'}`;
    }
    setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: reply }]);
  }

  // ── Send message ─────────────────────────────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    if (!text || thinking) return;

    setInput('');

    // First reply = user's name
    if (awaitingNameRef.current) {
      setMessages(m => [...m, { id: nextId(), role: 'user', text }]);
      handleNameReply(text);
      return;
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
      awaitingFieldRef.current = null;
      let syntheticText;
      if (FIELD_CTX_MAP[awField]) {
        syntheticText = `${FIELD_CTX_MAP[awField]} is ${text}`;
      } else if (FIELD_REQ_MAP[awField]) {
        syntheticText = `${FIELD_REQ_MAP[awField]} is ${text}`;
      }
      if (syntheticText) {
        const result = ruleBasedResponse(syntheticText, sRef.current, authUserRef.current);
        if (result) {
          const { reply, actions = [] } = typeof result === 'string' ? { reply: result } : result;
          if (actions.length > 0) applyActionsWithRefs(actions);
          // Queue next field question
          const next = nextFieldPrompt(sRef.current, awField);
          awaitingFieldRef.current = next;
          const nextQ = next ? `\n\n${FIELD_QUESTIONS[next]}` : '\n\nAll fields complete! Say "run scan" to continue.';
          setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: reply + nextQ }]);
          return;
        }
      }
    }

    setThinking(true);

    try {
      // Rule-based mentor — handles phase guidance, field-setting, status queries
      const fast = ruleBasedResponse(text, s, authUser);
      if (fast) {
        setThinking(false);
        const { reply, actions = [], _pendingTask } = typeof fast === 'string' ? { reply: fast } : fast;
        if (_pendingTask) pendingTaskRef.current = _pendingTask;
        const immediate = actions.filter(a => !a.requiresConfirmation);
        const needsConfirm = actions.filter(a => a.requiresConfirmation);
        if (immediate.length > 0) applyActions(immediate);
        setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: reply }]);
        if (needsConfirm.length > 0) {
          setMessages(m => [...m, { id: nextId(), role: 'confirm', actions: needsConfirm }]);
        }
        return;
      }

      // Groq-powered NLP
      const ctx    = buildStateContext(s, authUser);
      const result = await sendChatMessage(text, ctx, getHistory(messagesRef.current));

      setThinking(false);

      const { reply, actions = [], nextPrompt } = result;
      const replyText = nextPrompt ? `${reply} ${nextPrompt}` : reply;

      const needsConfirm = actions.some(a => a.requiresConfirmation);
      const immediate    = actions.filter(a => !a.requiresConfirmation);

      // Run non-significant actions straight away
      if (immediate.length > 0) applyActions(immediate);

      // Show reply
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: replyText }]);

      // Show confirmation card for significant actions
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
      // When Groq is unavailable, respond with helpful guidance instead of a technical error
      const fallback = ruleBasedResponse('help', s, authUser);
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

  return (
    <>
      {/* Floating trigger — always visible; pulsing when OpsMentor active but minimized */}
      <button
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
          'fixed bottom-5 right-5 z-50 w-11 h-11 rounded-full shadow-xl',
          'flex items-center justify-center text-white text-base',
          'transition-all duration-200',
          open && panelVisible ? 'bg-teal-600 scale-110' :
          open ? 'bg-teal-500 ring-2 ring-teal-300 animate-pulse' :
          'bg-slate-700 hover:bg-teal-700',
          hasAlerts && !panelVisible ? 'ring-2 ring-amber-400 ring-offset-1' : '',
        ].join(' ')}
        title={open && !panelVisible ? 'OpsMentor active — click to restore' : 'OpsMentor'}
      >
        {open && panelVisible ? '×' : '🎯'}
      </button>

      {/* Panel — shown/hidden via panelVisible, never unmounted once open so voice continues */}
      {open && (
        <div
          className="orchestrator-panel fixed z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          style={{ width: 440, maxHeight: 660, bottom: 72, right: 20, display: panelVisible ? 'flex' : 'none' }}
        >
          {/* Header */}
          <div className="bg-slate-800 text-white px-4 py-3 flex items-center gap-2 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse flex-shrink-0" />
            <span className="text-sm font-semibold flex-1 tracking-tight">
              OpsMentor{userName ? ` · ${userName}` : ''}
            </span>
            <button
              onClick={() => { stopCartesia(); setPlaying(false); abortRef.current?.abort(); }}
              className="text-xs px-2.5 py-1 rounded font-medium transition-all bg-slate-600 hover:bg-slate-500 text-slate-300"
              title="Stop voice"
            >
              ⏹ Mute
            </button>
            <button onClick={() => setPanelVisible(false)} className="text-slate-400 hover:text-white w-6 h-6 flex items-center justify-center ml-1 text-xl leading-none" title="Minimise (voice continues)">−</button>
          </div>

          {/* Checklist */}
          <div className="orch-workflow-strip">
            <WorkflowStrip items={checklist} />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {messages.map(msg =>
              msg.role === 'confirm' ? (
                <ConfirmCard
                  key={msg.id}
                  actions={msg.actions}
                  onConfirm={() => handleConfirm(msg.actions)}
                  onCancel={handleCancel}
                />
              ) : (
                <Bubble key={msg.id} msg={msg} />
              )
            )}
            {thinking && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-sm" style={{ fontSize: 9, fontWeight: 800 }}>AI</div>
                <div className="orch-bubble-ai bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  {[0, 0.2, 0.4].map(d => (
                    <div key={d} className="w-2 h-2 rounded-full bg-slate-400" style={{ animation: `splash-pulse 1.2s ease-in-out ${d}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick suggestions — always shown when input empty */}
          {!input && !thinking && (
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

          {/* Voice recording status */}
          {recStatus && (
            <div className="px-4 pb-1 flex items-center gap-2 flex-shrink-0">
              <span className={['w-2 h-2 rounded-full', recStatus === 'restarting' ? 'bg-amber-500' : 'bg-red-500 animate-pulse'].join(' ')} />
              <span className="text-xs text-slate-500">
                {recStatus === 'listening' ? 'Listening — speak now…' : recStatus === 'restarting' ? 'Mic restarting…' : 'Processing speech…'}
              </span>
            </div>
          )}

          {/* Input */}
          <div className="orch-input-area flex gap-2 px-4 py-3 border-t border-slate-100 flex-shrink-0 bg-white">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything or speak with the mic…"
              disabled={thinking}
              rows={1}
              className="orch-input flex-1 resize-none text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 placeholder:text-slate-400 disabled:opacity-50 transition-all"
              style={{ minHeight: 42, maxHeight: 96 }}
            />
            {/* Mic button */}
            <button
              onClick={handleMic}
              disabled={thinking}
              title={recording ? 'Stop recording' : 'Speak to type'}
              className={[
                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all text-base',
                recording
                  ? 'bg-red-500 text-white animate-pulse shadow-lg'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200',
              ].join(' ')}
            >
              🎤
            </button>
            {/* Send button */}
            <button
              onClick={() => { unlockAudio(); handleSend(); }}
              disabled={!input.trim() || thinking}
              className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-sm"
            >
              ↵
            </button>
          </div>

          {/* RACI context hint */}
          <div className="orch-footer px-4 pb-2.5 text-xs text-slate-400 flex-shrink-0">
            {authUser
              ? <><span className="font-medium text-slate-500">{authUser.email}</span>{s.requirements?.pmEmail === authUser.email ? ' · PM — full access' : ' · Role-based access active'}</>
              : <span className="text-slate-400">Guest mode — sign in to save builds and execute actions</span>
            }
          </div>
        </div>
      )}
    </>
  );
}
