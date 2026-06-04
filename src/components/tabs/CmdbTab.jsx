import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../../store/useStore.js';
import { useAuth } from '../../lib/AuthContext.jsx';
import { canUseFeature } from '../../lib/auth.js';
import { getEolInfo } from '../../lib/eolData.js';
import { ALL_INC } from '../../lib/incidents.js';
import { ALL_UUM } from '../../lib/uumItems.js';
import {
  fetchComponentLiveData,
  searchProducts,
  fetchProductCycles,
  cycleLiveStatus,
  EOL_SLUG_MAP,
} from '../../lib/eolApi.js';

// ── Lifecycle helpers ──────────────────────────────────────────────────────────

function daysUntil(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const diff = Math.round((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

function DaysChip({ days }) {
  if (days === null) return null;
  if (days < 0) return <span className="text-xs font-bold text-red-500">Expired</span>;
  if (days < 90) return <span className="text-xs font-bold text-red-500">{days}d left</span>;
  if (days < 365) return <span className="text-xs font-bold text-amber-500">{days}d left</span>;
  return <span className="text-xs text-slate-400">{Math.round(days / 30)}mo left</span>;
}

// Security-only period: support has ended but EOL has not
function securityOnlyStatus(cycle) {
  if (!cycle) return false;
  const today = new Date();
  const eos = typeof cycle.support === 'string' ? new Date(cycle.support) : null;
  const eol = typeof cycle.eol === 'string' ? new Date(cycle.eol) : null;
  return eos && eol && eos < today && eol > today;
}

function ExtendedSupportChip({ cycle }) {
  if (!cycle?.extendedSupport) return <span className="text-xs text-slate-300">—</span>;
  if (typeof cycle.extendedSupport === 'boolean') {
    return <span className="text-xs text-green-500">Available</span>;
  }
  const days = daysUntil(cycle.extendedSupport);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-green-500">Until {cycle.extendedSupport}</span>
      {days !== null && <DaysChip days={days} />}
    </div>
  );
}

function LtsBadge({ cycle }) {
  if (!cycle?.lts) return <span className="text-xs text-slate-300">—</span>;
  if (typeof cycle.lts === 'boolean') return <span className="badge badge-green text-xs">LTS</span>;
  const days = daysUntil(cycle.lts);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="badge badge-green text-xs">LTS</span>
      {days !== null && days > 0 && <span className="text-xs text-slate-400">until {cycle.lts}</span>}
    </div>
  );
}

// ── UUM Keyword Matcher ────────────────────────────────────────────────────────

function UumKeywordMatcher({ selUUM, toggleUUM }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [apiResults, setApiResults] = useState([]); // live endoflife.date results
  const [apiLoading, setApiLoading] = useState(false);
  const timerRef = useRef(null);

  function searchUUM(q) {
    if (q.trim().length < 3) { setMatches([]); return; }
    const lower = q.toLowerCase();
    const scored = ALL_UUM
      .map(u => {
        const text = `${u.txt} ${u.grp} ${u.short}`.toLowerCase();
        const wordScore = lower.split(/\s+/).filter(w => w.length > 2)
          .reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
        return { uum: u, score: wordScore };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ uum }) => uum);
    setMatches(scored);
  }

  async function searchApi(q) {
    if (q.trim().length < 3) { setApiResults([]); return; }
    setApiLoading(true);
    try {
      const slugs = await searchProducts(q.trim().toLowerCase());
      const results = await Promise.all(
        slugs.slice(0, 4).map(async slug => {
          try {
            const cycles = await fetchProductCycles(slug);
            const recent = cycles.slice(0, 2);
            return { slug, cycles: recent };
          } catch { return null; }
        })
      );
      setApiResults(results.filter(Boolean));
    } catch { setApiResults([]); }
    finally { setApiLoading(false); }
  }

  function handleInput(e) {
    const v = e.target.value;
    setQuery(v);
    searchUUM(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => searchApi(v), 600);
  }

  const typeColor = { upgrade: 'badge-blue', migration: 'badge-amber', update: 'badge-green' };
  const statusColor = { eol: 'badge-red', eos_soon: 'badge-amber', eos: 'badge-amber', active: 'badge-green' };

  return (
    <div className="card overflow-hidden mb-4">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
        <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">Project Keywords to UUM Matcher</div>
        <span className="text-xs text-slate-400">type any tech/project description to find relevant UUM items + live API context</span>
      </div>
      <div className="p-4">
        <input
          type="text"
          value={query}
          onChange={handleInput}
          placeholder="e.g. oracle migration aix linux, tomcat upgrade java, rhel eol ..."
          className="w-full text-sm border border-slate-200 rounded px-3 py-2 focus:outline-none focus:border-teal-400 mb-3"
        />
        {query.length >= 3 && matches.length === 0 && !apiLoading && (
          <div className="text-xs text-slate-400 text-center py-2">No UUM items matched — try other keywords</div>
        )}
        {matches.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Matched UUM Items ({matches.length})
            </div>
            <div className="space-y-1.5">
              {matches.map(uum => {
                const added = selUUM.includes(uum.code);
                return (
                  <div key={uum.code} className={`flex items-center gap-2 p-2 rounded-lg border ${added ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-white'} hover:bg-slate-50`}>
                    <button
                      onClick={() => toggleUUM(uum.code)}
                      className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${added ? 'border-teal-500 bg-teal-500 text-white' : 'border-slate-300 hover:border-teal-400'}`}
                      title={added ? 'Remove from selection' : 'Add to UUM list'}
                    >
                      {added ? (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      ) : (
                        <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                      )}
                    </button>
                    <span className={`badge ${typeColor[uum.type] || 'badge-slate'} text-xs flex-shrink-0`}>{uum.type || 'update'}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-600 mr-1">{uum.short}</span>
                      <span className="text-xs text-slate-600">{uum.txt?.substring(uum.short.length + 2, 80)}</span>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{uum.grp}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {(apiResults.length > 0 || apiLoading) && (
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              Live API Context
              {apiLoading && <span className="text-teal-500 italic font-normal">Fetching...</span>}
            </div>
            {apiResults.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b border-slate-200">
                      {['Product', 'Cycle', 'Latest', 'EOS', 'EOL', 'LTS', 'Ext Support', 'Status'].map(h => (
                        <th key={h} className="pb-1.5 pr-4 font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {apiResults.flatMap(({ slug, cycles }) =>
                      cycles.map((cycle, i) => {
                        const ls = cycleLiveStatus(cycle);
                        const isSecOnly = securityOnlyStatus(cycle);
                        return (
                          <tr key={`${slug}-${i}`} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2 pr-4 font-bold text-teal-700">{slug}</td>
                            <td className="py-2 pr-4 font-semibold text-slate-700">{cycle.cycle}</td>
                            <td className="py-2 pr-4 text-slate-600">{cycle.latest || '—'}</td>
                            <td className="py-2 pr-4 text-slate-500">
                              <div>{typeof cycle.support === 'string' ? cycle.support : (cycle.support === false ? 'Ended' : '—')}</div>
                              {typeof cycle.support === 'string' && <DaysChip days={daysUntil(cycle.support)} />}
                            </td>
                            <td className="py-2 pr-4">
                              <div className={typeof cycle.eol === 'string' && daysUntil(cycle.eol) < 0 ? 'font-bold text-red-600' : 'text-slate-600'}>
                                {typeof cycle.eol === 'boolean' ? (cycle.eol ? 'Yes' : 'No') : (cycle.eol || '—')}
                              </div>
                              {typeof cycle.eol === 'string' && <DaysChip days={daysUntil(cycle.eol)} />}
                            </td>
                            <td className="py-2 pr-4"><LtsBadge cycle={cycle} /></td>
                            <td className="py-2 pr-4"><ExtendedSupportChip cycle={cycle} /></td>
                            <td className="py-2">
                              <div className="flex flex-col gap-0.5">
                                <span className={`badge ${statusColor[ls.status] || 'badge-slate'}`}>{ls.label}</span>
                                {isSecOnly && <span className="badge badge-amber text-xs">Security Only</span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const LAYER_CI = {
  hw: 'Hardware', unix: 'Operating System', os: 'Operating System',
  web: 'Web / HTTP', app: 'Application', db: 'Database',
  storage: 'Storage', stor: 'Storage', backup: 'Backup / DR', bk: 'Backup / DR',
  network: 'Network', net: 'Network', security: 'Security', sec: 'Security',
};

function resolveLayer(layerArr) {
  const types = new Set();
  (layerArr || []).forEach(l => { const ci = LAYER_CI[l.toLowerCase()]; if (ci) types.add(ci); });
  return [...types];
}

function EolBadge({ component }) {
  const info = getEolInfo(component);
  if (!info) return null;
  const cls = { active: 'badge-green', eos_soon: 'badge-amber', eol: 'badge-red', unknown: 'badge-slate' };
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className={`badge ${cls[info.status] || 'badge-slate'}`}>{info.label}</span>
      {info.date && <span className="text-xs text-slate-400">{info.date}</span>}
    </div>
  );
}

function LiveStatusBadge({ cycle, loading, error }) {
  if (loading) return <span className="text-xs text-slate-400 italic">Fetching...</span>;
  if (error) return <span className="text-xs text-slate-300">API unavailable</span>;
  if (!cycle) return <span className="text-xs text-slate-300">No data</span>;
  const { status, label, color } = cycleLiveStatus(cycle);
  const colors = { red: 'badge-red', amber: 'badge-amber', green: 'badge-green' };
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`badge ${colors[color] || 'badge-slate'}`}>{label}</span>
      {cycle.latest && <span className="text-xs text-slate-400">Latest: {cycle.latest}</span>}
      {status !== 'active' && cycle.eol && typeof cycle.eol === 'string' && (
        <span className="text-xs text-slate-400">EOL: {cycle.eol}</span>
      )}
    </div>
  );
}

function CiRow({ ci, idx, liveEntry }) {
  const incBadges = ci.incidents.slice(0, 3);
  const uumBadges = ci.uums.slice(0, 3);
  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
  const eolInfo = getEolInfo(ci.component);
  const hasAlert = eolInfo?.status === 'eol' || eolInfo?.status === 'eos_soon';
  const liveStatus = liveEntry?.matchedCycle ? cycleLiveStatus(liveEntry.matchedCycle) : null;
  const hasLiveAlert = liveStatus && (liveStatus.status === 'eol' || liveStatus.status === 'eos_soon');

  return (
    <tr className={[
      'border-b border-slate-100 transition-colors hover:bg-blue-50/20',
      rowBg,
      (hasAlert || hasLiveAlert) ? 'border-l-2 border-l-amber-400' : '',
    ].join(' ')}>
      <td className="py-2.5 px-3 w-10">
        <span className="text-xs font-mono text-slate-400">{String(idx + 1).padStart(2, '0')}</span>
      </td>
      <td className="py-2.5 px-3 w-32">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{ci.type}</span>
      </td>
      <td className="py-2.5 px-3">
        <div className="text-xs font-semibold text-slate-800">{ci.component || '—'}</div>
        {ci.detail && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{ci.detail}</div>}
        {liveEntry?.slug && (
          <div className="text-xs text-teal-500 mt-0.5">
            API: endoflife.date/{liveEntry.slug}
          </div>
        )}
      </td>
      <td className="py-2.5 px-3 w-36">
        <EolBadge component={ci.component} />
      </td>
      <td className="py-2.5 px-3 w-36">
        <LiveStatusBadge
          cycle={liveEntry?.matchedCycle}
          loading={liveEntry?.loading}
          error={liveEntry?.error}
        />
      </td>
      <td className="py-2.5 px-3 w-44">
        {incBadges.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {incBadges.map(code => <span key={code} className="badge badge-red text-xs">{code}</span>)}
            {ci.incidents.length > 3 && <span className="text-xs text-slate-400">+{ci.incidents.length - 3}</span>}
          </div>
        ) : <span className="text-xs text-slate-300">None</span>}
      </td>
      <td className="py-2.5 px-3 w-44">
        {uumBadges.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {uumBadges.map(code => <span key={code} className="badge badge-amber text-xs">{code}</span>)}
            {ci.uums.length > 3 && <span className="text-xs text-slate-400">+{ci.uums.length - 3}</span>}
          </div>
        ) : <span className="text-xs text-slate-300">None</span>}
      </td>
      <td className="py-2.5 px-3 w-28">
        <span className="text-xs text-slate-500">{ci.owner}</span>
      </td>
    </tr>
  );
}

function FlowNode({ label, sub, color, alert }) {
  const colors = {
    navy: 'bg-[#1A2E4A] text-white border-[#1A2E4A]',
    teal: 'bg-teal-600 text-white border-teal-600',
    amber: 'bg-amber-100 text-amber-800 border-amber-300',
    green: 'bg-green-100 text-green-800 border-green-300',
    slate: 'bg-slate-100 text-slate-700 border-slate-300',
    red: 'bg-red-100 text-red-800 border-red-400',
  };
  return (
    <div className={['rounded-lg border-2 px-3 py-2 text-center min-w-[100px] relative', colors[color] || colors.slate, alert ? 'ring-2 ring-red-400 ring-offset-1' : ''].join(' ')}>
      <div className="text-xs font-bold leading-tight">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5 leading-tight">{sub}</div>}
      {alert && <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">!</div>}
    </div>
  );
}

function Arrow({ dir = 'down' }) {
  return (
    <div className={`flex ${dir === 'down' ? 'flex-col items-center' : 'flex-row items-center'}`}>
      <div className={dir === 'down' ? 'w-0.5 h-4 bg-slate-300' : 'h-0.5 w-4 bg-slate-300'} />
      <svg className={`w-3 h-3 text-slate-400 flex-shrink-0 ${dir === 'right' ? 'rotate-[-90deg]' : ''}`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </div>
  );
}

// ── Live API search panel ───────────────────────────────────────────────────────

function LiveApiSearch() {
  const [query, setQuery] = useState('');
  const [indexLoaded, setIndexLoaded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]); // [{ slug, cycles }]
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  async function doSearch(q) {
    if (q.length < 3) { setResults([]); return; }
    setSearching(true);
    setError('');
    try {
      const slugs = await searchProducts(q);
      setIndexLoaded(true);
      if (!slugs.length) { setResults([]); setSearching(false); return; }
      const fetched = await Promise.all(
        slugs.map(async slug => {
          try {
            const cycles = await fetchProductCycles(slug);
            return { slug, cycles: cycles.slice(0, 4) };
          } catch { return { slug, cycles: [] }; }
        })
      );
      setResults(fetched.filter(r => r.cycles.length > 0));
    } catch (e) {
      setError('endoflife.date API unavailable — check network or CORS');
    } finally {
      setSearching(false);
    }
  }

  function handleInput(e) {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(v.trim().toLowerCase()), 500);
  }

  const statusColor = { eol: 'badge-red', eos_soon: 'badge-amber', eos: 'badge-amber', active: 'badge-green', unknown: 'badge-slate' };

  return (
    <div className="card overflow-hidden mb-4">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
        <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">Live Lifecycle Search</div>
        <span className="text-xs text-slate-400">endoflife.date API</span>
        {searching && <span className="text-xs text-teal-500 italic">Querying API...</span>}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
      <div className="p-4">
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={query}
            onChange={handleInput}
            placeholder="Search any product (e.g. oracle, nginx, rhel, postgresql)..."
            className="flex-1 text-xs border border-slate-200 rounded px-3 py-2 focus:outline-none focus:border-teal-400"
          />
        </div>
        {results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b border-slate-200">
                  {['Product', 'Cycle', 'Latest', 'Released', 'EOS', 'EOL', 'LTS', 'Ext Support', 'Sec Only?', 'Status'].map(h => (
                    <th key={h} className="pb-2 pr-3 font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.flatMap(({ slug, cycles }) =>
                  cycles.map((cycle, i) => {
                    const ls = cycleLiveStatus(cycle);
                    const isSecOnly = securityOnlyStatus(cycle);
                    return (
                      <tr key={`${slug}-${i}`} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 pr-3 font-bold text-teal-700 uppercase whitespace-nowrap">{slug}</td>
                        <td className="py-2 pr-3 font-semibold text-slate-700">{cycle.cycle}</td>
                        <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{cycle.latest || 'N/A'}</td>
                        <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{cycle.releaseDate || '—'}</td>
                        <td className="py-2 pr-3">
                          <div className="text-slate-500 whitespace-nowrap">
                            {typeof cycle.support === 'boolean' ? (cycle.support ? 'Ongoing' : 'Ended') : (cycle.support || '—')}
                          </div>
                          {typeof cycle.support === 'string' && <DaysChip days={daysUntil(cycle.support)} />}
                        </td>
                        <td className="py-2 pr-3">
                          <div className={`font-semibold whitespace-nowrap ${ls.status === 'eol' ? 'text-red-600' : 'text-slate-600'}`}>
                            {typeof cycle.eol === 'boolean' ? (cycle.eol ? 'Yes' : 'No') : (cycle.eol || '—')}
                          </div>
                          {typeof cycle.eol === 'string' && <DaysChip days={daysUntil(cycle.eol)} />}
                        </td>
                        <td className="py-2 pr-3"><LtsBadge cycle={cycle} /></td>
                        <td className="py-2 pr-3"><ExtendedSupportChip cycle={cycle} /></td>
                        <td className="py-2 pr-3">
                          {isSecOnly
                            ? <span className="badge badge-amber text-xs whitespace-nowrap">Sec Only</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2">
                          <span className={`badge ${statusColor[ls.status] || 'badge-slate'} whitespace-nowrap`}>{ls.label}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {query.length >= 3 && !searching && results.length === 0 && !error && (
          <div className="text-xs text-slate-400 text-center py-3">No products found matching "{query}"</div>
        )}
        {query.length < 3 && (
          <div className="text-xs text-slate-400">Type 3+ characters to search the live endoflife.date database (500+ products)</div>
        )}
      </div>
    </div>
  );
}

// ── Stack Live Check panel ──────────────────────────────────────────────────────

function StackLiveCheck({ stackComponents, liveEolData, setLiveEolData }) {
  const [fetching, setFetching] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const hasMappings = stackComponents.some(c => EOL_SLUG_MAP[c]);

  const fetchAll = useCallback(async () => {
    const toFetch = stackComponents.filter(c => EOL_SLUG_MAP[c] && !liveEolData[c]?.fetchedAt);
    if (!toFetch.length) return;
    setFetching(true);
    await Promise.all(toFetch.map(async component => {
      setLiveEolData(component, { loading: true });
      try {
        const data = await fetchComponentLiveData(component);
        setLiveEolData(component, data ? { ...data, fetchedAt: Date.now() } : { error: 'Not found', fetchedAt: Date.now() });
      } catch {
        setLiveEolData(component, { error: 'Fetch failed', fetchedAt: Date.now() });
      }
    }));
    setLastFetch(new Date().toLocaleTimeString());
    setFetching(false);
  }, [stackComponents, liveEolData, setLiveEolData]);

  async function refreshAll() {
    stackComponents.filter(c => EOL_SLUG_MAP[c]).forEach(c => setLiveEolData(c, {}));
    setFetching(true);
    await Promise.all(stackComponents.filter(c => EOL_SLUG_MAP[c]).map(async component => {
      setLiveEolData(component, { loading: true });
      try {
        const data = await fetchComponentLiveData(component);
        setLiveEolData(component, data ? { ...data, fetchedAt: Date.now() } : { error: 'Not found', fetchedAt: Date.now() });
      } catch {
        setLiveEolData(component, { error: 'Fetch failed', fetchedAt: Date.now() });
      }
    }));
    setLastFetch(new Date().toLocaleTimeString());
    setFetching(false);
  }

  // Auto-fetch on mount
  useEffect(() => { fetchAll(); }, []);

  if (!hasMappings) return null;

  const statusColor = { eol: 'badge-red', eos_soon: 'badge-amber', eos: 'badge-amber', active: 'badge-green', unknown: 'badge-slate' };

  return (
    <div className="card overflow-hidden mb-4">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">Stack Live Lifecycle Check</div>
          <span className="text-xs text-teal-500 font-medium">endoflife.date API</span>
          {lastFetch && <span className="text-xs text-slate-400">Refreshed {lastFetch}</span>}
          {fetching && <span className="text-xs text-slate-400 italic animate-pulse">Fetching...</span>}
        </div>
        <button
          onClick={refreshAll}
          disabled={fetching}
          className="text-xs text-teal-600 border border-teal-200 rounded px-2 py-0.5 hover:bg-teal-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left border-b border-slate-200 bg-white">
              {['Component', 'API Product', 'Cycle', 'Latest', 'Release', 'EOS', 'EOL', 'LTS', 'Ext Support', 'Live Status'].map(h => (
                <th key={h} className="py-2 px-3 font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stackComponents.filter(c => EOL_SLUG_MAP[c]).map((component, idx) => {
              const entry = liveEolData[component] || {};
              const cycle = entry.matchedCycle;
              const ls = cycle ? cycleLiveStatus(cycle) : null;
              const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';
              return (
                <tr key={component} className={`border-b border-slate-100 ${rowBg} hover:bg-blue-50/20`}>
                  <td className="py-2.5 px-3 font-semibold text-slate-800 max-w-[160px]">
                    <div className="truncate">{component}</div>
                  </td>
                  <td className="py-2.5 px-3 text-teal-700 font-mono whitespace-nowrap">{entry.slug || EOL_SLUG_MAP[component]?.slug || '—'}</td>
                  <td className="py-2.5 px-3 text-slate-600">{cycle?.cycle || entry.targetCycle || '—'}</td>
                  <td className="py-2.5 px-3 text-slate-700 font-medium whitespace-nowrap">{cycle?.latest || '—'}</td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{cycle?.releaseDate || '—'}</td>
                  <td className="py-2.5 px-3">
                    <div className="text-slate-500 whitespace-nowrap">
                      {cycle ? (typeof cycle.support === 'boolean' ? (cycle.support ? 'Ongoing' : 'Ended') : (cycle.support || '—')) : '—'}
                    </div>
                    {typeof cycle?.support === 'string' && <DaysChip days={daysUntil(cycle.support)} />}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className={`font-semibold whitespace-nowrap ${ls?.status === 'eol' ? 'text-red-600' : 'text-slate-600'}`}>
                      {cycle ? (typeof cycle.eol === 'boolean' ? (cycle.eol ? 'Yes (EOL)' : 'No') : (cycle.eol || '—')) : '—'}
                    </div>
                    {typeof cycle?.eol === 'string' && <DaysChip days={daysUntil(cycle.eol)} />}
                  </td>
                  <td className="py-2.5 px-3"><LtsBadge cycle={cycle} /></td>
                  <td className="py-2.5 px-3"><ExtendedSupportChip cycle={cycle} /></td>
                  <td className="py-2.5 px-3">
                    {entry.loading ? (
                      <span className="text-slate-400 italic">Fetching...</span>
                    ) : entry.error ? (
                      <span className="text-slate-300">{entry.error}</span>
                    ) : ls ? (
                      <span className={`badge ${statusColor[ls.status] || 'badge-slate'}`}>{ls.label}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────

export default function CmdbTab() {
  const s = useStore();
  const { authUser, setShowAuthModal } = useAuth();
  const hasCmdb = canUseFeature(authUser, 'cmdb');

  if (!hasCmdb) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div className="text-base font-bold text-slate-700 mb-2">CMDB</div>
          <div className="text-sm text-slate-500 mb-4">
            Configuration Management Database with live endoflife.date API, CI register, incident mapping, and stack lifecycle validation.
          </div>
          <div className="space-y-2 text-left bg-slate-50 rounded-lg p-4 mb-5 text-xs text-slate-600 border border-slate-200">
            <div className="font-semibold text-slate-700 mb-1">Included in Pro+</div>
            {[
              'Live endoflife.date API for 500+ products',
              'CI register with EOL/EOS alerts',
              'Incident and UUM mapping per CI',
              'Stack lifecycle validation on build',
              'Cross-tab coherence alerts on EOL detection',
              'Search any product lifecycle live',
            ].map(f => (
              <div key={f} className="flex items-center gap-2">
                <svg className="w-3 h-3 text-teal-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {f}
              </div>
            ))}
          </div>
          <button onClick={() => setShowAuthModal(true)} className="btn-teal px-6 py-2 text-sm">
            Upgrade to Pro
          </button>
          <div className="mt-2 text-xs text-slate-400">Use code OPSPRO to try Pro instantly</div>
        </div>
      </div>
    );
  }

  const { ctx, selInc, selUUM, sysDesignData, customInc, liveEolData, setLiveEolData } = s;

  // Stack components to check
  const stackComponents = [ctx.hw, ctx.os, ctx.db, ctx.app].filter(Boolean);

  // Build CI list
  const cis = [
    {
      type: 'Hardware', component: ctx.hw,
      detail: sysDesignData?.unix?.cpu ? `CPU: ${sysDesignData.unix.cpu} | RAM: ${sysDesignData.unix.ram}` : null,
      owner: 'Unix Admin', layers: ['hw'],
    },
    {
      type: 'Operating System', component: ctx.os,
      detail: sysDesignData?.unix?.kernel_params ? `Kernel: ${sysDesignData.unix.kernel_params}` : null,
      owner: 'Unix Admin', layers: ['unix', 'os'],
    },
    {
      type: 'Database', component: ctx.db,
      detail: sysDesignData?.db?.listener_port ? `Port: ${sysDesignData.db.listener_port} | Pool: ${sysDesignData.db.max_conn}` : null,
      owner: 'DB Admin', layers: ['db'],
    },
    {
      type: 'Application', component: ctx.app,
      detail: sysDesignData?.app?.app_port ? `Port: ${sysDesignData.app.app_port} | Deploy: ${sysDesignData.app.deploy_method}` : null,
      owner: 'App Admin', layers: ['app'],
    },
    {
      type: 'Web / HTTP',
      component: ctx.app?.includes('NGINX') || ctx.app?.includes('Apache') || ctx.app?.includes('IIS') ? ctx.app : (sysDesignData?.web?.notes ? 'NGINX / Apache (see config)' : null),
      detail: sysDesignData?.web?.ssl_protocols ? `TLS: ${sysDesignData.web.ssl_protocols}` : null,
      owner: 'Web Admin', layers: ['web'],
    },
    {
      type: 'Storage',
      component: sysDesignData?.storage?.san_fabric || (ctx.hw ? 'SAN / NFS' : null),
      detail: sysDesignData?.storage?.lun_size ? `LUN: ${sysDesignData.storage.lun_size} | RAID: ${sysDesignData.storage.raid_level}` : null,
      owner: 'Storage Admin', layers: ['storage', 'stor'],
    },
    {
      type: 'Backup / DR',
      component: sysDesignData?.backup?.backup_tool || (ctx.hw ? 'RMAN / Veeam' : null),
      detail: sysDesignData?.backup?.rpo_hours ? `RPO: ${sysDesignData.backup.rpo_hours}h | RTO: ${sysDesignData.backup.rto_hours}h` : null,
      owner: 'Backup Admin', layers: ['backup', 'bk'],
    },
    {
      type: 'Network',
      component: sysDesignData?.network?.bandwidth || (ctx.hw ? 'Enterprise Network' : null),
      detail: sysDesignData?.network?.vlan_ids ? `VLANs: ${sysDesignData.network.vlan_ids}` : null,
      owner: 'Net Admin', layers: ['network', 'net'],
    },
    {
      type: 'Security',
      component: sysDesignData?.security?.compliance_framework || (ctx.hw ? 'ISO 27001 / CIS' : null),
      detail: sysDesignData?.security?.siem_endpoint ? `SIEM: ${sysDesignData.security.siem_endpoint}` : null,
      owner: 'SecOps', layers: ['security', 'sec'],
    },
  ].filter(ci => ci.component);

  function resolveInc(code) {
    return ALL_INC.find(i => i.code === code) || (customInc || []).find(c => c.code === code) || null;
  }

  const ciRows = cis.map(ci => ({
    ...ci,
    incidents: selInc.filter(code => {
      const inc = resolveInc(code);
      return inc && resolveLayer(inc.layers).some(ciType => ciType === ci.type);
    }),
    uums: selUUM.filter(code => {
      const uum = ALL_UUM.find(u => u.code === code);
      return uum && resolveLayer(uum.layers).some(ciType => ciType === ci.type);
    }),
  }));

  const eolCount = ciRows.filter(ci => getEolInfo(ci.component)?.status === 'eol').length;
  const eosSoonCount = ciRows.filter(ci => getEolInfo(ci.component)?.status === 'eos_soon').length;
  const incImpactCount = ciRows.filter(ci => ci.incidents.length > 0).length;
  const uumImpactCount = ciRows.filter(ci => ci.uums.length > 0).length;

  const liveEolCount = stackComponents.filter(c => {
    const e = liveEolData[c]; return e?.matchedCycle && cycleLiveStatus(e.matchedCycle).status === 'eol';
  }).length;
  const liveEosSoonCount = stackComponents.filter(c => {
    const e = liveEolData[c]; const s2 = e?.matchedCycle && cycleLiveStatus(e.matchedCycle).status;
    return s2 === 'eos_soon' || s2 === 'eos';
  }).length;

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-slate-700">Configuration Management Database (CMDB)</div>
          <div className="text-xs text-slate-500">{ciRows.length} CIs · {ctx.hw} / {ctx.os} · Live API: endoflife.date</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {liveEolCount > 0 && <span className="badge badge-red">{liveEolCount} Live EOL</span>}
          {liveEosSoonCount > 0 && <span className="badge badge-amber">{liveEosSoonCount} Live EOS Soon</span>}
          {eolCount > 0 && <span className="badge badge-red">{eolCount} Catalog EOL</span>}
          {eosSoonCount > 0 && <span className="badge badge-amber">{eosSoonCount} Catalog EOS Soon</span>}
          {incImpactCount > 0 && <span className="badge badge-red">{incImpactCount} Incident</span>}
          {uumImpactCount > 0 && <span className="badge badge-amber">{uumImpactCount} UUM</span>}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total CIs', value: ciRows.length, sub: 'Active components', color: 'text-slate-700', bg: 'bg-white border-slate-200' },
          {
            label: 'Live EOL Risk',
            value: liveEolCount + liveEosSoonCount,
            sub: `${liveEolCount} EOL · ${liveEosSoonCount} EOS Soon (API)`,
            color: liveEolCount > 0 ? 'text-red-600' : 'text-amber-600',
            bg: liveEolCount > 0 ? 'bg-red-50 border-red-200' : liveEosSoonCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200',
          },
          { label: 'Incident Impact', value: incImpactCount, sub: `${selInc.length} active incidents`, color: incImpactCount > 0 ? 'text-red-600' : 'text-slate-700', bg: incImpactCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200' },
          { label: 'UUM Scheduled', value: uumImpactCount, sub: `${selUUM.length} UUM items`, color: uumImpactCount > 0 ? 'text-amber-600' : 'text-slate-700', bg: uumImpactCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200' },
        ].map(card => (
          <div key={card.label} className={`rounded-lg border px-3 py-2 ${card.bg}`}>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{card.label}</div>
            <div className={`text-2xl font-bold leading-tight mt-0.5 ${card.color}`}>{card.value}</div>
            <div className="text-xs text-slate-400">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Project keywords → UUM matcher */}
      <UumKeywordMatcher selUUM={s.selUUM} toggleUUM={s.toggleUUM} />

      {/* Stack live lifecycle check */}
      <StackLiveCheck
        stackComponents={stackComponents}
        liveEolData={liveEolData}
        setLiveEolData={setLiveEolData}
      />

      {/* Live API search */}
      <LiveApiSearch />

      {/* CI Register table */}
      <div className="card overflow-hidden mb-4">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">CI Register</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-left">
                {['#', 'Type', 'Component / Version', 'Catalog EOL', 'Live API Status', 'Active Incidents', 'UUM Changes', 'Owner'].map(h => (
                  <th key={h} className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ciRows.map((ci, idx) => (
                <CiRow
                  key={ci.type}
                  ci={ci}
                  idx={idx}
                  liveEntry={liveEolData[ci.component]}
                />
              ))}
              {ciRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-slate-400">
                    No CIs found. Build an environment in Phase 1 first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Connectivity flow + EOL alerts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">Connectivity Map</div>
          </div>
          <div className="p-4 flex flex-col items-center gap-0">
            <FlowNode label="Hardware" sub={ctx.hw?.split(' ').slice(0, 3).join(' ')} color="navy"
              alert={ciRows.find(c => c.type === 'Hardware')?.incidents?.length > 0} />
            <Arrow />
            <FlowNode label="Operating System" sub={ctx.os?.split(' ').slice(0, 2).join(' ')}
              color={getEolInfo(ctx.os)?.status === 'eol' ? 'red' : getEolInfo(ctx.os)?.status === 'eos_soon' ? 'amber' : 'slate'}
              alert={ciRows.find(c => c.type === 'Operating System')?.incidents?.length > 0} />
            <Arrow />
            <div className="flex items-start gap-6">
              <FlowNode label="Application" sub={ctx.app?.split(' ').slice(0, 2).join(' ')} color="amber"
                alert={ciRows.find(c => c.type === 'Application')?.incidents?.length > 0} />
              <div className="flex items-center gap-2 mt-4">
                <Arrow dir="right" />
                <FlowNode label="Database" sub={ctx.db?.split(' ').slice(0, 2).join(' ')}
                  color={getEolInfo(ctx.db)?.status === 'eol' ? 'red' : 'green'}
                  alert={ciRows.find(c => c.type === 'Database')?.incidents?.length > 0} />
              </div>
            </div>
            <Arrow />
            <FlowNode label="Storage / Backup" sub={sysDesignData?.storage?.san_fabric || 'SAN / NFS'} color="teal"
              alert={ciRows.find(c => c.type === 'Storage')?.incidents?.length > 0} />
            <Arrow />
            <FlowNode label="Network / Security" sub={sysDesignData?.security?.compliance_framework || 'ISO 27001'} color="navy"
              alert={ciRows.find(c => c.type === 'Security')?.incidents?.length > 0} />
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">EOL / EOS Risk Assessment</div>
          </div>
          <div className="divide-y divide-slate-100">
            {ciRows.map(ci => {
              const info = getEolInfo(ci.component);
              const liveEntry = liveEolData[ci.component];
              const liveStatus = liveEntry?.matchedCycle ? cycleLiveStatus(liveEntry.matchedCycle) : null;
              const showRow = (info && info.status !== 'active' && info.status !== 'unknown') ||
                (liveStatus && liveStatus.status !== 'active');
              if (!showRow) return null;
              return (
                <div key={ci.type} className={['px-4 py-3 flex items-center gap-3',
                  (info?.status === 'eol' || liveStatus?.status === 'eol') ? 'bg-red-50/50' : 'bg-amber-50/50'].join(' ')}>
                  <div className="flex-shrink-0 flex flex-col gap-1">
                    {info && info.status !== 'active' && (
                      <span className={`badge ${info.badge}`}>{info.label}</span>
                    )}
                    {liveStatus && liveStatus.status !== 'active' && (
                      <span className={`badge ${liveStatus.color === 'red' ? 'badge-red' : 'badge-amber'}`}>
                        Live: {liveStatus.label}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700">{ci.type}</div>
                    <div className="text-xs text-slate-500 truncate">{ci.component}</div>
                  </div>
                  <div className="text-xs text-slate-400 flex-shrink-0">EOS: {info?.date || liveEntry?.matchedCycle?.support || '—'}</div>
                </div>
              );
            }).filter(Boolean)}
            {ciRows.every(ci => {
              const info = getEolInfo(ci.component);
              const liveEntry = liveEolData[ci.component];
              const liveStatus = liveEntry?.matchedCycle ? cycleLiveStatus(liveEntry.matchedCycle) : null;
              return (!info || info.status === 'active' || info.status === 'unknown') &&
                (!liveStatus || liveStatus.status === 'active');
            }) && (
              <div className="px-4 py-4 text-center text-xs text-green-600 font-semibold">
                All components within support lifecycle
              </div>
            )}
          </div>

          {selInc.length > 0 && (
            <>
              <div className="px-4 py-2.5 bg-slate-50 border-t border-b border-slate-200">
                <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">Incident to CI Mapping</div>
              </div>
              <div className="divide-y divide-slate-100">
                {selInc.slice(0, 6).map(code => {
                  const inc = resolveInc(code);
                  if (!inc) return null;
                  const affectedCIs = resolveLayer(inc.layers);
                  return (
                    <div key={code} className="px-4 py-2.5 flex items-start gap-3">
                      <span className="badge badge-red flex-shrink-0 mt-0.5">{inc.short}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-600 font-medium truncate">{inc.txt?.substring((inc.short?.length || 0) + 2, 60)}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {affectedCIs.map(ci => (
                            <span key={ci} className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{ci}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
