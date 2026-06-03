import { StrictMode } from 'react'
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

const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);

// Remove splash screen once React has painted
function removeSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.style.transition = 'opacity 0.3s';
  splash.style.opacity = '0';
  setTimeout(() => splash.remove(), 320);
}
requestAnimationFrame(() => requestAnimationFrame(removeSplash));
// Hard fallback: force-remove after 4s in case React throws during mount
setTimeout(removeSplash, 4000);
