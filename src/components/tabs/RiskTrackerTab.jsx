import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore.js';
import { computeAllRisks, riskScore, riskLabel } from '../../lib/riskEngine.js';

const SEV_STYLE = {
  CRITICAL: { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700 border-red-200',    border: 'border-l-red-500',    dot: 'bg-red-500'    },
  HIGH:     { bar: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700 border-amber-200',  border: 'border-l-amber-500',  dot: 'bg-amber-500'  },
  MEDIUM:   { bar: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', border: 'border-l-yellow-400', dot: 'bg-yellow-400' },
  LOW:      { bar: 'bg-slate-300',  badge: 'bg-slate-100 text-slate-500 border-slate-200',  border: 'border-l-slate-300',  dot: 'bg-slate-400'  },
};

const SOURCE_LABEL = {
  coherence:    'Coherence',
  raid:         'RAID',
  vulnerability:'Vulnerability',
  stakeholder:  'Stakeholder',
  system:       'System',
  rtm:          'RTM',
  incident:     'Incidents',
  schedule:     'Schedule',
  'live-eol':   'Live EOL API',
};

const SCORE_COLORS = {
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  ring: 'ring-green-300' },
  teal:   { bg: 'bg-teal-50',   text: 'text-teal-700',   ring: 'ring-teal-300'  },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  ring: 'ring-amber-300' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-300'},
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    ring: 'ring-red-300'   },
};

const ACK_STATUS_OPTS = ['open', 'mitigating', 'accepted', 'closed'];
const ACK_STYLE = {
  open:       'bg-red-50 text-red-700',
  mitigating: 'bg-amber-50 text-amber-700',
  accepted:   'bg-purple-50 text-purple-700',
  closed:     'bg-green-50 text-green-700',
};

function RiskCard({ risk, ack, onAck, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(ack?.notes || '');
  const st = SEV_STYLE[risk.severity] || SEV_STYLE.MEDIUM;
  const isClosed = ack?.status === 'closed';

  function saveAck(status) {
    onAck(risk.id, { status, notes, acknowledgedAt: new Date().toISOString() });
  }

  return (
    <div className={[
      'rounded-lg border border-l-4 mb-2 overflow-hidden transition-opacity',
      st.border, isClosed ? 'opacity-50' : '',
    ].join(' ')}>
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
        onClick={() => setExpanded(x => !x)}
      >
        <span className={`mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold border flex-shrink-0 ${st.badge}`}>
          {risk.severity}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 leading-snug">{risk.title}</div>
          {!expanded && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{risk.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
            {SOURCE_LABEL[risk.source] || risk.source}
          </span>
          {ack && (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${ACK_STYLE[ack.status] || ''}`}>
              {ack.status}
            </span>
          )}
          <span className="text-slate-300 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">{risk.description}</p>
          <div className="flex items-start gap-1.5 text-xs text-teal-700 bg-teal-50 px-2.5 py-1.5 rounded">
            <span className="font-semibold flex-shrink-0">Action:</span>
            <span>{risk.actionHint}</span>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onNavigate(risk.tab)}
              className="text-xs px-3 py-1.5 rounded bg-teal-600 text-white hover:bg-teal-700 font-medium"
            >
              Open {risk.tab.toUpperCase()} tab →
            </button>
            {ACK_STATUS_OPTS.filter(s => s !== ack?.status).map(st => (
              <button
                key={st}
                onClick={() => saveAck(st)}
                className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${ACK_STYLE[st]} border-current`}
              >
                Mark {st}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">PM Notes / Mitigation</label>
            <div className="flex gap-2">
              <textarea
                className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 text-slate-700 resize-none"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Document what's being done to address this risk..."
              />
              <button onClick={() => saveAck(ack?.status || 'mitigating')}
                className="text-xs px-3 py-1 rounded bg-slate-600 text-white hover:bg-slate-700 self-end">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreDial({ score, label: rl }) {
  const { bg, text, ring } = SCORE_COLORS[rl.color] || SCORE_COLORS.green;
  return (
    <div className={`w-20 h-20 rounded-full flex flex-col items-center justify-center ${bg} ring-4 ${ring}`}>
      <span className={`text-2xl font-black ${text}`}>{score}</span>
      <span className={`text-xs font-bold ${text} uppercase tracking-wide`}>{rl.label}</span>
    </div>
  );
}

export default function RiskTrackerTab() {
  const store = useStore();

  const s = {
    coherenceAlerts:     store.coherenceAlerts     || [],
    customRaidEntries:   store.customRaidEntries    || [],
    vulnRegistry:        store.vulnRegistry         || [],
    stakeholderDiscussions: store.stakeholderDiscussions || [],
    rtmStale:            store.rtmStale,
    tasksStaleReason:    store.tasksStaleReason,
    cabDeclined:         store.cabDeclined,
    promoted:            store.promoted,
    rtmSigned:           store.rtmSigned,
    rtmRows:             store.rtmRows              || {},
    selInc:              store.selInc               || [],
    selFix:              store.selFix               || [],
    phase2Active:        store.phase2Active,
    requirements:        store.requirements         || {},
    liveEolData:         store.liveEolData          || {},
    riskAcknowledgments: store.riskAcknowledgments  || {},
  };

  const allRisks = useMemo(() => computeAllRisks(s), [
    s.coherenceAlerts.length, s.customRaidEntries.length, s.vulnRegistry.length,
    s.stakeholderDiscussions.length, s.rtmStale, s.tasksStaleReason, s.cabDeclined,
    s.promoted, s.rtmSigned, JSON.stringify(s.rtmRows), s.selInc.length,
    s.phase2Active, s.requirements?.goLiveDate, JSON.stringify(s.liveEolData),
  ]);

  const score = riskScore(allRisks);
  const rl    = riskLabel(score);

  const openRisks   = allRisks.filter(r => (s.riskAcknowledgments[r.id]?.status ?? 'open') !== 'closed');
  const closedRisks = allRisks.filter(r => s.riskAcknowledgments[r.id]?.status === 'closed');

  const critCount = openRisks.filter(r => r.severity === 'CRITICAL').length;
  const highCount = openRisks.filter(r => r.severity === 'HIGH').length;
  const medCount  = openRisks.filter(r => r.severity === 'MEDIUM').length;
  const lowCount  = openRisks.filter(r => r.severity === 'LOW').length;

  const [showClosed, setShowClosed] = useState(false);
  const [filterSrc,  setFilterSrc]  = useState('ALL');

  const sources = ['ALL', ...new Set(allRisks.map(r => r.source))];

  const displayRisks = openRisks.filter(r => filterSrc === 'ALL' || r.source === filterSrc);

  function handleAck(id, data) {
    store.acknowledgeRisk(id, data);
  }

  function handleNavigate(tab) {
    store.setActiveTab(tab);
  }

  // OpsMentor suggestions — top 3 actionable items
  const suggestions = openRisks.slice(0, 3).map(r => ({
    risk: r,
    suggestion: r.actionHint,
    urgency: r.severity,
  }));

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-5">
        <ScoreDial score={score} label={rl} />
        <div className="flex-1">
          <h2 className="text-base font-bold text-slate-800">Risk Tracker</h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-3">
            Live risk posture across all build phases. Syncs with Coherence, RAID, RTM, Vulnerabilities, CMDB, and Incidents.
          </p>
          <div className="flex gap-2 flex-wrap">
            {critCount > 0 && <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">{critCount} Critical</span>}
            {highCount > 0 && <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{highCount} High</span>}
            {medCount  > 0 && <span className="px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">{medCount} Medium</span>}
            {lowCount  > 0 && <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">{lowCount} Low</span>}
            {openRisks.length === 0 && <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">No active risks</span>}
          </div>
        </div>
      </div>

      {/* Severity bar */}
      {allRisks.length > 0 && (
        <div className="h-2 rounded-full overflow-hidden flex gap-px bg-slate-100">
          {critCount > 0 && <div className="bg-red-500"   style={{ flex: critCount }} />}
          {highCount > 0 && <div className="bg-amber-400" style={{ flex: highCount }} />}
          {medCount  > 0 && <div className="bg-yellow-300" style={{ flex: medCount  }} />}
          {lowCount  > 0 && <div className="bg-slate-300" style={{ flex: lowCount  }} />}
        </div>
      )}

      {/* OpsMentor suggestions */}
      {suggestions.length > 0 && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-2">
          <div className="text-xs font-bold text-teal-700 uppercase tracking-wide flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-teal-600 text-white flex items-center justify-center" style={{ fontSize: 8, fontWeight: 800 }}>AI</span>
            OpsMentor Suggestions
          </div>
          {suggestions.map((sg, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-teal-800">
              <span className={`mt-0.5 w-3.5 h-3.5 rounded-full flex-shrink-0 ${SEV_STYLE[sg.urgency]?.dot || 'bg-teal-400'}`} />
              <span className="leading-snug">
                <span className="font-semibold">{sg.risk.title}:</span> {sg.suggestion}
              </span>
            </div>
          ))}
          <p className="text-xs text-teal-600 pt-1">
            Ask OpsMentor: "show risks" · "what are the critical risks?" · "mitigate [risk name]"
          </p>
        </div>
      )}

      {/* Filter bar */}
      {openRisks.length > 0 && (
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-xs text-slate-500 font-medium">Source:</span>
          {sources.map(src => (
            <button
              key={src}
              onClick={() => setFilterSrc(src)}
              className={[
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                filterSrc === src
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-teal-400',
              ].join(' ')}
            >
              {SOURCE_LABEL[src] || src}
            </button>
          ))}
        </div>
      )}

      {/* Risk list */}
      {displayRisks.length === 0 && openRisks.length === 0 ? (
        <div className="text-center py-14">
          <div className="text-4xl mb-3">✓</div>
          <div className="text-sm font-semibold text-slate-700">No active risks</div>
          <div className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Risk Tracker is watching coherence alerts, RAID entries, vulnerabilities, stakeholder discussions, RTM, incidents, and live EOL data.
          </div>
        </div>
      ) : (
        <>
          <div>
            {displayRisks.map(risk => (
              <RiskCard
                key={risk.id}
                risk={risk}
                ack={s.riskAcknowledgments[risk.id]}
                onAck={handleAck}
                onNavigate={handleNavigate}
              />
            ))}
          </div>

          {/* Resolved risks accordion */}
          {closedRisks.length > 0 && (
            <div>
              <button
                onClick={() => setShowClosed(v => !v)}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1.5 font-medium"
              >
                <span>{showClosed ? '▼' : '▶'}</span>
                {closedRisks.length} closed / resolved risk{closedRisks.length !== 1 ? 's' : ''}
              </button>
              {showClosed && (
                <div className="mt-2 opacity-60">
                  {closedRisks.map(risk => (
                    <RiskCard
                      key={risk.id}
                      risk={risk}
                      ack={s.riskAcknowledgments[risk.id]}
                      onAck={handleAck}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* How this works */}
      <div className="text-xs text-slate-400 border-t border-slate-100 pt-3 space-y-1">
        <div className="font-semibold text-slate-500">Risk sources tracked live:</div>
        <div>Coherence engine · RAID log · Vulnerability registry · Stakeholder discussions · RTM rows · System state · Live EOL API · Incident density</div>
        <div className="pt-1">Risk Score = CRITICAL×4 + HIGH×2 + MEDIUM×1. Mark risks as <em>mitigating</em>, <em>accepted</em>, or <em>closed</em> to reduce the score.</div>
      </div>
    </div>
  );
}
