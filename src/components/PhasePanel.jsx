import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore, DESIGN_SECTIONS, HW_OPTIONS, OS_OPTIONS, DB_OPTIONS, APP_OPTIONS } from '../store/useStore.js';
import { ALL_INC, FIXES } from '../lib/incidents.js';
import { ALL_UUM } from '../lib/uumItems.js';
import { getDefaultDesignValues } from '../lib/designDefaults.js';
import { exportExcel } from '../lib/exportExcel.js';

const LOCK_ICON = (
  <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
  </svg>
);

function PhasePill({ label, role, locked, active, onClick }) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      className={[
        'w-full text-left px-3 py-2 rounded-md text-xs font-semibold flex items-center gap-2 mb-1 transition-all duration-150',
        active ? 'bg-teal text-white shadow-sm' : 'text-white/80 hover:bg-white/10',
        locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {locked && LOCK_ICON}
      <div className="min-w-0">
        <div className="text-xs/3 font-normal opacity-70 mb-0.5">{role}</div>
        <div>{label}</div>
      </div>
    </button>
  );
}

function ItemList({ items, selected, onToggle, colorClass, grpMap }) {
  const [search, setSearch] = useState('');
  const filtered = items.filter(i =>
    !search || i.txt.toLowerCase().includes(search.toLowerCase()) || i.short.toLowerCase().includes(search.toLowerCase())
  );
  const byGroup = {};
  filtered.forEach(i => { if (!byGroup[i.grp]) byGroup[i.grp] = []; byGroup[i.grp].push(i); });

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white mb-2">
      <input
        className="w-full px-3 py-1.5 text-xs border-b border-slate-100 focus:outline-none focus:bg-blue-50 placeholder:text-slate-400"
        placeholder="Search..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="max-h-52 overflow-y-auto">
        {Object.entries(byGroup).map(([grp, grpItems]) => (
          <div key={grp}>
            <div className="sticky top-0 bg-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider px-3 py-1 flex justify-between items-center">
              <span>{grp}</span>
              <span
                className="text-sky-400 text-xs cursor-pointer border border-sky-600 px-1.5 rounded hover:text-white"
                onClick={() => grpItems.forEach(i => !selected.includes(i.code) && onToggle(i.code))}
              >All</span>
            </div>
            {grpItems.map(item => {
              const sel = selected.includes(item.code);
              return (
                <div
                  key={item.code}
                  onClick={() => onToggle(item.code)}
                  className={['item-row', sel ? colorClass : ''].join(' ')}
                >
                  <span className={[
                    'flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center text-xs font-bold mt-0.5',
                    sel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300',
                  ].join(' ')}>
                    {sel ? '✓' : ''}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-700 leading-snug">{item.short}</div>
                    <div className="text-xs text-slate-400 truncate">{item.txt.substring(item.short.length + 2)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {filtered.length === 0 && <div className="px-3 py-4 text-xs text-slate-400 text-center">No results</div>}
      </div>
    </div>
  );
}

function ScanModal({ onClose, onComplete }) {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [result, setResult] = useState('');
  const { ctx } = useStore();

  async function runScan() {
    if (!apiKey.trim()) { setStatus('error'); setResult('Please enter your Anthropic API key.'); return; }
    setStatus('running');
    const prompt = `You are an enterprise infrastructure security scanner. Perform a CVE and EOL check for the following stack:\n\nHardware: ${ctx.hw}\nOS: ${ctx.os}\nDatabase: ${ctx.db}\nApplication: ${ctx.app}\n\nRespond with:\n1. A list of any known CVEs or EOL warnings (5-10 items max)\n2. Recommended remediation steps\n3. Overall risk rating: LOW / MEDIUM / HIGH / CRITICAL\n\nKeep response concise and professional.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'anthropic-dangerous-direct-browser-access': 'true',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      }).catch(() => fetch('http://localhost:8787/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
      }));

      if (!res.ok) { const t = await res.text(); throw new Error(t); }
      const data = await res.json();
      const text = data.content?.[0]?.text || 'No response.';
      setResult(text);
      setStatus('done');
    } catch (e) {
      setResult('Scan failed: ' + e.message + '\n\nYou can proceed without the scan -- the System Design tab will still be available.');
      setStatus('error');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg fade-in">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-900 text-sm">AI Smart Scan</div>
            <div className="text-xs text-slate-500">CVE and EOL scan for your provisioned stack</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">&#10005;</button>
        </div>
        <div className="p-4">
          {status === 'idle' && (
            <>
              <div className="text-xs text-slate-600 mb-3 bg-blue-50 border border-blue-100 rounded p-2">
                This scan calls the Anthropic API directly from your browser. Your API key is never stored.
              </div>
              <label className="form-label">Anthropic API Key</label>
              <input
                type="password"
                className="form-input mb-3"
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <div className="flex gap-2">
                <button className="btn-teal flex-1" onClick={runScan}>Run Scan</button>
                <button
                  className="btn-primary flex-1"
                  onClick={() => { setStatus('done'); setResult('Scan skipped -- proceeding with manual System Design entry.'); onComplete([]); }}
                >Skip Scan</button>
              </div>
            </>
          )}
          {status === 'running' && (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-teal border-t-transparent rounded-full mx-auto mb-3"></div>
              <div className="text-sm text-slate-600">Scanning {ctx.os} + {ctx.db} stack...</div>
            </div>
          )}
          {(status === 'done' || status === 'error') && (
            <>
              <div className={['rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap mb-3 max-h-64 overflow-y-auto', status === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'].join(' ')}>
                {result}
              </div>
              <div className="flex gap-2">
                {status === 'done' && <button className="btn-teal flex-1" onClick={() => onComplete([result])}>Apply Results</button>}
                {status === 'error' && <button className="btn-primary flex-1" onClick={() => onComplete([])}>Proceed Anyway</button>}
                <button className="btn-primary flex-1" onClick={onClose}>Close</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PhasePanel() {
  const s = useStore();
  const [showScan, setShowScan] = useState(false);
  const [activePhase, setActivePhase] = useState(null);
  const [hwCustom, setHwCustom] = useState('');
  const [osCustom, setOsCustom] = useState('');
  const [dbCustom, setDbCustom] = useState('');
  const [appCustom, setAppCustom] = useState('');
  const [hwSel, setHwSel] = useState(HW_OPTIONS[0]);
  const [osSel, setOsSel] = useState(OS_OPTIONS[0]);
  const [dbSel, setDbSel] = useState(DB_OPTIONS[0]);
  const [appSel, setAppSel] = useState(APP_OPTIONS[0]);
  const [reqOpen, setReqOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [newChange, setNewChange] = useState({ type: 'Emergency', title: '', datetime: '', desc: '', impact: 'High', owner: '' });

  const phases = [
    { id: 'phase1', label: 'Phase 1 -- Initialise Platform Topology', role: 'PM / All Teams', locked: false, active: s.isBuilt },
    { id: 'scan', label: 'AI Smart Scan', role: 'PM / SecOps', locked: !s.isBuilt, active: s.scanComplete },
    { id: 'design', label: 'System Design Entry', role: 'All Function Admins', locked: !s.scanComplete, active: s.designApplied },
    { id: 'phase2', label: 'Phase 2 -- Inject Incidents + UUM', role: 'PM / Unix Admin', locked: !s.isBuilt, active: s.phase2Active },
    { id: 'cab', label: 'CAB Gate', role: 'Change Manager', locked: !s.phase2Active, active: s.cabApproved },
    { id: 'rtm', label: 'RTM Sign-Off', role: 'PM / QA Team', locked: !s.phase2Active, active: s.rtmSigned },
    { id: 'cutover', label: 'Production Cutover', role: 'All Teams', locked: !(s.cabApproved && s.rtmSigned), active: s.promoted },
    { id: 'export', label: 'Export to Excel', role: 'PM', locked: !s.isBuilt, active: false },
  ];

  function handleBuild() {
    const hw = hwCustom || hwSel;
    const os = osCustom || osSel;
    const db = dbCustom || dbSel;
    const app = appCustom || appSel;
    s.build({ hw, os, db, app });

    // Apply defaults to system design
    const defaults = getDefaultDesignValues({ hw, os, db, app });
    s.setAllDesignFields(defaults);

    setActivePhase('phase1');
    s.setActiveTab('exec');
  }

  function handleScanComplete(results) {
    s.completeScan(results);
    setShowScan(false);
    s.setActiveTab('design');
  }

  function handleInjectIncidents() {
    if (s.selInc.length === 0) return;
    s.startPhase2();
    s.setActiveTab('raid');
  }

  function handleRtmSignoff() {
    if (!s.phase2Active) return;
    s.signRtm();
    s.setActiveTab('rtm');
  }

  function handleCutover() {
    if (!s.cabApproved || !s.rtmSigned) return;
    s.promote();
    s.setActiveTab('closure');
  }

  function handleExport() {
    try {
      exportExcel({
        ctx: s.ctx, selInc: s.selInc, selUUM: s.selUUM, selFix: s.selFix,
        promoted: s.promoted, cabApproved: s.cabApproved, rtmSigned: s.rtmSigned,
        sysDesignData: s.sysDesignData, sdAiTasks: s.sdAiTasks,
        requirements: s.requirements, emergencyChanges: s.emergencyChanges,
      });
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
  }

  const incGrps = [...new Set(ALL_INC.map(i => i.grp))];
  const uumGrps = [...new Set(ALL_UUM.map(u => u.grp))];

  return (
    <div className="w-60 min-w-60 bg-navy text-white flex flex-col overflow-hidden" style={{ height: '100vh' }}>
      {/* Header */}
      <div className="px-3 py-3 border-b border-white/10 flex-shrink-0">
        <div className="text-xs font-bold text-teal uppercase tracking-widest mb-0.5">Infra Lifecycle</div>
        <div className="text-white/60 text-xs">Engine v2.0</div>
      </div>

      {/* Phase nav */}
      <div className="px-2 py-2 flex-shrink-0 border-b border-white/10">
        {phases.map(p => (
          <PhasePill
            key={p.id}
            label={p.label}
            role={p.role}
            locked={p.locked}
            active={p.active}
            onClick={() => setActivePhase(activePhase === p.id ? null : p.id)}
          />
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">

        {/* Phase 1 */}
        <div>
          <div className="section-hdr">Phase 1 -- Platform Topology</div>

          {/* Requirements (collapsible) */}
          <button onClick={() => setReqOpen(!reqOpen)} className="w-full text-left text-xs text-white/60 hover:text-white/90 mb-1 flex items-center gap-1">
            <span>{reqOpen ? '▾' : '▸'}</span> Requirements
          </button>
          {reqOpen && (
            <div className="bg-white/5 rounded-lg p-2 mb-2 space-y-1.5 fade-in">
              {[
                ['Project Name', 'projectName', 'text'],
                ['Env Type', 'envType', 'select', ['Production', 'Staging', 'DR', 'Dev/Test']],
                ['Go-Live Date', 'goLiveDate', 'date'],
                ['SLA %', 'sla', 'text'],
                ['Compliance', 'compliance', 'text'],
                ['DR Tier', 'drTier', 'select', ['Tier 1 (Hot)', 'Tier 2 (Warm)', 'Tier 3 (Cold)']],
                ['Constraints', 'constraints', 'text'],
              ].map(([label, key, type, opts]) => (
                <div key={key}>
                  <label className="text-xs text-white/50 block mb-0.5">{label}</label>
                  {type === 'select' ? (
                    <select
                      className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
                      value={s.requirements[key] || ''}
                      onChange={e => s.setRequirements({ ...s.requirements, [key]: e.target.value })}
                    >
                      {opts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={type}
                      className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 placeholder:text-white/30 focus:outline-none"
                      placeholder={label}
                      value={s.requirements[key] || ''}
                      onChange={e => s.setRequirements({ ...s.requirements, [key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            {[
              ['Hardware', HW_OPTIONS, hwSel, setHwSel, hwCustom, setHwCustom],
              ['OS', OS_OPTIONS, osSel, setOsSel, osCustom, setOsCustom],
              ['Database', DB_OPTIONS, dbSel, setDbSel, dbCustom, setDbCustom],
              ['Application', APP_OPTIONS, appSel, setAppSel, appCustom, setAppCustom],
            ].map(([label, opts, sel, setSel, custom, setCustom]) => (
              <div key={label}>
                <label className="text-xs text-white/50 block mb-0.5">{label}</label>
                <select
                  className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 mb-1 focus:outline-none"
                  value={sel}
                  onChange={e => { setSel(e.target.value); setCustom(''); }}
                >
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  <option value="__custom">+ Custom...</option>
                </select>
                {sel === '__custom' && (
                  <input
                    className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 placeholder:text-white/30 focus:outline-none"
                    placeholder={`Custom ${label}...`}
                    value={custom}
                    onChange={e => setCustom(e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
          <button className="btn-teal mt-2" onClick={handleBuild}>Build Environment</button>
        </div>

        {/* AI Scan */}
        {s.isBuilt && (
          <div>
            <div className="section-hdr">AI Smart Scan</div>
            {!s.scanComplete ? (
              <button className="btn-primary" onClick={() => setShowScan(true)}>Run AI Smart Scan</button>
            ) : (
              <div className="text-xs text-green-400 bg-green-900/20 border border-green-800 rounded p-2">
                Scan complete -- System Design unlocked
              </div>
            )}
          </div>
        )}

        {/* Phase 2 */}
        {s.isBuilt && (
          <div>
            <div className="section-hdr text-red-400 border-red-500 bg-red-500/5">Phase 2 -- Incidents + UUM</div>

            {s.scanComplete && !s.phase2Active && (
              <div className="text-xs text-green-300 bg-green-900/20 border border-green-800 rounded p-2 mb-2">
                System Design is now open for all admins to fill in. Start Phase 2 after design is complete.
              </div>
            )}

            <div className="text-xs text-white/60 mb-1 font-semibold">Select Incidents</div>
            <div className="text-xs text-white/40 mb-1">{s.selInc.length} selected</div>
            <ItemList
              items={ALL_INC}
              selected={s.selInc}
              onToggle={s.toggleInc}
              colorClass="bg-red-900/30 border-l-2 border-red-500"
            />

            {s.selInc.length > 0 && (
              <>
                <div className="text-xs text-white/60 mb-1 font-semibold mt-2">Fix Runbooks</div>
                {s.selInc.map(code => {
                  const inc = ALL_INC.find(i => i.code === code);
                  if (!inc) return null;
                  const sel = s.selFix.includes(code);
                  return (
                    <div
                      key={code}
                      onClick={() => s.toggleFix(code)}
                      className={['text-xs rounded p-2 mb-1 cursor-pointer border', sel ? 'bg-green-900/30 border-green-700 text-green-300' : 'bg-white/5 border-white/10 text-white/70'].join(' ')}
                    >
                      <div className="font-semibold text-xs text-red-300">{inc.short}</div>
                      <div className="leading-snug">{FIXES[code] || 'Generic patch applied.'}</div>
                    </div>
                  );
                })}
              </>
            )}

            <button
              className="btn-red mt-1"
              disabled={s.selInc.length === 0 || s.phase2Active}
              onClick={handleInjectIncidents}
            >
              {s.phase2Active ? 'Phase 2 Active' : 'Inject Incidents'}
            </button>

            <div className="text-xs text-white/60 mb-1 font-semibold mt-3">Schedule UUM Items</div>
            <div className="text-xs text-white/40 mb-1">{s.selUUM.length} selected</div>
            <ItemList
              items={ALL_UUM}
              selected={s.selUUM}
              onToggle={s.toggleUUM}
              colorClass="bg-amber-900/30 border-l-2 border-amber-500"
            />
          </div>
        )}

        {/* CAB Gate */}
        {s.phase2Active && (
          <div>
            <div className="section-hdr">CAB Gate</div>
            <div className={['rounded-lg border p-2', s.cabApproved ? 'border-green-600 bg-green-900/20' : 'border-red-600 bg-red-900/20'].join(' ')}>
              <label className="text-xs text-white/60 block mb-1">CAB Authorization</label>
              <select
                className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
                value={s.cabApproved ? 'valid' : 'invalid'}
                onChange={e => s.setCabApproved(e.target.value === 'valid')}
              >
                <option value="invalid">Invalid / Pending</option>
                <option value="valid">Valid -- Approved</option>
              </select>
              <div className={['text-xs mt-1.5 font-semibold text-center py-1 rounded', s.cabApproved ? 'text-green-400' : 'text-red-400'].join(' ')}>
                {s.cabApproved ? 'CAB APPROVED -- Proceed to cutover' : 'CAB BLOCKED -- Awaiting approval'}
              </div>
            </div>
          </div>
        )}

        {/* RTM Sign-Off */}
        {s.phase2Active && (
          <div>
            <div className="section-hdr">RTM Sign-Off</div>
            <button
              className={s.rtmSigned ? 'btn-teal' : 'btn-amber'}
              disabled={s.rtmSigned}
              onClick={handleRtmSignoff}
            >
              {s.rtmSigned ? 'RTM Signed Off' : 'Sign Off RTM'}
            </button>
          </div>
        )}

        {/* Cutover */}
        {s.rtmSigned && (
          <div>
            <div className="section-hdr">Production Cutover</div>
            <button
              className={s.promoted ? 'btn-green' : 'btn-primary'}
              disabled={s.promoted || !s.cabApproved}
              onClick={handleCutover}
            >
              {s.promoted ? 'Production STABLE' : 'Execute Production Cutover'}
            </button>
            {!s.cabApproved && <div className="text-xs text-red-400 mt-1">BLOCKED: CAB approval required first</div>}
          </div>
        )}

        {/* Emergency Changes */}
        {s.isBuilt && (
          <div>
            <button onClick={() => setEmergencyOpen(!emergencyOpen)} className="w-full text-left text-xs text-white/60 hover:text-white/90 flex items-center gap-1 mb-1">
              <span>{emergencyOpen ? '▾' : '▸'}</span> Emergency / Manual Changes
            </button>
            {emergencyOpen && (
              <div className="bg-white/5 rounded-lg p-2 space-y-1.5 fade-in">
                {[
                  ['Type', 'type', 'select', ['Emergency', 'Weekend', 'Weekday', 'Out-of-Band']],
                  ['Title', 'title', 'text'],
                  ['Date/Time', 'datetime', 'datetime-local'],
                  ['Description', 'desc', 'text'],
                  ['Impact Level', 'impact', 'select', ['Critical', 'High', 'Medium', 'Low']],
                  ['Owner', 'owner', 'text'],
                ].map(([label, key, type, opts]) => (
                  <div key={key}>
                    <label className="text-xs text-white/50 block mb-0.5">{label}</label>
                    {type === 'select' ? (
                      <select
                        className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
                        value={newChange[key]}
                        onChange={e => setNewChange({ ...newChange, [key]: e.target.value })}
                      >
                        {opts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={type}
                        className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 placeholder:text-white/30 focus:outline-none"
                        placeholder={label}
                        value={newChange[key]}
                        onChange={e => setNewChange({ ...newChange, [key]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
                <button
                  className="btn-amber w-full mt-1"
                  onClick={() => {
                    if (newChange.title) {
                      s.addEmergencyChange({ ...newChange, id: Date.now() });
                      setNewChange({ type: 'Emergency', title: '', datetime: '', desc: '', impact: 'High', owner: '' });
                    }
                  }}
                >
                  Log Change
                </button>
                {s.emergencyChanges.length > 0 && (
                  <div className="mt-2">
                    {s.emergencyChanges.map(c => (
                      <div key={c.id} className="text-xs text-white/60 border border-white/10 rounded p-1.5 mb-1">
                        <span className="badge badge-amber mr-1">{c.type}</span>
                        <span>{c.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Export */}
        {s.isBuilt && (
          <div className="pb-4">
            <div className="section-hdr">Export</div>
            <button className="btn-green" onClick={handleExport}>Export to Excel (10 Sheets)</button>
          </div>
        )}
      </div>

      {showScan && <ScanModal onClose={() => setShowScan(false)} onComplete={handleScanComplete} />}
    </div>
  );
}
