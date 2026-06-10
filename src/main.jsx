import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'

// Register service worker for PWA / offline support
if ('serviceWorker' in navigator) {
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
