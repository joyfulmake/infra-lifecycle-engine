import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
// Inter bundled locally — no external network request on startup.
// fonts.googleapis.com is render-blocking and unreachable from ms-appx-web: context.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'

// Error suppression for ms-appx-web: is set in index.html inline script (runs before modules).
// Repeating here as a belt-and-suspenders in case the module loads on a path that wasn't caught.
if (window.location.href.startsWith('ms-appx-web:')) {
  window.onerror = () => true;
  window.addEventListener('unhandledrejection', (e) => { e.preventDefault(); });
}

// Service worker — web context ONLY.
// CRITICAL: never access navigator.serviceWorker in ms-appx-web: context.
// Calling ANY serviceWorker API (including getRegistrations) in ms-appx-web: crashes
// the WebView2 renderer on Windows 11 26200+ at the native level — no JS error is thrown,
// the process just dies. sw.js is excluded from the MSIX package so no SW can activate.
if (!window.location.href.startsWith('ms-appx-web:') && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
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
