import type { Config } from 'tailwindcss';

/**
 * CDS theme: slate structure + teal accent.
 * Colors resolve from CSS variables so light/dark modes stay in sync.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--cds-canvas)',
        surface: 'var(--cds-surface)',
        elevated: 'var(--cds-elevated)',
        ink: 'var(--cds-ink)',
        muted: 'var(--cds-muted)',
        line: 'var(--cds-line)',
        subtle: 'var(--cds-subtle)',
        accent: 'var(--cds-accent)',
        'accent-fg': 'var(--cds-accent-fg)',
        'accent-soft': 'var(--cds-accent-soft)',
        danger: 'var(--cds-danger)',
        'danger-soft': 'var(--cds-danger-soft)',
      },
      fontFamily: {
        sans: ['var(--font-cds)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: 'var(--cds-shadow)',
      },
      borderRadius: {
        DEFAULT: '10px',
      },
    },
  },
  plugins: [],
};

export default config;
