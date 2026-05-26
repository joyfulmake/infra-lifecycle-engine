import { useState, useRef, useEffect } from 'react';
import { useStore, DESIGN_SECTIONS, FIELD_LABELS } from '../../store/useStore.js';
import { matchSuggestKeys } from '../../lib/suggestDb.js';

function SuggestDropdown({ suggestions, onSelect, anchorEl }) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 200 });

  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    setPos({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 280) });
  }, [anchorEl]);

  if (!suggestions.length) return null;

  return (
    <div
      className="suggest-dropdown"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
    >
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
    if (val.length >= 0) {
      setSuggestions(matchSuggestKeys(val, `sd-${sectionKey}-${fieldKey}`));
    }
  }

  function handleFocus() {
    setFocused(true);
    setSuggestions(matchSuggestKeys(value || '', `sd-${sectionKey}-${fieldKey}`));
  }

  const isEmpty = !value?.trim();
  const highlight = readOnly && isEmpty;

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
            placeholder={`Enter ${FIELD_LABELS[fieldKey] || fieldKey}...`}
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

function DesignSection({ section, sectionData, readOnly, onFieldChange, open, onToggle, phase2Active }) {
  const filled = section.fields.filter(f => sectionData[f]?.trim()).length;
  const total = section.fields.length;
  const completePct = Math.round((filled / total) * 100);
  const badgeColor = completePct === 100 ? 'badge-green' : completePct >= 60 ? 'badge-teal' : 'badge-amber';

  return (
    <div className="card mb-3 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 text-sm">{section.label}</span>
          <span className="text-xs text-slate-400">-- {section.owner}</span>
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
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiKey, setAiKey] = useState('');
  const [aiStatus, setAiStatus] = useState('idle');
  const [aiResult, setAiResult] = useState('');

  const isLocked = !s.scanComplete;
  const isReadOnly = s.phase2Active;

  const allFilled = DESIGN_SECTIONS.every(sec =>
    sec.fields.filter(f => f !== 'notes').every(f => s.sysDesignData[sec.key]?.[f]?.trim())
  );

  async function generateAiTasks() {
    if (!aiKey.trim()) { setAiResult('Please enter your Anthropic API key.'); setAiStatus('error'); return; }
    setAiStatus('running');

    const designSummary = DESIGN_SECTIONS.map(sec => {
      const fields = sec.fields.slice(0, 5).map(f => `${FIELD_LABELS[f] || f}: ${s.sysDesignData[sec.key]?.[f] || 'TBD'}`).join('; ');
      return `${sec.label} (${sec.owner}): ${fields}`;
    }).join('\n');

    const prompt = `You are an enterprise infrastructure project manager. Based on this system design, generate a structured task plan.\n\nStack: ${s.ctx.hw} / ${s.ctx.os} / ${s.ctx.db} / ${s.ctx.app}\n\nSystem Design Summary:\n${designSummary}\n\nGenerate a JSON array of tasks with this structure:\n[\n  {"id": "T01", "name": "Task name", "team": "Team role", "duration_hours": 2, "depends_on": [], "phase": 1, "milestone": false, "description": "Brief description"}\n]\n\nInclude 15-20 tasks covering all phases from network through security. Order by dependency. Return ONLY the JSON array.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'anthropic-dangerous-direct-browser-access': 'true',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'x-api-key': aiKey,
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        }),
      }).catch(() => fetch('http://localhost:8787/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': aiKey },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
      }));

      if (!res.ok) { const t = await res.text(); throw new Error(t); }
      const data = await res.json();
      const text = data.content?.[0]?.text || '[]';

      // Parse JSON
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const tasks = JSON.parse(match[0]);
        s.setAiTasks(tasks);
        s.applyDesign();
        setAiResult(`Generated ${tasks.length} tasks successfully.`);
        setAiStatus('done');
      } else {
        throw new Error('No valid JSON array found in response');
      }
    } catch (e) {
      setAiResult('AI task generation failed: ' + e.message);
      setAiStatus('error');
      s.applyDesign(); // mark design as applied anyway
    }
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
          <div className="text-sm text-slate-500 mb-3">Complete Phase 1 and run the AI Smart Scan to unlock all 8 design sections for your function teams.</div>
          <div className="space-y-1 text-left">
            {[
              ['Phase 1 -- Platform Topology', s.isBuilt],
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
          <div>
            <div className="font-semibold text-green-800 text-sm">System Design Entry is Now Open</div>
            <div className="text-xs text-green-700 mt-0.5">All function admins should fill their section before Phase 2 begins. Defaults are pre-filled from your stack selection -- review and adjust.</div>
          </div>
        </div>
      )}

      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
          <div className="font-semibold text-amber-800 text-sm">System Design Locked -- Phase 2 Active</div>
          <div className="text-xs text-amber-700 mt-0.5">All fields are read-only. Empty fields highlighted in amber require PM to fill with admin present.</div>
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
          phase2Active={s.phase2Active}
        />
      ))}

      {/* AI Task Plan */}
      {!isReadOnly && (
        <div className="card p-4 mt-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-slate-700 text-sm">Generate AI Task Plan</div>
              <div className="text-xs text-slate-500">Calls Anthropic API to generate a structured task plan with dependencies</div>
            </div>
            {s.sdAiTasks.length > 0 && <span className="badge badge-green">{s.sdAiTasks.length} tasks generated</span>}
          </div>

          {!showAiModal ? (
            <button className="btn-teal w-auto px-4" onClick={() => setShowAiModal(true)}>
              Generate AI Task Plan
            </button>
          ) : (
            <div className="space-y-2 fade-in">
              <label className="form-label">Anthropic API Key</label>
              <input
                type="password"
                className="form-input"
                placeholder="sk-ant-..."
                value={aiKey}
                onChange={e => setAiKey(e.target.value)}
              />
              <div className="flex gap-2">
                <button className="btn-teal flex-1" onClick={generateAiTasks} disabled={aiStatus === 'running'}>
                  {aiStatus === 'running' ? 'Generating...' : 'Generate Tasks'}
                </button>
                <button className="btn-primary flex-1" onClick={() => { s.applyDesign(); setShowAiModal(false); }}>
                  Apply Without AI
                </button>
                <button className="btn-primary px-3 w-auto" onClick={() => setShowAiModal(false)}>✕</button>
              </div>
              {aiResult && (
                <div className={['text-xs rounded p-2', aiStatus === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'].join(' ')}>
                  {aiResult}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
