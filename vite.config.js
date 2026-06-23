import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // Disable modulepreload link tags and their polyfill.
    // Vite 8 (rolldown) emits <link rel="modulepreload" crossorigin> for every vendor chunk.
    // The `crossorigin` attribute on local ms-appx-web: resources crashes WebView2 on
    // certain Windows 11 builds (26100.3194). Disabling modulePreload removes those tags.
    // Modern WebView2 supports ES modules natively — the polyfill is unnecessary.
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          if (id.includes('zustand'))       return 'vendor-zustand';
          if (id.includes('dexie'))         return 'vendor-dexie';
          if (id.includes('xlsx-js-style')) return 'vendor-xlsx';
          if (id.includes('firebase'))      return 'vendor-firebase';
        },
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/__tests__/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/lib/**/*.js'],
    },
  },
})
