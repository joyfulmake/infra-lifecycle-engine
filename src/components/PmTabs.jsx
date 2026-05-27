import { useStore } from '../store/useStore.js';
import ExecSummaryTab from './tabs/ExecSummaryTab.jsx';
import SystemDesignTab from './tabs/SystemDesignTab.jsx';
import GanttTab from './tabs/GanttTab.jsx';
import RaidTab from './tabs/RaidTab.jsx';
import RtmTab from './tabs/RtmTab.jsx';
import ClosureTab from './tabs/ClosureTab.jsx';
import InfraDiagramTab from './tabs/InfraDiagramTab.jsx';

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
    id: 'design',
    label: 'System Design',
    unlocked: s => s.scanComplete,
    lockMsg: 'Complete AI Smart Scan first',
  },
  {
    id: 'gantt',
    label: 'Gantt',
    unlocked: s => s.designApplied,
    lockMsg: 'Apply System Design first',
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
  },
  {
    id: 'closure',
    label: 'Closure',
    unlocked: s => s.promoted,
    lockMsg: 'Execute production cutover first',
  },
];

function TabContent({ activeTab }) {
  switch (activeTab) {
    case 'exec': return <ExecSummaryTab />;
    case 'diagram': return <InfraDiagramTab />;
    case 'design': return <SystemDesignTab />;
    case 'gantt': return <GanttTab />;
    case 'raid': return <RaidTab />;
    case 'rtm': return <RtmTab />;
    case 'closure': return <ClosureTab />;
    default: return <ExecSummaryTab />;
  }
}

export default function PmTabs() {
  const s = useStore();
  const activeTab = s.activeTab || 'exec';

  function handleTabClick(tab) {
    const tabDef = TABS.find(t => t.id === tab.id);
    if (!tabDef || !tabDef.unlocked(s)) return;
    s.setActiveTab(tab.id);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab bar */}
      <div className="flex items-end gap-0.5 px-4 pt-2 bg-white border-b border-slate-200 flex-shrink-0">
        {TABS.map(tab => {
          const unlocked = tab.unlocked(s);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              title={!unlocked ? tab.lockMsg : undefined}
              className={[
                'tab-btn relative',
                isActive ? 'tab-btn-active' : '',
                !unlocked ? 'opacity-40 cursor-not-allowed' : '',
              ].join(' ')}
              disabled={!unlocked}
            >
              {tab.label}
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
