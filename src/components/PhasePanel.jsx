import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore, DESIGN_SECTIONS, HW_OPTIONS, OS_OPTIONS, DB_OPTIONS, APP_OPTIONS } from '../store/useStore.js';
import { ALL_INC, FIXES } from '../lib/incidents.js';
import { ALL_UUM } from '../lib/uumItems.js';
import { getDefaultDesignValues } from '../lib/designDefaults.js';
import { exportExcel } from '../lib/exportExcel.js';
import { runSmartScan } from '../lib/smartScan.js';
import { matchSuggestKeys } from '../lib/suggestDb.js';

const LOCK_ICON = (
  <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
  </svg>
);

const SEV_COLOR = { CRITICAL: 'text-red-400 bg-red-900/30 border-red-700', HIGH: 'text-orange-300 bg-orange-900/30 border-orange-700', MEDIUM: 'text-amber-300 bg-amber-900/30 border-amber-700', LOW: 'text-green-400 bg-green-900/30 border-green-700', INFO: 'text-sky-300 bg-sky-900/30 border-sky-700' };

// Floating suggestion dropdown rendered via Portal — works outside overflow:hidden ancestors
function SuggestDropdown({ suggestions, onSelect, anchorEl }) {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!anchorEl) return;
    const update = () => {
      const rect = anchorEl.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 260) });
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

// HW → compatible OS matrix
const HW_OS_COMPAT = {
  'IBM Power10 / Power11': ['AIX 7.3', 'AIX 7.2', 'RHEL 9.x', 'RHEL 8.x', 'Ubuntu 24.04 LTS', 'Ubuntu 22.04 LTS', 'SUSE SLES 15 SP6'],
  'IBM Power9':            ['AIX 7.3', 'AIX 7.2', 'AIX 6.1 (EOL)', 'RHEL 9.x', 'RHEL 8.x', 'RHEL 7.x (EOL)', 'Ubuntu 22.04 LTS', 'SUSE SLES 15 SP6', 'SUSE SLES 12 SP5'],
  'IBM Power7 / Power8':   ['AIX 7.2', 'AIX 6.1 (EOL)', 'RHEL 7.x (EOL)', 'SUSE SLES 12 SP5'],
  'IBM z16 Mainframe':     ['z/OS 3.1', 'RHEL 9.x', 'Ubuntu 22.04 LTS'],
  'Oracle Exadata X10M':   ['Oracle Linux 9', 'RHEL 8.x'],
};

// Option-filtered input — suggestions come from an options array, not suggestDb
function FilteredSuggestInput({ options, value, onChange, placeholder, className }) {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);

  function getSuggestions(val) {
    if (!val || val.trim().length < 2) return options.slice(0, 6);
    const lower = val.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(lower)).slice(0, 6);
  }

  function handleChange(val) {
    onChange(val);
    setSuggestions(getSuggestions(val));
  }

  function handleFocus() {
    setFocused(true);
    setSuggestions(getSuggestions(value || ''));
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className={className || 'w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 placeholder:text-white/30 focus:outline-none focus:bg-white/15'}
        placeholder={placeholder}
        value={value || ''}
        onChange={e => handleChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={() => { setFocused(false); setTimeout(() => setSuggestions([]), 200); }}
      />
      {focused && suggestions.length > 0 && (
        <SuggestDropdown
          suggestions={suggestions}
          onSelect={s => { onChange(s); setSuggestions([]); }}
          anchorEl={inputRef.current}
        />
      )}
    </div>
  );
}

// Input with suggestion support — styled for dark panel
function SuggestInput({ fieldId, value, onChange, placeholder, type = 'text', className = '' }) {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);

  function handleChange(val) {
    onChange(val);
    setSuggestions(matchSuggestKeys(val, fieldId));
  }

  function handleFocus() {
    setFocused(true);
    setSuggestions(matchSuggestKeys(value || '', fieldId));
  }


  return (
    <div className="relative">
      <input
        ref={inputRef}
        type={type}
        className={className || 'w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 placeholder:text-white/30 focus:outline-none focus:bg-white/15'}
        placeholder={placeholder}
        value={value || ''}
        onChange={e => handleChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={() => { setFocused(false); setTimeout(() => setSuggestions([]), 200); }}
      />
      {focused && suggestions.length > 0 && (
        <SuggestDropdown
          suggestions={suggestions}
          onSelect={s => { onChange(s); setSuggestions([]); }}
          anchorEl={inputRef.current}
        />
      )}
    </div>
  );
}

