import { useState } from 'react';
import { useStore } from '../store/useStore.js';

export default function AgentInsights({ tab }) {
  const [expanded, setExpanded] = useState(false);
  const alerts = useStore(s => s.coherenceAlerts);

  const relevant = alerts.filter(a => a.tabs.includes(tab));
  if (!relevant.length) return null;

  const hasWarn = relevant.some(a => a.severity === 'warn');
  const borderCls = hasWarn ? 'border-amber-300' : 'border-blue-200';
  const bgCls     = hasWarn ? 'bg-amber-50'      : 'bg-blue-50';
  const dotCls    = hasWarn ? 'bg-amber-400'      : 'bg-blue-400';
  const headCls   = hasWarn ? 'text-amber-800'    : 'text-blue-800';
  const bodyCls   = hasWarn ? 'text-amber-700'    : 'text-blue-700';
  const mutedCls  = hasWarn ? 'text-amber-500'    : 'text-blue-400';

  if (!expanded) {
    return (
      <div
        className={`flex items-center justify-between rounded-lg border ${borderCls} ${bgCls} px-3 py-2 mb-3 gap-3 cursor-pointer select-none`}
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
          <span className={`text-xs font-semibold flex-shrink-0 ${headCls}`}>Agent</span>
          <span className={`text-xs truncate ${bodyCls}`}>{relevant[0].message}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {relevant.length > 1 && (
            <span className={`text-xs ${mutedCls}`}>+{relevant.length - 1}</span>
          )}
          <svg className={`w-3.5 h-3.5 flex-shrink-0 ${mutedCls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${borderCls} ${bgCls} px-3 py-2.5 mb-3`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
          <span className={`text-xs font-bold ${headCls}`}>
            Agent Insights &mdash; {relevant.length} {relevant.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <button
          className={`text-xs ${mutedCls} hover:underline`}
          onClick={() => setExpanded(false)}
        >
          collapse
        </button>
      </div>
      <div className="flex flex-col gap-2.5">
        {relevant.map(alert => (
          <div key={alert.id} className="flex gap-2">
            <div
              className={`w-0.5 rounded-full flex-shrink-0 mt-0.5 self-stretch ${alert.severity === 'warn' ? 'bg-amber-400' : 'bg-blue-400'}`}
            />
            <div className="min-w-0">
              <div className={`text-xs ${bodyCls}`}>{alert.message}</div>
              {alert.action && (
                <div className={`text-xs mt-0.5 font-medium ${mutedCls}`}>&#8594; {alert.action}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
