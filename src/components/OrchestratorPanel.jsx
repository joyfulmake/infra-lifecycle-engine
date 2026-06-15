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
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-sm"
          style={{ fontSize: 9, fontWeight: 800, background: 'linear-gradient(135deg, #0f172a 0%, #0d4f4f 100%)' }}
        >AI</div>
      )}
      <div className={[
        'rounded-xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%]',
        isUser
          ? 'bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-tr-sm shadow-sm'
          : 'orch-bubble-ai bg-slate-50 text-slate-800 rounded-tl-sm border-l-2 border-teal-500 shadow-sm',
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

export default function OrchestratorPanel({ docked = false }) {
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
  const [workerOk,    setWorkerOk]    = useState(null); // null=unknown, true=ok, false=blocked
  const [ttsVoice,    setTtsVoice]    = useState(null); // 'cartesia'|'elevenlabs'|'none'|null
  const [chipsField,  setChipsField]  = useState(null); // 'hw'|'os'|'db'|'app'|'envType'|null
  const [fullscreen,  setFullscreen]  = useState(false);
  const [collapsed,   setCollapsed]   = useState(false);

  const abortRef        = useRef(null);
  const inputRef        = useRef(null);
  const bottomRef       = useRef(null);
  const msgId           = useRef(0);
  const pendingConfirmRef = useRef(null);
  // Speech recognition — browser-native SpeechRecognition first (no network),
  // MediaRecorder + Whisper as secondary (requires worker proxy)
  const speechRecRef     = useRef(null);   // native SpeechRecognition instance
  const mediaStreamRef   = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const silenceTimerRef  = useRef(null);
  const maxRecTimerRef   = useRef(null);
  const audioCtxRef      = useRef(null); // Whisper MediaRecorder analysis
  const hasSpeechRef     = useRef(false);
  const audioUnlockedRef = useRef(false);
  const noSpeechTimerRef = useRef(null); // escape to Whisper if SpeechRecognition produces nothing

  // Always-current refs to avoid stale closures in mic/timers
  const userNameRef       = useRef('');
  const awaitingNameRef   = useRef(false); // name-asking removed — no gate on commands
  const awaitingFieldRef  = useRef(null); // 'hw'|'os'|'db'|'app'|'projectName'|'envType'|'goLiveDate'|null
  const pendingTaskRef    = useRef(null); // { title } waiting for gantt/raid choice
  const recordingRef      = useRef(false);
  const sRef                  = useRef(s);
  const authUserRef           = useRef(authUser);
  const messagesRef           = useRef([]);
  const transcribeFailCountRef = useRef(0);
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
  const welcomeSpokenRef   = useRef(false);

  const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

  // Must be called synchronously in a click/key handler (before any await).
  // Unlocks HTMLAudioElement and — on very first interaction — queues a brief
  // spoken welcome so the user hears OpsMentor greet them.
  function unlockAudio() {
    const wasLocked = !audioUnlockedRef.current;
    if (wasLocked) {
      audioUnlockedRef.current = true;
      try { const a = new Audio(SILENT_WAV); a.volume = 0; a.play().catch(() => {}); } catch {}
    }
    if (wasLocked && !welcomeSpokenRef.current) {
      welcomeSpokenRef.current = true;
      const hour = new Date().getHours();
      const g = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      speakQueued(`${g}! I'm OpsMentor. Let's build your infrastructure profile.`);
    }
  }

  // Extract the key question or next-action sentence to speak aloud.
  // Skips pure confirmation echoes — user can read those, hearing them is redundant.
  function voiceExcerpt(text) {
    if (!text) return '';
    const sentences = (text || '')
      .replace(/[•★✓✗→←↑↓]\s*/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 8);
    if (!sentences.length) return text.slice(0, 120);
    // Prefer the question — most natural to speak aloud
    const q = sentences.find(s => s.includes('?'));
    if (q) return q.slice(0, 160);
    // Skip bare confirmation echoes (single-word value confirmations user just clicked)
    const bareEcho = /^(hardware set to|os set to|database set to|application set to|environment set to)\s+[^.]+\.?$/i;
    const meaningful = sentences.find(s => !bareEcho.test(s)) || sentences[sentences.length - 1] || sentences[0];
    return meaningful.replace(/^(next:|next step:)\s*/i, '').trim().slice(0, 160);
  }

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
      try { currentAudioRef.current.pause(); } catch {}
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
    // Only speak after the user has unlocked audio with a gesture.
    // Without a gesture, browser blocks all audio — queue drains silently on page load.
    if (!audioUnlockedRef.current) {
      cartesiaQueueRef.current = [];
      cartesiaPlayingRef.current = false;
      return;
    }
    cartesiaPlayingRef.current = true;
    const text = cartesiaQueueRef.current.shift();

    let played = false;

    // Primary: Cartesia Sonic-2 via same-origin Pages Function relay
    if (CARTESIA_CONFIGURED) {
      const ttsBody = JSON.stringify({
        text,
        voiceId: VOICE_IDS.learner,  // 694f9389 — "Pilot" clear male presenter
        speed: pickSpeed(text),
        emotion: pickEmotion(text),
      });
      for (const ttsUrl of ['/api/cartesia-tts', `${CARTESIA_WORKER_URL}/cartesia-tts`]) {
        try {
          const res = await fetch(ttsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: ttsBody,
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) continue;
          const blob = await res.blob();
          const objUrl = URL.createObjectURL(blob);
          const audio = new Audio(objUrl);
          audio.volume = 1;
          currentAudioRef.current = audio;
          try {
            await audio.play();
            played = true;
            await new Promise(resolve => { audio.onended = resolve; audio.onerror = resolve; });
            break;
          } catch { /* autoplay blocked — try next URL */ }
          finally {
            URL.revokeObjectURL(objUrl);
            currentAudioRef.current = null;
          }
        } catch { /* network error — try next */ }
      }
    }

    // Final fallback: Web Speech API — zero config, works in every browser
    if (!played && typeof speechSynthesis !== 'undefined') {
      try {
        speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        const voices = speechSynthesis.getVoices();
        const preferred =
          voices.find(v => /neural|natural|enhanced|premium/i.test(v.name) && v.lang.startsWith('en')) ||
          voices.find(v => /microsoft|google/i.test(v.name) && v.lang.startsWith('en')) ||
          voices.find(v => v.lang.startsWith('en'));
        if (preferred) utt.voice = preferred;
        utt.rate = 0.92; utt.pitch = 1.0; utt.volume = 1.0;
        await new Promise(resolve => { utt.onend = resolve; utt.onerror = resolve; speechSynthesis.speak(utt); });
        played = true;
      } catch { /* browser TTS unavailable */ }
    }

    runCartesiaQueue();
  }

  function speakQueued(text) {
    const excerpt = voiceExcerpt(text);
    if (!excerpt) return;
    cartesiaQueueRef.current.push(excerpt);
    if (!cartesiaPlayingRef.current) runCartesiaQueue();
  }

  function buildWelcome() {
    const stack = [s.ctx?.hw, s.ctx?.os, s.ctx?.db, s.ctx?.app].filter(Boolean).join(' / ');
    const sc = generateScript(s);
    if (stack && s.isBuilt) {
      return `Welcome back. Your ${stack} build is already in progress.\n\nNext step: ${sc.nextAction || 'all phases complete'}.\n\nSelect a chip or type your next step — I'll take it from here.`;
    }
    if (s.isBuilt || s.scanComplete || s.designApplied) {
      return `Welcome back. Build in progress — next: ${sc.nextAction || 'all phases complete'}.\n\nType your next step or use the buttons below.`;
    }
    // Fresh start — warm, brief, action-oriented
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    return `${greeting}. I'm OpsMentor — your AI infrastructure manager.\n\nI'll guide you through your full server lifecycle: hardware selection, system design, CAB approval, RTM sign-off, and production go-live.\n\nSelect your hardware platform below to get started.`;
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

  // Show welcome + kick off guided interview when OpsMentor first activates
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ id: nextId(), role: 'orchestrator', text: buildWelcome() }]);
      // Auto-start field interview for blank builds — show HW chips immediately
      if (!sRef.current.isBuilt && !sRef.current.ctx?.hw) {
        awaitingFieldRef.current = 'hw';
        setChipsField('hw');
      } else if (!sRef.current.isBuilt) {
        const firstMissing = nextFieldPrompt(sRef.current, null);
        if (firstMissing) {
          awaitingFieldRef.current = firstMissing;
          if (FIELD_CHIPS[firstMissing]) setChipsField(firstMissing);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Worker connectivity + TTS capability check
  useEffect(() => {
    if (!open || workerOk !== null) return;
    let cancelled = false;
    (async () => {
      for (const url of [`${CARTESIA_WORKER_URL}/health`, '/api/health']) {
        try {
          const r = await fetch(url, { signal: AbortSignal.timeout(3500) });
          if (r.ok && !cancelled) {
            setWorkerOk(true);
            try {
              const data = await r.json();
              setTtsVoice(data.tts?.voice || null);
            } catch { setTtsVoice(null); }
            return;
          }
        } catch { /* try next */ }
      }
      if (!cancelled) setWorkerOk(false);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workerOk]);

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
    // Deep sync tracking
    selIncCount: 0, selUumCount: 0,
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
    // orc = voiced, prominent messages for major workflow gates
    // log = compact one-liners for minor events
    const orc = [];
    const log = [];

    if (!prev.isBuilt && s.isBuilt) {
      awaitingFieldRef.current = null;
      setChipsField(null);
      const { hw, os, db, app } = s.ctx || {};
      const stack = [hw, os, db, app].filter(Boolean).join(' / ') || 'your stack';
      orc.push(`Stack locked in — ${stack}. Now hit the AI Smart Scan in the left sidebar. It checks CVEs, EOL status, and compatibility for your entire stack in under 2 seconds. You'll love what it finds!`);
    }
    if (!prev.scanComplete && s.scanComplete) {
      const incCount  = (s.selInc || []).length;
      const uumCount  = (s.selUUM || []).length;
      const findings  = (s.scanResults?.findings || []);
      const critical  = findings.filter(f => f.sev === 'CRITICAL');
      const high      = findings.filter(f => f.sev === 'HIGH');
      const riskLvl   = s.scanResults?.riskLevel || 'UNKNOWN';
      const summaryLines = [
        `Scan complete — Risk: ${riskLvl} · ${findings.length} finding${findings.length !== 1 ? 's' : ''}`,
        critical.length > 0 ? `CRITICAL: ${critical.map(f => f.component).join(', ')}` : null,
        high.length > 0 ? `HIGH: ${high.map(f => f.component).join(', ')}` : null,
        `Auto-selected: ${incCount} incident${incCount !== 1 ? 's' : ''}, ${uumCount} UUM item${uumCount !== 1 ? 's' : ''} for remediation`,
      ].filter(Boolean);
      log.push(summaryLines.join('\n'));
      const crit = critical.length > 0 ? `${critical.length} CRITICAL issue${critical.length !== 1 ? 's' : ''} flagged — address these first. ` : '';
      orc.push(`Scan done! ${crit}${incCount} incident${incCount !== 1 ? 's' : ''} and ${uumCount} UUM item${uumCount !== 1 ? 's' : ''} pre-selected for your stack.\n\nOpen System Design now — fill all 8 sections, then click "Generate Task Plan" to lock the design and build the project schedule.`);
    }
    if (!prev.designApplied && s.designApplied) {
      awaitingFieldRef.current = null;
      orc.push(`Design locked and tasks generated! The schedule is live in the Gantt tab.\n\nNow inject Phase 2 from the sidebar — that activates your incident triage scope, UUM task matrix, and unlocks Gantt and RTM for full editing.`);
    }
    if (!prev.phase2Active && s.phase2Active) {
      awaitingFieldRef.current = null;
      const inc = (s.selInc || []).length;
      const uum = (s.selUUM || []).length;
      orc.push(`Phase 2 is live! ${inc} incident${inc !== 1 ? 's' : ''} and ${uum} UUM item${uum !== 1 ? 's' : ''} in scope. Open the Gantt tab — your auto-generated schedule is ready to review. Once it looks right, submit to CAB from the sidebar.`);
    }
    if (!prev.cabApproved && s.cabApproved) {
      orc.push(`CAB approved — you're cleared for cutover! Open the RTM tab now and mark every requirement row as PASS or NA. Once every row is signed off, the "Promote to Live" button will activate.`);
    }
    if (!prev.cabDeclined && s.cabDeclined) {
      orc.push(`CAB declined this change. Not the end — click "Unlock Tabs for Revision" in the sidebar to lift all phase gates. Update the design, adjust scope or schedule, then resubmit. You've got this.`);
    }
    if (!prev.rtmSigned && s.rtmSigned) {
      orc.push(`RTM signed! Every requirement is verified and on record. Head to the Closure tab — work through the post-go-live checklist, then hit "Promote to Live" when you're in the outage window. Almost there!`);
    }
    if (!prev.promoted && s.promoted) {
      orc.push(`System is live! Excellent work. Complete the Closure checklist — hypercare monitoring, CMDB updates, lessons-learned — then export your full audit trail to Excel from the sidebar. You did it!`);
    }
    if (!prev.rtmStale && s.rtmStale) {
      log.push(`RTM drifted — scope changed after sign-off. Open RTM, re-review each row, and re-sign if requirements still hold.`);
    }
    if (!prev.tasksStaleReason && s.tasksStaleReason) {
      log.push(`Gantt tasks are stale: ${s.tasksStaleReason}. Open Gantt and click Regenerate.`);
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

    // ── Deep sync: incident / UUM scope changes (Phase 2 only) ───────────────
    if (s.phase2Active && prev.selIncCount !== undefined) {
      if (selIncCount > prev.selIncCount) {
        log.push(`+${selIncCount - prev.selIncCount} incident — scope: ${selIncCount} incident${selIncCount !== 1 ? 's' : ''} total.`);
      } else if (selIncCount < prev.selIncCount && prev.selIncCount > 0) {
        log.push(`Incident removed — scope: ${selIncCount} incident${selIncCount !== 1 ? 's' : ''} total.`);
      }
      if (selUumCount > prev.selUumCount) {
        log.push(`+${selUumCount - prev.selUumCount} UUM item — scope: ${selUumCount} UUM item${selUumCount !== 1 ? 's' : ''} total.`);
      } else if (selUumCount < prev.selUumCount && prev.selUumCount > 0) {
        log.push(`UUM item removed — scope: ${selUumCount} item${selUumCount !== 1 ? 's' : ''} total.`);
      }
    }

    // ── Deep sync: RTM progress ───────────────────────────────────────────────
    if (s.cabApproved && !s.rtmSigned && rtmTotalCount > 0) {
      const prevPassed = (prev.rtmPassCount || 0) + (prev.rtmNaCount || 0);
      const nowPassed  = rtmPassCount + rtmNaCount;
      if (nowPassed > prevPassed) {
        if (nowPassed >= rtmTotalCount) {
          orc.push(`All ${rtmTotalCount} RTM rows are verified — every requirement shows PASS or NA. Ready to sign off! Say "sign RTM" or use the sidebar to lock the baseline.`);
        } else if (nowPassed % 5 === 0 || nowPassed === Math.floor(rtmTotalCount / 2)) {
          log.push(`RTM: ${nowPassed}/${rtmTotalCount} rows verified (${Math.round(nowPassed / rtmTotalCount * 100)}%).`);
        }
      }
      if (rtmFailCount > (prev.rtmFailCount || 0)) {
        log.push(`RTM: ${rtmFailCount} FAIL row${rtmFailCount !== 1 ? 's' : ''} — must be resolved before sign-off.`);
      }
    }

    // ── Deep sync: RAID entries added outside OpsMentor ──────────────────────
    if (raidCount > (prev.raidCount || 0) && prev.raidCount !== undefined) {
      const delta = raidCount - prev.raidCount;
      log.push(`+${delta} RAID entr${delta !== 1 ? 'ies' : 'y'} added — ${raidCount} total on record.`);
    }

    // ── Deep sync: Closure checklist progress ─────────────────────────────────
    if (s.rtmSigned && closureCheckCount > (prev.closureCheckCount || 0)) {
      if (closureTotalCount > 0 && closureCheckCount >= closureTotalCount) {
        orc.push(`Closure checklist complete — all post-go-live items are done! Export your full audit trail to Excel from the sidebar when ready.`);
      } else if (closureCheckCount % 3 === 0 && closureCheckCount > 0 && closureTotalCount > 0) {
        log.push(`Closure: ${closureCheckCount}/${closureTotalCount} items done.`);
      }
    }

    // ── Deep sync: Team RACI filling up ──────────────────────────────────────
    if (rolesFilledCount > (prev.rolesFilledCount || 0)) {
      if (rolesFilledCount >= 20 && prev.rolesFilledCount < 20) {
        orc.push(`All 20 roles assigned — the full RACI team is on record! Open the Roles tab to confirm email contacts and backup coverage.`);
      } else if (rolesFilledCount === 10 && (prev.rolesFilledCount || 0) < 10) {
        log.push(`Team halfway there — ${rolesFilledCount}/20 roles assigned in the Roles tab.`);
      }
    }

    // ── Deep sync: New coherence warnings ────────────────────────────────────
    if (coherenceWarnCount > (prev.coherenceWarnCount || 0)) {
      const warns = (s.coherenceAlerts || []).filter(a => a.severity === 'warn');
      if (warns.length > 0) {
        const latest = warns[warns.length - 1];
        log.push(`Coherence alert: ${latest.message}${latest.action ? ' — ' + latest.action : ''}`);
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
      const sc = generateScript(sRef.current); // always use latest state
      const nudge = sc.nextAction
        ? `Next up: ${sc.nextAction}`
        : 'Build looks complete — ask me anything or export your audit trail.';
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

  // When docked, always open immediately — no button needed
  useEffect(() => {
    if (docked) { setOpen(true); setPanelVisible(true); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docked]);

  // Open when ExecOverview "OpsMentor" button is clicked (floating mode)
  useEffect(() => {
    const handler = () => {
      unlockAudio(); // dispatched from button click — gesture still active, unlock audio now
      setOpen(true);
      setPanelVisible(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    };
    window.addEventListener('opsmanifest-orchestrator-open', handler);
    return () => window.removeEventListener('opsmanifest-orchestrator-open', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open after tour dismisses — tour "Start using it" click IS a gesture, capture it
  useEffect(() => {
    const handler = () => {
      // Call synchronously inside the click gesture context so audio unlocks immediately
      unlockAudio();
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

  // ── Auto-speak orchestrator messages via TTS queue ────────────────────────
  // Only speaks 'orchestrator' role messages — never log entries, nudges, results,
  // or user messages. Voice starts from message #2 (welcome skipped — no gesture yet).
  // voiceExcerpt() inside speakQueued ensures we speak the KEY QUESTION or NEXT ACTION,
  // never an echo of what the user just typed or selected.
  useEffect(() => {
    if (!open || messages.length === 0) return;
    if (messages.length === 1) return; // welcome — no gesture yet, browser blocks audio
    const last = messages[messages.length - 1];
    if (last.role !== 'orchestrator') return;
    speakQueued(last.text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, open]);

  // ── Field change logging ──────────────────────────────────────────────────
  // Watches every ctx and requirements field individually.
  const prevCtx = useRef({ hw: undefined, os: undefined, db: undefined, app: undefined });
  const prevReqs = useRef({ projectName: undefined, envType: undefined, projectStartDate: undefined, goLiveDate: undefined, sla: undefined });

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
    const { projectName: pn, envType: pe, projectStartDate: psd, goLiveDate: pg, sla: ps } = prevReqs.current;
    const name = userNameRef.current;
    const pre = name ? `${name} — ` : '';
    const logs = [];
    if (pn  !== undefined && pn  !== reqProjectName      && reqProjectName)      logs.push(`${pre}Project: ${reqProjectName}`);
    if (pe  !== undefined && pe  !== reqEnvType           && reqEnvType)          logs.push(`${pre}Environment: ${reqEnvType}`);
    if (psd !== undefined && psd !== reqProjectStartDate  && reqProjectStartDate) logs.push(`${pre}Project start: ${reqProjectStartDate}`);
    if (pg  !== undefined && pg  !== reqGoLiveDate        && reqGoLiveDate)       logs.push(`${pre}Go-live: ${reqGoLiveDate}`);
    if (ps  !== undefined && ps  !== reqSla               && reqSla)              logs.push(`${pre}SLA: ${reqSla}`);
    if (logs.length > 0) setMessages(m => [...m, ...logs.map(t => ({ id: nextId(), role: 'log', text: t }))]);
    prevReqs.current = { projectName: reqProjectName, envType: reqEnvType, projectStartDate: reqProjectStartDate, goLiveDate: reqGoLiveDate, sla: reqSla };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqProjectName, reqEnvType, reqProjectStartDate, reqGoLiveDate, reqSla]);

  // ── Field interview sync — advance/close interview when user fills via UI ──
  useEffect(() => {
    if (!open || awaitingNameRef.current || !awaitingFieldRef.current) return;
    const currS = sRef.current;
    const { hw, os, db, app } = currS.ctx || {};
    const r = currS.requirements || {};
    const filled = { hw: !!hw, os: !!os, db: !!db, app: !!app,
      projectName: !!r.projectName, envType: !!r.envType,
      projectStartDate: !!r.projectStartDate, goLiveDate: !!r.goLiveDate };
    const curr = awaitingFieldRef.current;
    if (!filled[curr]) return; // not yet filled
    const next = nextFieldPrompt(currS, curr);
    awaitingFieldRef.current = next;
    if (!next) {
      const sc = generateScript(currS);
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text:
        `All fields set — you're ready to go! ${sc.nextAction ? sc.nextAction : 'Say "run scan" to kick off the AI Smart Scan.'}`
      }]);
    } else {
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: FIELD_QUESTIONS[next] }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxHw, ctxOs, ctxDb, ctxApp, reqProjectName, reqEnvType, reqProjectStartDate, reqGoLiveDate, open]);

  // ── Tab change logging ────────────────────────────────────────────────────
  const prevActiveTab = useRef('');
  useEffect(() => {
    if (!prevActiveTab.current) { prevActiveTab.current = s.activeTab; return; }
    if (prevActiveTab.current === s.activeTab) return;
    prevActiveTab.current = s.activeTab;
    // User is navigating the app directly — stop field interview
    if (!awaitingNameRef.current) awaitingFieldRef.current = null;
    const n = userNameRef.current ? `, ${userNameRef.current}` : '';
    const tabHints = {
      exec:    `Executive Summary${n}. Risk score, KPIs, and incident overview — this is your command dashboard.`,
      design:  `System Design${n}. Fill all 8 sections — Network, Storage, Security, Backup, Compliance, Monitoring, DR, HA — then click "Generate Task Plan" to lock the design and build your project schedule.`,
      gantt:   `Gantt chart${n}. Your auto-generated schedule is here — review the critical path and task durations.${s.tasksStaleReason ? ' Tasks are stale — click Regenerate now.' : ''}`,
      rtm:     `RTM${n}. Every requirement row must be PASS or NA before you can sign off.${s.rtmStale ? ' Scope drifted after sign-off — re-review required!' : ' Work through the rows and get every one green.'}`,
      matrix:  `Cross-Stack Matrix${n}. See task dependencies across all 8 swimlane layers — great for spotting blocking chains.`,
      raid:    `RAID Log${n}. Log Risks, Assumptions, Issues, and Decisions here — this becomes your project governance record.`,
      roles:   `Roles and RACI${n}. Assign your 20-role team, set email contacts, and lock who owns each design section.`,
      closure: `Closure checklist${n}. Tick off every post-go-live item — hypercare, CMDB updates, lessons-learned — before exporting.`,
      diagram: `Infrastructure Diagram${n}. Switch between Visual topology, ASCII Map, and Mission Intel to see your architecture from every angle.`,
      cmdb:    `CMDB live EOL data${n}. Check real-time end-of-life status for every component in your stack.`,
      vuln:    `Vulnerability Registry${n}. CVEs, EOL risks, stakeholder decisions, and the full action audit trail — all in one place.`,
      risks:   `Risk Tracker${n}. Current score: ${liveScore} (${liveRl.label}). ${liveRisks.filter(r => r.severity === 'CRITICAL').length > 0 ? `${liveRisks.filter(r => r.severity === 'CRITICAL').length} critical risk${liveRisks.filter(r => r.severity === 'CRITICAL').length !== 1 ? 's' : ''} need immediate attention!` : 'Looking good — keep monitoring as scope changes.'}`,
      cost:    `Cost Management${n}. ${s.costConfig?.enabled ? 'Cost tracking is active — your project cost is being estimated from task hours.' : 'Enable cost tracking to get a real-time project cost estimate from your task schedule.'}`,
    };
    const hint = tabHints[s.activeTab];
    // Use orchestrator role for tab hints so voice announces the context
    if (hint) setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: hint }]);
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

  // ── Chip selection — direct field update without text parsing ─────────────
  function handleChipSelect(field, value) {
    unlockAudio(); // must be synchronous — call before any await
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
      const envReply = `Environment set to ${value}.${next ? `\n\n${FIELD_QUESTIONS[next]}` : '\n\nAll Phase 1 fields done — I\'ll build and scan now.'}`;
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

    let reply = `${CTX_LABEL[field] || field} set to ${value}.`;

    if (!next && !updatedS.isBuilt) {
      // All 4 ctx fields set — build + scan
      applyActionsWithRefs([
        { type: 'BUILD', description: 'Build environment from stack selection', requiresConfirmation: false },
        { type: 'RUN_SCAN', description: 'Auto-run AI Smart Scan', requiresConfirmation: false },
      ]);
      reply += '\n\nAll stack fields set — building and running AI Smart Scan now.';
    } else if (next && FIELD_CHIPS[next]) {
      setChipsField(next);
      reply += `\n\n${FIELD_QUESTIONS[next]}`;
    } else if (next) {
      reply += `\n\n${FIELD_QUESTIONS[next]}`;
    }

    setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: reply }]);
  }

  // ── Mic / voice input ────────────────────────────────────────────────────
  function processVoiceInput(text) {
    // Delegate to handleSend via setInput + synthetic submit to reuse all logic
    // We set input and immediately call the send logic inline (avoids state timing issues)
    const currS    = sRef.current;
    const currAuth = authUserRef.current;

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
      // RUN_SCAN: show the PhasePanel ScanModal popup instead of running scan directly.
      // The popup animates, runs the scan, and lets the user click "Apply Results".
      if (action.type === 'RUN_SCAN') {
        window.dispatchEvent(new CustomEvent('opsmanifest-run-scan'));
        auditLog(action, 'executed');
        done.push(action.description);
        continue; // don't call executeAction — modal handles scan + completeScan
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

  // ── Voice input — browser-native SpeechRecognition (primary, no network needed)
  // Falls back to MediaRecorder → Whisper proxy if SpeechRecognition unavailable.
  // SpeechRecognition works in Chrome, Edge, Brave (normal mode) natively.

  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const srCycleCountRef = useRef(0); // rapid-cycle detector for Brave/Firefox
  const srStartTimeRef  = useRef(0);

  function startNativeSpeech() {
    if (!SR) { startWhisperRecording(); return; }
    srCycleCountRef.current = 0;
    srStartTimeRef.current = 0;
    _startNativeSpeechInner();
  }

  function _startNativeSpeechInner() {
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = true;       // keep mic open until user clicks stop
    rec.interimResults = true;   // show live interim transcript
    rec.maxAlternatives = 1;
    speechRecRef.current = rec;
    srStartTimeRef.current = Date.now();

    rec.onstart = () => {
      setRecording(true); recordingRef.current = true; setRecStatus('listening…');
      // If no speech result arrives in 10 s, the browser speech service isn't working.
      // Escape to Whisper (Groq) which is network-independent of browser speech service.
      clearTimeout(noSpeechTimerRef.current);
      noSpeechTimerRef.current = setTimeout(() => {
        if (!recordingRef.current) return;
        try { speechRecRef.current?.stop(); } catch {}
        speechRecRef.current = null;
        recordingRef.current = false;
        setMessages(m => [...m, { id: nextId(), role: 'log', text:
          'Switching to Whisper — browser speech service returned nothing. Speak after the mic indicator turns blue.' }]);
        startWhisperRecording();
      }, 3000);
    };

    rec.onresult = (e) => {
      clearTimeout(noSpeechTimerRef.current); // got a result — cancel the escape timer
      srCycleCountRef.current = 0;
      const latest = e.results[e.results.length - 1];
      if (latest.isFinal) {
        const t = latest[0].transcript.trim();
        if (t) { setRecStatus('listening…'); processVoiceInput(t); }
      } else {
        setRecStatus(latest[0].transcript.slice(0, 60) + '…');
      }
    };

    rec.onerror = (e) => {
      clearTimeout(noSpeechTimerRef.current);
      if (e.error === 'not-allowed') {
        recordingRef.current = false;
        setRecording(false); setRecStatus('');
        speechRecRef.current = null;
        setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text:
          'Mic access denied — click the lock icon in the address bar → Microphone → Allow, then try again.' }]);
      } else {
        // service-not-allowed (Brave Shields), network, or other service errors → fall back to Whisper
        try { speechRecRef.current?.stop(); } catch {}
        speechRecRef.current = null;
        recordingRef.current = false;
        setRecStatus('');
        setMessages(m => [...m, { id: nextId(), role: 'log', text:
          'Browser speech service unavailable — switching to Whisper transcription.' }]);
        startWhisperRecording();
      }
    };

    rec.onend = () => {
      clearTimeout(noSpeechTimerRef.current);
      if (!recordingRef.current || !speechRecRef.current) {
        setRecording(false); recordingRef.current = false; setRecStatus('');
        speechRecRef.current = null;
        return;
      }
      const elapsed = Date.now() - srStartTimeRef.current;
      srCycleCountRef.current += 1;
      if (elapsed < 1500 && srCycleCountRef.current >= 3) {
        recordingRef.current = false;
        speechRecRef.current = null;
        setRecStatus('');
        setMessages(m => [...m, { id: nextId(), role: 'log', text:
          'Browser speech service blocked — switching to Whisper transcription.' }]);
        startWhisperRecording();
        return;
      }
      setTimeout(() => {
        if (recordingRef.current && speechRecRef.current) {
          try { speechRecRef.current.start(); } catch {}
        }
      }, 150);
    };

    try { rec.start(); } catch { clearTimeout(noSpeechTimerRef.current); setRecording(false); setRecStatus(''); }
  }

  // Whisper fallback (used only when SpeechRecognition is unavailable)
  async function startWhisperRecording() {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || '';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = rec;
      audioChunksRef.current = [];
      hasSpeechRef.current = false;
      rec.ondataavailable = e => { if (e.data?.size > 0) audioChunksRef.current.push(e.data); };
      rec.start(300);
      setRecording(true); recordingRef.current = true; setRecStatus('listening');

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      function checkVolume() {
        if (!recordingRef.current) return;
        analyser.getByteTimeDomainData(buf);
        const rms = Math.sqrt(buf.reduce((s, v) => s + (v - 128) ** 2, 0) / buf.length);
        if (rms > 3.5) {
          hasSpeechRef.current = true;
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => { if (recordingRef.current && hasSpeechRef.current) submitWhisperAudio(); }, 1800);
        }
        requestAnimationFrame(checkVolume);
      }
      requestAnimationFrame(checkVolume);
      maxRecTimerRef.current = setTimeout(() => { if (recordingRef.current) submitWhisperAudio(); }, 30000);
    } catch (e) {
      setRecording(false); recordingRef.current = false; setRecStatus('');
      const msg = e.name === 'NotAllowedError' ? 'Microphone access denied. Allow it in your browser settings.'
        : e.name === 'NotFoundError' ? 'No microphone found.' : `Mic error: ${e.message}`;
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: msg }]);
    }
  }

  async function submitWhisperAudio() {
    clearTimeout(silenceTimerRef.current);
    clearTimeout(maxRecTimerRef.current);
    hasSpeechRef.current = false;
    setRecStatus('processing');
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      await new Promise(resolve => { rec.onstop = resolve; rec.stop(); });
    }
    const blob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
    audioChunksRef.current = [];
    if (blob.size < 2000) { if (recordingRef.current) restartWhisperCapture(); return; }

    let transcribed = false;
    for (const url of [`${CARTESIA_WORKER_URL}/whisper-transcribe`, '/api/whisper-transcribe']) {
      if (transcribed) break;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': blob.type || 'audio/webm', 'X-Audio-Type': blob.type || 'audio/webm' },
          body: blob,
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) continue;
        const { transcript } = await res.json();
        if (transcript?.trim()) { setInput(''); processVoiceInput(transcript.trim()); }
        transcribed = true;
        transcribeFailCountRef.current = 0;
      } catch { /* try next */ }
    }
    if (!transcribed) { transcribeFailCountRef.current++; }
    if (recordingRef.current) restartWhisperCapture();
  }

  function restartWhisperCapture() {
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
    maxRecTimerRef.current = setTimeout(() => { if (recordingRef.current) submitWhisperAudio(); }, 30000);
  }

  function stopRecording() {
    clearTimeout(noSpeechTimerRef.current);
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch {}
      speechRecRef.current = null;
    }
    recordingRef.current = false;
    clearTimeout(silenceTimerRef.current);
    clearTimeout(maxRecTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    setRecording(false); setRecStatus('');
  }

  function handleMic() {
    unlockAudio(); // synchronous — before any async
    if (recording) { stopRecording(); return; }
    transcribeFailCountRef.current = 0;
    if (SR) {
      // Native speech recognition — no network needed, works in Chrome/Edge/Brave
      startNativeSpeech();
    } else {
      // Fallback: MediaRecorder → Whisper proxy
      startWhisperRecording();
    }
  }

  // ── Name reply handler ───────────────────────────────────────────────────

  // Field interview order — projectStartDate comes before goLiveDate (can't set end without start)
  const FIELD_ORDER = ['hw', 'os', 'db', 'app', 'projectName', 'envType', 'projectStartDate', 'goLiveDate'];

  // Clickable chip options for each field — user picks instead of typing
  const FIELD_CHIPS = {
    hw:      ['Dell PowerEdge R750', 'HPE ProLiant DL380', 'IBM Power9', 'Cisco UCS B-Series', 'Supermicro SuperServer'],
    os:      ['RHEL 9.2', 'RHEL 8.6', 'Ubuntu 22.04 LTS', 'Windows Server 2022', 'AIX 7.2', 'Oracle Linux 8'],
    db:      ['Oracle 19c', 'PostgreSQL 15', 'MySQL 8.0', 'SQL Server 2022', 'MongoDB 6', 'MariaDB 10.11'],
    app:     ['WebSphere 9.0', 'JBoss EAP 7.4', 'Apache Tomcat 10', 'nginx 1.24', 'WebLogic 14c', 'IIS 10'],
    envType: ['Production', 'UAT', 'DR', 'Dev', 'SIT'],
  };
  const FIELD_QUESTIONS = {
    hw:               'What hardware platform are you running on? (select a chip or type — e.g. Dell PowerEdge R750, HPE ProLiant, IBM Power9)',
    os:               'What operating system? (e.g. RHEL 9.2, Ubuntu 22.04, Windows Server 2022, AIX 7.2)',
    db:               'What database engine? (e.g. Oracle 19c, PostgreSQL 15, MySQL 8.0, SQL Server 2022)',
    app:              'What application or middleware? (e.g. WebSphere 9.0, JBoss EAP 7.4, Tomcat, nginx, IIS)',
    projectName:      'What should we call this project? (a short name for this build — e.g. "DB Upgrade Q3 2026")',
    envType:          'What environment type is this? (Production, UAT, DR, Dev, or SIT)',
    projectStartDate: 'When does this project kick off? (start date — e.g. 2026-07-01)',
    goLiveDate:       'And when is the target go-live date? (e.g. 2026-09-15)',
  };
  const FIELD_CTX_MAP = {
    hw: 'hardware', os: 'OS', db: 'database', app: 'application',
  };
  const FIELD_REQ_MAP = {
    projectName: 'project name', envType: 'environment',
    projectStartDate: 'project start date', goLiveDate: 'go-live date',
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
    unlockAudio(); // must be synchronous — call before any await
    const text = input.trim();
    if (!text || thinking) return;

    setInput('');

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

      // Let workflow commands escape the interview (build, skip, run scan, etc.)
      const isCommand = /^(build|build it|build now|run scan|scan|skip|next|cancel|help|status|what|done|ready)(\s|$)/.test(tl)
        || /\b(run scan|ai scan|inject|submit cab|sign rtm|go live|promote)\b/.test(tl);

      if (!isCommand) {
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
            const next = nextFieldPrompt(sRef.current, awField);
            awaitingFieldRef.current = next;
            if (next && FIELD_CHIPS[next]) setChipsField(next);
            const nextQ = next ? `\n\n${FIELD_QUESTIONS[next]}` : '\n\nAll fields complete! Say "run scan" to continue.';
            const fullReply = reply + nextQ;
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

      // Groq-powered NLP (async — voice via auto-speak useEffect when reply message is added)
      const ctx    = buildStateContext(s, authUser);
      const result = await sendChatMessage(text, ctx, getHistory(messagesRef.current));

      setThinking(false);

      const { reply, actions = [], nextPrompt } = result;
      const replyText = nextPrompt ? `${reply} ${nextPrompt}` : reply;

      const needsConfirm = actions.some(a => a.requiresConfirmation);
      const immediate    = actions.filter(a => !a.requiresConfirmation);

      // Run non-significant actions straight away
      if (immediate.length > 0) applyActions(immediate);

      // Show reply — voice via useEffect (gesture is long gone after Groq roundtrip)
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
          unlockAudio(); // direct click — gesture context active, unlock audio now
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
              {/* Stop voice */}
              <button
                onClick={() => { stopCartesia(); setPlaying(false); abortRef.current?.abort(); }}
                className="text-xs px-2 py-0.5 rounded font-medium bg-white/10 hover:bg-white/20 text-teal-200 transition-colors flex-shrink-0"
                title="Stop voice"
              >⏹</button>
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
                  title="Minimise (voice continues)"
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

          {/* Worker connectivity / TTS availability warnings */}
          {ttsVoice === 'none' && workerOk === true && (
            <div className="px-3 py-2 bg-slate-900 border-b border-slate-700 flex-shrink-0">
              <span className="text-xs text-slate-300">
                Voice is silent — no TTS key in the worker. To activate: add <strong className="text-white">ELEVENLABS_API_KEY</strong> in Cloudflare dashboard → Workers → opsmanifest-ai → Settings → Variables. Free tier gives 10k chars/month.
              </span>
            </div>
          )}
          {workerOk === false && (
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex-shrink-0">
              <span className="text-xs text-amber-700">
                ⚠ Direct AI proxy unreachable — retrying via secure relay. Voice and Groq may take an extra second.
                All text commands work immediately without any connection.
              </span>
            </div>
          )}

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

          {/* Voice recording status + live typing indicator */}
          {(recStatus || input.trim()) && (
            <div className="px-4 pb-1 flex items-center gap-2 flex-shrink-0">
              {recStatus && (
                <>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${recStatus === 'processing' ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`} />
                  <span className="text-xs text-slate-500 truncate max-w-xs">
                    {recStatus === 'processing'
                      ? 'Transcribing…'
                      : (recStatus === 'listening' || recStatus === 'listening…')
                      ? 'Listening — speak now…'
                      : recStatus /* show live interim transcript */}
                  </span>
                </>
              )}
              {!recStatus && input.trim() && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse flex-shrink-0" />
                  <span className="text-xs text-slate-400 italic">typing…</span>
                </>
              )}
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
            {/* Mic button — always available; uses native SpeechRecognition (no network needed) */}
            <button
              onClick={handleMic}
              disabled={thinking}
              title={recording ? `Stop (${recStatus})` : SR ? 'Speak — browser-native, no network needed' : 'Speak — Whisper via proxy'}
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
              onClick={handleSend}
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
