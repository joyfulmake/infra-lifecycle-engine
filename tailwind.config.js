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
        // Bump every step up slightly for readability — 2px increase across the board
        'xs':   ['0.8125rem', { lineHeight: '1.25rem' }],   // 13px  (was 12px)
        'sm':   ['0.9375rem', { lineHeight: '1.5rem' }],    // 15px  (was 14px)
        'base': ['1.0625rem', { lineHeight: '1.75rem' }],   // 17px  (was 16px)
        'lg':   ['1.1875rem', { lineHeight: '1.875rem' }],  // 19px  (was 18px)
        'xl':   ['1.3125rem', { lineHeight: '1.875rem' }],  // 21px  (was 20px)
        '2xl':  ['1.5625rem', { lineHeight: '2rem' }],      // 25px  (was 24px)
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

