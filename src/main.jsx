import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
// Inter loaded via Google Fonts link tag in index.html
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'

// Service worker handling — web context only, never MSIX packaged context.
if ('serviceWorker' in navigator) {
  if (window.location.href.startsWith('ms-appx-web:')) {
    // MSIX packaged context: actively unregister any previously registered service workers.
    // A SW installed by an older MSIX version can survive updates and will crash the
    // WebView2 renderer on Windows 11 24H2 by intercepting ms-appx-web: scheme fetch events.
    navigator.serviceWorker.getRegistrations()
      .then(regs => regs.forEach(r => r.unregister()))
      .catch(() => {});
  } else {
    // Web context — register SW for PWA offline support.
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

// In the MSIX packaged context: prevent unhandled errors from crashing WebView2.
// Only suppress in ms-appx-web: — in the browser, let errors surface normally.
if (window.location.href.startsWith('ms-appx-web:')) {
  window.addEventListener('unhandledrejection', (e) => { e.preventDefault(); });
  window.onerror = () => true;
}

// Root error boundary — prevents a React render crash from showing a blank screen
class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position:'fixed',inset:0,display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',
          background:'#0f172a',gap:16,padding:24,textAlign:'center'
        }}>
          <img src="/icon-192.png" alt="OpsManifest" style={{width:64,height:64,borderRadius:12}} />
          <div style={{color:'#f1f5f9',fontFamily:'Inter,sans-serif',fontSize:17,fontWeight:600}}>OpsManifest</div>
          <div style={{color:'#94a3b8',fontFamily:'Inter,sans-serif',fontSize:13}}>
            The application could not load. Please check your connection and try again.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop:8,background:'#0d9488',color:'#fff',border:'none',
              padding:'8px 24px',borderRadius:6,cursor:'pointer',
              fontFamily:'Inter,sans-serif',fontSize:14,fontWeight:500
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppErrorBoundary>
  </StrictMode>,
);

// Remove splash screen once React has painted
window.__appMounted = false;
function removeSplash() {
  window.__appMounted = true;
  if (window.__splashFallbackTimer) {
    clearTimeout(window.__splashFallbackTimer);
  }
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.style.transition = 'opacity 0.3s';
  splash.style.opacity = '0';
  setTimeout(() => splash.remove(), 320);
}
requestAnimationFrame(() => requestAnimationFrame(removeSplash));
