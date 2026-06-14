import PhasePanel from './components/PhasePanel.jsx';
import ExecOverview from './components/ExecOverview.jsx';
import PmTabs from './components/PmTabs.jsx';
import AuthModal from './components/AuthModal.jsx';
import DemoTour from './components/DemoTour.jsx';
import OrchestratorPanel from './components/OrchestratorPanel.jsx';
import { useAuth } from './lib/AuthContext.jsx';

export default function App() {
  const { showAuthModal, setShowAuthModal, authModalReason } = useAuth();

  return (
    <>
      <div className="flex h-screen bg-slate-100 overflow-hidden">
        {/* Left panel: phase workflow */}
        <div className="flex-shrink-0 h-full overflow-y-auto overflow-x-hidden sidebar-root" style={{ width: '320px' }}>
          <PhasePanel />
        </div>

        {/* Centre: executive overview + tabs */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white main-root">
          <div className="flex-shrink-0" style={{ height: '96px' }}>
            <ExecOverview />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <PmTabs />
          </div>
        </div>

        {/* OpsMentor — docked right panel, always present, avatar of the app */}
        <div
          className="flex-shrink-0 h-full overflow-hidden"
          style={{ width: '360px', borderLeft: '1px solid rgba(13,148,136,0.18)', background: '#fff' }}
        >
          <OrchestratorPanel docked />
        </div>
      </div>

      {showAuthModal && <AuthModal reason={authModalReason} onClose={() => setShowAuthModal(false)} />}
      <DemoTour />
    </>
  );
}
