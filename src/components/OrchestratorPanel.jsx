import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { generateScript, getWorkflowChecklist } from '../lib/orchestratorScripts.js';
import { speakScript, CARTESIA_CONFIGURED } from '../lib/cartesia.js';
import { buildStateContext, checkPermission, executeAction } from '../lib/orchestratorActions.js';
import { sendChatMessage, ruleBasedResponse } from '../lib/orchestratorChat.js';

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
  };

  const [open,        setOpen]        = useState(false);
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [thinking,    setThinking]    = useState(false);
  const [playing,     setPlaying]     = useState(false);
  const [lineIdx,     setLineIdx]     = useState(0);
  const [recording,   setRecording]   = useState(false);
  const [recStatus,   setRecStatus]   = useState('');  // 'listening' | 'processing' | ''

  const abortRef        = useRef(null);
  const inputRef        = useRef(null);
  const bottomRef       = useRef(null);
  const msgId           = useRef(0);
  const pendingConfirmRef = useRef(null);
  const recognitionRef  = useRef(null);

  const script    = generateScript(s);
  const checklist = getWorkflowChecklist(s);
  const hasAlerts = (s.coherenceAlerts || []).some(a => a.severity === 'warn')
    || !!s.tasksStaleReason || s.rtmStale;

  function nextId() { return ++msgId.current; }

  function buildWelcome(s) {
    const { hw, os, db, app } = s.ctx || {};
    const filled = [hw, os, db, app].filter(Boolean).length;
    if (filled === 4 && s.isBuilt) {
      return `Welcome back! Your build is in progress — ${script.title}.\n\n${script.nextAction ? 'Next step: ' + script.nextAction : 'All phases complete.'}\n\nAsk me anything, or type "show alerts" to check for issues.`;
    }
    return `Hello! I'm OpsMentor — I'll guide you through every step of the infrastructure lifecycle.\n\nYour 7-phase roadmap:\n1. Phase 1 — Select hardware, OS, database, and application, then click Build\n2. AI Smart Scan — auto-scans for CVEs and EOL risks (sidebar button)\n3. System Design — fill 8 sections, then click "Generate Task Plan"\n4. Phase 2 — inject incidents and UUM items (sidebar "Inject Phase 2" button)\n5. Gantt — review your auto-generated project schedule\n6. CAB Gate + RTM — submit for approval and sign off all requirements\n7. Closure — complete post-go-live checklist and export to Excel\n\nLet's start. Tell me your hardware platform — e.g. "hardware is Dell PowerEdge R750" — or select from the left panel.`;
  }

  // Show welcome message when panel opens — auto-speak is handled by the messages effect
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ id: nextId(), role: 'orchestrator', text: buildWelcome(s) }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Update welcome when workflow state changes — only if conversation is still at greeting
  const prevScriptId = useRef(script.id);
  useEffect(() => {
    if (prevScriptId.current !== script.id) {
      prevScriptId.current = script.id;
      if (messages.length <= 1) {
        setMessages([{ id: nextId(), role: 'orchestrator', text: buildWelcome(s) }]);
        setLineIdx(0);
        abortRef.current?.abort();
        setPlaying(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // ── Action logging — watch key state transitions and auto-post log entries ──
  // Each flag is tracked with a prev ref; when it flips we post a chat log.
  const prevState = useRef({
    isBuilt: false, scanComplete: false, designApplied: false,
    phase2Active: false, cabApproved: false, cabDeclined: false,
    rtmSigned: false, promoted: false, rtmStale: false, tasksStaleReason: null,
  });

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

    if (logs.length > 0) {
      setMessages(m => [...m, ...logs.map(text => ({ id: nextId(), role: 'log', text }))]);
    }

    prevState.current = {
      isBuilt: s.isBuilt, scanComplete: s.scanComplete, designApplied: s.designApplied,
      phase2Active: s.phase2Active, cabApproved: s.cabApproved, cabDeclined: s.cabDeclined,
      rtmSigned: s.rtmSigned, promoted: s.promoted, rtmStale: s.rtmStale,
      tasksStaleReason: s.tasksStaleReason,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.isBuilt, s.scanComplete, s.designApplied, s.phase2Active, s.cabApproved,
      s.cabDeclined, s.rtmSigned, s.promoted, s.rtmStale, s.tasksStaleReason]);

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
        ? `Still here if you need me. Next step: ${sc.nextAction}`
        : 'Your build looks complete! Ask me anything or export your audit trail.';
      setMessages(m => [...m, { id: nextId(), role: 'nudge', text: nudge }]);
    }, 3000);
    return () => clearTimeout(inactivityTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, open]);

  // Cancel inactivity timer when user starts typing
  const handleInputChange = useCallback((e) => {
    clearTimeout(inactivityTimerRef.current);
    nudgeSentRef.current = true; // suppress nudge once typing starts
    setInput(e.target.value);
  }, []);

  // Open after tour dismisses every time
  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 150);
      }, 500);
    };
    window.addEventListener('opsmanifest-tour-dismissed', handler);
    return () => window.removeEventListener('opsmanifest-tour-dismissed', handler);
  }, []);

  // Auto-speak every new orchestrator message — skip log/nudge entries
  useEffect(() => {
    if (!open || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== 'orchestrator') return; // don't speak log/nudge/user/result

    // Abort any current playback before speaking the new message
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPlaying(true);

    // Speak the first meaningful line (skip bullet lists, keep intro sentence)
    const firstLine = last.text.split('\n').find(l => l.trim().length > 10) || last.text.slice(0, 180);
    const voiceText = firstLine.replace(/[•\-–—]\s*/g, '').slice(0, 220);

    speakScript([{ text: voiceText, voice: 'guide' }], { signal: ctrl.signal })
      .then(() => { if (!ctrl.signal.aborted) { setPlaying(false); abortRef.current = null; } })
      .catch(() => setPlaying(false));

    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, open]);

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

  function applyActions(actions) {
    const blocked = [];
    const done    = [];

    for (const action of actions) {
      const perm = checkPermission(action, authUser, s);
      if (!perm.allowed) {
        blocked.push(`${action.description}: ${perm.reason}`);
        continue;
      }
      executeAction(action, store);
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
  // Uses continuous mode so the mic stays open. interimResults shows
  // partial transcripts in the input as the user speaks. When the user
  // stops speaking (onspeechend or a 2-second silence), it finalises and
  // auto-sends so there's no extra button press needed.

  const micSilenceTimerRef = useRef(null);

  function handleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: 'Voice input is not supported in this browser. Try Chrome or Edge.' }]);
      return;
    }

    if (recording) {
      clearTimeout(micSilenceTimerRef.current);
      recognitionRef.current?.stop();
      setRecording(false);
      setRecStatus('');
      return;
    }

    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;

    let finalTranscript = '';

    rec.onstart = () => { setRecording(true); setRecStatus('listening'); finalTranscript = ''; };

    rec.onresult = e => {
      clearTimeout(micSilenceTimerRef.current);
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          finalTranscript += r[0].transcript + ' ';
        } else {
          interim = r[0].transcript;
        }
      }
      // Show combined transcript in the input box
      const display = (finalTranscript + interim).trim();
      if (display) setInput(display);

      // Auto-send after 2s of silence if we have final text
      if (finalTranscript.trim()) {
        micSilenceTimerRef.current = setTimeout(() => {
          rec.stop();
          setRecording(false);
          setRecStatus('');
          // Auto-send the transcribed text
          const text = finalTranscript.trim();
          if (text) {
            finalTranscript = '';
            setInput('');
            setMessages(m => [...m, { id: nextId(), role: 'user', text }]);
            setThinking(true);
            const fast = ruleBasedResponse(text, s, authUser);
            if (fast) {
              setThinking(false);
              const { reply, actions = [] } = typeof fast === 'string' ? { reply: fast } : fast;
              const immediate = actions.filter(a => !a.requiresConfirmation);
              const needsConfirm = actions.filter(a => a.requiresConfirmation);
              if (immediate.length > 0) applyActions(immediate);
              setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: reply }]);
              if (needsConfirm.length > 0) {
                setMessages(m => [...m, { id: nextId(), role: 'confirm', actions: needsConfirm }]);
              }
            }
          }
        }, 2000);
      }
    };

    rec.onspeechend = () => setRecStatus('processing');
    rec.onerror = (e) => {
      if (e.error !== 'no-speech') {
        setRecording(false);
        setRecStatus('');
      }
    };
    rec.onend = () => { setRecording(false); setRecStatus(''); clearTimeout(micSilenceTimerRef.current); };

    recognitionRef.current = rec;
    rec.start();
  }

  // ── Send message ─────────────────────────────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    if (!text || thinking) return;

    setInput('');
    setMessages(m => [...m, { id: nextId(), role: 'user', text }]);
    setThinking(true);

    try {
      // Rule-based mentor — handles phase guidance, field-setting, status queries
      const fast = ruleBasedResponse(text, s, authUser);
      if (fast) {
        setThinking(false);
        const { reply, actions = [] } = typeof fast === 'string' ? { reply: fast } : fast;
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
      const result = await sendChatMessage(text, ctx);

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
      {/* Floating trigger */}
      <button
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 100); }}
        className={[
          'fixed bottom-5 right-5 z-50 w-11 h-11 rounded-full shadow-xl',
          'flex items-center justify-center text-white text-base',
          'transition-all duration-200',
          open ? 'bg-teal-600 scale-110' : 'bg-slate-700 hover:bg-teal-700',
          hasAlerts && !open ? 'ring-2 ring-amber-400 ring-offset-1 animate-pulse' : '',
        ].join(' ')}
        title="OpsMentor"
      >
        {open ? '×' : '🎯'}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="orchestrator-panel fixed z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          style={{ width: 440, maxHeight: 660, bottom: 72, right: 20 }}
        >
          {/* Header */}
          <div className="bg-slate-800 text-white px-4 py-3 flex items-center gap-2 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
            <span className="text-sm font-semibold flex-1 tracking-tight">OpsMentor</span>
            <button
              onClick={handlePlay}
              className={[
                'text-xs px-2.5 py-1 rounded font-medium transition-all',
                playing ? 'bg-amber-500 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-300',
              ].join(' ')}
              title={CARTESIA_CONFIGURED ? 'Play voice guidance' : 'Text mode — add CARTESIA_API_KEY for voice'}
            >
              {playing ? '⏹ Stop' : '▶ Voice'}
            </button>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white w-6 h-6 flex items-center justify-center ml-1 text-lg leading-none">×</button>
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
                ? ["What's next?", 'Show alerts', 'RTM ready?', 'Who is the Unix Admin?']
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
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-slate-500">{recStatus === 'listening' ? 'Listening…' : 'Processing…'}</span>
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
