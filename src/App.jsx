import PhasePanel from './components/PhasePanel.jsx';
import ExecOverview from './components/ExecOverview.jsx';
import PmTabs from './components/PmTabs.jsx';
import AuthModal from './components/AuthModal.jsx';
import { useAuth } from './lib/AuthContext.jsx';

export default function App() {
  const { showAuthModal, setShowAuthModal } = useAuth();

  return (
    <>
      <div className="flex h-screen bg-slate-100 overflow-hidden">
        {/* Left panel: phase workflow */}
        <div className="flex-shrink-0 h-full overflow-y-auto overflow-x-hidden" style={{ width: '320px', background: '#1A2E4A' }}>
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

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </>
  );
}
