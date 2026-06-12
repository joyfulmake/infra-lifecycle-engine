import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base ensures paths work from ms-appx-web:/// in MSIX packaged builds
  // as well as standard CDN hosting — avoids absolute-path resolution issues in
  // the Windows WebView2 container used by packaged hosted web apps.
  base: './',
})
