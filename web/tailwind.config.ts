import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        abyss: {
          950: '#03060c',
          900: '#060b14',
          850: '#08101c',
          800: '#0b1524',
          700: '#111e33',
          600: '#1a2a44',
        },
        ink: {
          DEFAULT: '#e6eef8',
          muted: '#9fb0c6',
          dim: '#6b7d95',
        },
        line: {
          DEFAULT: 'rgba(140, 180, 220, 0.14)',
          strong: 'rgba(140, 180, 220, 0.26)',
        },
        accent: {
          DEFAULT: '#22d3ee',
          soft: 'rgba(34, 211, 238, 0.14)',
          glow: 'rgba(34, 211, 238, 0.45)',
        },
        ready: { DEFAULT: '#34d399', soft: 'rgba(52, 211, 153, 0.14)' },
        watch: { DEFAULT: '#fbbf24', soft: 'rgba(251, 191, 36, 0.14)' },
        risk: { DEFAULT: '#fb4d5d', soft: 'rgba(251, 77, 93, 0.16)' },
        stale: { DEFAULT: '#94a3b8', soft: 'rgba(148, 163, 184, 0.14)' },
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glass: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 50px -20px rgba(0,0,0,0.7)',
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
