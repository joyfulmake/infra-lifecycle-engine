/**
 * CompatWarning — inline amber/red warning strip for compatibility issues.
 *
 * Props:
 *   hits          — array of COMPAT_RULES objects (from useCompatCheck)
 *   onOverride    — called when user clicks "Override & Proceed"
 *   onDismiss     — called when user clicks "Change my entry"
 *   dark          — true for dark background (sidebar), false for light (tabs)
 *   overriding    — true if user has already overridden; shows a softer reminder
 *
 * Each rule that has a matching entry in store.liveCompatData gets a live
 * verification badge showing whether the EOL status was just confirmed or
 * whether the vendor has extended support beyond the static date.
 */
import { useStore } from '../store/useStore.js';

export default function CompatWarning({ hits, onOverride, onDismiss, dark = false, overriding = false }) {
  const liveCompatData      = useStore(s => s.liveCompatData);
  const liveCompatVerifiedAt = useStore(s => s.liveCompatVerifiedAt);

  if (!hits || hits.length === 0) return null;

  const hasCritical = hits.some(h => h.severity === 'critical');
  const borderCls = dark
    ? (hasCritical ? 'border-red-400/60'   : 'border-amber-400/60')
    : (hasCritical ? 'border-red-300'       : 'border-amber-300');
  const bgCls = dark
    ? (hasCritical ? 'bg-red-900/30'        : 'bg-amber-900/25')
    : (hasCritical ? 'bg-red-50'            : 'bg-amber-50');
  const headCls = dark
    ? (hasCritical ? 'text-red-300'         : 'text-amber-300')
    : (hasCritical ? 'text-red-700'         : 'text-amber-700');
  const bodyCls = dark
    ? (hasCritical ? 'text-red-200'         : 'text-amber-200')
    : (hasCritical ? 'text-red-600'         : 'text-amber-600');
  const linkCls = dark
    ? 'text-blue-300 hover:text-blue-200 border-blue-500/40 bg-white/5 hover:bg-white/10'
    : 'text-blue-700 hover:text-blue-800 border-blue-300 bg-white hover:bg-blue-50';

  function liveBadge(rule) {
    const live = liveCompatData[rule.id];
    if (!live) return null;

    // If live data shows the product is still active, the static CRITICAL rule may be stale
    // (vendor extended support). Show an amber caution note.
    if (live.status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ml-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30">
          ⚡ Live: support may be extended — re-verify
        </span>
      );
    }
    // 'eol' or 'eos' — live data confirms the static rule is accurate
    if (live.status === 'eol' || live.status === 'eos') {
      const dateStr = live.eolDate && live.eolDate !== 'EOL' ? ` (${live.eolDate})` : '';
      return (
        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ml-1.5 bg-green-800/25 text-green-300 border border-green-600/30">
          ✓ Live confirmed{dateStr}
        </span>
      );
    }
    // 'eos_soon' — EOL within 12 months, live-verified
    if (live.status === 'eos_soon') {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ml-1.5 bg-amber-800/25 text-amber-300 border border-amber-600/30">
          ⏳ Live: EOL approaching ({live.eolDate || 'soon'})
        </span>
      );
    }
    return null;
  }

  // Format the verified timestamp concisely
  const verifiedStr = liveCompatVerifiedAt
    ? (() => {
        try {
          const d = new Date(liveCompatVerifiedAt);
          return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } catch { return null; }
      })()
    : null;

  return (
    <div className={`rounded border ${borderCls} ${bgCls} p-2.5 mt-1.5 mb-1 text-xs space-y-2`}>
      {hits.map(rule => {
        const live = liveCompatData[rule.id];
        return (
          <div key={rule.id}>
            <div className={`font-semibold ${headCls} mb-0.5 flex flex-wrap items-center gap-0.5`}>
              {rule.severity === 'critical' ? '🔴' : '⚠'} {rule.title}
              {liveBadge(rule)}
            </div>
            <div className={`${bodyCls} leading-relaxed mb-1`}>{rule.detail}</div>
            {live?.latest && (
              <div className={`text-xs mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                Latest supported release: <strong>{live.latest}</strong>
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {(rule.refs || []).map((ref, i) => (
                <a
                  key={i}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-xs transition-colors ${linkCls}`}
                  title={ref.url}
                >
                  ↗ {ref.label}
                </a>
              ))}
            </div>
          </div>
        );
      })}

      {/* Only show action buttons when handlers are provided (info-only mode passes null) */}
      {!overriding && onOverride !== null && (
        <div className="flex gap-2 pt-1 border-t border-current/10">
          {onDismiss !== null && (
            <button
              type="button"
              onClick={onDismiss}
              className={`flex-1 text-xs font-semibold px-2 py-1 rounded border transition-colors ${
                dark
                  ? 'border-white/20 text-white/80 hover:bg-white/10'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Change my entry
            </button>
          )}
          <button
            type="button"
            onClick={onOverride}
            className={`flex-1 text-xs font-semibold px-2 py-1 rounded border transition-colors ${
              hasCritical
                ? 'border-red-400 text-red-600 hover:bg-red-50'
                : 'border-amber-400 text-amber-700 hover:bg-amber-50'
            }`}
          >
            Override &amp; add RAID risk
          </button>
        </div>
      )}

      {overriding && (
        <div className={`text-xs font-semibold mt-1 ${hasCritical ? 'text-red-400' : 'text-amber-400'}`}>
          ⚠ Overridden — a RAID risk will be auto-raised on submit
        </div>
      )}

      {/* Live verification footer */}
      {verifiedStr && (
        <div className={`text-xs pt-1 border-t border-current/10 ${dark ? 'text-white/35' : 'text-slate-400'}`}>
          Live data from endoflife.date · verified {verifiedStr}
        </div>
      )}
    </div>
  );
}
