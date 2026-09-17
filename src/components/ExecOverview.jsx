import { useMemo } from 'react';
import { useStore } from '../store/useStore.js';
import { ALL_INC } from '../lib/incidents.js';
import { ALL_UUM } from '../lib/uumItems.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { PLANS, promoDaysRemaining } from '../lib/auth.js';
import { PLAN_BADGE } from './AuthModal.jsx';
import StatTile from './ui/StatTile.jsx';
import { getUserRolesForBuild } from '../lib/roleAccess.js';
import { buildProjectGraph } from '../engine/projectGraph.js';
import { computeRoleCapacityDrag } from '../engine/mathEngine.js';

// Thin adapter over the shared StatTile primitive — keeps this file's call
// sites (color="red"/"amber"/"teal"/"slate"/"green") unchanged while the
// actual rendering comes from one shared component (see src/index.css
// .ui-stat-tile and src/components/ui/StatTile.jsx).
const COLOR_TO_TONE = { red: 'danger', amber: 'warning', teal: 'accent', slate: 'neutral', green: 'success' };
function KpiTile({ label, value, sub, color }) {
  return <StatTile label={label} value={value} sub={sub} tone={COLOR_TO_TONE[color] || 'neutral'} />;
}

function MilestoneDot({ label, done }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <div
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${done ? '' : 'bg-white border-slate-300'}`}
        style={done ? { background: 'var(--app-accent)', borderColor: 'var(--app-accent)' } : {}}
      >
        {done && <svg className="w-full h-full text-white p-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
      </div>
      <div className="text-xs text-slate-500 text-center leading-tight w-12">{label}</div>
    </div>
  );
}


export default function ExecOverview() {
  const s = useStore();
  const { authUser, openAuthModal } = useAuth();

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

  // Role-aware dashboard: a signed-in user matched to a specific function
  // team's RACI role sees a KPI relevant to THEM (their capacity drag from
  // linked open risks) in place of the generic UUM count — a DBA and a
  // Change Manager don't need the same fixed tile set. Falls back to the
  // generic view for anyone not matched to a team-shaped role (PM, Change
  // Manager, QA Lead already have CAB/RTM tiles that suit them directly).
  const userRoles = getUserRolesForBuild(authUser, s.roleAssignments);
  const myRoleDrag = useMemo(() => {
    if (!s.phase2Active || userRoles.length === 0) return null;
    const { graph } = buildProjectGraph(s);
    const drag = computeRoleCapacityDrag(graph);
    for (const myRole of userRoles) {
      const match = Object.entries(drag).find(([teamRole]) =>
        teamRole.toLowerCase().includes(myRole.toLowerCase()) || myRole.toLowerCase().includes(teamRole.toLowerCase())
      );
      if (match) return { role: myRole, hours: match[1] };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase2Active, s.customRaidEntries, s.selInc, s.selUUM, s.customUUM, s.sysDesignData, s.sdAiTasks, s.ganttOverrides, userRoles.join(',')]);

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
      <div className="min-h-[96px] h-auto flex flex-col min-[1160px]:flex-row items-center justify-between gap-3 bg-white border-b border-slate-200 px-4 min-[1160px]:px-6 py-3 min-[1160px]:py-0">
        <div className="text-center flex-1 min-w-0">
          <div className="text-lg min-[1160px]:text-2xl font-bold text-slate-800 mb-1">Where do you want to start?</div>
          <div className="text-slate-500 text-xs min-[1160px]:text-sm">Pick a domain and stack in the left panel — infra, apps, SAP, cloud, and 12 more — then build.</div>
          <div className="hidden min-[1160px]:flex gap-2 justify-center mt-3 flex-wrap">
            {['Phase 1: Provision', 'AI Smart Scan', 'System Design', 'Phase 2: Incidents + UUM', 'CAB Gate', 'RTM Sign-Off', 'Production Cutover', 'Excel Export'].map(label => (
              <span key={label} className="badge badge-slate text-xs px-3 py-1" style={{ border: '1px solid var(--app-accent-border)' }}>{label}</span>
            ))}
          </div>
        </div>
        {/* OpsMentor + User */}
        <div className="flex-shrink-0 min-[1160px]:ml-6 flex flex-row min-[1160px]:flex-col items-center min-[1160px]:items-end gap-2">
          {/* OpsMentor — always visible in top strip */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('opsmanifest-orchestrator-open'))}
            className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-white text-xs font-bold shadow-lg hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #0d9488 100%)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-pulse flex-shrink-0" />
            <span>OpsMentor</span>
            <span className="text-teal-200 font-normal">›</span>
          </button>
          {authUser ? (
            <button
              onClick={() => openAuthModal('signup')}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                {authUser.displayName?.[0]?.toUpperCase() || authUser.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="text-left">
                <div className="text-xs font-medium text-slate-700 leading-tight">{authUser.displayName || authUser.email}</div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className={`text-xs font-bold rounded px-1 ${PLAN_BADGE[authUser.plan] || PLAN_BADGE.free}`}>
                    {PLANS[authUser.plan]?.name || authUser.plan}
                  </span>
                  {(() => {
                    const days = promoDaysRemaining(authUser);
                    if (days === null) return null;
                    return (
                      <span className={`text-xs rounded px-1 font-semibold ${days <= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        Demo {days}d
                      </span>
                    );
                  })()}
                  {authUser.promoExpired && (
                    <span className="text-xs rounded px-1 font-semibold bg-red-100 text-red-700">Expired</span>
                  )}
                </div>
              </div>
            </button>
          ) : (
            <button
              onClick={() => openAuthModal('signup')}
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
    <div className="h-auto min-h-24 min-[1160px]:h-full bg-white border-b border-slate-200 px-3 min-[1160px]:px-6 py-2.5 min-[1160px]:py-3 flex flex-col min-[1160px]:flex-row gap-2.5 min-[1160px]:gap-4 items-stretch min-[1160px]:items-start">
      {/* KPI Tiles */}
      <div className="grid grid-cols-2 min-[520px]:grid-cols-4 gap-2 min-[1160px]:gap-3 flex-1 min-w-0 relative">
        <KpiTile
          label="Active Incidents"
          value={activeInc}
          sub={activeInc > 0 ? (s.promoted ? 'All Resolved' : `${s.selFix.length} fixed in staging`) : 'No incidents'}
          color={s.promoted ? 'green' : incSev}
        />
        {myRoleDrag ? (
          <KpiTile
            label={`${myRoleDrag.role} Drag`}
            value={`${Math.round(myRoleDrag.hours)}h`}
            sub={myRoleDrag.hours > 0 ? 'From your open linked risks' : 'No open risk drag on your tasks'}
            color={myRoleDrag.hours > 8 ? 'red' : myRoleDrag.hours > 0 ? 'amber' : 'green'}
          />
        ) : (
          <KpiTile
            label="UUM Items"
            value={uumCount}
            sub={uumCount > 0 ? (s.promoted ? 'Completed' : 'Scheduled') : 'None scheduled'}
            color={s.promoted ? 'green' : uumCount > 0 ? 'amber' : 'slate'}
          />
        )}
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
      <div className="flex flex-row min-[1160px]:flex-col flex-wrap items-center min-[1160px]:items-stretch justify-between gap-2 flex-shrink-0 min-[1160px]:min-w-48">
        {/* OpsMentor — desktop only; mobile/tablet use the top bar trigger */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('opsmanifest-orchestrator-open'))}
          className="hidden min-[1160px]:flex items-center gap-1.5 rounded-lg px-2 py-1 text-white text-xs font-bold hover:opacity-90 transition-opacity w-full"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #0d9488 100%)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-pulse flex-shrink-0" />
          <span className="flex-1 text-left">OpsMentor</span>
          <span className="text-teal-200">›</span>
        </button>
        {/* Risk bar */}
        <div className="min-w-24 min-[1160px]:min-w-0 min-[1160px]:w-full">
          <div className="flex items-center justify-between mb-1 gap-2">
            <span className="text-xs font-semibold text-slate-500">RISK</span>
            <span className="text-xs font-bold" style={{ color: riskColor }}>{riskLabel}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: riskScore + '%', backgroundColor: riskColor }}
            />
          </div>
          <div className="hidden min-[1160px]:block text-xs text-slate-400 mt-0.5">{s.ctx.hw} / {s.ctx.os}</div>
        </div>

        {/* Milestones — desktop only, tablet/mobile too tight for 7 dots */}
        <div className="hidden min-[1160px]:flex gap-1 items-start">
          {milestones.map((m, i) => (
            <div key={m.label} className="flex items-center gap-0.5">
              <MilestoneDot label={m.label} done={m.done} />
              {i < milestones.length - 1 && (
                <div className={`w-3 milestone-line ${m.done && milestones[i+1].done ? 'done' : ''}`} />
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
            onClick={() => openAuthModal('signup')}
            className="flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 transition-colors"
          >
            <div className="w-4 h-4 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
              {authUser.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="hidden min-[520px]:inline text-xs text-slate-600 font-medium leading-tight">{authUser.displayName}</span>
            <span className={`text-xs font-bold rounded px-1 ${PLAN_BADGE[authUser.plan] || PLAN_BADGE.free}`}>
              {PLANS[authUser.plan]?.name}
            </span>
          </button>
        ) : (
          <button
            onClick={() => openAuthModal('signup')}
            className="text-xs text-teal-600 border border-teal-200 rounded px-2 py-1 hover:bg-teal-50 transition-colors font-semibold"
          >
            Sign In / Plans
          </button>
        )}
      </div>
    </div>
  );
}
