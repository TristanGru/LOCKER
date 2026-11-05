import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Institutional look: square corners (2px), no frosted glass. Status dots keep "full".
    borderRadius: { none: "0", sm: "1px", DEFAULT: "2px", md: "2px", lg: "2px", xl: "2px", "2xl": "3px", "3xl": "3px", full: "9999px" },
    backdropBlur: { none: "0", sm: "0", DEFAULT: "0", md: "0", lg: "0", xl: "0", "2xl": "0", "3xl": "0" },
    extend: {
      colors: {
        masthead: 'rgb(var(--masthead) / <alpha-value>)',
        banner: 'rgb(var(--banner) / <alpha-value>)',
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
        // Public Sans is the U.S. government typeface (USWDS); Plex Mono for figures and record IDs.
        sans: ['"Public Sans"', '"Segoe UI"', 'Arial', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'Consolas', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glass: 'var(--shadow-glass)',
        focus: '0 0 0 2px rgb(var(--accent))',
        risk: '0 0 0 2px rgb(var(--risk))',
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
