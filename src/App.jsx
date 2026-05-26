import PhasePanel from './components/PhasePanel.jsx';
import ExecOverview from './components/ExecOverview.jsx';
import PmTabs from './components/PmTabs.jsx';

export default function App() {
  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Left panel: phase workflow */}
      <div className="w-60 flex-shrink-0 h-full overflow-y-auto overflow-x-hidden" style={{ background: '#1A2E4A' }}>
        <PhasePanel />
      </div>

      {/* Right side: overview + tabs */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white">
        {/* Executive overview strip */}
        <div className="flex-shrink-0" style={{ height: '96px' }}>
          <ExecOverview />
        </div>

        {/* PM tabbed interface */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <PmTabs />
        </div>
      </div>
    </div>
  );
}
