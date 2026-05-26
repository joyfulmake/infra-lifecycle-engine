import { useState, useRef, useEffect } from 'react';
import { useStore, DESIGN_SECTIONS, FIELD_LABELS } from '../../store/useStore.js';
import { matchSuggestKeys } from '../../lib/suggestDb.js';
import { generateTaskPlan } from '../../lib/smartScan.js';

function SuggestDropdown({ suggestions, onSelect, anchorEl }) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 200 });

  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    setPos({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 280) });
  }, [anchorEl]);

  if (!suggestions.length) return null;

  return (
    <div className="suggest-dropdown" style={{ top: pos.top, left: pos.left, width: pos.width }}>
      {suggestions.map((s, i) => (
        <div key={i} className="suggest-item" onMouseDown={e => { e.preventDefault(); onSelect(s); }}>
          {s}
        </div>
      ))}
    </div>
  );
}

function DesignField({ sectionKey, fieldKey, value, onChange, readOnly }) {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);

  function handleChange(val) {
    onChange(val);
    setSuggestions(matchSuggestKeys(val, fieldKey));
  }

  function handleFocus() {
    setFocused(true);
    setSuggestions(matchSuggestKeys(value || '', fieldKey));
  }

  const isEmpty = !value?.trim();
  const highlight = readOnly && isEmpty;

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
      <label className="form-label text-slate-500">{FIELD_LABELS[fieldKey] || fieldKey}</label>
      {readOnly ? (
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
              onSelect={s => { onChange(s); setSuggestions([]); }}
              anchorEl={inputRef.current}
            />
          )}
        </>
      )}
    </div>
  );
}

function DesignSection({ section, sectionData, readOnly, onFieldChange, open, onToggle }) {
  const filled = section.fields.filter(f => sectionData[f]?.trim()).length;
  const total = section.fields.length;
  const completePct = Math.round((filled / total) * 100);
  const badgeColor = completePct === 100 ? 'badge-green' : completePct >= 60 ? 'badge-teal' : 'badge-amber';

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

      {/* Status banner */}
      {!isReadOnly && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 mt-1 flex-shrink-0 pulse-ring" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-green-800 text-sm">System Design Entry Open — {overallPct}% Complete</div>
              <span className={['badge text-xs', overallPct === 100 ? 'badge-green' : overallPct >= 60 ? 'badge-teal' : 'badge-amber'].join(' ')}>
                {filledFields}/{totalFields} fields
              </span>
            </div>
            <div className="text-xs text-green-700 mt-0.5">
              All 8 sections × 30 fields pre-filled from stack selection. Review and adjust — suggestions appear as you type in any field.
            </div>
            <div className="h-1 bg-green-200 rounded-full mt-2">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: overallPct + '%' }} />
            </div>
          </div>
        </div>
      )}

      {isReadOnly && (
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
          readOnly={isReadOnly}
          onFieldChange={s.setDesignField}
          open={!!s.designSectionOpen[section.key]}
          onToggle={() => s.toggleDesignSection(section.key)}
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
