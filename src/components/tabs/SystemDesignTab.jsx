import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore, DESIGN_SECTIONS, FIELD_LABELS } from '../../store/useStore.js';
import { matchSuggestKeys } from '../../lib/suggestDb.js';
import { generateTaskPlan } from '../../lib/smartScan.js';

function SuggestDropdown({ suggestions, onSelect, anchorEl }) {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!anchorEl) return;
    const update = () => {
      const rect = anchorEl.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchorEl]);

  if (!suggestions.length || !pos) return null;

  return createPortal(
    <div className="suggest-dropdown" style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}>
      {suggestions.map((s, i) => (
        <div key={i} className="suggest-item" onMouseDown={e => { e.preventDefault(); onSelect(s); }}>
          {s}
        </div>
      ))}
    </div>,
    document.body
  );
}

function DesignField({ sectionKey, fieldKey, value, onChange, readOnly, techMode }) {
  const s = useStore();
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);
  const lockKey = `${sectionKey}.${fieldKey}`;
  const lockData = s.lockedDesignFields?.[lockKey];
  const isLocked = !!lockData;

  function handleChange(val) {
    onChange(val);
    setSuggestions(matchSuggestKeys(val, fieldKey));
  }

  function handleFocus() {
    setFocused(true);
    setSuggestions(matchSuggestKeys(value || '', fieldKey));
  }

  function toggleLock() {
    if (isLocked) {
      s.unlockDesignField(lockKey);
    } else {
      s.lockDesignField(lockKey, { lockedBy: 'Tech Lead', value: value || '' });
    }
  }

  const isEmpty = !value?.trim();
  const highlight = readOnly && isEmpty && !isLocked;

  const placeholder = (() => {
    const label = FIELD_LABELS[fieldKey] || fieldKey;
    const hints = matchSuggestKeys(fieldKey, fieldKey, 0);
    if (hints.length > 0) {
      const first = hints[0];
      return first.length > 50 ? first.slice(0, 50) + '…' : first;
    }
    return `Enter ${label}…`;
  })();

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-0.5">
        <label className="form-label text-slate-500 mb-0">{FIELD_LABELS[fieldKey] || fieldKey}</label>
        {(techMode || isLocked) && (
          <button
            type="button"
            onClick={toggleLock}
            title={isLocked ? `Locked by ${lockData.lockedBy} — click to unlock` : 'Lock this field (Tech Review)'}
            className={['text-xs px-1 py-0 rounded border transition-colors', isLocked ? 'border-amber-400 text-amber-600 bg-amber-50 hover:bg-amber-100' : 'border-slate-200 text-slate-400 hover:border-amber-400 hover:text-amber-500'].join(' ')}
          >
            {isLocked ? '🔒' : '🔓'}
          </button>
        )}
      </div>
      {isLocked && !techMode ? (
        <div className="text-xs px-2 py-1.5 rounded border border-amber-300 bg-amber-50 text-amber-800 flex items-center gap-1.5">
          <span className="flex-1 truncate">{value || '—'}</span>
          <span className="text-amber-500 text-xs whitespace-nowrap flex-shrink-0">Tech Review</span>
        </div>
      ) : readOnly && !techMode ? (
        <div className={['text-xs px-2 py-1.5 rounded border min-h-7',
          highlight ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-100 bg-slate-50 text-slate-700',
        ].join(' ')}>
          {value || <span className="text-amber-500">(PM: fill with admin present)</span>}
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            className="form-input"
            value={value || ''}
            onChange={e => handleChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={() => { setFocused(false); setTimeout(() => setSuggestions([]), 200); }}
            placeholder={placeholder}
          />
          {focused && suggestions.length > 0 && (
            <SuggestDropdown
              suggestions={suggestions}
              onSelect={v => { onChange(v); setSuggestions([]); }}
              anchorEl={inputRef.current}
            />
          )}
        </>
      )}
    </div>
  );
}