function PhasePill({ label, role, locked, active, isCurrent, onClick }) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      className={[
        'w-full text-left px-3 py-2 rounded-md text-xs font-semibold flex items-center gap-2 mb-1 transition-all duration-150',
        isCurrent ? 'bg-teal/20 text-teal border border-teal/40 shadow-sm' : active ? 'text-white/60' : 'text-white/60 hover:bg-white/10',
        locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {locked && LOCK_ICON}
      {!locked && active && !isCurrent && (
        <svg className="w-3 h-3 text-teal flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )}
      {isCurrent && (
        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-teal pulse-ring" />
      )}
      <div className="min-w-0">
        <div className="text-xs/3 font-normal opacity-70 mb-0.5">{role}</div>
        <div className={isCurrent ? 'text-teal' : ''}>{label}</div>
      </div>
      {isCurrent && <span className="ml-auto text-teal text-xs">←</span>}
    </button>
  );
}

function ItemList({ items, selected, onToggle, colorClass }) {
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
                <div key={item.code} onClick={() => onToggle(item.code)} className={['item-row', sel ? colorClass : ''].join(' ')}>
                  <span className={['flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center text-xs font-bold mt-0.5', sel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'].join(' ')}>
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

const SCAN_STAGES = [
  'Resolving hardware platform fingerprint...',
  'Checking OS EOL and patch status...',
  'Scanning database CVE advisory feeds...',
  'Analysing application stack versions...',
  'Cross-referencing CISA KEV catalog...',
  'Evaluating vendor end-of-life timelines...',
  'Checking CIS Benchmark compliance posture...',
  'Compiling risk findings and recommendations...',
];

function ScanModal({ onClose, onComplete }) {
  const [stage, setStage] = useState(0);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState(null);
  const { ctx } = useStore();

  useEffect(() => {
    let i = 0;
    const tick = () => {
      i++;
      setStage(i);
      if (i < SCAN_STAGES.length - 1) {
        setTimeout(tick, 320 + Math.random() * 280);
      } else {
        setTimeout(() => {
          const res = runSmartScan(ctx);
          setResult(res);
          setDone(true);
        }, 400);
      }
    };
    const t = setTimeout(tick, 250);
    return () => clearTimeout(t);
  }, []);

  const riskBadge = result
    ? { CRITICAL: 'bg-red-700 text-white', HIGH: 'bg-orange-600 text-white', MEDIUM: 'bg-amber-500 text-white', LOW: 'bg-green-600 text-white' }[result.riskLevel]
    : '';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg fade-in">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-900 text-sm">AI Smart Scan</div>
            <div className="text-xs text-slate-500">Standalone CVE, EOL and security posture scan — no API key required</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">&#10005;</button>
        </div>

        <div className="p-4">
          {!done ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="animate-spin w-6 h-6 border-2 border-teal border-t-transparent rounded-full flex-shrink-0" />
                <div className="text-sm text-slate-600 font-medium">Scanning {ctx.os} + {ctx.db} stack...</div>
              </div>
              <div className="space-y-1 bg-slate-900 rounded-lg p-3 font-mono text-xs">
                {SCAN_STAGES.slice(0, stage + 1).map((s, i) => (
                  <div key={i} className={['flex items-center gap-2', i === stage ? 'text-green-400' : 'text-slate-500'].join(' ')}>
                    <span>{i < stage ? '✓' : '›'}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-slate-800">Scan Complete</div>
                <span className={['text-xs font-bold px-2 py-0.5 rounded', riskBadge].join(' ')}>
                  RISK: {result.riskLevel}
                </span>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto mb-3">
                {result.findings.map((f, i) => (
                  <div key={i} className={['rounded border px-2 py-1.5 text-xs', SEV_COLOR[f.sev] || SEV_COLOR.INFO].join(' ')}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-bold uppercase text-xs">{f.sev}</span>
                      <span className="font-semibold">{f.component}</span>
                    </div>
                    <div className="opacity-90 leading-snug">{f.msg}</div>
                  </div>
                ))}
              </div>

              {(result.suggestedInc?.length > 0 || result.suggestedUUM?.length > 0) && (
                <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3 text-xs text-blue-800">
                  <div className="font-semibold mb-0.5">AI Pre-Selection Ready</div>
                  <div>{result.suggestedInc?.length || 0} incident(s) + {result.suggestedUUM?.length || 0} UUM item(s) matched to your stack — will be pre-selected for your review.</div>
                </div>
              )}
              <div className="flex gap-2">
                <button className="btn-teal flex-1" onClick={() => onComplete(result.findings.map(f => `[${f.sev}] ${f.component}: ${f.msg}`), result.suggestedInc || [], result.suggestedUUM || [])}>
                  Apply Results &amp; Unlock Design
                </button>
                <button className="btn-primary px-3 w-auto" onClick={onClose}>Close</button>
              </div>
            </div>
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
  const [customIncOpen, setCustomIncOpen] = useState(false);
  const [buildsOpen, setBuildsOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedBuilds, setSavedBuilds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('opsmanifest_builds') || '[]'); } catch { return []; }
  });
  const [newCustomInc, setNewCustomInc] = useState({ title: '', desc: '', sev: 'HIGH', owner: '' });
  const [newChange, setNewChange] = useState({ type: 'Emergency', title: '', datetime: '', desc: '', impact: 'High', owner: '' });
  const [aiSuggestBanner, setAiSuggestBanner] = useState(null); // { inc: [], uum: [] }

  // Determine current active phase for guidemark
  const currentPhaseId = (() => {
    if (!s.isBuilt) return 'phase1';
    if (!s.scanComplete) return 'scan';
    if (!s.designApplied) return 'design';
    if (!s.phase2Active) return 'phase2';
    if (s.cabDeclined) return 'cabdeclined';
    if (!s.cabApproved) return 'cab';
    if (!s.rtmSigned) return 'rtm';
    if (!s.promoted) return 'cutover';
    return 'export';
  })();

  const PHASE_HINTS = {
    phase1:      'Select HW / OS / DB / App stack and click Build Environment.',
    scan:        'Click Run AI Smart Scan — no API key needed. Unlocks System Design.',
    design:      'Fill all 8 design sections with your team, then Generate Task Plan.',
    phase2:      'Select incidents and UUM items relevant to your change, then Inject.',
    cab:         'Set CAB Authorization to "Valid — Approved" before proceeding.',
    cabdeclined: 'Change DECLINED by CAB. Execute rollback plan, then resubmit with revised scope.',
    rtm:         'Open RTM tab → manually review each row → set status → Sign Off.',
    cutover:     'All gates green — execute Production Cutover to go live.',
    export:      'Download the full 12-sheet Excel workbook for stakeholder review.',
  };

  const phases = [
    { id: 'phase1', label: 'Phase 1 — Platform Topology', role: 'PM / All Teams', locked: false, active: s.isBuilt },
    { id: 'scan',   label: 'AI Smart Scan', role: 'PM / SecOps', locked: !s.isBuilt, active: s.scanComplete },
    { id: 'design', label: 'System Design Entry', role: 'All Function Admins', locked: !s.scanComplete, active: s.designApplied },
    { id: 'phase2', label: 'Phase 2 — Incidents + UUM', role: 'PM / Unix Admin', locked: !s.isBuilt, active: s.phase2Active },
    { id: 'cab',    label: 'CAB Gate', role: 'Change Manager', locked: !s.phase2Active, active: s.cabApproved },
    { id: 'rtm',    label: 'RTM Sign-Off', role: 'PM / QA Team', locked: !s.phase2Active, active: s.rtmSigned },
    { id: 'cutover',label: 'Production Cutover', role: 'All Teams', locked: !(s.cabApproved && s.rtmSigned), active: s.promoted },
    { id: 'export', label: 'Export to Excel', role: 'PM', locked: !s.isBuilt, active: false },
  ];

  function handleBuild() {
    const hw = hwCustom || hwSel;
    const os = osCustom || osSel;
    const db = dbCustom || dbSel;
    const app = appCustom || appSel;
    s.build({ hw, os, db, app });
    const defaults = getDefaultDesignValues({ hw, os, db, app });
    s.setAllDesignFields(defaults);
    setActivePhase('phase1');
    s.setActiveTab('exec');
  }

  function handleScanComplete(results, suggestedInc = [], suggestedUUM = []) {
    s.completeScan(results);
    setShowScan(false);
    // Pre-select AI-suggested incidents and UUM items for user review
    if (suggestedInc.length > 0 || suggestedUUM.length > 0) {
      suggestedInc.forEach(code => { if (!s.selInc.includes(code)) s.toggleInc(code); });
      suggestedUUM.forEach(code => { if (!s.selUUM.includes(code)) s.toggleUUM(code); });
      setAiSuggestBanner({ inc: suggestedInc, uum: suggestedUUM });
    }
    s.setActiveTab('design');
  }

  function handleInjectIncidents() {
    if (s.selInc.length === 0) return;
    s.startPhase2();
    s.setActiveTab('raid');
  }

  function handleRtmSignoff() {
    if (!s.phase2Active) return;
    // Navigate to RTM tab — user must manually review and sign off there
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

  function handleSaveBuild() {
    if (!saveName.trim()) return;
    const build = {
      id: Date.now(),
      name: saveName.trim(),
      savedAt: new Date().toISOString(),
      isBuilt: s.isBuilt, scanComplete: s.scanComplete, designApplied: s.designApplied,
      phase2Active: s.phase2Active, cabApproved: s.cabApproved, cabDeclined: s.cabDeclined,
      rtmSigned: s.rtmSigned, promoted: s.promoted,
      ctx: s.ctx, requirements: s.requirements,
      selInc: s.selInc, selUUM: s.selUUM, selFix: s.selFix,
      customInc: s.customInc, sysDesignData: s.sysDesignData, sdAiTasks: s.sdAiTasks,
      scanResults: s.scanResults, rtmRows: s.rtmRows,
      closureChecks: s.closureChecks, closureNotes: s.closureNotes,
      emergencyChanges: s.emergencyChanges, lockedDesignFields: s.lockedDesignFields,
    };
    const updated = [build, ...savedBuilds].slice(0, 20);
    localStorage.setItem('opsmanifest_builds', JSON.stringify(updated));
    setSavedBuilds(updated);
    setSaveName('');
  }

  function handleLoadBuild(build) {
    if (!window.confirm(`Load build "${build.name}"? Current unsaved state will be replaced.`)) return;
    s.loadBuild(build);
    setBuildsOpen(false);
  }

  function handleDeleteBuild(id) {
    const updated = savedBuilds.filter(b => b.id !== id);
    localStorage.setItem('opsmanifest_builds', JSON.stringify(updated));
    setSavedBuilds(updated);
  }

  // Requirements field config: [label, key, type, options?, suggestId?]
  const reqFields = [
    ['Project Name', 'projectName', 'text', null, 'projectName'],
    ['Env Type', 'envType', 'select', ['Production', 'Staging', 'DR', 'Dev/Test']],
    ['Go-Live Date', 'goLiveDate', 'date'],
    ['SLA %', 'sla', 'text', null, 'sla'],
    ['Load Profile', 'load_profile', 'text', null, 'load_profile'],
    ['Data Volume', 'data_volume', 'text', null, 'data_volume'],
    ['Compliance', 'compliance', 'text', null, 'compliance'],
    ['DR Tier', 'drTier', 'select', ['Tier 1 (Hot)', 'Tier 2 (Warm)', 'Tier 3 (Cold)']],
    ['Constraints', 'constraints', 'text', null, 'constraints'],
  ];

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
          <PhasePill key={p.id} label={p.label} role={p.role} locked={p.locked} active={p.active}
            isCurrent={p.id === currentPhaseId}
            onClick={() => setActivePhase(activePhase === p.id ? null : p.id)} />
        ))}
      </div>

      {/* Guidemark — current stage hint */}
      <div className="px-3 py-2 flex-shrink-0 border-b border-white/10 bg-white/5">
        <div className="text-xs text-teal font-semibold mb-0.5">Current stage</div>
        <div className="text-xs text-white/70 leading-snug">{PHASE_HINTS[currentPhaseId]}</div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">

        {/* Phase 1 */}
        <div>
          <div className="section-hdr">Phase 1 — Platform Topology</div>

          {/* Requirements */}
          <button onClick={() => setReqOpen(!reqOpen)} className="w-full text-left text-xs text-white/60 hover:text-white/90 mb-1 flex items-center gap-1">
            <span>{reqOpen ? '▾' : '▸'}</span> Requirements
          </button>
          {reqOpen && (
            <div className="bg-white/5 rounded-lg p-2 mb-2 space-y-1.5 fade-in">
              {reqFields.map(([label, key, type, opts, suggestId]) => (
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
                  ) : suggestId ? (
                    <SuggestInput
                      fieldId={suggestId}
                      value={s.requirements[key] || ''}
                      onChange={v => s.setRequirements({ ...s.requirements, [key]: v })}
                      placeholder={label}
                      type={type}
                    />
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

          {/* Stack selects — HW drives OS compatibility filter */}
          <div className="space-y-1.5">
            {/* Hardware */}
            <div>
              <label className="text-xs text-white/50 block mb-0.5">Hardware</label>
              <select
                className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 mb-1 focus:outline-none"
                value={hwSel}
                onChange={e => { setHwSel(e.target.value); setHwCustom(''); setOsSel(OS_OPTIONS[0]); setOsCustom(''); }}
              >
                {HW_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                <option value="__custom">+ Custom...</option>
              </select>
              {hwSel === '__custom' && (
                <FilteredSuggestInput
                  options={HW_OPTIONS}
                  value={hwCustom}
                  onChange={setHwCustom}
                  placeholder="Type hardware model (e.g. IBM Power10, Dell R760)..."
                />
              )}
            </div>

            {/* OS — filtered by selected HW */}
            <div>
              {(() => {
                const effectiveHW = hwCustom || (hwSel !== '__custom' ? hwSel : '');
                const compatOS = HW_OS_COMPAT[effectiveHW] || OS_OPTIONS;
                const isFiltered = !!HW_OS_COMPAT[effectiveHW];
                return (
                  <>
                    <label className="text-xs text-white/50 block mb-0.5">
                      OS
                      {isFiltered && <span className="ml-1 text-teal/70 text-xs">(filtered for {effectiveHW.split(' ')[0]} {effectiveHW.split(' ')[1] || ''})</span>}
                    </label>
                    <select
                      className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 mb-1 focus:outline-none"
                      value={osSel}
                      onChange={e => { setOsSel(e.target.value); setOsCustom(''); }}
                    >
                      {compatOS.map(o => <option key={o} value={o}>{o}</option>)}
                      {!isFiltered && <option value="__custom">+ Custom...</option>}
                      {isFiltered && <option value="__custom">+ Other (custom)...</option>}
                    </select>
                    {osSel === '__custom' && (
                      <FilteredSuggestInput
                        options={OS_OPTIONS}
                        value={osCustom}
                        onChange={setOsCustom}
                        placeholder="Type OS name (e.g. RHEL 9, Ubuntu 24.04, AIX 7.3)..."
                      />
                    )}
                  </>
                );
              })()}
            </div>

            {/* Database */}
            <div>
              <label className="text-xs text-white/50 block mb-0.5">Database</label>
              <select
                className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 mb-1 focus:outline-none"
                value={dbSel}
                onChange={e => { setDbSel(e.target.value); setDbCustom(''); }}
              >
                {DB_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                <option value="__custom">+ Custom...</option>
              </select>
              {dbSel === '__custom' && (
                <FilteredSuggestInput
                  options={DB_OPTIONS}
                  value={dbCustom}
                  onChange={setDbCustom}
                  placeholder="Type DB name (e.g. Oracle 19c, PostgreSQL 16, MySQL 8.4)..."
                />
              )}
            </div>

            {/* Application */}
            <div>
              <label className="text-xs text-white/50 block mb-0.5">Application</label>
              <select
                className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 mb-1 focus:outline-none"
                value={appSel}
                onChange={e => { setAppSel(e.target.value); setAppCustom(''); }}
              >
                {APP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                <option value="__custom">+ Custom...</option>
              </select>
              {appSel === '__custom' && (
                <FilteredSuggestInput
                  options={APP_OPTIONS}
                  value={appCustom}
                  onChange={setAppCustom}
                  placeholder="Type app server (e.g. Tomcat 10, Spring Boot 3, Node.js 22)..."
                />
              )}
            </div>
          </div>
          <button className="btn-teal mt-2" onClick={handleBuild}>Build Environment</button>
        </div>

        {/* AI Scan */}
        {s.isBuilt && (
          <div>
            <div className="section-hdr">AI Smart Scan</div>
            {!s.scanComplete ? (
              <div>
                <div className="text-xs text-white/50 mb-1.5 leading-snug">
                  Standalone scan — no API key required. Checks EOL status, known CVEs, and security posture for your stack.
                </div>
                <button className="btn-primary" onClick={() => setShowScan(true)}>Run AI Smart Scan</button>
              </div>
            ) : (
              <div className="text-xs text-green-400 bg-green-900/20 border border-green-800 rounded p-2">
                Scan complete — System Design unlocked ({s.scanResults?.length || 0} findings)
              </div>
            )}
          </div>
        )}

        {/* AI suggestion acceptance banner */}
        {aiSuggestBanner && (
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-2 fade-in">
            <div className="text-xs font-semibold text-blue-300 mb-0.5">AI Pre-Selected Items</div>
            <div className="text-xs text-blue-200 leading-snug mb-2">
              {aiSuggestBanner.inc.length} incident{aiSuggestBanner.inc.length !== 1 ? 's' : ''} + {aiSuggestBanner.uum.length} UUM item{aiSuggestBanner.uum.length !== 1 ? 's' : ''} matched to your stack. Review below and deselect any that don't apply.
            </div>
            <button
              className="text-xs text-blue-400 hover:text-blue-200 border border-blue-700 rounded px-2 py-0.5 mr-2"
              onClick={() => setAiSuggestBanner(null)}
            >Dismiss</button>
            <button
              className="text-xs text-red-400 hover:text-red-200"
              onClick={() => {
                aiSuggestBanner.inc.forEach(code => { if (s.selInc.includes(code)) s.toggleInc(code); });
                aiSuggestBanner.uum.forEach(code => { if (s.selUUM.includes(code)) s.toggleUUM(code); });
                setAiSuggestBanner(null);
              }}
            >Clear AI selections</button>
          </div>
        )}

        {/* Phase 2 */}
        {s.isBuilt && (
          <div>
            <div className="section-hdr text-red-400 border-red-500 bg-red-500/5">Phase 2 — Incidents + UUM</div>

            {s.scanComplete && !s.phase2Active && (
              <div className="text-xs text-green-300 bg-green-900/20 border border-green-800 rounded p-2 mb-2">
                System Design is now open. Start Phase 2 after design sign-off.
              </div>
            )}

            <div className="text-xs text-white/60 mb-1 font-semibold">Select Incidents</div>
            <div className="text-xs text-white/40 mb-1">{s.selInc.length} selected</div>
            <ItemList items={ALL_INC} selected={s.selInc} onToggle={s.toggleInc} colorClass="bg-red-900/30 border-l-2 border-red-500" />

            {s.selInc.length > 0 && (
              <>
                <div className="text-xs text-white/60 mb-1 font-semibold mt-2">Fix Runbooks</div>
                {s.selInc.map(code => {
                  const inc = ALL_INC.find(i => i.code === code);
                  if (!inc) return null;
                  const sel = s.selFix.includes(code);
                  return (
                    <div key={code} onClick={() => s.toggleFix(code)}
                      className={['text-xs rounded p-2 mb-1 cursor-pointer border', sel ? 'bg-green-900/30 border-green-700 text-green-300' : 'bg-white/5 border-white/10 text-white/70'].join(' ')}>
                      <div className="font-semibold text-xs text-red-300">{inc.short}</div>
                      <div className="leading-snug">{FIXES[code] || 'Generic patch applied.'}</div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Custom incident form */}
            <button
              onClick={() => setCustomIncOpen(o => !o)}
              className="w-full text-left text-xs text-white/50 hover:text-white/80 flex items-center gap-1 mt-1 mb-1"
            >
              <span>{customIncOpen ? '▾' : '▸'}</span> Add Custom Incident / Ticket
            </button>
            {customIncOpen && (
              <div className="bg-white/5 rounded-lg p-2 mb-2 space-y-1.5 fade-in">
                <div>
                  <label className="text-xs text-white/50 block mb-0.5">Title / Short Description</label>
                  <SuggestInput fieldId="title" value={newCustomInc.title} onChange={v => setNewCustomInc(p => ({ ...p, title: v }))} placeholder="e.g. SSL cert expiry on app server" />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-0.5">Full Description</label>
                  <SuggestInput fieldId="desc" value={newCustomInc.desc} onChange={v => setNewCustomInc(p => ({ ...p, desc: v }))} placeholder="Detail the issue or ticket scope" />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-0.5">Severity</label>
                  <select className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
                    value={newCustomInc.sev} onChange={e => setNewCustomInc(p => ({ ...p, sev: e.target.value }))}>
                    {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-0.5">Assigned Owner</label>
                  <SuggestInput fieldId="owner" value={newCustomInc.owner} onChange={v => setNewCustomInc(p => ({ ...p, owner: v }))} placeholder="Team or person responsible" />
                </div>
                <button
                  className="btn-amber w-full mt-1"
                  onClick={() => {
                    if (!newCustomInc.title.trim()) return;
                    const id = `custom_${Date.now()}`;
                    s.addCustomInc({
                      id, code: id,
                      short: newCustomInc.title.substring(0, 60),
                      txt: `${newCustomInc.title}: ${newCustomInc.desc}`,
                      grp: 'Custom Entries',
                      sev: newCustomInc.sev,
                      owner: newCustomInc.owner,
                    });
                    s.toggleInc(id);
                    setNewCustomInc({ title: '', desc: '', sev: 'HIGH', owner: '' });
                    setCustomIncOpen(false);
                  }}
                >Add & Select</button>
              </div>
            )}

            {/* Custom incidents display */}
            {s.customInc?.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-white/50 mb-1">Custom Entries ({s.customInc.length})</div>
                {s.customInc.map(ci => {
                  const sel = s.selInc.includes(ci.code);
                  return (
                    <div key={ci.id} className={['text-xs rounded p-1.5 mb-1 cursor-pointer border flex items-start gap-2', sel ? 'bg-amber-900/30 border-amber-700 text-amber-200' : 'bg-white/5 border-white/10 text-white/60'].join(' ')}
                      onClick={() => s.toggleInc(ci.code)}>
                      <span className={['flex-shrink-0 w-3 h-3 rounded border flex items-center justify-center text-xs font-bold mt-0.5', sel ? 'bg-amber-500 border-amber-500 text-white' : 'border-white/30'].join(' ')}>{sel ? '✓' : ''}</span>
                      <div>
                        <div className="font-medium">{ci.short}</div>
                        <div className="text-white/40 text-xs">{ci.sev} — {ci.owner || 'Unassigned'}</div>
                      </div>
                      <button className="ml-auto text-white/30 hover:text-red-400 text-xs" onClick={e => { e.stopPropagation(); s.removeCustomInc(ci.id); if (sel) s.toggleInc(ci.code); }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-xs text-white/60 mb-1 font-semibold mt-3">Schedule UUM Items</div>
            <div className="text-xs text-white/40 mb-1">{s.selUUM.length} selected</div>
            <ItemList items={ALL_UUM} selected={s.selUUM} onToggle={s.toggleUUM} colorClass="bg-amber-900/30 border-l-2 border-amber-500" />

            {/* Injection summary + confirm */}
            {!s.phase2Active && (s.selInc.length > 0 || s.selUUM.length > 0) && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-2 mt-2 text-xs text-white/60">
                <div className="font-semibold text-white/80 mb-1">Ready to inject to this build:</div>
                {s.selInc.length > 0 && <div className="text-red-300">{s.selInc.length} incident{s.selInc.length > 1 ? 's' : ''}</div>}
                {s.selUUM.length > 0 && <div className="text-amber-300">{s.selUUM.length} UUM item{s.selUUM.length > 1 ? 's' : ''}</div>}
                {s.selFix.length > 0 && <div className="text-green-300">{s.selFix.length} fix runbook{s.selFix.length > 1 ? 's' : ''}</div>}
              </div>
            )}
            <button className="btn-red mt-1" disabled={s.selInc.length === 0 || s.phase2Active} onClick={handleInjectIncidents}>
              {s.phase2Active ? 'Phase 2 Active' : `Inject to Build (${s.selInc.length} inc + ${s.selUUM.length} UUM)`}
            </button>
          </div>
        )}

        {/* CAB Gate */}
        {s.phase2Active && (
          <div>
            <div className="section-hdr">CAB Gate</div>
            <div className={['rounded-lg border p-2', s.cabApproved ? 'border-green-600 bg-green-900/20' : s.cabDeclined ? 'border-red-500 bg-red-900/30' : 'border-red-600 bg-red-900/20'].join(' ')}>
              <label className="text-xs text-white/60 block mb-1">CAB Authorization</label>
              <select
                className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
                value={s.cabApproved ? 'valid' : s.cabDeclined ? 'declined' : 'invalid'}
                onChange={e => {
                  if (e.target.value === 'valid') s.setCabApproved(true);
                  else if (e.target.value === 'declined') s.setCabDeclined(true);
                  else { s.setCabApproved(false); }
                }}
              >
                <option value="invalid">Pending / Awaiting Review</option>
                <option value="valid">Approved — Proceed</option>
                <option value="declined">DECLINED — Rollback Required</option>
              </select>
              <div className={['text-xs mt-1.5 font-semibold text-center py-1 rounded',
                s.cabApproved ? 'text-green-400' : s.cabDeclined ? 'text-red-300 bg-red-900/40' : 'text-red-400'
              ].join(' ')}>
                {s.cabApproved ? 'CAB APPROVED — Proceed to cutover' : s.cabDeclined ? 'CHANGE DECLINED — Rollback Required' : 'CAB BLOCKED — Awaiting approval'}
              </div>
            </div>
            {s.cabDeclined && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-2 mt-2 fade-in">
                <div className="text-xs font-bold text-red-300 mb-1">Rollback Plan</div>
                {['Notify all stakeholders of decline decision', 'Snapshot current state before rollback', 'Revert application deployment', 'Revert database schema changes', 'Restore OS/kernel baseline config', 'Re-validate network routing', 'Confirm service health post-rollback', 'File post-change incident report'].map((step, i) => (
                  <div key={i} className="text-xs text-red-200 flex items-start gap-1.5 mb-0.5">
                    <span className="text-red-400 flex-shrink-0 font-mono">RB{String(i + 1).padStart(2, '0')}</span>
                    <span>{step}</span>
                  </div>
                ))}
                <div className="mt-2 text-xs text-red-300 font-medium">Rollback steps visible in Gantt tab.</div>
              </div>
            )}
          </div>
        )}

        {/* RTM Sign-Off */}
        {s.phase2Active && (
          <div>
            <div className="section-hdr">RTM Sign-Off</div>
            <button className={s.rtmSigned ? 'btn-teal' : 'btn-amber'} disabled={s.rtmSigned} onClick={handleRtmSignoff}>
              {s.rtmSigned ? 'RTM Signed Off' : 'Sign Off RTM'}
            </button>
          </div>
        )}

        {/* Cutover */}
        {s.rtmSigned && (
          <div>
            <div className="section-hdr">Production Cutover</div>
            <button className={s.promoted ? 'btn-green' : 'btn-primary'} disabled={s.promoted || !s.cabApproved} onClick={handleCutover}>
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
                {/* Type */}
                <div>
                  <label className="text-xs text-white/50 block mb-0.5">Type</label>
                  <select className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
                    value={newChange.type} onChange={e => setNewChange({ ...newChange, type: e.target.value })}>
                    {['Emergency', 'Weekend', 'Weekday', 'Out-of-Band'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                {/* Title with suggestions */}
                <div>
                  <label className="text-xs text-white/50 block mb-0.5">Title</label>
                  <SuggestInput fieldId="title" value={newChange.title} onChange={v => setNewChange({ ...newChange, title: v })} placeholder="Change title" />
                </div>
                {/* Date/Time */}
                <div>
                  <label className="text-xs text-white/50 block mb-0.5">Date / Time</label>
                  <input type="datetime-local" className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
                    value={newChange.datetime} onChange={e => setNewChange({ ...newChange, datetime: e.target.value })} />
                </div>
                {/* Description with suggestions */}
                <div>
                  <label className="text-xs text-white/50 block mb-0.5">Description</label>
                  <SuggestInput fieldId="desc" value={newChange.desc} onChange={v => setNewChange({ ...newChange, desc: v })} placeholder="Describe the change" />
                </div>
                {/* Impact */}
                <div>
                  <label className="text-xs text-white/50 block mb-0.5">Impact Level</label>
                  <select className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
                    value={newChange.impact} onChange={e => setNewChange({ ...newChange, impact: e.target.value })}>
                    {['Critical', 'High', 'Medium', 'Low'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                {/* Owner with suggestions */}
                <div>
                  <label className="text-xs text-white/50 block mb-0.5">Owner</label>
                  <SuggestInput fieldId="owner" value={newChange.owner} onChange={v => setNewChange({ ...newChange, owner: v })} placeholder="Change owner" />
                </div>

                <button className="btn-amber w-full mt-1" onClick={() => {
                  if (newChange.title) {
                    s.addEmergencyChange({ ...newChange, id: Date.now() });
                    setNewChange({ type: 'Emergency', title: '', datetime: '', desc: '', impact: 'High', owner: '' });
                  }
                }}>Log Change</button>

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

        {/* Save / Load Builds */}
        <div className="pb-2">
          <button onClick={() => setBuildsOpen(o => !o)} className="w-full text-left text-xs text-white/60 hover:text-white/90 flex items-center gap-1 mb-1">
            <span>{buildsOpen ? '▾' : '▸'}</span> Saved Builds ({savedBuilds.length})
          </button>
          {buildsOpen && (
            <div className="bg-white/5 rounded-lg p-2 space-y-2 fade-in">
              <div className="text-xs text-white/40 leading-snug">Builds are saved locally in your browser. Export to Excel to share with your team.</div>
              {s.isBuilt && (
                <div className="flex gap-1">
                  <input
                    className="flex-1 text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 placeholder:text-white/30 focus:outline-none"
                    placeholder="Build name to save..."
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveBuild()}
                  />
                  <button className="btn-teal px-2 py-1 text-xs w-auto" onClick={handleSaveBuild} disabled={!saveName.trim()}>Save</button>
                </div>
              )}
              {savedBuilds.length === 0 && (
                <div className="text-xs text-white/30 text-center py-2">No saved builds yet</div>
              )}
              {savedBuilds.map(b => (
                <div key={b.id} className="bg-white/5 border border-white/10 rounded p-2 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white/80 truncate">{b.name}</div>
                    <div className="text-xs text-white/40">{b.ctx?.hw?.split(' ')[0] || '?'} / {b.ctx?.os?.split(' ')[0] || '?'} — {new Date(b.savedAt).toLocaleDateString()}</div>
                    <div className="flex gap-1 mt-1">
                      {b.isBuilt && <span className="badge badge-teal" style={{ fontSize: 9 }}>Built</span>}
                      {b.rtmSigned && <span className="badge badge-green" style={{ fontSize: 9 }}>RTM Signed</span>}
                      {b.promoted && <span className="badge badge-green" style={{ fontSize: 9 }}>Live</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button className="text-xs text-teal hover:text-white" onClick={() => handleLoadBuild(b)}>Load</button>
                    <button className="text-xs text-white/30 hover:text-red-400" onClick={() => handleDeleteBuild(b.id)}>Del</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export */}
        {s.isBuilt && (
          <div className="pb-4">
            <div className="section-hdr">Export</div>
            <button className="btn-green" onClick={handleExport}>Export to Excel (12 Sheets)</button>
          </div>
        )}
      </div>

      {showScan && <ScanModal onClose={() => setShowScan(false)} onComplete={handleScanComplete} />}
    </div>
  );
}
