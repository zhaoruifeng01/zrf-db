/**
 * Client-side preferences store (theme mode, language).
 *
 * Per ADR 0001 §状态层: Zustand holds cross-route client-only state. Theme is
 * a pure client preference - it has nothing to do with server state, so it
 * does not belong in TanStack Query or in route params.
 *
 * Persisted to localStorage via @dbgpt/shared/storage so the key registry
 * stays the single source of truth (STORAGE_KEYS.theme).
 */

import { create } from 'zustand';

import { STORAGE_KEYS, readRaw, writeRaw } from '@dbgpt/shared';

export type ThemeMode = 'light' | 'dark';

function resolveInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const stored = readRaw(STORAGE_KEYS.theme);
  if (stored === 'light' || stored === 'dark') return stored;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export interface PreferencesState {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const usePreferences = create<PreferencesState>(set => ({
  theme: resolveInitialMode(),
  setTheme: mode => {
    writeRaw(STORAGE_KEYS.theme, mode);
    set({ theme: mode });
  },
  toggleTheme: () => {
    set(state => {
      const next: ThemeMode = state.theme === 'light' ? 'dark' : 'light';
      writeRaw(STORAGE_KEYS.theme, next);
      return { theme: next };
    });
  },
}));

/** Apply the `dark` class on <html> so Tailwind + CSS variables pick it up. */
export function applyThemeClass(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', mode === 'dark');
}
