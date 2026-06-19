/**
 * CompatWarning — inline amber/red warning strip for compatibility issues.
 *
 * Props:
 *   hits          — array of COMPAT_RULES objects (from useCompatCheck)
 *   onOverride    — called when user clicks "Override & Proceed"
 *   onDismiss     — called when user clicks "Change my entry"
 *   dark          — true for dark background (sidebar), false for light (tabs)
 *   overriding    — true if user has already overridden; shows a softer reminder
 */
export default function CompatWarning({ hits, onOverride, onDismiss, dark = false, overriding = false }) {
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

  return (
    <div className={`rounded border ${borderCls} ${bgCls} p-2.5 mt-1.5 mb-1 text-xs space-y-2`}>
      {hits.map(rule => (
        <div key={rule.id}>
          <div className={`font-semibold ${headCls} mb-0.5`}>
            {rule.severity === 'critical' ? '🔴' : '⚠'} {rule.title}
          </div>
          <div className={`${bodyCls} leading-relaxed mb-1`}>{rule.detail}</div>
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
      ))}

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
    </div>
  );
}
