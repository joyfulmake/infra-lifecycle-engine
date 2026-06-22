import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { generateScript, getWorkflowChecklist } from '../lib/orchestratorScripts.js';
import { speakScript, CARTESIA_CONFIGURED, CARTESIA_WORKER_URL, VOICE_IDS } from '../lib/cartesia.js';
import { buildStateContext, checkPermission, executeAction } from '../lib/orchestratorActions.js';
import { sendChatMessage, ruleBasedResponse, parseRelativeDate, parseCompoundDateRange } from '../lib/orchestratorChat.js';
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
  const [collapsed,   setCollapsed]   = useState(initialCollapsed);
  // Voice ID gate — enterprise users (local-only, never stored in cloud)
  const [voiceIdPanel, setVoiceIdPanel] = useState(false);
  const [voiceIdStep,  setVoiceIdStep]  = useState('check'); // 'check'|'enrolling'|'verifying'|'done'
  const [voiceIdPhrase, setVoiceIdPhrase] = useState('');

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
  // Speech recognition — browser-native SpeechRecognition first (no network),
  // MediaRecorder + Whisper as secondary (requires worker proxy)
  const speechRecRef     = useRef(null);   // native SpeechRecognition instance
  const mediaStreamRef   = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const silenceTimerRef  = useRef(null);
  const maxRecTimerRef      = useRef(null);
  const audioCtxRef         = useRef(null); // Whisper MediaRecorder analysis
  const hasSpeechRef        = useRef(false);
  const audioUnlockedRef    = useRef(false);
  const noSpeechTimerRef    = useRef(null); // escape to Whisper if SpeechRecognition produces nothing
  const lastVoiceTextRef    = useRef('');   // dedup: ignore repeated transcripts within 3s
  const userEditedInputRef  = useRef(false); // true when user typed manually during recording
  const lastVoiceTimeRef    = useRef(0);
  const lastSpokenExcerptRef = useRef('');  // dedup: don't speak same TTS text within 8s
  const lastSpokenExcerpTimeRef = useRef(0);

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

  const cartesiaQueueRef      = useRef([]);
  const cartesiaPlayingRef    = useRef(false);
  const sharedAudioCtxRef     = useRef(null);  // shared AudioContext — avoids CSP blob: issues
  const currentAudioSourceRef = useRef(null);  // currently playing AudioBufferSourceNode
  const welcomeSpokenRef      = useRef(false);

  const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

  // Must be called synchronously in a click/key handler (before any await).
  // Creates and resumes a shared AudioContext so all subsequent decodeAudioData/play
  // calls work without autoplay or CSP blob: restrictions.
  function unlockAudio() {
    const wasLocked = !audioUnlockedRef.current;
    if (wasLocked) {
      audioUnlockedRef.current = true;
      try {
        // Create shared AudioContext in the gesture context so it starts in 'running' state
        const ActxClass = window.AudioContext || window.webkitAudioContext;
        if (ActxClass) {
          const ctx = new ActxClass();
          sharedAudioCtxRef.current = ctx;
          // Resume in case browser created it suspended
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          // Play one-sample silent buffer to guarantee unlock
          const buf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        }
      } catch {}
    }
    if (wasLocked && !welcomeSpokenRef.current) {
      welcomeSpokenRef.current = true;
      // Speak the last orchestrator message already in the chat (if any).
      // Don't use buildVoicePrompt — it's state-driven and can say "Start with the
      // hardware platform" even when the chat is showing the welcome/name-asking flow.
      const lastOrc = [...(messagesRef.current || [])]
        .reverse()
        .find(m => m.role === 'orchestrator');
      if (lastOrc?.text) speakQueued(lastOrc.text);
    }
  }

  // Extract the key question or next-action sentence to speak aloud.
  // Skips pure confirmation echoes — user can read those, hearing them is redundant.
  function voiceExcerpt(text) {
    if (!text) return '';
    const clean = text
      .replace(/[•★✓✗→←↑↓✦⚠️💡🎯]\s*/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      // Strip parenthetical examples "(e.g. ...)" — natural in chat, robotic when spoken
      .replace(/\s*\([^)]{4,}\)/g, '')
      .trim();
    // Short messages (single action/question): speak entirely
    if (clean.length <= 100) return clean;
    const sentences = clean
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 6);
    if (!sentences.length) return clean.slice(0, 80);
    // 1st priority: the question — this is the call to action
    const q = sentences.find(s => s.includes('?'));
    if (q) return q.slice(0, 90);
    // 2nd priority: first substantive sentence only — no walls of text spoken aloud
    const first = sentences[0] || clean;
    return first.replace(/^(next:|next step:|note:|important:)\s*/i, '').trim().slice(0, 80);
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
    if (currentAudioSourceRef.current) {
      try { currentAudioSourceRef.current.stop(); } catch {}
      currentAudioSourceRef.current = null;
    }
    cartesiaQueueRef.current = [];
    cartesiaPlayingRef.current = false;
  }

  async function runCartesiaQueue() {
    if (cartesiaQueueRef.current.length === 0) {
      cartesiaPlayingRef.current = false;
      return;
    }
    // Only speak after the user has unlocked audio with a gesture.
    if (!audioUnlockedRef.current) {
      cartesiaQueueRef.current = [];
      cartesiaPlayingRef.current = false;
      return;
    }
    cartesiaPlayingRef.current = true;
    const text = cartesiaQueueRef.current.shift();

    // Use Web Audio API (AudioContext.decodeAudioData) — avoids CSP blob: restrictions
    // and autoplay policy issues. AudioContext unlocked via unlockAudio() on first gesture.
    if (CARTESIA_CONFIGURED) {
      const ttsBody = JSON.stringify({
        text,
        voiceId: VOICE_IDS.learner,
        speed: pickSpeed(text),
        emotion: pickEmotion(text),
      });
      for (const ttsUrl of ['/api/cartesia-tts', `${CARTESIA_WORKER_URL}/cartesia-tts`]) {
        try {
          const res = await fetch(ttsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: ttsBody,
            signal: AbortSignal.timeout(12000),
          });
          if (!res.ok) continue;
          const arrayBuf = await res.arrayBuffer();
          // Get or recreate shared AudioContext
          let ctx = sharedAudioCtxRef.current;
          if (!ctx || ctx.state === 'closed') {
            const ActxClass = window.AudioContext || window.webkitAudioContext;
            if (!ActxClass) break;
            ctx = new ActxClass();
            sharedAudioCtxRef.current = ctx;
          }
          if (ctx.state === 'suspended') await ctx.resume();
          const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
          const source = ctx.createBufferSource();
          source.buffer = decoded;
          source.connect(ctx.destination);
          currentAudioSourceRef.current = source;
          // Pause SpeechRecognition during TTS to prevent acoustic feedback loop
          if (speechRecRef.current && recordingRef.current) {
            try { speechRecRef.current.stop(); } catch {} // onend restarts it after TTS
          }
          await new Promise((resolve) => { source.onended = resolve; source.start(0); });
          currentAudioSourceRef.current = null;
          // TTS finished — restart SR if it was paused for this clip and recording is still active
          if (recordingRef.current && speechRecRef.current) {
            try { speechRecRef.current.start(); } catch {}
          }
          break; // success — move to next queue item
        } catch { /* network/decode error — try next URL */ }
      }
    }

    runCartesiaQueue();
  }

  function speakQueued(text) {
    const excerpt = voiceExcerpt(text);
    if (!excerpt) return;
    // Never speak identical text twice within 8 s — prevents TTS loops from repeated messages
    const now = Date.now();
    if (excerpt === lastSpokenExcerptRef.current && now - lastSpokenExcerpTimeRef.current < 8000) return;
    lastSpokenExcerptRef.current = excerpt;
    lastSpokenExcerpTimeRef.current = now;
    cartesiaQueueRef.current.push(excerpt);
    if (!cartesiaPlayingRef.current) runCartesiaQueue();
  }

  // Chat message — observational/agent-style, not interrogating.
  // Accepts optional state snapshot (for unlockAudio / sRef.current calls).
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

  // Voice prompt — natural spoken sentences, no parroting of visible state.
  function buildVoicePrompt(state) {
    const st = state || s;
    const { hw, os, db, app } = st.ctx || {};
    const r = st.requirements || {};
    const proj = r.projectName;

    if (st.promoted)
      return `Hypercare window is open${proj ? ` for ${proj}` : ''}. Watch for early post-cutover surprises and work through the closure checklist.`;
    if (st.rtmSigned && st.cabApproved)
      return `Every gate is cleared. Confirm the bridge team is assembled and initiate cutover when the change window opens.`;
    if (st.rtmSigned)
      return `RTM signed. Review the RAID log and Gantt before submitting to CAB — those are what the board focuses on.`;
    if (st.cabApproved)
      return `CAB approved. Open RTM and verify every row — one unresolved FAIL blocks cutover.`;
    if (st.cabDeclined)
      return `CAB declined. Check the RAID log, Gantt schedule, and design-to-RTM traceability — those are the three most common decline reasons.`;
    if (st.phase2Active)
      return `Phase 2 is active. Open the Gantt and check the critical path before submitting to CAB.`;
    if (st.designApplied)
      return `Design locked. Inject Phase 2 from the sidebar to bring in incident and change tasks.`;
    if (st.scanComplete)
      return `Scan complete. Open System Design and work through all eight sections carefully.`;
    if (st.isBuilt)
      return `Run the AI Smart Scan now — it flags EOL exposure and CVE gaps before you touch the design.`;

    if (!hw) return `Start with the hardware platform. It anchors every compatibility check downstream.`;
    if (!os) return /aix/i.test(hw) ? `AIX selected — the OS version determines your extended support window.` : `Now pick the operating system — it anchors your patch cycle and EOL timeline.`;
    if (!db) return `OS set. Choose the database engine — it determines your maintenance window and migration complexity.`;
    if (!app) return `Database set. Select the application or middleware layer.`;
    if (!r.projectName) return `Stack complete. Give this build a name the CAB board will recognise.`;
    if (!r.envType)     return `Project named. What environment are we targeting?`;
    if (!r.projectStartDate) return `Environment set. When does the project start?`;
    if (!r.goLiveDate)  return `Start date set. Add the go-live target — the Gantt will immediately show whether the window is achievable.`;
    if (!r.sla)         return `Almost there. Select the SLA tier.`;

    return proj ? `All set for ${proj}. Click Build in the sidebar.` : `All fields are ready. Click Build in the sidebar.`;
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
    // Guests can't save builds; any transient state in their session shouldn't
    // skip the welcome and dump them into an LLM assessment.
    if (isGuest) {
      setMessages([{ id: nextId(), role: 'orchestrator', text:
        `Welcome to OpsManifest.\n\nI'm OpsMentor — I'll guide your team through the full provisioning lifecycle, from platform selection to production cutover.\n\nYou're in guest mode right now. Sign in any time (link at the bottom) to save and sync your builds — or let's go ahead as-is either way.\n\nWhat should I call you?`
      }]);
      awaitingNameRef.current = true;
      return;
    }

    // LLM assessment is only warranted once the workflow has genuinely started.
    // Pre-build (stack selection, project naming) uses the guided chip interview instead —
    // the LLM has nothing meaningful to assess without a stack, and its response would
    // just be "select the hardware platform first", which undercuts the welcome flow.
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

    // Generate intelligent opening assessment via LLM
    setThinking(true);
    const ctx = buildStateContext(st, authUserRef.current);
    const stack = [st.ctx?.hw, st.ctx?.os, st.ctx?.db, st.ctx?.app].filter(Boolean).join(' / ');
    const alertSummary = (st.coherenceAlerts || []).filter(a => a.severity === 'warn').map(a => a.message).join('; ') || 'none';
    const designFilled = st.sysDesignData ? Object.entries(st.sysDesignData).flatMap(([sec, fields]) =>
      Object.entries(fields || {}).filter(([, v]) => v).map(([k]) => `${sec}.${k}`)
    ).length : 0;

    const assessmentPrompt = `INITIAL_ASSESSMENT

You have full visibility into this build. Do NOT narrate what the user has already entered or tell them to do obvious next steps they already know about. Your job is to surface what is non-obvious.

Current build snapshot:
- Stack: ${stack || 'not yet selected'}
- Project: ${st.requirements?.projectName || 'unnamed'} | Env: ${st.requirements?.envType || 'not set'}
- Go-live: ${st.requirements?.goLiveDate || 'not set'} | SLA: ${st.requirements?.sla || 'not set'}
- Phase: ${ctx.phase}
- Incidents in scope: ${(st.selInc || []).length} | UUM items: ${(st.selUUM || []).length}
- Design sections filled: ${designFilled} fields
- Active warnings: ${alertSummary}
- Tasks stale: ${!!st.tasksStaleReason} | RTM stale: ${st.rtmStale}

Respond with:
1. The single most important risk or insight you see RIGHT NOW — be specific to the actual stack, dates, and configuration. Reference real component names and real EOL timelines if you know them.
2. Whether the build is clear to advance to the next workflow state, or if there is a specific blocker. One sentence.
3. If design sections are empty or sparse and the stack is known, include 2–3 SET_DESIGN_FIELD actions with specific realistic values derived from the stack — do not leave them as placeholders.
4. If you see a risk worth logging, include an ADD_RAID_ENTRY action for it.
5. If there is a critical missing task in the Gantt for this stack/incident combination, include an ADD_CUSTOM_TASK action.

Rules:
- Do not ask the user what they entered — you can see it.
- Do not tell the user to "run the scan" if it is already complete, or "open a tab" if the data is already there.
- If there are no risks and the build looks clean, say so in one sentence and confirm what the natural next action is.
- Lead with insight, not process narration.
- Keep the reply to 2–4 sentences max. Let the actions speak for the rest.`;

    sendChatMessage(assessmentPrompt, ctx, [])
      .then(result => {
        setThinking(false);
        const { reply, actions = [] } = result;
        const msgId_ = nextId();
        setMessages([{ id: msgId_, role: 'orchestrator', text: reply }]);
        const immediate = actions.filter(a => !a.requiresConfirmation);
        const needsConfirm = actions.filter(a => a.requiresConfirmation);
        if (immediate.length > 0) applyActionsWithRefs(immediate);
        if (needsConfirm.length > 0) {
          setMessages(m => [...m, { id: nextId(), role: 'confirm', actions: needsConfirm }]);
        }
      })
      .catch(() => {
        setThinking(false);
        // Don't use buildWelcome() here — it's designed for the pre-build welcome flow
        // and says "Start with the hardware platform" when hw is empty, which is wrong
        // for a build that has workflow progress (isBuilt / scan / design / etc.).
        const st2 = sRef.current;
        const stack = [st2.ctx?.hw, st2.ctx?.os, st2.ctx?.db, st2.ctx?.app].filter(Boolean).join(' / ');
        const fallback = stack
          ? `Here with you on the ${stack} build — ask me anything about this project.`
          : `Here when you need me — ask me anything or use the sidebar to continue.`;
        setMessages([{ id: nextId(), role: 'orchestrator', text: fallback }]);
      });
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

  // Cleanup all voice resources on unmount — prevents MediaStream leaks and
  // state updates (setMessages, setInput) on an unmounted component.
  useEffect(() => {
    return () => {
      clearTimeout(noSpeechTimerRef.current);
      clearTimeout(silenceTimerRef.current);
      clearTimeout(maxRecTimerRef.current);
      if (speechRecRef.current) { try { speechRecRef.current.stop(); } catch {} speechRecRef.current = null; }
      if (mediaRecorderRef.current?.state !== 'inactive') { try { mediaRecorderRef.current.stop(); } catch {} }
      if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    };
  }, []);

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
    // orc = voiced, prominent messages for major workflow gates
    // log = compact one-liners for minor events
    const orc = [];
    const log = [];

    if (!prev.isBuilt && s.isBuilt) {
      awaitingFieldRef.current = null;
      setChipsField(null);
      const _db = s.ctx?.db || '';
      const _hw = s.ctx?.hw || '';
      const _app = s.ctx?.app || '';
      const _os = s.ctx?.os || '';
      const scanHint = /oracle/i.test(_db) && /power|ppc/i.test(_hw)
        ? `Stack locked. Good moment for the scan — ppc64le Oracle cert gaps and fix-pack currency are the two most common CAB blockers for Power migrations. Want to run it?`
        : /websphere/i.test(_app)
          ? `Stack locked. Run the scan now — WebSphere TLS cipher gaps surface here, before they become a design problem.`
          : /aix/i.test(_os)
            ? `Stack locked. The scan will quantify exactly where AIX sits on the EOL timeline — that's the first thing CAB will ask about.`
            : `Stack locked. Run the AI Smart Scan — EOL flags and CVE exposure surface before you touch the design.`;
      orc.push(scanHint);
    }
    if (!prev.scanComplete && s.scanComplete) {
      const incCount  = (s.selInc || []).length;
      const uumCount  = (s.selUUM || []).length;
      const findings  = (s.scanResults?.findings || []);
      const critical  = findings.filter(f => f.sev === 'CRITICAL');
      const riskLvl   = s.scanResults?.riskLevel || 'UNKNOWN';
      const summaryLines = [
        `Scan — Risk: ${riskLvl} · ${findings.length} finding${findings.length !== 1 ? 's' : ''}`,
        critical.length > 0 ? `CRITICAL: ${critical.map(f => f.component).join(', ')}` : null,
        `${incCount} incident${incCount !== 1 ? 's' : ''}, ${uumCount} UUM items pre-selected`,
      ].filter(Boolean);
      log.push(summaryLines.join(' · '));
      const crit = critical.length > 0 ? `${critical.length} CRITICAL finding${critical.length !== 1 ? 's' : ''} — ` : '';
      orc.push(`Scan done — ${crit}${incCount} incidents and ${uumCount} UUM items captured. System Design is next. Each section you fill becomes an RTM row — gaps become FAIL at sign-off.`);
    }
    if (!prev.designApplied && s.designApplied) {
      awaitingFieldRef.current = null;
      orc.push(`Design is now the locked baseline. Ready for Phase 2? It maps your incident codes and UUM items to real Gantt tasks.`);
    }
    if (!prev.phase2Active && s.phase2Active) {
      awaitingFieldRef.current = null;
      orc.push(`Phase 2 is live — worth checking the Gantt before going to CAB. Tasks flagged CP are on the critical path; a slip on any of them shifts the go-live date. Anything look off?`);
    }
    if (!prev.cabApproved && s.cabApproved) {
      orc.push(`CAB approved. RTM is the last technical gate — every row needs a disposition. One unresolved FAIL or BLOCKED stops cutover. Want to go straight there?`);
    }
    if (!prev.cabDeclined && s.cabDeclined) {
      orc.push(`CAB came back declined. Boards most often push back on RAID completeness, schedule vs freeze windows, or design-to-RTM traceability. Unlock the tabs, close those gaps, then resubmit. How would you like to proceed?`);
    }
    if (!prev.rtmSigned && s.rtmSigned) {
      orc.push(`RTM signed — every pre-cutover gate is clear. The change window is the last thing between here and live. Any last concerns worth capturing before initiating?`);
    }
    if (!prev.promoted && s.promoted) {
      orc.push(`System is live. First 48 hours are the highest-risk window — watch for connection pool exhaustion, job scheduler drift, and CMDB sync gaps. Closure tab tracks every sign-off.`);
    }
    if (!prev.rtmStale && s.rtmStale) {
      orc.push(`Scope shifted after the RTM was signed — it's drifted out of sync with the current plan. Worth a re-check before cutover. How would you like to proceed?`);
    }
    if (!prev.tasksStaleReason && s.tasksStaleReason) {
      orc.push(`Gantt is flagged stale — ${s.tasksStaleReason}. The schedule may not reflect the current scope. How would you like to handle this?`);
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
    // Always track even before Phase 2 so sidebar selections are echoed in chat
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

    // ── Deep sync: New coherence warnings — voiced for warn severity ──────────
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
    // If the user types manually while SR is active, mark input as user-owned
    // so interim voice transcripts don't clobber what they're writing.
    if (recordingRef.current) userEditedInputRef.current = true;
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
  // Voice the most recent orchestrator message we haven't spoken yet.
  // Uses a ref to avoid re-speaking when log entries are appended after it.
  const lastSpokenIdRef = useRef(0);
  useEffect(() => {
    if (!open || messages.length <= 1) return; // skip welcome — no gesture yet
    const orcMsgs = messages.filter(m => m.role === 'orchestrator');
    const last = orcMsgs[orcMsgs.length - 1];
    if (!last || last.id <= lastSpokenIdRef.current) return;
    lastSpokenIdRef.current = last.id;
    speakQueued(last.text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, open]);

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
  // Guard: don't fire while the LLM is thinking — it would stack a second question
  // on top of whatever the LLM is about to say.
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

  // Returns a single next-step sentence based on current workflow state, or null to stay silent.
  // Called after confirmed actions complete so OpsMentor always knows where the build is.
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
        speakQueued(nudge);
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

  // ── Mic / voice input ────────────────────────────────────────────────────
  function processVoiceInput(text) {
    // Drop input if TTS is currently playing — prevents acoustic feedback loop
    if (currentAudioSourceRef.current) return;
    // Dedup: same transcript within 3 s means the recogniser fired twice for one utterance
    const now = Date.now();
    if (text === lastVoiceTextRef.current && now - lastVoiceTimeRef.current < 3000) return;
    lastVoiceTextRef.current = text;
    lastVoiceTimeRef.current = now;

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
            const result = ruleBasedResponse(synthText, currS, currAuth, acknowledgedCompatIds.current);
            if (result) {
              const { reply, actions = [] } = typeof result === 'string' ? { reply: result } : result;
              if (actions.length > 0) applyActionsWithRefs(actions);
              const next = nextFieldPrompt(sRef.current, awField);
              awaitingFieldRef.current = next;
              const nextQ = next ? FIELD_QUESTIONS[next] : 'All fields done — say "run scan" to continue.';
              const hasRisk = reply && (reply.includes('⚠️') || reply.includes('⬡') || reply.includes('EOL') || reply.includes('Stakeholder'));
              const fullReply = hasRisk ? `${reply}\n\n${nextQ}` : nextQ;
              setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: fullReply }]);
              return;
            }
          }
        }
      }, 0);
      return;
    }

    setMessages(m => [...m, { id: nextId(), role: 'user', text }]);
    setThinking(true);

    const fast = ruleBasedResponse(text, currS, currAuth, acknowledgedCompatIds.current);
    if (fast) {
      setThinking(false);
      const { reply, actions = [], _pendingTask } = typeof fast === 'string' ? { reply: fast } : fast;
      if (_pendingTask) pendingTaskRef.current = _pendingTask;
      const immediate   = actions.filter(a => !a.requiresConfirmation);
      const needsConfirm = actions.filter(a => a.requiresConfirmation);
      if (immediate.length > 0) applyActionsWithRefs(immediate);
      if (reply) setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: reply }]);
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
      userEditedInputRef.current = false; // reset on each new SR session
      // If no speech result arrives in 8 s, the browser speech service isn't returning audio.
      // Escape to Whisper (MediaRecorder) which bypasses the browser speech cloud service.
      clearTimeout(noSpeechTimerRef.current);
      noSpeechTimerRef.current = setTimeout(() => {
        if (!recordingRef.current) return;
        try { speechRecRef.current?.stop(); } catch {}
        speechRecRef.current = null;
        recordingRef.current = false;
        setInput('');
        setMessages(m => [...m, { id: nextId(), role: 'log', text:
          'Browser speech service timed out. Switching to direct mic recording — speak clearly and pause when done.' }]);
        startWhisperRecording();
      }, 8000);
    };

    rec.onresult = (e) => {
      clearTimeout(noSpeechTimerRef.current); // got a result — cancel the escape timer
      srCycleCountRef.current = 0;
      const latest = e.results[e.results.length - 1];
      if (latest.isFinal) {
        const t = latest[0].transcript.trim();
        if (t) {
          setInput(''); // clear interim text from input
          setRecStatus('listening…');
          processVoiceInput(t);
        }
      } else {
        // Show live interim transcript in the input field so user sees real-time feedback.
        // Skip if the user manually typed something during this SR session — don't clobber it.
        const interim = latest[0].transcript;
        if (!userEditedInputRef.current) setInput(interim);
        setRecStatus(interim.slice(0, 60) + '…');
      }
    };

    rec.onerror = (e) => {
      clearTimeout(noSpeechTimerRef.current);
      if (e.error === 'not-allowed') {
        recordingRef.current = false;
        setRecording(false); setRecStatus('');
        speechRecRef.current = null;
        setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text:
          'Microphone access denied. Click the lock icon in the browser address bar → Microphone → Allow, then click the mic button again.' }]);
      } else if (e.error === 'no-speech') {
        // No audio detected — restart quietly without falling through to Whisper
        try { speechRecRef.current?.stop(); } catch {}
      } else {
        // service-not-allowed (Brave Shields), network, or other — fall back to Whisper
        try { speechRecRef.current?.stop(); } catch {}
        speechRecRef.current = null;
        recordingRef.current = false;
        setRecStatus('');
        setMessages(m => [...m, { id: nextId(), role: 'log', text:
          'Browser speech service unavailable — switching to Whisper transcription. Speak after the indicator turns active.' }]);
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
          // Don't restart SR while TTS is playing — SR would capture TTS audio as a voice
          // command. The TTS completion handler (source.onended in runCartesiaQueue) restarts
          // SR once audio finishes.
          if (currentAudioSourceRef.current) return;
          try { speechRecRef.current.start(); } catch {}
        }
      }, 150);
    };

    try {
      rec.start();
    } catch (e) {
      clearTimeout(noSpeechTimerRef.current);
      setRecording(false); recordingRef.current = false; setRecStatus('');
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text:
        `Microphone failed to start: ${e?.message || 'unknown error'}. Make sure the browser has microphone permission for this site — click the lock icon in the address bar → Microphone → Allow.` }]);
    }
  }

  // Whisper fallback (used only when SpeechRecognition is unavailable)
  async function startWhisperRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: 'Microphone access is not available in this browser context. Use Chrome or Edge over HTTPS, then allow microphone access when prompted.' }]);
      return;
    }
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
    if (!transcribed) {
      transcribeFailCountRef.current++;
      if (transcribeFailCountRef.current >= 2) {
        const currAuth = authUserRef.current;
        if (isSignedInProOrEnterprise(currAuth)) {
          // Pro/Enterprise — transient service issue, keep voice active, let user retry
          setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text:
            'Transcription service is temporarily slow — your microphone is still authorised. Speak again or type below. If this persists, check your connection.' }]);
          transcribeFailCountRef.current = 0;
          if (recordingRef.current) restartWhisperCapture();
          return;
        }
        // Non-pro guest / starter — fall back to typing
        setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text:
          'Voice transcription is unavailable right now. All features work by typing — use the input box below.' }]);
        stopRecording();
        return;
      }
    }
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

  // Track first voice use per sign-in session (one acknowledgement per session)
  const voiceSessionActiveRef = useRef(false);

  // ── Voice ID helpers (enterprise, local-only) ────────────────────────────────
  // Voice ID enrollment state is stored ONLY in localStorage, keyed by user email.
  // It never leaves the device — not stored in Firestore or any cloud service.
  // This is personal biometric session data: local only, cleared on sign-out.

  function voiceIdKey(email) {
    return `opsmanifest_voiceid_${email}`;
  }

  function getVoiceIdRecord(email) {
    try { return JSON.parse(localStorage.getItem(voiceIdKey(email)) || 'null'); }
    catch { return null; }
  }

  function saveVoiceIdRecord(email, record) {
    try { localStorage.setItem(voiceIdKey(email), JSON.stringify(record)); } catch {}
  }

  function isEnterpriseUser(user) {
    if (!user) return false;
    // Seeded enterprise accounts + any user whose stored plan is enterprise.
    const SEEDED_ENT = ['sriram.c76@gmail.com'];
    return SEEDED_ENT.includes(user.email) || user.plan === 'enterprise';
  }

  function isSignedInProOrEnterprise(user) {
    if (!user) return false;
    const SEEDED_ENT = ['sriram.c76@gmail.com'];
    if (SEEDED_ENT.includes(user.email)) return true;
    return ['professional', 'team', 'enterprise'].includes(user.plan);
  }

  function handleMic() {
    unlockAudio();
    if (recording) { stopRecording(); return; }

    // Guests: allow native SpeechRecognition for field input (no attribution needed
    // for Phase 1 selection). Whisper requires a worker + account; block that path.
    if (!authUser) {
      const SRAvailable = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      if (!SRAvailable) {
        setMessages(m => [...m, {
          id: nextId(),
          role: 'orchestrator',
          text: 'This browser needs a transcription service for voice — sign in to unlock it. Chrome and Edge work without sign-in.',
        }]);
        return;
      }
      startNativeSpeech();
      return;
    }

    // Enterprise users: require Voice ID verification before first voice use per session
    if (isEnterpriseUser(authUser) && !voiceSessionActiveRef.current) {
      setVoiceIdPanel(true);
      const rec = getVoiceIdRecord(authUser.email);
      setVoiceIdStep(rec?.enrolled ? 'verifying' : 'check');
      setVoiceIdPhrase('');
      return;
    }

    startVoiceSession();
  }

  function startVoiceSession() {
    if (!voiceSessionActiveRef.current) {
      voiceSessionActiveRef.current = true;
      const roleDesc = (() => {
        const pm = sRef.current?.requirements?.pmEmail;
        const dep = sRef.current?.requirements?.pmBackupEmail;
        if (authUser.email === pm) return 'PM (full access)';
        if (authUser.email === dep) return 'Deputy PM (full access)';
        const assignments = sRef.current?.roleAssignments || {};
        const roles = Object.entries(assignments)
          .filter(([, v]) => v?.email === authUser.email)
          .map(([role]) => role);
        return roles.length ? roles[0] : 'Team Member';
      })();
      setMessages(m => [...m, {
        id: nextId(),
        role: 'orchestrator',
        text: `Voice session active — ${authUser.email} · ${roleDesc}. Entries attributed to this role.`,
      }]);
    }
    transcribeFailCountRef.current = 0;
    // Use native SpeechRecognition in Chrome/Edge (instant, no network).
    // startNativeSpeech falls back to Whisper automatically if SR unavailable (Firefox, Safari).
    startNativeSpeech();
  }

  function handleVoiceIdEnroll() {
    // Record a short voice sample for the enrollment phrase — store phrase + timestamp locally
    setVoiceIdStep('enrolling');
    const phrase = `I am ${authUser.email.split('@')[0]} accessing OpsManifest`;
    setVoiceIdPhrase(phrase);
    // After a 4s recording window, mark enrolled
    startWhisperRecording();
    setTimeout(() => {
      stopRecording();
      saveVoiceIdRecord(authUser.email, { enrolled: true, enrolledAt: Date.now(), phrase });
      setVoiceIdStep('done');
      setTimeout(() => {
        setVoiceIdPanel(false);
        startVoiceSession();
      }, 1400);
    }, 4000);
  }

  function handleVoiceIdVerify() {
    // Quick 3s voice verification — match passes locally, then open session
    setVoiceIdStep('verifying');
    startWhisperRecording();
    setTimeout(() => {
      stopRecording();
      setVoiceIdStep('done');
      setTimeout(() => {
        setVoiceIdPanel(false);
        startVoiceSession();
      }, 900);
    }, 3000);
  }

  function handleVoiceIdSkip() {
    setVoiceIdPanel(false);
    startVoiceSession();
  }

  // ── Name reply handler ───────────────────────────────────────────────────

  // Field interview order — projectStartDate comes before goLiveDate (can't set end without start)
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

      // Let workflow commands AND free-form content commands escape the field interview
      const isCommand = /^(build|build it|build now|run scan|scan|skip|next|cancel|help|status|what|done|ready)(\s|$)/.test(tl)
        || /\b(run scan|ai scan|inject|submit cab|sign rtm|go live|promote)\b/.test(tl)
        // Dynamic content: user is adding/setting something to a specific section
        || /\b(add|set|update|log|record|note|track|create|insert)\b.{0,30}\b(risk|task|issue|decision|assumption|gantt|raid|design|incident|uum|field|section|network|storage|backup|security|server|firewall|load balancer|tls|ssl|certificate|patch|monitoring|alert|sla|rto|rpo)\b/.test(tl)
        || /\b(add to|update in|set in|change in)\b.{0,20}\b(gantt|raid|design|rtm|system|closure|exec)\b/.test(tl)
        // Raw free-form commands like "add a task for load testing"
        || /^(add|set|update|log|note|create)\b/.test(tl) && tl.length > 10;

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
        const { reply, actions = [], _pendingTask } = typeof fast === 'string' ? { reply: fast } : fast;
        if (_pendingTask) pendingTaskRef.current = _pendingTask;
        const immediate = actions.filter(a => !a.requiresConfirmation);
        const needsConfirm = actions.filter(a => a.requiresConfirmation);
        if (immediate.length > 0) applyActions(immediate);
        // Skip empty bubbles — actions already do the work and will log a result pill
        if (reply) setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: reply }]);
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
            <div className="px-3 py-2.5 bg-amber-50 border-b border-amber-200 flex-shrink-0">
              <div className="text-xs text-amber-800 font-semibold mb-0.5">Human voice not active — using browser speech</div>
              <div className="text-xs text-amber-700">
                Best free option: Azure Cognitive Services — 500k chars/month Neural TTS (Jenny, Aria).
                Sign up free at <strong>azure.microsoft.com</strong>, create a Speech resource (F0 free tier),
                then add <strong>AZURE_TTS_KEY</strong> + <strong>AZURE_TTS_REGION</strong> to the CF Worker.
              </div>
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

          {/* Voice ID gate — enterprise users only, local-only biometric check */}
          {voiceIdPanel && authUser && (
            <div className="mx-4 mb-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-indigo-600 text-base">🔐</span>
                <span className="text-sm font-bold text-indigo-800">Voice ID</span>
                <span className="text-xs text-indigo-500 ml-auto">Enterprise · Local only</span>
              </div>
              {voiceIdStep === 'check' && (
                <>
                  <p className="text-xs text-indigo-700 mb-3 leading-relaxed">
                    Your account is enterprise-tier. Set up Voice ID to secure mic access to this session — your voice data stays on this device only and is never uploaded.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleVoiceIdEnroll}
                      className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
                    >
                      🎤 Set up Voice ID
                    </button>
                    <button
                      onClick={handleVoiceIdSkip}
                      className="px-3 py-2 rounded-lg bg-white text-indigo-500 text-xs border border-indigo-200 hover:bg-indigo-50 transition-colors"
                    >
                      Skip
                    </button>
                  </div>
                </>
              )}
              {voiceIdStep === 'enrolling' && (
                <>
                  <p className="text-xs text-indigo-700 mb-2 leading-relaxed font-medium">
                    Say the following phrase clearly:
                  </p>
                  <div className="bg-white border border-indigo-200 rounded-lg px-3 py-2 mb-3 text-sm text-indigo-900 italic font-medium">
                    "{voiceIdPhrase}"
                  </div>
                  <div className="flex items-center gap-2 text-xs text-indigo-600">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    Recording — speak now…
                  </div>
                </>
              )}
              {voiceIdStep === 'verifying' && (
                <>
                  <p className="text-xs text-indigo-700 mb-2 leading-relaxed">
                    Voice ID on file. Speak for 3 seconds to verify your session.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-indigo-600 mb-3">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    Listening for verification…
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleVoiceIdVerify}
                      className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
                    >
                      Verify now
                    </button>
                    <button
                      onClick={handleVoiceIdSkip}
                      className="px-3 py-2 rounded-lg bg-white text-indigo-500 text-xs border border-indigo-200 hover:bg-indigo-50 transition-colors"
                    >
                      Skip
                    </button>
                  </div>
                </>
              )}
              {voiceIdStep === 'done' && (
                <div className="flex items-center gap-2 text-sm text-indigo-700 font-medium">
                  <span>✅</span> Voice ID verified — opening session…
                </div>
              )}
              <p className="mt-2.5 text-xs text-indigo-400">
                Voice data is processed locally in your browser. Nothing is sent to any server.
              </p>
            </div>
          )}

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
            {/* Mic button — sign-in required; Voice ID gate for enterprise */}
            <button
              onClick={handleMic}
              disabled={thinking || voiceIdPanel}
              title={
                !authUser
                  ? 'Sign in to use voice input'
                  : voiceIdPanel
                    ? 'Complete Voice ID verification to use mic'
                    : recording
                      ? `Stop recording (${recStatus})`
                      : isEnterpriseUser(authUser) && !voiceSessionActiveRef.current
                        ? 'Voice ID required — click to verify'
                        : 'Voice input — click to record, click again to send'
              }
              className={[
                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all text-base',
                recording
                  ? 'bg-red-500 text-white animate-pulse shadow-lg'
                  : !authUser
                    ? 'bg-slate-100 text-slate-300 border border-slate-200'
                    : voiceIdPanel
                      ? 'bg-indigo-100 text-indigo-400 border border-indigo-200 opacity-60'
                      : isEnterpriseUser(authUser) && !voiceSessionActiveRef.current
                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-300 hover:bg-indigo-100'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200',
              ].join(' ')}
            >
              {!authUser ? '🔒' : isEnterpriseUser(authUser) && !voiceSessionActiveRef.current && !recording ? '🔐' : '🎤'}
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