function DesignSection({ section, sectionData, readOnly, onFieldChange, open, onToggle, techMode, presentMode }) {
  const filled = section.fields.filter(f => sectionData[f]?.trim()).length;
  const total = section.fields.length;
  const completePct = Math.round((filled / total) * 100);
  const badgeColor = completePct === 100 ? 'badge-green' : completePct >= 60 ? 'badge-teal' : 'badge-amber';

  if (presentMode) {
    const filledFields = section.fields.filter(f => f !== 'notes' && sectionData[f]?.trim());
    if (filledFields.length === 0) return null;
    return (
      <div className="card mb-4 overflow-hidden">
        <div className="bg-slate-800 px-4 py-2 flex items-center justify-between">
          <div>
            <span className="font-bold text-white text-sm">{section.label}</span>
            <span className="text-slate-400 text-xs ml-2">— {section.owner}</span>
          </div>
          <span className={`badge ${badgeColor}`}>{filled}/{total}</span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {filledFields.map(field => (
            <div key={field} className="border border-slate-100 rounded-lg p-2.5 bg-slate-50">
              <div className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wide">{FIELD_LABELS[field] || field}</div>
              <div className="text-sm font-semibold text-slate-800">{sectionData[field]}</div>
            </div>
          ))}
          {sectionData.notes?.trim() && (
            <div className="col-span-2 border border-blue-100 rounded-lg p-2.5 bg-blue-50">
              <div className="text-xs text-blue-400 font-medium mb-1 uppercase tracking-wide">Notes</div>
              <div className="text-xs text-blue-800">{sectionData.notes}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card mb-3 overflow-hidden">
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 text-sm">{section.label}</span>
          <span className="text-xs text-slate-400">— {section.owner}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${badgeColor}`}>{filled}/{total} filled</span>
          <svg className={['w-4 h-4 text-slate-400 transition-transform', open ? 'rotate-180' : ''].join(' ')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 fade-in">
          <div className="h-1 bg-slate-100 rounded-full mt-3 mb-4">
            <div className="h-full bg-teal rounded-full transition-all" style={{ width: completePct + '%' }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {section.fields.map(field => (
              <DesignField
                key={field}
                sectionKey={section.key}
                fieldKey={field}
                value={sectionData[field]}
                onChange={val => onFieldChange(section.key, field, val)}
                readOnly={readOnly}
                techMode={techMode}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SystemDesignTab() {
  const s = useStore();
  const [taskStatus, setTaskStatus] = useState('idle'); // idle | running | done
  const [taskMsg, setTaskMsg] = useState('');
  const [presentMode, setPresentMode] = useState(false);
  const [techMode, setTechMode] = useState(false);

  const isLocked = !s.scanComplete;
  const isReadOnly = s.phase2Active;

  const totalFields = DESIGN_SECTIONS.reduce((n, sec) => n + sec.fields.filter(f => f !== 'notes').length, 0);
  const filledFields = DESIGN_SECTIONS.reduce((n, sec) =>
    n + sec.fields.filter(f => f !== 'notes' && s.sysDesignData[sec.key]?.[f]?.trim()).length, 0);
  const overallPct = Math.round((filledFields / totalFields) * 100);

  function generateTasks() {
    setTaskStatus('running');
    setTaskMsg('');
    setTimeout(() => {
      try {
        const tasks = generateTaskPlan(s.sysDesignData, s.ctx);
        s.setAiTasks(tasks);
        s.applyDesign();
        setTaskStatus('done');
        setTaskMsg(`Generated ${tasks.length} implementation tasks across all function teams.`);
      } catch (e) {
        setTaskStatus('idle');
        setTaskMsg('Task generation failed: ' + e.message);
      }
    }, 800);
  }

  if (isLocked) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="font-semibold text-slate-700 mb-1">System Design Locked</div>
          <div className="text-sm text-slate-500 mb-3">Complete Phase 1 and run the AI Smart Scan (no API key needed) to unlock all 8 design sections.</div>
          <div className="space-y-1 text-left">
            {[
              ['Phase 1 — Platform Topology', s.isBuilt],
              ['AI Smart Scan Completed', s.scanComplete],
              ['Before Phase 2 Begins', true],
            ].map(([label, done]) => (
              <div key={label} className={['text-xs flex items-center gap-2', done ? 'text-green-600' : 'text-slate-400'].join(' ')}>
                <span>{done ? '✓' : '○'}</span>{label}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">

      {/* Header with mode toggles */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {!isReadOnly && (
            <div className="text-xs text-slate-500">
              {filledFields}/{totalFields} fields filled &mdash;{' '}
              <span className={overallPct === 100 ? 'text-green-600 font-semibold' : 'text-amber-600'}>{overallPct}% complete</span>
            </div>
          )}
          {isReadOnly && (
            <div className="text-xs text-amber-600 font-medium">Phase 2 Active — fields locked</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setTechMode(t => !t); setPresentMode(false); }}
            className={['text-xs px-3 py-1 rounded border transition-colors', techMode ? 'bg-amber-100 border-amber-400 text-amber-800 font-semibold' : 'border-slate-200 text-slate-500 hover:border-amber-300'].join(' ')}
            title="Tech Review Mode — lock fields that PM cannot override"
          >
            {techMode ? 'Exit Tech Review' : 'Tech Review Mode'}
          </button>
          <button
            onClick={() => { setPresentMode(p => !p); setTechMode(false); }}
            className={['text-xs px-3 py-1 rounded border transition-colors', presentMode ? 'bg-slate-800 border-slate-700 text-white font-semibold' : 'border-slate-200 text-slate-500 hover:border-slate-400'].join(' ')}
            title="Stakeholder Presentation — show filled fields as decision cards"
          >
            {presentMode ? 'Edit Mode' : 'Present View'}
          </button>
        </div>
      </div>

      {/* Status banner */}
      {techMode && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-2 mb-4 text-xs text-amber-800">
          <span className="font-bold">Tech Review Mode active.</span> Use the lock icon on each field to protect values from PM override. Locked fields are clearly marked throughout the session.
        </div>
      )}

      {presentMode && (
        <div className="bg-slate-800 rounded-lg px-4 py-3 mb-4">
          <div className="text-white font-bold text-sm mb-0.5">System Design — Stakeholder Summary</div>
          <div className="text-slate-400 text-xs">
            {s.requirements.projectName || 'Infrastructure Project'} &mdash; {s.requirements.envType || 'Production'} &mdash; {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
      )}

      {!presentMode && !isReadOnly && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-4 text-xs text-green-700">
          All 8 sections pre-filled from stack selection. Review and adjust — suggestions appear after 3 characters in any field.
        </div>
      )}

      {!presentMode && isReadOnly && !techMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
          <div className="font-semibold text-amber-800 text-sm">System Design Locked — Phase 2 Active</div>
          <div className="text-xs text-amber-700 mt-0.5">All fields read-only. Amber fields require PM to fill with admin present.</div>
        </div>
      )}

      {/* Sections */}
      {DESIGN_SECTIONS.map(section => (
        <DesignSection
          key={section.key}
          section={section}
          sectionData={s.sysDesignData[section.key] || {}}
          readOnly={isReadOnly && !techMode}
          onFieldChange={s.setDesignField}
          open={presentMode || !!s.designSectionOpen[section.key]}
          onToggle={() => !presentMode && s.toggleDesignSection(section.key)}
          techMode={techMode}
          presentMode={presentMode}
        />
      ))}

      {/* Task Plan Generation — no API key needed */}
      {!isReadOnly && (
        <div className="card p-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-semibold text-slate-700 text-sm">Generate Implementation Task Plan</div>
              <div className="text-xs text-slate-500">Builds a structured task plan from your design — no API key required</div>
            </div>
            {s.sdAiTasks.length > 0 && <span className="badge badge-green">{s.sdAiTasks.length} tasks</span>}
          </div>

          <div className="flex gap-2 items-center">
            <button
              className="btn-teal w-auto px-4"
              onClick={generateTasks}
              disabled={taskStatus === 'running'}
            >
              {taskStatus === 'running' ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full inline-block" />
                  Generating…
                </span>
              ) : s.sdAiTasks.length > 0 ? 'Regenerate Task Plan' : 'Generate Task Plan'}
            </button>
            {!s.designApplied && (
              <button className="btn-primary w-auto px-4" onClick={() => s.applyDesign()}>
                Apply Design (skip tasks)
              </button>
            )}
          </div>

          {taskMsg && (
            <div className={['text-xs rounded p-2 mt-2', taskStatus === 'done' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'].join(' ')}>
              {taskMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
