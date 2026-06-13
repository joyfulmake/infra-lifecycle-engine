import { useStore } from '../store/useStore.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useCoherenceEngine } from '../lib/useCoherenceEngine.js';
import ExecSummaryTab from './tabs/ExecSummaryTab.jsx';
import SystemDesignTab from './tabs/SystemDesignTab.jsx';
import GanttTab from './tabs/GanttTab.jsx';
import RaidTab from './tabs/RaidTab.jsx';
import RtmTab from './tabs/RtmTab.jsx';
import ClosureTab from './tabs/ClosureTab.jsx';
import InfraDiagramTab from './tabs/InfraDiagramTab.jsx';
import CmdbTab from './tabs/CmdbTab.jsx';
import RolesTab from './tabs/RolesTab.jsx';
import MatrixTab from './tabs/MatrixTab.jsx';
import VulnTab from './tabs/VulnTab.jsx';
import RiskTrackerTab from './tabs/RiskTrackerTab.jsx';
import CostTab from './tabs/CostTab.jsx';

const TABS = [
  {
    id: 'exec',
    label: 'Executive Summary',
    unlocked: () => true,
  },
  {
    id: 'diagram',
    label: 'Infra Diagram',
    unlocked: s => s.isBuilt,
    lockMsg: 'Build environment first',
  },
  {
    id: 'cmdb',
    label: 'CMDB',
    unlocked: s => s.isBuilt,
    lockMsg: 'Build environment first',
    proBadge: true,
  },
  {
    id: 'design',
    label: 'System Design',
    unlocked: s => s.scanComplete,
    lockMsg: 'Complete AI Smart Scan first',
  },
  {
    id: 'gantt',
    label: 'Gantt',
    unlocked: s => s.designApplied,
    lockMsg: 'Apply System Design first (Generate Task Plan)',
    staleDot: s => !!s.tasksStaleReason,
  },
  {
    id: 'raid',
    label: 'RAID',
    unlocked: s => s.phase2Active,
    lockMsg: 'Start Phase 2 first',
  },
  {
    id: 'rtm',
    label: 'RTM',
    unlocked: s => s.phase2Active,
    lockMsg: 'Start Phase 2 first',
    staleDot: s => !!s.rtmStale,
  },
  {
    id: 'closure',
    label: 'Closure',
    unlocked: s => s.rtmSigned,
    lockMsg: 'Complete RTM sign-off first',
  },
  {
    id: 'roles',
    label: 'Roles',
    unlocked: s => s.isBuilt,
    lockMsg: 'Build environment first',
  },
  {
    id: 'matrix',
    label: 'Matrix',
    unlocked: s => s.phase2Active,
    lockMsg: 'Inject Phase 2 to activate',
  },
  {
    id: 'vuln',
    label: 'Vulnerabilities',
    unlocked: s => s.isBuilt,
    lockMsg: 'Build environment first',
    staleDot: s => (s.vulnRegistry || []).some(v => v.status === 'ACTIVE'),
  },
  {
    id: 'risks',
    label: 'Risk Tracker',
    unlocked: () => true,
    // Amber dot when risk score is high — computed inline
    staleDot: s => {
      const crit = (s.coherenceAlerts || []).filter(a => a.severity === 'warn').length > 0;
      const vuln = (s.vulnRegistry || []).some(v => v.status === 'ACTIVE');
      const disc = (s.stakeholderDiscussions || []).some(d => d.status === 'PENDING');
      return crit || vuln || disc || s.rtmStale || !!s.tasksStaleReason || s.cabDeclined;
    },
  },
  {
    id: 'cost',
    label: 'Cost',
    unlocked: () => true,
    // No staleDot — cost tab is always neutral unless over budget
  },
];

