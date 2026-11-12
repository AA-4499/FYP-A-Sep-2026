/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        clinical: {
          ground: 'var(--clinical-ground)',
          surface: 'var(--clinical-surface)',
          elevated: 'var(--clinical-elevated)',
          subtleBg: 'var(--clinical-subtle-bg)',
          border: 'var(--clinical-border)',
          borderStrong: 'var(--clinical-border-strong)',
          borderSubtle: 'var(--clinical-border-subtle)',
          ink: 'var(--clinical-ink)',
          secondary: 'var(--clinical-ink-secondary)',
          muted: 'var(--clinical-ink-muted)',
          faint: 'var(--clinical-ink-faint)',
          primary: 'var(--clinical-primary)',
          primaryHover: 'var(--clinical-primary-hover)',
          primarySubtle: 'var(--clinical-primary-subtle)',
          primaryBorder: 'var(--clinical-primary-border)',
          accent: 'var(--clinical-accent)',
          accentSubtle: 'var(--clinical-accent-subtle)',
          safe: 'var(--clinical-safe)',
          safeSubtle: 'var(--clinical-safe-subtle)',
          caution: 'var(--clinical-caution)',
          cautionSubtle: 'var(--clinical-caution-subtle)',
          critical: 'var(--clinical-critical)',
          criticalSubtle: 'var(--clinical-critical-subtle)',
        },
        brand: {
          dark: '#0f172a',
          primary: '#1769aa',
          accent: '#087f5b',
          danger: '#c92a3a',
          warning: '#d98b00',
        }
      },
      boxShadow: {
        'clinical-subtle': 'var(--shadow-clinical-subtle)',
        'clinical-card': 'var(--shadow-clinical-card)',
        'clinical-dropdown': 'var(--shadow-clinical-dropdown)',
        'clinical-modal': 'var(--shadow-clinical-modal)',
      }
    },
  },
  plugins: [],
}
