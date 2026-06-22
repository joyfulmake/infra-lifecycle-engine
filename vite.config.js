import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
