import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore, DESIGN_SECTIONS, HW_OPTIONS, OS_OPTIONS, DB_OPTIONS, APP_OPTIONS } from '../store/useStore.js';
import { ALL_INC, FIXES } from '../lib/incidents.js';
import { ALL_UUM } from '../lib/uumItems.js';
import { getDefaultDesignValues } from '../lib/designDefaults.js';
import { exportExcel } from '../lib/exportExcel.js';
import { runSmartScan } from '../lib/smartScan.js';
import { matchSuggestKeys, buildContextSuggestions } from '../lib/suggestDb.js';
import { getEolInfo } from '../lib/eolData.js';
import { searchProducts, fetchProductCycles, cycleLiveStatus } from '../lib/eolApi.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { canUseFeature, buildLimitReached, incrementBuildCount } from '../lib/auth.js';
import { useBuildsDb } from '../lib/useBuildsDb.js';
import { FIREBASE_CONFIGURED } from '../lib/firebase.js';
import { GROQ_CONFIGURED } from '../lib/groqConfig.js';
import { searchUUMWithGroq, enrichCustomUUMWithGroq } from '../lib/groq.js';
import {
  detectLayersFromText, detectTypeFromText, detectPrimaryLayerFromText,
  detectSeverityFromText, detectIncidentGroupFromText,
  buildUUMDescription, buildUUMGroup,
  extractProductSlugs, formatEolDate,
} from '../lib/uumKeywordDetect.js';
import OrgPanel from './OrgPanel.jsx';
import { useCompatCheck } from '../lib/useCompatCheck.js';
import CompatWarning from './CompatWarning.jsx';

const LOCK_ICON = (
  <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
  </svg>
);

const SEV_COLOR = { CRITICAL: 'text-red-800 bg-red-50 border-red-300', HIGH: 'text-orange-800 bg-orange-50 border-orange-300', MEDIUM: 'text-amber-800 bg-amber-50 border-amber-300', LOW: 'text-green-800 bg-green-50 border-green-300', INFO: 'text-sky-800 bg-sky-50 border-sky-300' };
const SEV_BADGE = { CRITICAL: 'bg-red-600 text-white', HIGH: 'bg-orange-500 text-white', MEDIUM: 'bg-amber-500 text-white', LOW: 'bg-green-600 text-white', INFO: 'bg-sky-500 text-white' };

// Floating suggestion dropdown rendered via Portal — works outside overflow:hidden ancestors
function SuggestDropdown({ suggestions, onSelect, anchorEl, activeIdx = -1 }) {
  const [pos, setPos] = useState(null);
  const activeRef = useRef(null);

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

  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!suggestions.length || !pos) return null;

  return createPortal(
    <div className="suggest-dropdown" style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}>
      {suggestions.map((s, i) => (
        <div
          key={i}
          ref={i === activeIdx ? activeRef : null}
          className={`suggest-item${i === activeIdx ? ' bg-teal/20 !text-white font-semibold' : ''}`}
          onMouseDown={e => { e.preventDefault(); onSelect(s); }}
        >
          {s}
        </div>
      ))}
    </div>,
    document.body
  );
}

// Append EOL/EOS suffix to option label
function eolLabel(val) {
  const info = getEolInfo(val);
  if (!info || info.status === 'active' || info.status === 'unknown') return val;
  const tag = info.status === 'eol' ? ' ⚠ EOL' : ' ⚠ EOS Soon';
  return val + tag;
}

// HW → compatible OS matrix
const HW_OS_COMPAT = {
  'IBM Power10 / Power11': ['AIX 7.3', 'AIX 7.2', 'RHEL 9.x', 'RHEL 8.x', 'Ubuntu 24.04 LTS', 'Ubuntu 22.04 LTS', 'SUSE SLES 15 SP6'],
  'IBM Power9':            ['AIX 7.3', 'AIX 7.2', 'AIX 6.1 (EOL)', 'RHEL 9.x', 'RHEL 8.x', 'RHEL 7.x (EOL)', 'Ubuntu 22.04 LTS', 'SUSE SLES 15 SP6', 'SUSE SLES 12 SP5'],
  'IBM Power7 / Power8':   ['AIX 7.2', 'AIX 6.1 (EOL)', 'RHEL 7.x (EOL)', 'SUSE SLES 12 SP5'],
  'IBM z16 Mainframe':     ['z/OS 3.1', 'RHEL 9.x', 'Ubuntu 22.04 LTS'],
  'Oracle Exadata X10M':   ['Oracle Linux 9', 'RHEL 8.x'],
};

