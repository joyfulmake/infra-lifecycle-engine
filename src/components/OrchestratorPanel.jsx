import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { generateScript, getWorkflowChecklist } from '../lib/orchestratorScripts.js';
import { speakScript, CARTESIA_CONFIGURED } from '../lib/cartesia.js';
import { buildStateContext, checkPermission, executeAction } from '../lib/orchestratorActions.js';
import { sendChatMessage, ruleBasedResponse } from '../lib/orchestratorChat.js';

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  const isResult = msg.role === 'result';

  if (isResult) {
    return (
      <div className="flex justify-center">
        <span className="text-xs px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
          {msg.text}
        </span>
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

  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([]);   // { id, role, text, actions?, onConfirm?, onCancel? }
  const [input,    setInput]    = useState('');
  const [thinking, setThinking] = useState(false);
  const [playing,  setPlaying]  = useState(false);
  const [lineIdx,  setLineIdx]  = useState(0);

  const abortRef   = useRef(null);
  const inputRef   = useRef(null);
  const bottomRef  = useRef(null);
  const msgId      = useRef(0);
  const pendingConfirmRef = useRef(null);

  const script    = generateScript(s);
  const checklist = getWorkflowChecklist(s);
  const hasAlerts = (s.coherenceAlerts || []).some(a => a.severity === 'warn')
    || !!s.tasksStaleReason || s.rtmStale;

  function nextId() { return ++msgId.current; }

  // Initialise with the contextual script as the first message when panel opens
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: nextId(),
        role: 'orchestrator',
        text: script.lines.map(l => `[${l.voice === 'guide' ? 'Guide' : 'Learner'}] ${l.text}`).join('\n'),
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Update the opening script when workflow state changes — but only if user hasn't chatted yet
  const prevScriptId = useRef(script.id);
  useEffect(() => {
    if (prevScriptId.current !== script.id) {
      prevScriptId.current = script.id;
      if (messages.length <= 1) {
        setMessages([{
          id: nextId(),
          role: 'orchestrator',
          text: script.lines.map(l => `[${l.voice === 'guide' ? 'Guide' : 'Learner'}] ${l.text}`).join('\n'),
        }]);
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

  // ── Send message ─────────────────────────────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    if (!text || thinking) return;

    setInput('');
    setMessages(m => [...m, { id: nextId(), role: 'user', text }]);
    setThinking(true);

    try {
      // Rule-based fallback for simple state questions (no Groq needed)
      const fast = ruleBasedResponse(text, s, authUser);
      if (fast) {
        setThinking(false);
        setMessages(m => [...m, { id: nextId(), role: 'orchestrator', text: fast }]);
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
      const isGroqMissing = e.message?.includes('GROQ_API_KEY');
      setMessages(m => [...m, {
        id: nextId(),
        role: 'orchestrator',
        text: isGroqMissing
          ? 'Natural language commands need GROQ_API_KEY in the Cloudflare Worker. State questions still work — try "what is the current state?" or "who is the Unix Admin?"'
          : `Error: ${e.message}`,
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
        title="Expert Orchestrator"
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
            <span className="text-sm font-semibold flex-1 tracking-tight">Expert Orchestrator</span>
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

          {/* Quick suggestions — shown when input empty */}
          {!input && authUser && !thinking && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
              {['Current status?', "What's next?", 'RTM ready?', 'Who is the Unix Admin?'].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
                  className="text-xs px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 hover:border-teal-400 hover:text-teal-600 transition-colors bg-white"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="orch-input-area flex gap-2 px-4 py-3 border-t border-slate-100 flex-shrink-0 bg-white">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={authUser ? 'Ask anything or type a command…' : 'Sign in to use the orchestrator'}
              disabled={!authUser || thinking}
              rows={1}
              className="orch-input flex-1 resize-none text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 placeholder:text-slate-400 disabled:opacity-50 transition-all"
              style={{ minHeight: 42, maxHeight: 96 }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || thinking || !authUser}
              className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-sm"
            >
              ↵
            </button>
          </div>

          {/* RACI context hint */}
          {authUser && (
            <div className="orch-footer px-4 pb-2.5 text-xs text-slate-400 flex-shrink-0">
              <span className="font-medium text-slate-500">{authUser.email}</span>
              {s.requirements?.pmEmail === authUser.email ? ' · PM — full access' : ' · Role-based access active'}
            </div>
          )}
        </div>
      )}
    </>
  );
}
