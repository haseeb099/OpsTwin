import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#09090b',
          raised: '#0f0f12',
          overlay: '#18181b',
          border: '#27272a',
          'border-hover': '#3f3f46',
        },
        brand: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
          muted: 'rgba(99, 102, 241, 0.12)',
        },
        success: '#22c55e',
        warning: '#eab308',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.06)',
        glow: '0 0 24px -4px rgba(99, 102, 241, 0.35)',
      },
    },
  },
  plugins: [],
}

export default config