// Option-filtered input with keyboard nav + live endoflife.date API augmentation
function FilteredSuggestInput({ options, value, onChange, placeholder, className }) {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [liveSugs, setLiveSugs] = useState([]); // [{label, slug, cycle, liveStatus}]
  const [activeIdx, setActiveIdx] = useState(-1);
  const [liveLoading, setLiveLoading] = useState(false);
  const inputRef = useRef(null);
  const apiTimerRef = useRef(null);

  const allSuggestions = [
    ...suggestions,
    ...liveSugs.map(l => l.label).filter(l => !suggestions.includes(l)),
  ];

  function getStaticSuggestions(val) {
    if (!val || val.trim().length < 2) return options.slice(0, 6);
    const lower = val.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(lower)).slice(0, 6);
  }

  async function fetchLiveSuggestions(val) {
    if (val.trim().length < 3) { setLiveSugs([]); return; }
    setLiveLoading(true);
    try {
      const slugs = await searchProducts(val.trim().toLowerCase());
      const results = await Promise.all(
        slugs.slice(0, 4).map(async slug => {
          try {
            const cycles = await fetchProductCycles(slug);
            const best = cycles[0];
            const ls = cycleLiveStatus(best);
            const label = `${slug} ${best?.cycle || ''}`.trim();
            return { label, slug, cycle: best, liveStatus: ls };
          } catch { return null; }
        })
      );
      setLiveSugs(results.filter(Boolean));
    } catch { setLiveSugs([]); }
    finally { setLiveLoading(false); }
  }

  function handleChange(val) {
    onChange(val);
    const st = getStaticSuggestions(val);
    setSuggestions(st);
    setActiveIdx(-1);
    clearTimeout(apiTimerRef.current);
    if (val.trim().length >= 3) {
      apiTimerRef.current = setTimeout(() => fetchLiveSuggestions(val), 500);
    } else {
      setLiveSugs([]);
    }
  }

  function handleFocus() {
    setFocused(true);
    setSuggestions(getStaticSuggestions(value || ''));
  }

  function handleKeyDown(e) {
    if (!allSuggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, allSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      const pick = activeIdx >= 0 ? allSuggestions[activeIdx] : allSuggestions[0];
      if (pick) { e.preventDefault(); onChange(pick); setSuggestions([]); setLiveSugs([]); setActiveIdx(-1); }
    } else if (e.key === 'Escape') {
      setSuggestions([]); setLiveSugs([]); setActiveIdx(-1);
    }
  }

  function selectItem(s) { onChange(s); setSuggestions([]); setLiveSugs([]); setActiveIdx(-1); }

  const dropdownTop = (inputRef.current?.getBoundingClientRect().bottom ?? 0) + 4;
  const dropdownLeft = inputRef.current?.getBoundingClientRect().left ?? 0;
  const dropdownWidth = Math.max(inputRef.current?.getBoundingClientRect().width ?? 200, 320);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className={className || 'w-full text-xs bg-white/10 text-white border border-white/25 rounded px-2 py-1.5 placeholder:text-white/62 focus:outline-none focus:bg-white/15'}
        placeholder={placeholder}
        value={value || ''}
        onChange={e => handleChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={() => { setFocused(false); setTimeout(() => { setSuggestions([]); setLiveSugs([]); setActiveIdx(-1); }, 200); }}
        onKeyDown={handleKeyDown}
      />
      {focused && allSuggestions.length > 0 && createPortal(
        <div className="suggest-dropdown" style={{ position: 'fixed', top: dropdownTop, left: dropdownLeft, width: dropdownWidth, zIndex: 9999 }}>
          {suggestions.length > 0 && (
            <div className="px-2 py-1 text-xs text-white/40 uppercase tracking-wide border-b border-white/10">Catalog</div>
          )}
          {suggestions.map((s, i) => {
            const info = getEolInfo(s);
            const isActive = i === activeIdx;
            return (
              <div key={`s-${i}`} className={`suggest-item flex items-center justify-between gap-2${isActive ? ' bg-teal/20 !text-white font-semibold' : ''}`}
                onMouseDown={e => { e.preventDefault(); selectItem(s); }}>
                <span>{s}</span>
                {info && info.status !== 'active' && info.status !== 'unknown' && (
                  <span className={`text-xs font-bold flex-shrink-0 ${info.status === 'eol' ? 'text-red-400' : 'text-amber-400'}`}>
                    {info.status === 'eol' ? 'EOL' : 'EOS Soon'}
                  </span>
                )}
              </div>
            );
          })}
          {liveSugs.length > 0 && (
            <div className="px-2 py-1 text-xs text-teal/80 uppercase tracking-wide border-t border-white/10 border-b border-white/10">
              Live API{liveLoading ? ' …' : ''}
            </div>
          )}
          {liveSugs.map((item, i) => {
            const globalIdx = suggestions.length + i;
            const isActive = globalIdx === activeIdx;
            const statusColor = { eol: 'text-red-400', eos_soon: 'text-amber-400', eos: 'text-amber-400', active: 'text-green-400' };
            return (
              <div key={`l-${i}`} className={`suggest-item flex items-center justify-between gap-2${isActive ? ' bg-teal/20 !text-white font-semibold' : ''}`}
                onMouseDown={e => { e.preventDefault(); selectItem(item.label); }}>
                <span className="flex-1 truncate">{item.label}</span>
                <span className="text-xs text-teal/60 flex-shrink-0">API</span>
                {item.liveStatus && (
                  <span className={`text-xs font-bold flex-shrink-0 ${statusColor[item.liveStatus.status] || 'text-slate-400'}`}>
                    {item.liveStatus.label}
                  </span>
                )}
              </div>
            );
          })}
          {liveLoading && liveSugs.length === 0 && (
            <div className="px-3 py-2 text-xs text-teal/60 italic">Searching live API...</div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// Input with suggestion support — styled for dark panel
function SuggestInput({ fieldId, value, onChange, placeholder, type = 'text', className = '' }) {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef(null);
  const { ctx, sysDesignData, scanResults } = useStore();

  function getSuggestions(val) {
    return buildContextSuggestions(val, fieldId, ctx, sysDesignData, scanResults);
  }

  function handleKeyDown(e) {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter') {
      const pick = activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0];
      if (pick) { e.preventDefault(); onChange(pick); setSuggestions([]); setActiveIdx(-1); }
    } else if (e.key === 'Escape') { setSuggestions([]); setActiveIdx(-1); }
  }

  function handleChange(val) {
    onChange(val);
    setActiveIdx(-1);
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
        type={type}
        className={className || 'w-full text-xs bg-white/10 text-white border border-white/25 rounded px-2 py-1.5 placeholder:text-white/62 focus:outline-none focus:bg-white/15'}
        placeholder={placeholder}
        value={value || ''}
        onChange={e => handleChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={() => { setFocused(false); setTimeout(() => { setSuggestions([]); setActiveIdx(-1); }, 200); }}
        onKeyDown={handleKeyDown}
      />
      {focused && suggestions.length > 0 && (
        <SuggestDropdown
          suggestions={suggestions}
          onSelect={s => { onChange(s); setSuggestions([]); setActiveIdx(-1); }}
          anchorEl={inputRef.current}
          activeIdx={activeIdx}
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
        'w-full text-left px-3 py-2 rounded-md flex items-center gap-2 mb-0.5 transition-all duration-150',
        isCurrent
          ? 'bg-teal/20 border border-teal/40 shadow-sm'
          : active
            ? 'hover:bg-white/8'
            : 'hover:bg-white/8',
        locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {locked && LOCK_ICON}
      {!locked && active && !isCurrent && (
        <svg className="w-3 h-3 text-teal/80 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )}
      {isCurrent && (
        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-teal pulse-ring mt-0.5" />
      )}
      {!locked && !active && !isCurrent && (
        <span className="flex-shrink-0 w-2 h-2 rounded-full border border-white/20 mt-0.5" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-white/80 mb-0.5 leading-tight" style={{ fontSize: '11.5px' }}>{role}</div>
        <div className={['text-xs font-semibold leading-snug', isCurrent ? 'text-teal' : active ? 'text-white/90' : 'text-white/85'].join(' ')}>{label}</div>
      </div>
      {isCurrent && <span className="ml-auto text-teal/80 text-xs flex-shrink-0">▸</span>}
    </button>
  );
}

// StatusBadge for EOL status
function EolBadge({ status }) {
  if (!status) return null;
  const cfg = {
    eol:      { cls: 'bg-red-100 text-red-700 border-red-200',     label: 'EOL' },
    eos:      { cls: 'bg-amber-100 text-amber-700 border-amber-200', label: 'EOS' },
    eos_soon: { cls: 'bg-amber-100 text-amber-700 border-amber-200', label: 'EOS <12mo' },
    active:   { cls: 'bg-green-100 text-green-700 border-green-200', label: 'Supported' },
    unknown:  { cls: 'bg-slate-100 text-slate-500 border-slate-200', label: '?' },
  };
  const { cls, label } = cfg[status.status] || cfg.unknown;
  return <span className={`text-xs font-bold rounded px-1 py-0 border flex-shrink-0 ${cls}`}>{label}</span>;
}

function ItemList({ items, selected, onToggle, colorClass, onAiAdd = null }) {
  const [query, setQuery] = useState('');
  const [eolData, setEolData]   = useState([]); // [{slug, name, cycle, status}]
  const [aiData, setAiData]     = useState([]); // [{short, description, type, layer, grp}]
  const [eolLoading, setEolLoading] = useState(false);
  const [aiLoading, setAiLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const timerRef = useRef(null);

  // ── Multi-token catalog scoring ─────────────────────────────────────────────
  const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  const scored = tokens.length === 0
    ? items.map(i => ({ item: i, score: 1 }))
    : items.map(item => {
        const hay = (item.txt + ' ' + item.short + ' ' + (item.grp || '')).toLowerCase();
        const hits = tokens.filter(t => hay.includes(t)).length;
        return { item, score: hits };
      }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  const byGroup = {};
  scored.forEach(({ item, score }) => {
    if (!byGroup[item.grp]) byGroup[item.grp] = [];
    byGroup[item.grp].push({ ...item, _score: score });
  });

  // ── EOL badge for catalog items ─────────────────────────────────────────────
  // Checks if any fetched slug's name parts appear in a catalog item's text
  function catalogEolBadge(item) {
    if (!eolData.length) return null;
    const hay = (item.txt + ' ' + item.short).toLowerCase();
    for (const eol of eolData) {
      const parts = eol.slug.split('-').filter(p => p.length > 2);
      if (parts.some(p => hay.includes(p))) return eol.status;
    }
    return null;
  }

  // ── 600ms debounced parallel search ────────────────────────────────────────
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (query.length < 3) {
      setEolData([]); setAiData([]); setSearched(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setSearched(true);

      // ── EOL API: extract slugs → fetch cycles in parallel ──────────────────
      const slugs = extractProductSlugs(query);
      if (slugs.length) {
        setEolLoading(true);
        const results = await Promise.all(slugs.map(async slug => {
          try {
            const cycles = await fetchProductCycles(slug);
            const latest = cycles[0];
            return {
              slug,
              name: slug.replace(/-/g, ' '),
              cycle: latest,
              status: cycleLiveStatus(latest),
              allCycles: cycles.slice(0, 3),
            };
          } catch { return null; }
        }));
        setEolData(results.filter(Boolean));
        setEolLoading(false);
      } else {
        setEolData([]);
      }

      // ── Groq AI: only if configured ────────────────────────────────────────
      if (GROQ_CONFIGURED) {
        setAiLoading(true);
        try {
          const { results } = await searchUUMWithGroq(query);
          setAiData(results || []);
        } catch {
          setAiData([]);
        }
        setAiLoading(false);
      }
    }, 600);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const isSearching = tokens.length > 0;
  const catalogCount = scored.length;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white mb-2">

      {/* ── Search textarea ─────────────────────────────────────────────────── */}
      <div className={['p-2 border-b', isSearching ? 'bg-teal-50 border-teal-200' : 'border-slate-100'].join(' ')}>
        <textarea
          rows={2}
          className="w-full px-2 py-1.5 text-xs text-slate-800 bg-white border border-slate-200 rounded resize-none focus:outline-none focus:border-teal-400 placeholder:text-slate-400 leading-relaxed"
          placeholder={'Type any keywords — e.g. "sybase ase migration aix to rhel"\nSearches catalog + live EOL API + AI in parallel after 600ms'}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {isSearching && (
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="text-teal-600 font-medium">{catalogCount} catalog</span>
            {(eolLoading) && <span className="text-blue-500 animate-pulse">· fetching EOL API…</span>}
            {(!eolLoading && eolData.length > 0) && <span className="text-blue-600">· {eolData.length} EOL product{eolData.length !== 1 ? 's' : ''}</span>}
            {(GROQ_CONFIGURED && aiLoading) && <span className="text-amber-500 animate-pulse">· AI generating…</span>}
            {(GROQ_CONFIGURED && !aiLoading && aiData.length > 0) && <span className="text-amber-600">· {aiData.length} AI ops</span>}
          </div>
        )}
      </div>

      {/* ── Section 2: Live EOL API ─────────────────────────────────────────── */}
      {searched && (eolLoading || eolData.length > 0) && (
        <div className="border-b border-blue-200">
          <div className="px-3 py-1 text-xs font-bold text-blue-700 bg-blue-100 flex items-center gap-2">
            Live EOL API — endoflife.date
            {eolLoading && <span className="font-normal text-blue-500 animate-pulse">fetching…</span>}
          </div>
          <div className="max-h-36 overflow-y-auto">
            {eolData.map(eol => (
              <div key={eol.slug} className="px-3 py-2 border-b border-blue-50 flex items-start gap-2 hover:bg-blue-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="text-xs font-semibold text-slate-700 capitalize">{eol.name}</span>
                    <EolBadge status={eol.status} />
                    {eol.cycle && (
                      <span className="text-xs text-slate-400">
                        latest {eol.cycle.cycle} · EOL {formatEolDate(eol.cycle.eol)}
                      </span>
                    )}
                  </div>
                  {eol.allCycles?.length > 1 && (
                    <div className="flex gap-1 flex-wrap mt-0.5">
                      {eol.allCycles.slice(1).map(c => (
                        <span key={c.cycle} className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded px-1">
                          {c.cycle}: {formatEolDate(c.eol)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {onAiAdd && (
                  <button
                    onClick={() => onAiAdd({
                      short: `${eol.name.toUpperCase()} lifecycle management`,
                      description: `Plan and execute EOL upgrade/migration for ${eol.name}. Latest cycle: ${eol.cycle?.cycle || 'n/a'}, EOL: ${formatEolDate(eol.cycle?.eol)}. Status: ${eol.status.label}.`,
                      type: eol.status.status === 'eol' ? 'migration' : 'upgrade',
                      layer: detectPrimaryLayerFromText(eol.name),
                      grp: 'EOL/Lifecycle Operations',
                    })}
                    className="flex-shrink-0 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded px-2 py-0.5 mt-0.5 whitespace-nowrap"
                  >+ Add</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 3: AI-Generated Operations (Groq) ──────────────────────── */}
      {GROQ_CONFIGURED && searched && (aiLoading || aiData.length > 0) && (
        <div className="border-b border-amber-200">
          <div className="px-3 py-1 text-xs font-bold text-amber-700 bg-amber-100 flex items-center gap-2">
            ✦ AI-Generated Operations
            {aiLoading && <span className="font-normal text-amber-500 animate-pulse">generating…</span>}
          </div>
          <div className="max-h-40 overflow-y-auto">
            {aiData.map((r, i) => (
              <div key={i} className="px-3 py-2 border-b border-amber-50 flex items-start gap-2 hover:bg-amber-50">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-700">{r.short}</div>
                  <div className="text-xs text-slate-500 leading-snug">{r.description}</div>
                  <div className="text-xs text-amber-600 mt-0.5">{r.type} · {r.layer}</div>
                </div>
                {onAiAdd && (
                  <button
                    onClick={() => onAiAdd(r)}
                    className="flex-shrink-0 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded px-2 py-0.5 mt-0.5"
                  >+ Add</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 1: Catalog Matches ─────────────────────────────────────── */}
      <div className="max-h-48 overflow-y-auto">
        {Object.entries(byGroup).map(([grp, grpItems]) => (
          <div key={grp}>
            <div className="sticky top-0 bg-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider px-3 py-1 flex justify-between items-center">
              <span>{grp}</span>
              <span className="text-sky-400 text-xs cursor-pointer border border-sky-600 px-1.5 rounded hover:text-white"
                onClick={() => grpItems.forEach(i => !selected.includes(i.code) && onToggle(i.code))}>All</span>
            </div>
            {grpItems.map(item => {
              const sel = selected.includes(item.code);
              const eolBadge = catalogEolBadge(item);
              const showScore = isSearching && item._score > 1;
              return (
                <div key={item.code} className={['item-row flex items-start gap-2', sel ? colorClass : ''].join(' ')}>
                  {/* Toggle checkbox — clicking whole row or this */}
                  <span
                    onClick={() => onToggle(item.code)}
                    className={['flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center text-xs font-bold mt-0.5 cursor-pointer', sel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'].join(' ')}
                  >{sel ? '✓' : ''}</span>
                  <div className="min-w-0 flex-1" onClick={() => onToggle(item.code)} style={{ cursor: 'pointer' }}>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs font-medium text-slate-700 leading-snug">{item.short}</span>
                      {showScore && <span className="text-xs text-teal-600 font-semibold">{item._score}↑</span>}
                      {eolBadge && <EolBadge status={eolBadge} />}
                    </div>
                    <div className="text-xs text-slate-400 leading-snug" style={{ whiteSpace: 'normal' }}>
                      {item.txt.substring(item.short.length + 2)}
                    </div>
                  </div>
                  {/* Explicit + Add button */}
                  <button
                    onClick={e => { e.stopPropagation(); onToggle(item.code); }}
                    className={['flex-shrink-0 text-xs rounded px-1.5 py-0.5 mt-0.5 border transition-colors', sel ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-teal-100 hover:text-teal-700 hover:border-teal-300'].join(' ')}
                  >{sel ? '✓' : '+'}</button>
                </div>
              );
            })}
          </div>
        ))}
        {scored.length === 0 && (
          <div className="px-3 py-4 text-center">
            <div className="text-xs text-slate-400 mb-1">No catalog matches for "{query}"</div>
            <div className="text-xs text-slate-400">
              {GROQ_CONFIGURED ? 'AI search is running above — or use "Add Custom UUM" below.' : 'Use "Add Custom UUM / Operation" below to add it.'}
            </div>
          </div>
        )}
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
  const [autoCloseIn, setAutoCloseIn] = useState(null); // countdown seconds
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

  // Auto-apply results after 4 s so the modal never traps the user
  useEffect(() => {
    if (!done || !result) return;
    setAutoCloseIn(4);
    const iv = setInterval(() => setAutoCloseIn(n => {
      if (n <= 1) { clearInterval(iv); onComplete(result, result.suggestedInc || [], result.suggestedUUM || []); return 0; }
      return n - 1;
    }), 1000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

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
                      <span className={['font-bold uppercase text-xs rounded px-1 py-0.5', SEV_BADGE[f.sev] || SEV_BADGE.INFO].join(' ')}>{f.sev}</span>
                      <span className="font-semibold text-slate-800">{f.component}</span>
                    </div>
                    <div className="text-slate-700 leading-snug">{f.msg}</div>
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
                <button className="btn-teal flex-1" onClick={() => onComplete(result, result.suggestedInc || [], result.suggestedUUM || [])}>
                  Apply Results &amp; Unlock Design{autoCloseIn > 0 ? ` (${autoCloseIn}s)` : ''}
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
  const { authUser, setAuthUser, openAuthModal } = useAuth();
  const [showScan, setShowScan] = useState(false);
  const [activePhase, setActivePhase] = useState(null);
  const [hwCustom, setHwCustom] = useState('');
  const [osCustom, setOsCustom] = useState('');
  const [dbCustom, setDbCustom] = useState('');
  const [appCustom, setAppCustom] = useState('');
  const [hwSel, setHwSel] = useState('');
  const [osSel, setOsSel] = useState('');
  const [dbSel, setDbSel] = useState('');
  const [appSel, setAppSel] = useState('');

  // Listen for OpsMentor's "run scan" command → open the ScanModal popup
  useEffect(() => {
    const handler = () => { if (s.isBuilt && !s.scanComplete) setShowScan(true); };
    window.addEventListener('opsmanifest-run-scan', handler);
    return () => window.removeEventListener('opsmanifest-run-scan', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.isBuilt, s.scanComplete]);

  // Sync dropdowns + text inputs when OpsMentor sets ctx externally via SET_CTX.
  // Must update BOTH the <select> value (hwSel) AND the custom text (hwCustom) so the
  // field is visible — FilteredSuggestInput only renders when sel === '__custom'.
  useEffect(() => {
    const v = s.ctx?.hw; if (!v) return;
    if (HW_OPTIONS.includes(v)) { setHwSel(v); setHwCustom(''); }
    else { setHwSel('__custom'); setHwCustom(v); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.ctx?.hw]);
  useEffect(() => {
    const v = s.ctx?.os; if (!v) return;
    if (OS_OPTIONS.includes(v)) { setOsSel(v); setOsCustom(''); }
    else { setOsSel('__custom'); setOsCustom(v); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.ctx?.os]);
  useEffect(() => {
    const v = s.ctx?.db; if (!v) return;
    if (DB_OPTIONS.includes(v)) { setDbSel(v); setDbCustom(''); }
    else { setDbSel('__custom'); setDbCustom(v); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.ctx?.db]);
  useEffect(() => {
    const v = s.ctx?.app; if (!v) return;
    if (APP_OPTIONS.includes(v)) { setAppSel(v); setAppCustom(''); }
    else { setAppSel('__custom'); setAppCustom(v); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.ctx?.app]);
  const [reqOpen, setReqOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [customIncOpen, setCustomIncOpen] = useState(false);
  const [customUUMOpen, setCustomUUMOpen] = useState(false);
  const [buildsOpen, setBuildsOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const { builds: savedBuilds, saveBuild, deleteBuild: deleteBuildDb, shareToTeam, org, setOrg, syncing, syncError, cloudEnabled, teamEnabled } = useBuildsDb(authUser);
  const [newCustomInc, setNewCustomInc] = useState({ title: '', desc: '', sev: 'HIGH', owner: '' });
  const [newCustomUUM, setNewCustomUUM] = useState({ title: '', desc: '', layer: 'os', type: 'upgrade' });
  const [uumCompatOverride, setUumCompatOverride] = useState(false);
  const { hits: uumCompatHits, clear: clearUumCompat } = useCompatCheck(
    newCustomUUM.title + ' ' + newCustomUUM.desc, s.ctx
  );
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
    export:      'Download the full 13-sheet Excel workbook for stakeholder review.',
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
    const hw = hwCustom || (hwSel !== '' && hwSel !== '__custom' ? hwSel : hwCustom);
    const os = osCustom || (osSel !== '' && osSel !== '__custom' ? osSel : osCustom);
    const db = dbCustom || (dbSel !== '' && dbSel !== '__custom' ? dbSel : dbCustom);
    const app = appCustom || (appSel !== '' && appSel !== '__custom' ? appSel : appCustom);
    if (!hw || !os || !db || !app) return;
    // Only block signed-in users who've hit their plan's build limit
    if (authUser && buildLimitReached(authUser)) {
      openAuthModal('build_limit');
      return;
    }
    s.build({ hw, os, db, app });
    const defaults = getDefaultDesignValues({ hw, os, db, app });
    s.setAllDesignFields(defaults);
    const updated = incrementBuildCount(authUser);
    if (updated) setAuthUser(updated);
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

    // If live and RTM is stale — post-live change, rollback may be needed first
    if (s.promoted && s.rtmStale) {
      if (!window.confirm(
        'SYSTEM IS LIVE and RTM has become stale — new changes were detected after go-live.\n\n' +
        'If service quality has degraded or acceptance criteria are no longer met, execute your ROLLBACK PLAN first.\n\n' +
        'Proceed to RTM review anyway?'
      )) return;
    }

    // Gantt tasks stale before RTM sign-off
    if (!s.rtmSigned && s.tasksStaleReason) {
      if (!window.confirm(
        'Gantt tasks have changed since the implementation plan was generated.\n\n' +
        'Reason: ' + s.tasksStaleReason + '\n\n' +
        'Recommended: Open Gantt tab and regenerate tasks first to ensure all work is captured.\n\n' +
        'Continue to RTM review anyway?'
      )) return;
    }

    // Navigate to RTM tab — user reviews rows manually before signing
    s.setActiveTab('rtm');
  }

  function handleCutover() {
    if (!s.cabApproved || !s.rtmSigned) return;

    // RTM stale since signing — implementation scope may have drifted
    if (s.rtmStale) {
      if (!window.confirm(
        'RTM has changed since sign-off — the implementation scope may have drifted from what was accepted.\n\n' +
        'Recommended: Re-verify RTM rows before going live.\n\n' +
        'Proceed to production cutover anyway?'
      )) return;
    }

    // FAIL or BLOCKED rows — known acceptance gaps
    const failCount = Object.values(s.rtmRows || {}).filter(v => v === 'FAIL' || v === 'BLOCKED').length;
    if (failCount > 0) {
      if (!window.confirm(
        failCount + ' RTM row(s) are marked FAIL or BLOCKED.\n\n' +
        'Proceeding to cutover with known failures must be documented as accepted risk and approved by the PM.\n\n' +
        'Execute production cutover with accepted failures?'
      )) return;
    }

    s.promote();
    s.setActiveTab('closure');
  }

  function handleExport() {
    if (!canUseFeature(authUser, 'excel_export')) {
      openAuthModal('export');
      return;
    }
    try {
      exportExcel({
        ctx: s.ctx, selInc: s.selInc, selUUM: s.selUUM, selFix: s.selFix,
        promoted: s.promoted, cabApproved: s.cabApproved, rtmSigned: s.rtmSigned,
        sysDesignData: s.sysDesignData, sdAiTasks: s.sdAiTasks,
        requirements: s.requirements, emergencyChanges: s.emergencyChanges,
        customInc: s.customInc, customUUM: s.customUUM,
        customMentorTasks: s.customMentorTasks || [],
        customRaidEntries: s.customRaidEntries || [],
        vulnRegistry: s.vulnRegistry || [],
        stakeholderDiscussions: s.stakeholderDiscussions || [],
        actionAuditLog: s.actionAuditLog || [],
        rtmRows: s.rtmRows, liveEolData: s.liveEolData,
        isBuilt: s.isBuilt, phase2Active: s.phase2Active,
        cabDeclined: s.cabDeclined, rtmStale: s.rtmStale,
        selRegions: s.selRegions,
        fullExport: canUseFeature(authUser, 'excel_full'),
      });
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
  }

  function buildSnapshot(id, name) {
    return {
      id,
      name: name || id,
      email: authUser?.email || 'guest',
      savedAt: new Date().toISOString(),
      isBuilt: s.isBuilt, scanComplete: s.scanComplete, designApplied: s.designApplied,
      phase2Active: s.phase2Active, cabApproved: s.cabApproved, cabDeclined: s.cabDeclined,
      rtmSigned: s.rtmSigned, promoted: s.promoted,
      ctx: s.ctx, requirements: s.requirements, selRegions: s.selRegions,
      selInc: s.selInc, selUUM: s.selUUM, selFix: s.selFix,
      customInc: s.customInc, sysDesignData: s.sysDesignData, sdAiTasks: s.sdAiTasks,
      scanResults: s.scanResults, rtmRows: s.rtmRows,
      closureChecks: s.closureChecks, closureNotes: s.closureNotes,
      emergencyChanges: s.emergencyChanges, lockedDesignFields: s.lockedDesignFields,
      changePeriods: s.changePeriods, ganttOverrides: s.ganttOverrides,
      unlockedForRevision: s.unlockedForRevision, tasksStaleReason: s.tasksStaleReason,
      rtmStale: s.rtmStale, roleAssignments: s.roleAssignments,
    };
  }

  async function handleSaveBuild() {
    if (!saveName.trim()) return;
    const id = String(Date.now());
    await saveBuild(buildSnapshot(id, saveName.trim()));
    s.setCurrentBuildId(id);
    s.markClean();
    setSaveName('');
  }

  async function handleUpdateBuild() {
    if (!s.currentBuildId) return;
    const existing = savedBuilds.find(b => b.id === s.currentBuildId);
    if (!existing) return;
    await saveBuild(buildSnapshot(s.currentBuildId, existing.name));
    s.markClean();
  }

  function handleLoadBuild(build) {
    if (s.isDirty && !window.confirm(`Load build "${build.name}"? Unsaved changes to current build will be lost.`)) return;
    if (!s.isDirty && !window.confirm(`Load build "${build.name}"?`)) return;
    s.loadBuild(build);
    s.setCurrentBuildId(build.id);
    setBuildsOpen(false);
  }

  async function handleDeleteBuild(id) {
    await deleteBuildDb(id);
  }

  async function handleCopyBuild(build) {
    const newId = String(Date.now());
    const copy = { ...build, id: newId, name: `${build.name} (copy)`, savedAt: new Date().toISOString() };
    await saveBuild(copy);
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
    ['PM Email', 'pmEmail', 'text', null, null],
    ['PM Backup Email', 'pmBackupEmail', 'text', null, null],
  ];

  return (
    <div className="w-full bg-navy text-white flex flex-col overflow-hidden" style={{ height: '100vh' }}>
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-teal flex-shrink-0" />
          <div className="text-sm font-bold text-white tracking-tight">OpsManifest</div>
          <button
            onClick={s.toggleTheme}
            className="ml-auto w-6 h-6 rounded flex items-center justify-center text-white/62 hover:text-white/90 hover:bg-white/8 transition-all"
            title={s.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {s.theme === 'dark' ? '☀' : '🌙'}
          </button>
        </div>
        <div className="text-xs text-white/78 pl-4 leading-snug">Infrastructure Lifecycle Engine</div>
      </div>

      {/* Phase nav */}
      <div className="px-3 py-2 flex-shrink-0 border-b border-white/10">
        {phases.map(p => (
          <PhasePill key={p.id} label={p.label} role={p.role} locked={p.locked} active={p.active}
            isCurrent={p.id === currentPhaseId}
            onClick={() => setActivePhase(activePhase === p.id ? null : p.id)} />
        ))}
      </div>

      {/* Guidemark — current stage hint */}
      <div className="px-4 py-3 flex-shrink-0 border-b border-white/10 bg-teal/5">
        <div className="text-xs text-teal font-bold uppercase tracking-wide mb-1">Current stage</div>
        <div className="text-xs text-white/80 leading-relaxed">{PHASE_HINTS[currentPhaseId]}</div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-6">

        {/* Phase 1 */}
        <div>
          <div className="section-hdr">1 · Phase 1 — Platform Topology</div>

          {/* Requirements */}
          <button onClick={() => setReqOpen(!reqOpen)} className="w-full text-left text-xs font-medium text-white/75 hover:text-white mb-1.5 flex items-center gap-1.5">
            <span className="text-white/82 text-xs">{reqOpen ? '▾' : '▸'}</span> Requirements
          </button>
          {reqOpen && (
            <div className="bg-white/5 rounded-lg p-3 mb-2 space-y-2 fade-in">
              {reqFields.map(([label, key, type, opts, suggestId]) => (
                <div key={key}>
                  <label className="text-xs font-medium text-white/82 block mb-1">{label}</label>
                  {type === 'select' ? (
                    <select
                      className="w-full text-xs bg-white/10 text-white border border-white/25 rounded px-2 py-1.5 focus:outline-none focus:bg-white/15"
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
                      className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 placeholder:text-white/52 focus:outline-none"
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
          <div className="space-y-2.5">
            {/* Hardware */}
            <div>
              <label className="text-xs font-medium text-white/82 block mb-1">Hardware</label>
              <select
                className="w-full text-xs bg-white/10 text-white border border-white/25 rounded px-2 py-1.5 mb-1 focus:outline-none focus:bg-white/15"
                value={hwSel}
                onChange={e => { setHwSel(e.target.value); setHwCustom(''); setOsSel(''); setOsCustom(''); }}
              >
                <option value="">— Select Hardware —</option>
                {HW_OPTIONS.map(o => <option key={o} value={o}>{eolLabel(o)}</option>)}
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
                    <label className="text-xs font-medium text-white/82 block mb-1">
                      OS
                      {isFiltered && <span className="ml-1 text-teal/80 font-normal text-xs">(filtered for {effectiveHW.split(' ')[0]} {effectiveHW.split(' ')[1] || ''})</span>}
                    </label>
                    <select
                      className="w-full text-xs bg-white/10 text-white border border-white/25 rounded px-2 py-1.5 mb-1 focus:outline-none focus:bg-white/15"
                      value={osSel}
                      onChange={e => { setOsSel(e.target.value); setOsCustom(''); }}
                    >
                      <option value="">— Select OS —</option>
                      {compatOS.map(o => <option key={o} value={o}>{eolLabel(o)}</option>)}
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
              <label className="text-xs font-medium text-white/82 block mb-1">Database</label>
              <select
                className="w-full text-xs bg-white/10 text-white border border-white/25 rounded px-2 py-1.5 mb-1 focus:outline-none focus:bg-white/15"
                value={dbSel}
                onChange={e => { setDbSel(e.target.value); setDbCustom(''); }}
              >
                <option value="">— Select Database —</option>
                {DB_OPTIONS.map(o => <option key={o} value={o}>{eolLabel(o)}</option>)}
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
              <label className="text-xs font-medium text-white/82 block mb-1">Application</label>
              <select
                className="w-full text-xs bg-white/10 text-white border border-white/25 rounded px-2 py-1.5 mb-1 focus:outline-none focus:bg-white/15"
                value={appSel}
                onChange={e => { setAppSel(e.target.value); setAppCustom(''); }}
              >
                <option value="">— Select Application —</option>
                {APP_OPTIONS.map(o => <option key={o} value={o}>{eolLabel(o)}</option>)}
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
          {/* Regions in scope */}
          <div className="mt-2">
            <label className="text-xs font-medium text-white/82 block mb-1.5">Regions in Scope</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'Production', label: 'Production', color: 'border-red-500/50 text-red-300' },
                { id: 'Model', label: 'Model', color: 'border-amber-500/50 text-amber-300' },
                { id: 'QA/Dev', label: 'QA / Dev', color: 'border-blue-500/50 text-blue-300' },
                { id: 'Integration', label: 'Integration', color: 'border-green-500/50 text-green-300' },
              ].map(({ id, label, color }) => {
                const active = s.selRegions.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? s.selRegions.filter(r => r !== id)
                        : [...s.selRegions, id];
                      s.setSelRegions(next.length ? next : [id]);
                    }}
                    className={['text-xs rounded border px-2 py-0.5 transition-colors', active ? `${color} bg-white/10 font-semibold` : 'border-white/10 text-white/52'].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {s.selRegions.length > 0 && (
              <div className="text-xs text-white/52 mt-0.5">{s.selRegions.join(' · ')}</div>
            )}
          </div>

          {/* Project start date */}
          <div className="mt-2">
            <label className="text-xs font-medium text-white/82 block mb-1">Project Start Date</label>
            <input
              type="date"
              className="w-full text-xs bg-white/10 text-white border border-white/25 rounded px-2 py-1.5 focus:outline-none focus:bg-white/15"
              value={s.requirements.projectStartDate || ''}
              onChange={e => s.setRequirements({ ...s.requirements, projectStartDate: e.target.value })}
            />
          </div>

          <button className="btn-teal mt-2" onClick={handleBuild}>Build Environment</button>
        </div>

        {/* AI Scan */}
        <div>
          <div className="section-hdr">2 · AI Smart Scan</div>
          {!s.isBuilt ? (
            <div className="text-xs text-white/40 flex items-center gap-2 py-1 mb-2">{LOCK_ICON} Build environment first</div>
          ) : !s.scanComplete ? (
            <div>
              <div className="text-xs text-white/82 mb-2 leading-relaxed">
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

        {/* AI suggestion acceptance banner */}
        {aiSuggestBanner && (
          <div className="rounded-lg p-2.5 fade-in" style={{ background: 'rgba(30,58,138,0.75)', border: '1px solid #3b82f6' }}>
            <div className="text-xs font-bold mb-1" style={{ color: '#93c5fd' }}>AI Pre-Selected Items</div>
            <div className="text-xs leading-snug mb-2.5" style={{ color: '#e0f0ff' }}>
              {aiSuggestBanner.inc.length} incident{aiSuggestBanner.inc.length !== 1 ? 's' : ''} + {aiSuggestBanner.uum.length} UUM item{aiSuggestBanner.uum.length !== 1 ? 's' : ''} matched to your stack. Review below and deselect any that don't apply.
            </div>
            <button
              className="text-xs border rounded px-2 py-0.5 mr-2 transition-colors"
              style={{ color: '#93c5fd', borderColor: '#3b82f6' }}
              onClick={() => setAiSuggestBanner(null)}
            >Dismiss</button>
            <button
              className="text-xs transition-colors"
              style={{ color: '#fca5a5' }}
              onClick={() => {
                aiSuggestBanner.inc.forEach(code => { if (s.selInc.includes(code)) s.toggleInc(code); });
                aiSuggestBanner.uum.forEach(code => { if (s.selUUM.includes(code)) s.toggleUUM(code); });
                setAiSuggestBanner(null);
              }}
            >Clear AI selections</button>
          </div>
        )}

        {/* Phase 2 */}
        <div>
          <div className="section-hdr text-red-400 border-red-500 bg-red-500/5">3 · Phase 2 — Incidents + UUM</div>
          {!s.isBuilt ? (
            <div className="text-xs text-white/40 flex items-center gap-2 py-1 mb-2">{LOCK_ICON} Build environment first</div>
          ) : (
          <>
            {s.scanComplete && !s.phase2Active && (
              <div className="text-xs text-green-300 bg-green-900/20 border border-green-800 rounded p-2 mb-2">
                System Design is now open. Start Phase 2 after design sign-off.
              </div>
            )}

            <div className="text-xs font-semibold text-white/85 mb-1">Select Incidents</div>
            <div className="text-xs text-white/75 mb-1.5">{s.selInc.length} selected</div>
            <ItemList items={ALL_INC} selected={s.selInc} onToggle={s.toggleInc} colorClass="bg-red-900/30 border-l-2 border-red-500" />

            {s.selInc.length > 0 && (
              <>
                <div className="text-xs font-semibold text-white/85 mt-3 mb-1.5">Fix Runbooks</div>
                {s.selInc.map(code => {
                  const inc = ALL_INC.find(i => i.code === code);
                  if (!inc) return null;
                  const sel = s.selFix.includes(code);
                  return (
                    <div key={code} onClick={() => s.toggleFix(code)}
                      className={['text-xs rounded p-2 mb-1 cursor-pointer border', sel ? 'bg-green-900/30 border-green-700 text-green-300' : 'bg-white/5 border-white/10 text-white/82'].join(' ')}>
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
              className="w-full text-left text-xs font-medium text-white/82 hover:text-white flex items-center gap-1.5 mt-2 mb-1.5"
            >
              <span className="text-white/62">{customIncOpen ? '▾' : '▸'}</span> Add Custom Incident / Ticket
            </button>
            {customIncOpen && (() => {
                const incText = newCustomInc.title + ' ' + newCustomInc.desc;
                const detectedSev = newCustomInc.title.length >= 3 ? detectSeverityFromText(incText) : null;
                const detectedGrp = newCustomInc.title.length >= 3 ? detectIncidentGroupFromText(incText) : null;
                const detectedLayers = newCustomInc.title.length >= 3 ? detectLayersFromText(incText) : [];
                return (
                  <div className="bg-white/5 rounded-lg p-2 mb-2 space-y-1.5 fade-in">
                    <div>
                      <label className="text-xs text-white/82 block mb-0.5">Title / Incident Description</label>
                      <SuggestInput fieldId="title" value={newCustomInc.title}
                        onChange={v => setNewCustomInc(p => ({ ...p, title: v }))}
                        placeholder="e.g. Oracle DB alert log showing ORA-04031 shared pool exhausted" />
                    </div>
                    {/* Smart inference preview */}
                    {newCustomInc.title.length >= 4 && (
                      <div className="bg-teal-900/30 border border-teal-600/30 rounded px-2 py-1.5 text-xs">
                        <div className="text-teal-300 font-semibold mb-0.5">Detected from your description:</div>
                        <div className="flex flex-wrap gap-1">
                          {detectedLayers.map(l => <span key={l} className="bg-teal-700/40 text-teal-200 rounded px-1.5 py-0.5">{l.toUpperCase()}</span>)}
                          {detectedSev && <span className={['rounded px-1.5 py-0.5 font-bold', detectedSev === 'CRITICAL' ? 'bg-red-800/60 text-red-200' : detectedSev === 'HIGH' ? 'bg-amber-700/60 text-amber-200' : 'bg-slate-700/60 text-slate-200'].join(' ')}>{detectedSev}</span>}
                          {detectedGrp && <span className="bg-slate-700/60 text-slate-300 rounded px-1.5 py-0.5">{detectedGrp}</span>}
                        </div>
                        <div className="text-white/50 mt-0.5">Fix runbook tasks will match detected layers — override below if needed</div>
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-white/82 block mb-0.5">Full Description / Ticket Scope</label>
                      <SuggestInput fieldId="desc" value={newCustomInc.desc}
                        onChange={v => setNewCustomInc(p => ({ ...p, desc: v }))}
                        placeholder="Which system, database, version, error code, or service is affected?" />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-white/82 block mb-0.5">Severity
                          {detectedSev && <span className="ml-1 text-teal-400">(auto-detected)</span>}
                        </label>
                        <select className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
                          value={newCustomInc.sev || detectedSev || 'HIGH'}
                          onChange={e => setNewCustomInc(p => ({ ...p, sev: e.target.value }))}>
                          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-white/82 block mb-0.5">Assigned Owner</label>
                        <SuggestInput fieldId="owner" value={newCustomInc.owner}
                          onChange={v => setNewCustomInc(p => ({ ...p, owner: v }))}
                          placeholder="Team or person" />
                      </div>
                    </div>
                    <button
                      className="btn-amber w-full mt-1"
                      onClick={() => {
                        if (!newCustomInc.title.trim()) return;
                        const id = `custom_${Date.now()}`;
                        const layers = detectLayersFromText(newCustomInc.title + ' ' + newCustomInc.desc);
                        const sev = newCustomInc.sev || detectSeverityFromText(newCustomInc.title + ' ' + newCustomInc.desc);
                        const grp = detectIncidentGroupFromText(newCustomInc.title + ' ' + newCustomInc.desc);
                        s.addCustomInc({
                          id, code: id,
                          short: newCustomInc.title.substring(0, 60),
                          txt: `${newCustomInc.title}${newCustomInc.desc ? ': ' + newCustomInc.desc : ''}`,
                          grp,
                          sev,
                          owner: newCustomInc.owner,
                          layers,
                        });
                        s.toggleInc(id);
                        setNewCustomInc({ title: '', desc: '', sev: 'HIGH', owner: '' });
                        setCustomIncOpen(false);
                      }}
                    >Add & Select</button>
                  </div>
                );
              })()}

            {/* Custom incidents display */}
            {s.customInc?.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-white/82 mb-1">Custom Entries ({s.customInc.length})</div>
                {s.customInc.map(ci => {
                  const sel = s.selInc.includes(ci.code);
                  return (
                    <div key={ci.id} className={['text-xs rounded p-1.5 mb-1 cursor-pointer border flex items-start gap-2', sel ? 'bg-amber-900/30 border-amber-700 text-amber-200' : 'bg-white/5 border-white/10 text-white/78'].join(' ')}
                      onClick={() => s.toggleInc(ci.code)}>
                      <span className={['flex-shrink-0 w-3 h-3 rounded border flex items-center justify-center text-xs font-bold mt-0.5', sel ? 'bg-amber-500 border-amber-500 text-white' : 'border-white/30'].join(' ')}>{sel ? '✓' : ''}</span>
                      <div>
                        <div className="font-medium">{ci.short}</div>
                        <div className="text-white/58 text-xs">{ci.sev} — {ci.owner || 'Unassigned'}</div>
                      </div>
                      <button className="ml-auto text-white/52 hover:text-red-400 text-xs" onClick={e => { e.stopPropagation(); s.removeCustomInc(ci.id); if (sel) s.toggleInc(ci.code); }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-xs font-semibold text-white/85 mt-4 mb-1">Schedule UUM Items</div>
            <div className="text-xs text-white/75 mb-1.5">{s.selUUM.length} selected</div>

            {/* Custom UUM entries display */}
            {(s.customUUM?.length > 0) && (
              <div className="mb-2">
                <div className="text-xs text-white/82 mb-1">Custom UUM Entries ({s.customUUM.length})</div>
                {s.customUUM.map(cu => {
                  const sel = s.selUUM.includes(cu.id);
                  return (
                    <div key={cu.id} className={['text-xs rounded p-1.5 mb-1 cursor-pointer border flex items-start gap-2', sel ? 'bg-amber-900/30 border-amber-700 text-amber-200' : 'bg-white/5 border-white/10 text-white/78'].join(' ')}
                      onClick={() => s.toggleUUM(cu.id)}>
                      <span className={['flex-shrink-0 w-3 h-3 rounded border flex items-center justify-center text-xs font-bold mt-0.5', sel ? 'bg-amber-500 border-amber-500 text-white' : 'border-white/30'].join(' ')}>{sel ? '✓' : ''}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{cu.short}</div>
                        <div className="text-white/58 text-xs">
                          {cu.type} — {cu.layer}
                          {cu.enriching && <span className="ml-1 text-teal-400 animate-pulse">✦ enriching…</span>}
                          {cu.enriched && cu.aiTasks?.length > 0 && <span className="ml-1 text-teal-300">✦ {cu.aiTasks.length} tasks</span>}
                        </div>
                      </div>
                      <button className="ml-auto text-white/52 hover:text-red-400 text-xs flex-shrink-0" onClick={e => { e.stopPropagation(); s.removeCustomUUM(cu.id); }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}

            <ItemList
              items={ALL_UUM}
              selected={s.selUUM}
              onToggle={s.toggleUUM}
              colorClass="bg-amber-900/30 border-l-2 border-amber-500"
              onAiAdd={(r) => {
                const id = `custom_uum_${Date.now()}`;
                const layers = detectLayersFromText((r.short || '') + ' ' + (r.description || '') + ' ' + (r.grp || ''));
                const layer  = r.layer || detectPrimaryLayerFromText((r.short || '') + ' ' + (r.description || ''));
                const type   = r.type || detectTypeFromText((r.short || '') + ' ' + (r.description || ''));
                const grp    = r.grp || buildUUMGroup(layers, type);
                const txt    = buildUUMDescription(r.short, r.description, layers, type);
                s.addCustomUUM({ id, short: r.short?.substring(0, 60), txt, grp, layer, type, layers, enriching: GROQ_CONFIGURED });
                s.toggleUUM(id);
                if (GROQ_CONFIGURED) {
                  enrichCustomUUMWithGroq(r.short, r.description, layer, type)
                    .then(({ enriched }) => s.updateCustomUUM(id, { txt: enriched.description || txt, aiTasks: enriched.tasks || [], risks: enriched.risks || [], prerequisites: enriched.prerequisites || [], enriching: false, enriched: true }))
                    .catch(() => s.updateCustomUUM(id, { enriching: false }));
                }
              }}
            />

            {/* Add Custom UUM form */}
            <button
              onClick={() => setCustomUUMOpen(o => !o)}
              className="w-full text-left text-xs font-medium text-white/82 hover:text-white flex items-center gap-1.5 mt-1 mb-1.5"
            >
              <span className="text-white/62">{customUUMOpen ? '▾' : '▸'}</span> Add Custom UUM / Operation
            </button>
            {customUUMOpen && (() => {
              const uumText = newCustomUUM.title + ' ' + newCustomUUM.desc;
              // Auto-detect layers and type from what the user typed
              const autoLayers = newCustomUUM.title.length >= 3 ? detectLayersFromText(uumText) : [];
              const autoType   = newCustomUUM.title.length >= 3 ? detectTypeFromText(uumText) : null;
              const autoPrimary = autoLayers.length ? detectPrimaryLayerFromText(uumText) : null;
              // Smart catalog match: find catalog items with 2+ keyword hits
              const tokens = newCustomUUM.title.toLowerCase().split(/\s+/).filter(t => t.length > 2);
              const similar = tokens.length >= 2 ? ALL_UUM.filter(u => {
                const hay = (u.txt + ' ' + u.short).toLowerCase();
                return tokens.filter(t => hay.includes(t)).length >= 2;
              }).slice(0, 3) : [];
              const effectiveLayer = newCustomUUM.layer !== 'os' ? newCustomUUM.layer : (autoPrimary || 'os');
              const effectiveType  = newCustomUUM.type  !== 'upgrade' ? newCustomUUM.type  : (autoType  || 'upgrade');
              return (
                <div className="bg-white/5 rounded-lg p-2 mb-2 space-y-1.5 fade-in">
                  {/* Similar catalog items */}
                  {similar.length > 0 && (
                    <div className="bg-amber-900/40 border border-amber-600 rounded p-1.5">
                      <div className="text-xs text-amber-300 font-semibold mb-1">Similar operations already in catalog — click to select:</div>
                      {similar.map(u => (
                        <div key={u.code} className="text-xs text-amber-200 flex items-center gap-1.5 mb-0.5 cursor-pointer hover:text-white"
                          onClick={() => { if (!s.selUUM.includes(u.code)) s.toggleUUM(u.code); setCustomUUMOpen(false); setNewCustomUUM({ title: '', desc: '', layer: 'os', type: 'upgrade' }); }}>
                          <span className="text-amber-400">↩</span> <strong>{u.short}</strong>: {u.txt.substring(u.short.length + 2, u.short.length + 70)}
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-white/82 block mb-0.5">Operation Title</label>
                    <input
                      className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1.5 focus:outline-none focus:border-teal-400 placeholder:text-white/40"
                      placeholder="e.g. Sybase ASE 15.7 migration from AIX 7.2 to RHEL 9.4"
                      value={newCustomUUM.title}
                      onChange={e => setNewCustomUUM(p => ({ ...p, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/82 block mb-0.5">Scope / Version Details</label>
                    <input
                      className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1.5 focus:outline-none focus:border-teal-400 placeholder:text-white/40"
                      placeholder="Source system, target, versions, data size, estimated downtime"
                      value={newCustomUUM.desc}
                      onChange={e => setNewCustomUUM(p => ({ ...p, desc: e.target.value }))}
                    />
                  </div>
                  {/* Smart inference preview */}
                  {newCustomUUM.title.length >= 4 && (
                    <div className="bg-teal-900/30 border border-teal-600/30 rounded px-2 py-1.5 text-xs">
                      <div className="text-teal-300 font-semibold mb-1">Detected from your description — override below if needed:</div>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {autoLayers.map(l => <span key={l} className="bg-teal-700/40 text-teal-200 rounded px-1.5 py-0.5">{l.toUpperCase()}</span>)}
                        {autoType && <span className="bg-indigo-700/50 text-indigo-200 rounded px-1.5 py-0.5">{autoType}</span>}
                      </div>
                      <div className="text-white/50">Gantt tasks will be generated for: {autoLayers.join(', ')} · {autoType}</div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-white/82 block mb-0.5">Primary Layer
                        {autoPrimary && autoPrimary !== newCustomUUM.layer && <span className="ml-1 text-teal-400">(auto)</span>}
                      </label>
                      <select className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
                        value={effectiveLayer}
                        onChange={e => setNewCustomUUM(p => ({ ...p, layer: e.target.value }))}>
                        {['os','db','app','web','security','storage','hardware','network','backup'].map(l => (
                          <option key={l} value={l}>{l.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-white/82 block mb-0.5">Type
                        {autoType && autoType !== newCustomUUM.type && <span className="ml-1 text-teal-400">(auto)</span>}
                      </label>
                      <select className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
                        value={effectiveType}
                        onChange={e => setNewCustomUUM(p => ({ ...p, type: e.target.value }))}>
                        {['upgrade','migration','update','patch'].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {/* Inline compatibility warning */}
                  <CompatWarning
                    hits={uumCompatHits}
                    overriding={uumCompatOverride}
                    dark
                    onOverride={() => setUumCompatOverride(true)}
                    onDismiss={() => { setNewCustomUUM(p => ({ ...p, title: '', desc: '' })); setUumCompatOverride(false); }}
                  />
                  <button
                    className={`btn-amber w-full mt-1 ${uumCompatHits.length > 0 && !uumCompatOverride ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={uumCompatHits.length > 0 && !uumCompatOverride}
                    onClick={async () => {
                      if (!newCustomUUM.title.trim()) return;
                      if (uumCompatHits.length > 0 && !uumCompatOverride) return;
                      const id = `custom_uum_${Date.now()}`;
                      const uumTxt = newCustomUUM.title + ' ' + newCustomUUM.desc;
                      const finalLayers = detectLayersFromText(uumTxt);
                      const finalType   = detectTypeFromText(uumTxt);
                      const finalLayer  = detectPrimaryLayerFromText(uumTxt);
                      const finalGrp    = buildUUMGroup(finalLayers, finalType);
                      const finalTxt    = buildUUMDescription(newCustomUUM.title, newCustomUUM.desc, finalLayers, finalType);
                      const entry = {
                        id,
                        short: newCustomUUM.title.substring(0, 60),
                        txt: finalTxt,
                        grp: finalGrp,
                        layer: finalLayer,
                        type: finalType,
                        layers: finalLayers,
                        enriching: GROQ_CONFIGURED,
                      };
                      s.addCustomUUM(entry);
                      s.toggleUUM(id);
                      // Auto-RAID risk if user overrode a compat warning
                      if (uumCompatOverride && uumCompatHits.length > 0) {
                        uumCompatHits.forEach(rule => {
                          const refs = (rule.refs || []).map(r => r.label).join('; ');
                          s.addCustomRaidEntry({
                            id: `compat-risk-${Date.now()}-${rule.id}`,
                            type: 'RISK',
                            severity: rule.severity === 'critical' ? 'CRITICAL' : 'HIGH',
                            description: `[Compat Override] ${rule.title} — added custom UUM entry "${newCustomUUM.title.substring(0, 50)}" despite vendor restriction.`,
                            mitigation: `Verify against vendor PAM before proceeding. Refs: ${refs}`,
                            status: 'OPEN',
                            owner: 'PM / Architect',
                            addedAt: new Date().toISOString(),
                          });
                        });
                      }
                      const saved = { title: newCustomUUM.title, desc: newCustomUUM.desc, layer: finalLayer, type: finalType };
                      setNewCustomUUM({ title: '', desc: '', layer: 'os', type: 'upgrade' });
                      setUumCompatOverride(false);
                      clearUumCompat();
                      setCustomUUMOpen(false);
                      if (GROQ_CONFIGURED) {
                        try {
                          const { enriched } = await enrichCustomUUMWithGroq(saved.title, saved.desc, saved.layer, saved.type);
                          s.updateCustomUUM(id, {
                            txt: enriched.description || finalTxt,
                            aiTasks: enriched.tasks || [],
                            risks: enriched.risks || [],
                            prerequisites: enriched.prerequisites || [],
                            enriching: false,
                            enriched: true,
                          });
                        } catch {
                          s.updateCustomUUM(id, { enriching: false });
                        }
                      }
                    }}
                  >{GROQ_CONFIGURED ? 'Add & Enrich with AI' : 'Add & Generate Tasks'}</button>
                </div>
              );
            })()}

            {/* Injection summary + confirm */}
            {!s.phase2Active && (s.selInc.length > 0 || s.selUUM.length > 0) && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-2 mt-2 text-xs text-white/78">
                <div className="font-semibold text-white/80 mb-1">Ready to inject to this build:</div>
                {s.selInc.length > 0 && <div className="text-red-300">{s.selInc.length} incident{s.selInc.length > 1 ? 's' : ''}</div>}
                {s.selUUM.length > 0 && <div className="text-amber-300">{s.selUUM.length} UUM item{s.selUUM.length > 1 ? 's' : ''}</div>}
                {s.selFix.length > 0 && <div className="text-green-300">{s.selFix.length} fix runbook{s.selFix.length > 1 ? 's' : ''}</div>}
              </div>
            )}
            <button className="btn-red mt-1" disabled={s.selInc.length === 0 || s.phase2Active} onClick={handleInjectIncidents}>
              {s.phase2Active ? 'Phase 2 Active' : `Inject to Build (${s.selInc.length} inc + ${s.selUUM.length} UUM)`}
            </button>
          </>
          )}
        </div>

        {/* CAB Gate */}
        <div>
          <div className="section-hdr">4 · CAB Gate</div>
          {!s.phase2Active ? (
            <div className="text-xs text-white/40 flex items-center gap-2 py-1 mb-2">{LOCK_ICON} Inject Phase 2 first</div>
          ) : (
          <>
            <div className={['rounded-lg border p-2', s.cabApproved ? 'border-green-600 bg-green-900/20' : s.cabDeclined ? 'border-red-500 bg-red-900/30' : 'border-red-600 bg-red-900/20'].join(' ')}>
              <label className="text-xs text-white/78 block mb-1">CAB Authorization</label>
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
            {s.cabDeclined && !s.unlockedForRevision && (
              <div className="mt-2 space-y-1.5">
                <div className="text-xs text-amber-300/80 mb-1 leading-snug">After rollback is complete, unlock tabs to revise scope, design, or requirements before resubmitting.</div>
                <button
                  className="btn-amber"
                  onClick={() => s.setUnlockedForRevision(true)}
                >Unlock Tabs for Revision</button>
                {canUseFeature(authUser, 'save_builds') && (
                  <button
                    className="btn-primary mt-1"
                    onClick={() => s.setCabApproved(true)}
                  >Quick Change — PM Override (skip CAB re-review)</button>
                )}
              </div>
            )}
            {s.cabDeclined && s.unlockedForRevision && (
              <div className="mt-2 space-y-1.5 fade-in">
                <div className="flex items-center gap-1.5 rounded bg-amber-500/15 border border-amber-500/30 px-2 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
                  <span className="text-xs text-amber-300 font-semibold">Revision Mode — all tabs unlocked</span>
                </div>
                <div className="text-xs text-amber-200/70 leading-snug">Update any tab — requirements, system design, incidents, tasks — then resubmit to CAB.</div>
                <button
                  className="btn-teal"
                  onClick={() => s.resubmitCAB()}
                >Resubmit to CAB</button>
              </div>
            )}
          </>
          )}
        </div>

        {/* RTM Sign-Off */}
        <div>
          <div className="section-hdr">5 · RTM Sign-Off</div>
          {!s.phase2Active ? (
            <div className="text-xs text-white/40 flex items-center gap-2 py-1 mb-2">{LOCK_ICON} Inject Phase 2 first</div>
          ) : (
          <>
            {/* Gantt stale — warn before sign-off */}
            {!s.rtmSigned && s.tasksStaleReason && (
              <div className="bg-amber-900/20 border border-amber-600/40 rounded-lg p-2 mb-2 text-xs fade-in">
                <div className="text-amber-300 font-semibold mb-0.5">Gantt tasks have changed</div>
                <div className="text-amber-200/70 leading-snug mb-1">{s.tasksStaleReason}</div>
                <div className="text-amber-300/80 text-xs leading-snug">Regenerate tasks before signing RTM to ensure implementation scope is current and complete.</div>
                <button className="btn-amber mt-1.5 text-xs py-0.5" onClick={() => s.setActiveTab('gantt')}>Open Gantt to Regenerate →</button>
              </div>
            )}

            {/* RTM FAIL/BLOCKED rows pre-warning */}
            {!s.rtmSigned && (() => {
              const failCount = Object.values(s.rtmRows || {}).filter(v => v === 'FAIL' || v === 'BLOCKED').length;
              return failCount > 0 ? (
                <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-2 mb-2 text-xs fade-in">
                  <div className="text-red-300 font-semibold">{failCount} row{failCount > 1 ? 's' : ''} FAIL / BLOCKED in RTM</div>
                  <div className="text-red-200/70 leading-snug">Resolve or document as accepted risk before signing off.</div>
                </div>
              ) : null;
            })()}

            {/* Post-live RTM stale — rollback warning */}
            {s.promoted && s.rtmStale && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-2 mb-2 text-xs fade-in">
                <div className="text-red-300 font-bold mb-0.5">LIVE — RTM Has Become Stale</div>
                <div className="text-red-200/70 leading-snug mb-1">Changes were made after go-live. If service quality has degraded or acceptance criteria are no longer met, execute rollback immediately.</div>
                <button className="btn-red text-xs py-0.5" onClick={() => s.setActiveTab('closure')}>Assess Rollback in Closure →</button>
              </div>
            )}

            <button className={s.rtmSigned ? 'btn-teal' : 'btn-amber'} disabled={s.rtmSigned} onClick={handleRtmSignoff}>
              {s.rtmSigned ? 'RTM Signed Off' : 'Review & Sign Off RTM'}
            </button>
          </>
          )}
        </div>

        {/* Cutover */}
        <div>
          <div className="section-hdr">6 · Production Cutover</div>
          {!s.rtmSigned ? (
            <div className="text-xs text-white/40 flex items-center gap-2 py-1 mb-2">{LOCK_ICON} Complete RTM sign-off first</div>
          ) : (
          <>

            {/* RTM stale since signing */}
            {s.rtmStale && !s.promoted && (
              <div className="bg-amber-900/20 border border-amber-600/40 rounded-lg p-2 mb-2 text-xs fade-in">
                <div className="text-amber-300 font-semibold">RTM Changed Since Sign-Off</div>
                <div className="text-amber-200/70 leading-snug">Re-verify RTM acceptance criteria before cutting over to production.</div>
              </div>
            )}

            {/* Gantt stale + ready for cutover */}
            {s.tasksStaleReason && !s.promoted && (
              <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-2 mb-2 text-xs fade-in">
                <div className="text-amber-300 font-semibold">Gantt Tasks Stale</div>
                <div className="text-amber-200/70 leading-snug">Verify all implementation tasks are complete before going live.</div>
              </div>
            )}

            <button className={s.promoted ? 'btn-green' : 'btn-primary'} disabled={s.promoted || !s.cabApproved} onClick={handleCutover}>
              {s.promoted ? 'Production STABLE' : 'Execute Production Cutover'}
            </button>
            {!s.cabApproved && <div className="text-xs text-red-400 mt-1">BLOCKED: CAB approval required first</div>}
          </>
          )}
        </div>

        {/* Emergency Changes */}
        {s.isBuilt && (
          <div>
            <button onClick={() => setEmergencyOpen(!emergencyOpen)} className="w-full text-left text-xs font-medium text-white/75 hover:text-white flex items-center gap-1.5 mb-1.5">
              <span className="text-white/62">{emergencyOpen ? '▾' : '▸'}</span> Emergency / Manual Changes
            </button>
            {emergencyOpen && (
              <div className="bg-white/5 rounded-lg p-2 space-y-1.5 fade-in">
                {/* Type */}
                <div>
                  <label className="text-xs text-white/82 block mb-0.5">Type</label>
                  <select className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
                    value={newChange.type} onChange={e => setNewChange({ ...newChange, type: e.target.value })}>
                    {['Emergency', 'Weekend', 'Weekday', 'Out-of-Band'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                {/* Title with suggestions */}
                <div>
                  <label className="text-xs text-white/82 block mb-0.5">Title</label>
                  <SuggestInput fieldId="title" value={newChange.title} onChange={v => setNewChange({ ...newChange, title: v })} placeholder="Change title" />
                </div>
                {/* Date/Time */}
                <div>
                  <label className="text-xs text-white/82 block mb-0.5">Date / Time</label>
                  <input type="datetime-local" className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
                    value={newChange.datetime} onChange={e => setNewChange({ ...newChange, datetime: e.target.value })} />
                </div>
                {/* Description with suggestions */}
                <div>
                  <label className="text-xs text-white/82 block mb-0.5">Description</label>
                  <SuggestInput fieldId="desc" value={newChange.desc} onChange={v => setNewChange({ ...newChange, desc: v })} placeholder="Describe the change" />
                </div>
                {/* Impact */}
                <div>
                  <label className="text-xs text-white/82 block mb-0.5">Impact Level</label>
                  <select className="w-full text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
                    value={newChange.impact} onChange={e => setNewChange({ ...newChange, impact: e.target.value })}>
                    {['Critical', 'High', 'Medium', 'Low'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                {/* Owner with suggestions */}
                <div>
                  <label className="text-xs text-white/82 block mb-0.5">Owner</label>
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
                      <div key={c.id} className="text-xs text-white/78 border border-white/10 rounded p-1.5 mb-1">
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

        {/* Team org panel — Team+ users */}
        {teamEnabled && authUser && (
          <OrgPanel
            authUser={authUser}
            org={org}
            setOrg={setOrg}
            builds={savedBuilds}
            shareToTeam={shareToTeam}
            currentBuildId={s.currentBuildId}
          />
        )}

        {/* Save / Load Builds */}
        <div className="pb-2">
          <button onClick={() => setBuildsOpen(o => !o)} className="w-full text-left text-xs font-medium text-white/75 hover:text-white flex items-center gap-1.5 mb-1.5">
            <span className="text-white/62">{buildsOpen ? '▾' : '▸'}</span> Saved Builds ({savedBuilds.length})
          </button>
          {buildsOpen && (
            <div className="bg-white/5 rounded-lg p-2 space-y-2 fade-in">
              <div className="text-xs text-white/78 leading-relaxed">
                {cloudEnabled
                  ? 'Builds sync to cloud and IndexedDB.'
                  : 'Builds saved in browser IndexedDB.'}
                {' '}Export to Excel to share with your team.
              </div>
              {syncing && <div className="text-xs text-teal/80 animate-pulse">Syncing with cloud...</div>}
              {syncError && <div className="text-xs text-red-400">Sync error: {syncError}</div>}
              {cloudEnabled && !syncing && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                  <span className="text-xs text-green-400">Cloud sync active</span>
                </div>
              )}
              {!cloudEnabled && FIREBASE_CONFIGURED && authUser && (
                <div className="text-xs text-amber-400">Cloud sync requires Professional+ plan.</div>
              )}

              {/* Unsaved changes banner */}
              {s.isDirty && s.currentBuildId && s.isBuilt && (
                <div className="flex items-center justify-between rounded bg-amber-500/10 border border-amber-500/25 px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                    <span className="text-xs text-amber-300">Unsaved changes</span>
                  </div>
                  <button className="text-xs text-amber-300 hover:text-white font-semibold" onClick={handleUpdateBuild}>
                    Update Build
                  </button>
                </div>
              )}

              {s.isBuilt && !authUser && (
                <div className="bg-white/8 border border-white/15 rounded-lg p-2 text-center">
                  <div className="text-xs text-white/70 mb-1.5">Sign in free to save this build</div>
                  <button
                    className="btn-teal w-full text-xs py-1"
                    onClick={() => openAuthModal('save')}
                  >Sign In — Free, no card</button>
                </div>
              )}
              {s.isBuilt && authUser && (
                <div className="flex gap-1">
                  <input
                    className="flex-1 text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 placeholder:text-white/52 focus:outline-none"
                    placeholder="Save as new build..."
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveBuild()}
                  />
                  <button className="btn-teal px-2 py-1 text-xs w-auto" onClick={handleSaveBuild} disabled={!saveName.trim()}>Save</button>
                </div>
              )}
              {savedBuilds.length === 0 && (
                <div className="text-xs text-white/52 text-center py-2">No saved builds yet</div>
              )}
              {savedBuilds.map(b => (
                <div key={b.id} className="bg-white/5 border border-white/10 rounded p-2 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white/80 truncate">{b.name}</div>
                    <div className="text-xs text-white/58">{b.ctx?.hw?.split(' ')[0] || '?'} / {b.ctx?.os?.split(' ')[0] || '?'} / {b.ctx?.db?.split(' ')[0] || '?'} — {new Date(b.savedAt).toLocaleDateString()}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {b.isBuilt && <span className="badge badge-teal" style={{ fontSize: 9 }}>Built</span>}
                      {b.designApplied && <span className="badge badge-blue" style={{ fontSize: 9 }}>Design</span>}
                      {b.cabApproved && <span className="badge badge-green" style={{ fontSize: 9 }}>CAB</span>}
                      {b.rtmSigned && <span className="badge badge-green" style={{ fontSize: 9 }}>RTM</span>}
                      {b.promoted && <span className="badge badge-green" style={{ fontSize: 9 }}>Live</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button className="text-xs text-teal hover:text-white font-medium" onClick={() => handleLoadBuild(b)}>Load</button>
                    <button
                      className="text-xs text-white/62 hover:text-teal"
                      title="Copy this build — creates a new build with the same configuration"
                      onClick={() => handleCopyBuild(b)}
                    >Copy</button>
                    <button className="text-xs text-white/52 hover:text-red-400" onClick={() => handleDeleteBuild(b.id)}>Del</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export */}
        <div className="pb-4">
          <div className="section-hdr">7 · Export</div>
          {!s.isBuilt ? (
            <div className="text-xs text-white/40 flex items-center gap-2 py-1">{LOCK_ICON} Build environment first</div>
          ) : (
            <button className="btn-green" onClick={handleExport}>Export to Excel (12 Sheets)</button>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.10)', padding: '12px 16px 14px', marginTop: 'auto' }}>
        <p style={{ fontSize: '10.5px', lineHeight: '1.6', color: 'rgba(255,255,255,0.72)', margin: 0 }}>
          OpsManifest guides infra teams through structured provisioning workflows — not a replacement for ITSM, CMDB, or platforms such as ServiceNow, Jira, or Confluence.
        </p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
          <a href="/slides.html" target="_blank" rel="noopener" style={{ fontSize: '10.5px', color: 'rgba(13,148,136,0.70)', textDecoration: 'none' }}>About ↗</a>
          <a href="/privacy.html" target="_blank" rel="noopener" style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}>Privacy</a>
          <a href="/tos.html" target="_blank" rel="noopener" style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}>Terms</a>
          <a href="/sla.html" target="_blank" rel="noopener" style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}>SLA</a>
          <a href="/msa.html" target="_blank" rel="noopener" style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}>MSA</a>
          <a href="/dpa.html" target="_blank" rel="noopener" style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}>DPA</a>
          <a href="/aup.html" target="_blank" rel="noopener" style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}>AUP</a>
        </div>
      </div>

      {showScan && <ScanModal onClose={() => setShowScan(false)} onComplete={handleScanComplete} />}
    </div>
  );
}