function TabContent({ activeTab }) {
  switch (activeTab) {
    case 'exec': return <ExecSummaryTab />;
    case 'diagram': return <InfraDiagramTab />;
    case 'cmdb': return <CmdbTab />;
    case 'design': return <SystemDesignTab />;
    case 'gantt': return <GanttTab />;
    case 'raid': return <RaidTab />;
    case 'rtm': return <RtmTab />;
    case 'closure': return <ClosureTab />;
    case 'roles': return <RolesTab />;
    case 'matrix': return <MatrixTab />;
    case 'vuln':   return <VulnTab />;
    case 'risks':  return <RiskTrackerTab />;
    case 'cost':   return <CostTab />;
    default: return <ExecSummaryTab />;
  }
}

function getNextTabId(s) {
  if (s.unlockedForRevision) return null;
  if (!s.isBuilt) return null;
  // Scan runs in the sidebar — no tab to point to until scan is done
  if (!s.scanComplete) return null;
  // System Design tab is the next concrete step after scan
  if (!s.designApplied) return 'design';
  // After design applied, Phase 2 injection happens in sidebar — no tab to highlight
  // Once injected, Gantt shows the full task schedule including UUM + incident tasks
  if (!s.phase2Active) return null;
  // After Phase 2: review Gantt first, then RTM, then Closure
  if (!s.cabApproved && !s.cabDeclined) return 'gantt';
  if (!s.rtmSigned) return 'rtm';
  if (!s.promoted) return 'closure';
  return null;
}

export default function PmTabs() {
  const s = useStore();
  const { authUser } = useAuth();
  const activeTab = s.activeTab || 'exec';

  useCoherenceEngine();

  const nextTabId = getNextTabId(s);

  function isTabUnlocked(tab) {
    if (s.unlockedForRevision) return true;
    return tab.unlocked(s);
  }

  function handleTabClick(tab) {
    if (!isTabUnlocked(tab)) return;
    s.setActiveTab(tab.id);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Revision mode banner */}
      {s.unlockedForRevision && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
          <span className="text-xs text-amber-700 font-semibold">Revision Mode</span>
          <span className="text-xs text-amber-600">— All tabs unlocked. Update scope, design, or tasks then resubmit to CAB from the sidebar.</span>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-end gap-0.5 px-4 pt-2 bg-white border-b border-slate-200 flex-shrink-0 overflow-x-auto">
        {TABS.map(tab => {
          const unlocked = isTabUnlocked(tab);
          const isActive = activeTab === tab.id;
          const isNext = !isActive && unlocked && tab.id === nextTabId;
          const showStaleDot = unlocked && tab.staleDot && tab.staleDot(s);
          const insightCount = s.coherenceAlerts.filter(a => a.tabs.includes(tab.id)).length;
          const showInsightDot = unlocked && insightCount > 0;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              title={!unlocked ? tab.lockMsg : isNext ? 'Next recommended step' : undefined}
              className={[
                'tab-btn relative',
                isActive ? 'tab-btn-active' : '',
                !unlocked ? 'opacity-40 cursor-not-allowed' : '',
                isNext ? 'ring-2 ring-teal-400 ring-offset-1 animate-pulse-subtle' : '',
              ].join(' ')}
              disabled={!unlocked}
            >
              {tab.label}
              {isNext && (
                <span className="inline-block ml-1 text-xs bg-teal-500 text-white font-bold rounded px-1 py-0 leading-tight animate-pulse">
                  Next
                </span>
              )}
              {tab.proBadge && (
                <span className="inline-block ml-1 text-xs bg-teal-100 text-teal-700 font-bold rounded px-1 py-0 leading-tight">
                  Pro
                </span>
              )}
              {showStaleDot && (
                <span className="inline-block ml-1 w-1.5 h-1.5 rounded-full bg-amber-400 align-middle animate-pulse" title="Needs attention" />
              )}
              {showInsightDot && (
                <span className="inline-block ml-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 align-middle" title={`${insightCount} agent insight(s)`} />
              )}
              {tab.id === 'exec' && s.promoted && (
                <span className="inline-block ml-1 text-xs bg-green-100 text-green-700 font-bold rounded px-1 py-0 leading-tight">Live</span>
              )}
              {!unlocked && (
                <svg className="inline-block ml-1 w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <TabContent activeTab={activeTab} />
      </div>
    </div>
  );
}
