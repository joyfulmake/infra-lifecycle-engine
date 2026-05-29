import { useStore } from '../store/useStore.js';
import { ALL_INC } from '../lib/incidents.js';
import { ALL_UUM } from '../lib/uumItems.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { PLANS } from '../lib/auth.js';
import { PLAN_BADGE } from './AuthModal.jsx';

function KpiTile({ label, value, sub, color }) {
  const colors = {
    red:   'border-red-200 bg-red-50',
    amber: 'border-amber-200 bg-amber-50',
    teal:  'border-teal/30 bg-teal/5',
    slate: 'border-slate-200 bg-white',
    green: 'border-green-200 bg-green-50',
  };
  const valueColors = {
    red: 'text-red-600', amber: 'text-amber-600', teal: 'text-teal', slate: 'text-slate-700', green: 'text-green-700',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 min-w-0 ${colors[color] || colors.slate}`}>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide truncate">{label}</div>
      <div className={`text-xl font-bold leading-tight mt-0.5 ${valueColors[color] || valueColors.slate}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 truncate">{sub}</div>}
    </div>
  );
}

function MilestoneDot({ label, done }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${done ? 'bg-teal border-teal' : 'bg-white border-slate-300'}`}>
        {done && <svg className="w-full h-full text-white p-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
      </div>
      <div className="text-xs text-slate-500 text-center leading-tight w-12">{label}</div>
    </div>
  );
}


export default function ExecOverview() {
  const s = useStore();
  const { authUser, setShowAuthModal } = useAuth();

  const activeInc = s.selInc.length;
  const uumCount = s.selUUM.length;
  const incSev = activeInc > 5 ? 'red' : activeInc > 2 ? 'amber' : activeInc > 0 ? 'amber' : 'slate';

  // Risk score (0-100)
  const riskScore = Math.min(100,
    (activeInc * 12) + (uumCount * 6) +
    (s.cabApproved ? 0 : 10) + (s.rtmSigned ? 0 : 10) +
    (s.promoted ? -20 : 0) + (s.scanComplete ? 0 : 8)
  );
  const riskColor = riskScore >= 60 ? '#DC2626' : riskScore >= 35 ? '#D97706' : '#0D9488';
  const riskLabel = riskScore >= 60 ? 'HIGH' : riskScore >= 35 ? 'MEDIUM' : 'LOW';

  const milestones = [
    { label: 'Phase 1', done: s.isBuilt },
    { label: 'AI Scan', done: s.scanComplete },
    { label: 'Design', done: s.designApplied },
    { label: 'Phase 2', done: s.phase2Active },
    { label: 'CAB', done: s.cabApproved },
    { label: 'RTM', done: s.rtmSigned },
    { label: 'Cutover', done: s.promoted },
  ];

  if (!s.isBuilt) {
    return (
      <div className="h-full flex items-center justify-between bg-white border-b border-slate-200 px-6">
        <div className="text-center flex-1">
          <div className="text-2xl font-bold text-slate-800 mb-1">Enterprise Infrastructure Lifecycle Engine</div>
          <div className="text-slate-500 text-sm">Build your platform topology in the left panel to begin</div>
          <div className="flex gap-2 justify-center mt-3 flex-wrap">
            {['Phase 1: Provision', 'AI Smart Scan', 'System Design', 'Phase 2: Incidents + UUM', 'CAB Gate', 'RTM Sign-Off', 'Production Cutover', 'Excel Export'].map(label => (
              <span key={label} className="badge badge-slate text-xs">{label}</span>
            ))}
          </div>
        </div>
        {/* User badge */}
        <div className="flex-shrink-0 ml-6">
          {authUser ? (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                {authUser.displayName?.[0]?.toUpperCase() || authUser.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="text-left">
                <div className="text-xs font-medium text-slate-700 leading-tight">{authUser.displayName || authUser.email}</div>
                <span className={`text-xs font-bold rounded px-1 ${PLAN_BADGE[authUser.plan] || PLAN_BADGE.free}`}>
                  {PLANS[authUser.plan]?.name || authUser.plan}
                </span>
              </div>
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 text-xs text-teal-600 border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-50 transition-colors font-semibold"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Sign In / Plans
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white border-b border-slate-200 px-4 py-3 flex gap-4 items-start">
      {/* KPI Tiles */}
      <div className="grid grid-cols-4 gap-2 flex-1 min-w-0 relative">
        <KpiTile
          label="Active Incidents"
          value={activeInc}
          sub={activeInc > 0 ? (s.promoted ? 'All Resolved' : `${s.selFix.length} fixed in staging`) : 'No incidents'}
          color={s.promoted ? 'green' : incSev}
        />
        <KpiTile
          label="UUM Items"
          value={uumCount}
          sub={uumCount > 0 ? (s.promoted ? 'Completed' : 'Scheduled') : 'None scheduled'}
          color={s.promoted ? 'green' : uumCount > 0 ? 'amber' : 'slate'}
        />
        <KpiTile
          label="CAB Status"
          value={s.cabApproved ? 'APPROVED' : 'PENDING'}
          sub={s.cabApproved ? 'Change window authorized' : 'Awaiting CAB approval'}
          color={s.cabApproved ? 'teal' : 'red'}
        />
        <KpiTile
          label="RTM Status"
          value={s.rtmSigned ? 'SIGNED' : 'PENDING'}
          sub={s.rtmSigned ? 'All requirements verified' : 'Sign-off required'}
          color={s.rtmSigned ? 'teal' : 'amber'}
        />
      </div>

      {/* Risk + Milestones + User */}
      <div className="flex flex-col gap-2 flex-shrink-0 min-w-48">
        {/* Risk bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500">RISK</span>
            <span className="text-xs font-bold" style={{ color: riskColor }}>{riskLabel}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: riskScore + '%', backgroundColor: riskColor }}
            />
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{s.ctx.hw} / {s.ctx.os}</div>
        </div>

        {/* Milestones */}
        <div className="flex gap-1 items-start">
          {milestones.map((m, i) => (
            <div key={m.label} className="flex items-center gap-0.5">
              <MilestoneDot label={m.label} done={m.done} />
              {i < milestones.length - 1 && (
                <div className={`w-3 h-0.5 flex-shrink-0 mb-5 ${m.done && milestones[i+1].done ? 'bg-teal' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Unsaved indicator */}
        {s.isDirty && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
            <span className="text-xs text-amber-500 font-medium">Unsaved</span>
          </div>
        )}

        {/* User chip */}
        {authUser ? (
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 transition-colors"
          >
            <div className="w-4 h-4 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
              {authUser.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="text-xs text-slate-600 font-medium leading-tight">{authUser.displayName}</span>
            <span className={`text-xs font-bold rounded px-1 ${PLAN_BADGE[authUser.plan] || PLAN_BADGE.free}`}>
              {PLANS[authUser.plan]?.name}
            </span>
          </button>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="text-xs text-teal-600 border border-teal-200 rounded px-2 py-1 hover:bg-teal-50 transition-colors font-semibold"
          >
            Sign In / Plans
          </button>
        )}
      </div>
    </div>
  );
}
