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
      // Tailwind's built-in color-opacity modifier (text-white/72, bg-black/52,
      // etc.) only resolves values present in this scale — by default that's
      // multiples of 5 only (0,5,10,...,95,100). This codebase has used
      // non-multiple-of-5 values (text-white/82, /78, /72, /62, /58, /52, and
      // a few others) throughout the sidebar for months, on the assumption
      // they worked — they didn't: Tailwind silently generated no CSS for
      // any of them, and those elements only *looked* correct wherever they
      // happened to sit inside a parent with a real (multiple-of-5) opacity
      // color, inheriting its color by accident. Anywhere that inheritance
      // luck ran out (e.g. a standalone <h1>/<p> with no such ancestor) the
      // text silently fell back to the browser/OS default (near-black),
      // invisible against a dark background. Found 2026-09-18 via the
      // OnboardingWizard's headline being unreadable in dark theme — fixed
      // at the root by adding every non-standard value actually in use
      // (verified via `grep -rohE "...-.../([0-9]{1,3})" src/` across the
      // whole codebase) rather than patching call sites one at a time.
      opacity: {
        3: '0.03', 4: '0.04', 8: '0.08', 12: '0.12', 28: '0.28',
        52: '0.52', 58: '0.58', 62: '0.62', 72: '0.72', 78: '0.78', 82: '0.82',
      },
    },
  },
  plugins: [],
}

