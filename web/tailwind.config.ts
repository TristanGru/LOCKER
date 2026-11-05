import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        abyss: {
          950: 'rgb(var(--abyss-950) / <alpha-value>)',
          900: 'rgb(var(--abyss-900) / <alpha-value>)',
          850: 'rgb(var(--abyss-850) / <alpha-value>)',
          800: 'rgb(var(--abyss-800) / <alpha-value>)',
          700: 'rgb(var(--abyss-700) / <alpha-value>)',
          600: 'rgb(var(--abyss-600) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
          dim: 'rgb(var(--ink-dim) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent) / 0.14)',
          glow: 'rgb(var(--accent) / 0.45)',
        },
        ready: { DEFAULT: 'rgb(var(--ready) / <alpha-value>)', soft: 'rgb(var(--ready) / 0.14)' },
        watch: { DEFAULT: 'rgb(var(--watch) / <alpha-value>)', soft: 'rgb(var(--watch) / 0.14)' },
        risk: { DEFAULT: 'rgb(var(--risk) / <alpha-value>)', soft: 'rgb(var(--risk) / 0.16)' },
        stale: { DEFAULT: 'rgb(var(--stale) / <alpha-value>)', soft: 'rgb(var(--stale) / 0.14)' },
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glass: 'var(--shadow-glass)',
        focus: '0 0 0 1px rgba(34,211,238,0.7), 0 0 24px -4px rgba(34,211,238,0.5)',
        risk: '0 0 0 1px rgba(251,77,93,0.7), 0 0 28px -4px rgba(251,77,93,0.6)',
      },
      keyframes: {
        sweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(251,77,93,0.65)' },
          '70%': { boxShadow: '0 0 0 18px rgba(251,77,93,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(251,77,93,0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        sweep: 'sweep 6s linear infinite',
        pulseRing: 'pulseRing 1.8s ease-out infinite',
        blink: 'blink 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
