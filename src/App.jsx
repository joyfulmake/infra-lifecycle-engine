import { useState, useEffect } from 'react';
import PhasePanel from './components/PhasePanel.jsx';
import ExecOverview from './components/ExecOverview.jsx';
import PmTabs from './components/PmTabs.jsx';
import AuthModal from './components/AuthModal.jsx';
import DemoTour from './components/DemoTour.jsx';
import OrchestratorPanel from './components/OrchestratorPanel.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import { useAuth } from './lib/AuthContext.jsx';
import { useStore } from './store/useStore.js';

// Below this viewport width, sidebar (360) + center (400 min) + mentor (360) no
// longer fit side by side — both side panels switch from docked columns to
// off-canvas overlays. Kept in sync with the `min-[1160px]:` classes below.
const DESKTOP_BP = 1160;

export default function App() {
  const { showAuthModal, setShowAuthModal, authModalReason } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mentorOpen, setMentorOpen] = useState(false);
  // Collapse-to-strip is a desktop-docked convenience (user-toggled via the
  // panel's own Collapse button). The mobile/tablet overlay always opens
  // full-width, so it never starts pre-collapsed regardless of viewport.
  const [mentorCollapsed, setMentorCollapsed] = useState(false);
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

  // Close mobile/tablet overlays automatically when resizing up to desktop width
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= DESKTOP_BP) {
        setSidebarOpen(false);
        setMentorOpen(false);
      }
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Lock background scroll while a mobile overlay panel is open
  useEffect(() => {
    if (sidebarOpen || mentorOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [sidebarOpen, mentorOpen]);

  return (
    <>
      <div className="flex h-screen bg-slate-100 overflow-hidden relative">
        {/* Mobile/tablet top bar — hidden at desktop width */}
        <div className="mobile-topbar min-[1160px]:hidden">
          <button
            aria-label="Open workflow menu"
            onClick={() => setSidebarOpen(true)}
            className="mobile-topbar-btn"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="mobile-topbar-title">OpsManifest</span>
          <button
            aria-label="Open OpsMentor"
            onClick={() => setMentorOpen(true)}
            className="mobile-topbar-btn mobile-topbar-btn--accent"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.06 0-2.077-.162-3.02-.46L3 21l1.55-3.72C3.57 15.97 3 14.54 3 13c0-4.418 4.03-8 9-8s9 3.582 9 7z" />
            </svg>
          </button>
        </div>

        {/* Left panel: phase workflow (docked on desktop, drawer below 1160px) */}
        <div
          className={`app-sidebar sidebar-root h-full overflow-y-auto overflow-x-hidden flex-shrink-0 ${sidebarOpen ? 'is-open' : ''}`}
          style={{ width: '360px' }}
        >
          <button
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
            className="app-drawer-close min-[1160px]:hidden"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <PhasePanel />
        </div>

        {/* Centre: executive overview + tabs */}
        <div className="app-center flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white main-root">
          <div className="flex-shrink-0 h-auto min-[1160px]:h-24">
            <ExecOverview />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <PmTabs />
          </div>
        </div>

        {/* OpsMentor — docked right panel on desktop; collapses to a 40px strip when
            minimized, or becomes a full off-canvas overlay below 1160px */}
        <div
          className={`app-mentor flex-shrink-0 h-full overflow-hidden ${mentorOpen ? 'is-open' : ''}`}
          style={{
            width: mentorCollapsed ? '36px' : '360px',
            borderLeft: '1px solid rgba(13,148,136,0.18)',
            background: '#fff',
            transition: 'width 0.25s ease',
          }}
        >
          <button
            aria-label="Close OpsMentor"
            onClick={() => setMentorOpen(false)}
            className="app-drawer-close min-[1160px]:hidden"
            style={{ left: 8, right: 'auto' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <OrchestratorPanel docked initialCollapsed={mentorCollapsed} onCollapsedChange={setMentorCollapsed} />
        </div>

        {/* Shared backdrop for mobile/tablet overlays */}
        <div
          className={`app-backdrop min-[1160px]:hidden ${(sidebarOpen || mentorOpen) ? 'is-open' : ''}`}
          onClick={() => { setSidebarOpen(false); setMentorOpen(false); }}
        />
      </div>

      {showAuthModal && <AuthModal reason={authModalReason} onClose={() => setShowAuthModal(false)} />}
      <DemoTour />
      <CommandPalette />
    </>
  );
}
