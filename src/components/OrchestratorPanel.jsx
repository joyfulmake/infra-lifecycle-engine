import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore.js';
import { generateScript, getWorkflowChecklist } from '../lib/orchestratorScripts.js';
import { speakScript, CARTESIA_CONFIGURED } from '../lib/cartesia.js';

// ── Voice label chips ─────────────────────────────────────────────────────────

function VoiceLabel({ voice }) {
  return (
    <span className={[
      'text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0',
      voice === 'guide'
        ? 'bg-teal-100 text-teal-700'
        : 'bg-slate-100 text-slate-500',
    ].join(' ')}>
      {voice === 'guide' ? '♀ Guide' : '♂ Learner'}
    </span>
  );
}

// ── Workflow checklist strip ──────────────────────────────────────────────────

function WorkflowChecklist({ items }) {
  return (
    <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-slate-100 bg-slate-50">
      {items.map(item => (
        <span
          key={item.id}
          className={[
            'text-xs px-2 py-0.5 rounded-full font-medium',
            item.done ? 'bg-teal-100 text-teal-700'
            : item.warn ? 'bg-amber-100 text-amber-700'
            : 'bg-white text-slate-400 border border-slate-200',
          ].join(' ')}
        >
          {item.done ? '✓' : item.warn ? '!' : '○'} {item.label}
        </span>
      ))}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function OrchestratorPanel() {
  const s = useStore(st => ({
    isBuilt:            st.isBuilt,
    scanComplete:       st.scanComplete,
    designApplied:      st.designApplied,
    phase2Active:       st.phase2Active,
    cabApproved:        st.cabApproved,
    cabDeclined:        st.cabDeclined,
    rtmSigned:          st.rtmSigned,
    promoted:           st.promoted,
    tasksStaleReason:   st.tasksStaleReason,
    rtmStale:           st.rtmStale,
    unlockedForRevision:st.unlockedForRevision,
    coherenceAlerts:    st.coherenceAlerts,
    selInc:             st.selInc,
    selUUM:             st.selUUM,
    ctx:                st.ctx,
    requirements:       st.requirements,
    rtmRows:            st.rtmRows,
    roleAssignments:    st.roleAssignments,
    closureChecks:      st.closureChecks,
  }));

  const [open,    setOpen]    = useState(false);
  const [playing, setPlaying] = useState(false);
  const [lineIdx, setLineIdx] = useState(0);
  const abortRef = useRef(null);

  const script    = generateScript(s);
  const checklist = getWorkflowChecklist(s);

  const hasAlerts = (s.coherenceAlerts || []).some(a => a.severity === 'warn')
    || !!s.tasksStaleReason
    || s.rtmStale
    || (s.promoted && s.rtmStale);

  // Abort playback if the workflow state changes (script context switches)
  const prevScriptId = useRef(script.id);
  useEffect(() => {
    if (prevScriptId.current !== script.id) {
      abortRef.current?.abort();
      setPlaying(false);
      setLineIdx(0);
      prevScriptId.current = script.id;
    }
  }, [script.id]);

  // Cleanup on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  const handlePlay = useCallback(async () => {
    if (playing) {
      abortRef.current?.abort();
      setPlaying(false);
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPlaying(true);
    setLineIdx(0);

    await speakScript(script.lines, {
      onLineStart: i => setLineIdx(i),
      signal: ctrl.signal,
    });

    if (!ctrl.signal.aborted) {
      setPlaying(false);
      abortRef.current = null;
    }
  }, [playing, script.lines]);

  const handleNext = useCallback(() => {
    abortRef.current?.abort();
    setPlaying(false);
    setLineIdx(i => Math.min(i + 1, script.lines.length - 1));
  }, [script.lines.length]);

  return (
    <>
      {/* ── Floating trigger button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={[
          'fixed bottom-5 right-5 z-50 w-11 h-11 rounded-full shadow-xl',
          'flex items-center justify-center text-white text-base',
          'transition-all duration-200',
          open
            ? 'bg-teal-600 scale-110 shadow-teal-300'
            : 'bg-slate-700 hover:bg-teal-700',
          hasAlerts && !open
            ? 'ring-2 ring-amber-400 ring-offset-1 animate-pulse'
            : '',
        ].join(' ')}
        title="Expert Orchestrator — always-on lifecycle guide"
      >
        {open ? '×' : '🎯'}
      </button>

      {/* ── Expanded panel ── */}
      {open && (
        <div
          className="fixed bottom-18 right-5 z-50 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          style={{ maxHeight: '540px', bottom: '72px' }}
        >
          {/* Header */}
          <div className="bg-slate-800 text-white px-4 py-3 flex items-center gap-2 flex-shrink-0">
            <span className="text-sm font-semibold flex-1 tracking-tight">
              Expert Orchestrator
            </span>
            {!CARTESIA_CONFIGURED && (
              <span className="text-xs text-slate-400 italic">text mode</span>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white w-5 h-5 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          {/* Workflow checklist */}
          <WorkflowChecklist items={checklist} />

          {/* Script title */}
          <div className="px-4 pt-3 pb-1 flex-shrink-0">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
              {script.title}
            </div>
          </div>

          {/* Dialogue lines */}
          <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-2 min-h-0">
            {script.lines.map((line, i) => {
              const active = playing && lineIdx === i;
              return (
                <div
                  key={i}
                  className={[
                    'flex gap-2 rounded-lg px-3 py-2 text-xs transition-all duration-300',
                    active
                      ? 'bg-teal-50 ring-1 ring-teal-300 shadow-sm'
                      : 'bg-slate-50',
                  ].join(' ')}
                >
                  <VoiceLabel voice={line.voice} />
                  <span className="text-slate-700 leading-relaxed flex-1">{line.text}</span>
                </div>
              );
            })}
          </div>

          {/* Playback controls */}
          <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handlePlay}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                playing
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'bg-teal-600 text-white hover:bg-teal-700',
              ].join(' ')}
            >
              {playing ? '⏹ Stop' : '▶ Play'}
            </button>
            {playing && (
              <button
                onClick={handleNext}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                title="Skip to next line"
              >
                ⏭
              </button>
            )}
            <span className="text-xs text-slate-400 flex-1 text-right">
              {CARTESIA_CONFIGURED ? 'Sonic-2' : 'text only — add VITE_CARTESIA_WORKER_URL'}
            </span>
          </div>

          {/* Next action CTA */}
          {script.nextAction && (
            <div className="px-4 py-2.5 bg-teal-50 border-t border-teal-100 flex-shrink-0">
              <div className="text-xs text-teal-800">
                <span className="font-bold">Next: </span>
                {script.nextAction}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
