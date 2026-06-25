import { useState, useEffect } from 'react';
import PhasePanel from './components/PhasePanel.jsx';
import ExecOverview from './components/ExecOverview.jsx';
import PmTabs from './components/PmTabs.jsx';
import AuthModal from './components/AuthModal.jsx';
import DemoTour from './components/DemoTour.jsx';
import OrchestratorPanel from './components/OrchestratorPanel.jsx';
import { useAuth } from './lib/AuthContext.jsx';
import { useStore } from './store/useStore.js';

export default function App() {
  const { showAuthModal, setShowAuthModal, authModalReason } = useAuth();
  // Start collapsed on viewports too narrow for all three panels (sidebar 360 + center ≥ 400 + panel 360 = 1120 min).
  const initialCollapsed = window.innerWidth < 1160;
  const [mentorCollapsed, setMentorCollapsed] = useState(initialCollapsed);
  const ctx = useStore(s => s.ctx);

  useEffect(() => {
    const db = (ctx?.db || '').toLowerCase();
    const os = (ctx?.os || '').toLowerCase();
    const hw = (ctx?.hw || '').toLowerCase();
    let theme = '';
    if (/oracle/.test(db)) theme = 'oracle';
    else if (/aix/.test(os) || /power/.test(hw)) theme = 'aix';
    else if (/sql.?server|mssql/.test(db)) theme = 'mssql';
    else if (/postgres|pg\b/.test(db)) theme = 'postgres';
    else if (/rhel|red.?hat/.test(os)) theme = 'rhel';
    document.documentElement.setAttribute('data-stack-theme', theme);
  }, [ctx]);

  return (
    <>
      <div className="flex h-screen bg-slate-100 overflow-hidden">
        {/* Left panel: phase workflow */}
        <div className="flex-shrink-0 h-full overflow-y-auto overflow-x-hidden sidebar-root" style={{ width: '360px' }}>
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

        {/* OpsMentor — docked right panel; collapses to a 40px strip when minimized */}
        <div
          className="flex-shrink-0 h-full overflow-hidden"
          style={{
            width: mentorCollapsed ? '36px' : '360px',
            borderLeft: '1px solid rgba(13,148,136,0.18)',
            background: '#fff',
            transition: 'width 0.25s ease',
          }}
        >
          <OrchestratorPanel docked initialCollapsed={initialCollapsed} onCollapsedChange={setMentorCollapsed} />
        </div>
      </div>

      {showAuthModal && <AuthModal reason={authModalReason} onClose={() => setShowAuthModal(false)} />}
      <DemoTour />
    </>
  );
}
