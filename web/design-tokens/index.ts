/**
 * Design Tokens Index
 *
 * Central export for all design tokens.
 * Use this file to import tokens throughout the application.
 */

export * from './colors';

import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';

import { antdTokens, borderRadius, fontSize, semanticColors, shadows, spacing, transitions, zIndex } from './colors';

/**
 * Complete token object for Tailwind config
 */
export const tokens = {
  colors: {
    // Theme colors
    theme: {
      primary: semanticColors.accent.primary,
      'primary-hover': semanticColors.accent.hover,
      'primary-active': semanticColors.accent.active,
      light: semanticColors.surface.base,
      dark: semanticColors.surface.dark.base,
      'dark-container': semanticColors.surface.dark.container,
      success: semanticColors.status.success,
      error: semanticColors.status.error,
      warning: semanticColors.status.warning,
    },

    // Semantic surface colors
    surface: semanticColors.surface,

    // Semantic text colors
    text: semanticColors.text,

    // Semantic border colors
    border: semanticColors.border,

    // Status colors
    status: semanticColors.status,

    // Accent colors
    accent: semanticColors.accent,
  },

  spacing,
  fontSize,
  boxShadow: shadows,
  borderRadius,
  zIndex,
  transition: transitions,
};

/**
 * Get Ant Design theme config based on mode
 */
export function getAntdTheme(mode: 'light' | 'dark'): ThemeConfig {
  return {
    token: antdTokens[mode],
    algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  };
}

/**
 * CSS variable mapping for direct CSS usage
 * These can be used in globals.css or inline styles
 */
export const cssVariables = {
  '--color-primary': semanticColors.accent.primary,
  '--color-success': semanticColors.status.success,
  '--color-warning': semanticColors.status.warning,
  '--color-error': semanticColors.status.error,
  '--color-info': semanticColors.status.info,
  '--surface-base': semanticColors.surface.base,
  '--surface-elevated': semanticColors.surface.elevated,
  '--surface-dark-base': semanticColors.surface.dark.base,
  '--surface-dark-elevated': semanticColors.surface.dark.elevated,
  '--text-primary': semanticColors.text.primary,
  '--text-secondary': semanticColors.text.secondary,
  '--text-inverse': semanticColors.text.inverse,
  '--border-default': semanticColors.border.default,
  '--border-strong': semanticColors.border.strong,
  '--radius-default': `${borderRadius.DEFAULT}px`,
  '--radius-lg': `${borderRadius.lg}px`,
  '--shadow-sm': shadows.sm,
  '--shadow-default': shadows.DEFAULT,
  '--shadow-md': shadows.md,
} as const;

/**
 * Common Tailwind class combinations
 * Use these to maintain consistency
 */
export const classNames = {
  // Surface classes
  surface: {
    base: 'bg-theme-light dark:bg-theme-dark',
    elevated: 'bg-white dark:bg-theme-dark-container',
  },

  // Text classes
  text: {
    primary: 'text-gray-900 dark:text-gray-100',
    secondary: 'text-gray-600 dark:text-gray-400',
    muted: 'text-gray-500 dark:text-gray-500',
  },

  // Border classes
  border: {
    default: 'border-gray-200 dark:border-gray-700',
    strong: 'border-gray-300 dark:border-gray-600',
  },

  // Card classes
  card: 'bg-white dark:bg-theme-dark-container rounded-lg shadow-sm border border-gray-200 dark:border-gray-700',

  // Input classes
  input:
    'bg-white dark:bg-theme-dark-container border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:ring-2 focus:ring-theme-primary focus:border-transparent',

  // Button variants
  button: {
    primary: 'bg-theme-primary text-white hover:bg-theme-primary-hover rounded px-4 py-2 transition-colors',
    secondary:
      'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded px-4 py-2 transition-colors',
    ghost: 'text-theme-primary hover:bg-theme-primary-subtle rounded px-4 py-2 transition-colors',
  },
};
