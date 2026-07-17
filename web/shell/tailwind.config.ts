import type { Config } from 'tailwindcss';
import tailwindcssAnimated from 'tailwindcss-animated';

/**
 * Tailwind config for the new shell.
 *
 * Per ADR 0001: Tailwind is restricted to layout/spacing/typography/responsive
 * utilities. Visual values (color, radius, shadow) come from design tokens via
 * CSS variables. No `important: true` (the legacy web/tailwind.config.js still
 * has it, but the new shell does not inherit that override).
 *
 * During the strangler migration the shell reuses components from web/components
 * and web/new-components, which were authored against web/tailwind.config.js.
 * To keep those components rendering correctly without forking them, we mirror
 * the legacy theme extensions here (colors, gradients, keyframes, animations).
 * The content glob also scans the legacy directories so Tailwind generates the
 * utility classes they reference. Once a domain fully migrates and the legacy
 * file is deleted, drop the corresponding glob entry.
 */
export default {
  content: [
    './app/**/*.{ts,tsx}',
    '../components/**/*.{ts,tsx}',
    '../new-components/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      height: { dvh: '100dvh' },
      minHeight: { dvh: '100dvh' },
      maxHeight: { dvh: '100dvh' },
      colors: {
        theme: {
          primary: '#0069fe',
          light: '#f7f7f7',
          dark: '#151622',
          'dark-container': '#232734',
          success: '#52C41A',
          error: '#FF4D4F',
          warning: '#FAAD14',
        },
        gradientL: '#00DAEF',
        gradientR: '#105EFF',
      },
      backgroundColor: {
        bar: '#e0e7f2',
      },
      textColor: {
        default: '#0C75FC',
      },
      backgroundImage: {
        'gradient-light': "url('/images/bg.png')",
        'gradient-dark': 'url("/images/bg_dark.png")',
        'button-gradient': 'linear-gradient(to right, theme("colors.gradientL"), theme("colors.gradientR"))',
        // Brand icon/avatar gradient - single source of truth (was hardcoded in 6 places)
        'icon-gradient': 'linear-gradient(to top right, #31afff, #1677ff)',
      },
      keyframes: {
        pulse1: {
          '0%, 100%': { transform: 'scale(1)', backgroundColor: '#bdc0c4' },
          '33.333%': { transform: 'scale(1.5)', backgroundColor: '#525964' },
        },
        pulse2: {
          '0%, 100%': { transform: 'scale(1)', backgroundColor: '#bdc0c4' },
          '33.333%': { transform: 'scale(1.0)', backgroundColor: '#bdc0c4' },
          '66.666%': { transform: 'scale(1.5)', backgroundColor: '#525964' },
        },
        pulse3: {
          '0%, 66.666%': { transform: 'scale(1)', backgroundColor: '#bdc0c4' },
          '100%': { transform: 'scale(1.5)', backgroundColor: '#525964' },
        },
      },
      animation: {
        pulse1: 'pulse1 1.2s infinite',
        pulse2: 'pulse2 1.2s infinite',
        pulse3: 'pulse3 1.2s infinite',
      },
    },
  },
  plugins: [tailwindcssAnimated],
} satisfies Config;
