/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1A2E4A',
        teal: { DEFAULT: '#0D9488', light: '#14B8A6' },
        slate: {
          25: '#F8FAFC',
          850: '#1E293B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Slightly lifted for density — 1px increase on xs/sm only
        'xs':   ['0.8125rem', { lineHeight: '1.2rem' }],    // 13px (was 12px)
        'sm':   ['0.875rem',  { lineHeight: '1.4rem' }],    // 14px (unchanged)
      },
      spacing: {
        // Add slightly more granular spacing for comfortable gaps in dense panels
        '0.75': '0.1875rem',
        '1.25': '0.3125rem',
        '2.5':  '0.625rem',
      },
    },
  },
  plugins: [],
}

