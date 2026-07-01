import type { Config } from 'tailwindcss';

/**
 * Minimal monochrome SaaS palette: white background, black text, grey borders.
 * No gradients, no colourful accents.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111111',
        muted: '#6b7280',
        line: '#e5e7eb',
        surface: '#ffffff',
        subtle: '#f9fafb',
      },
      borderRadius: {
        DEFAULT: '6px',
      },
    },
  },
  plugins: [],
};

export default config;
