import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
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
})
