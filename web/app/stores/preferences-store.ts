/**
 * Theme / display-mode store.
 *
 * Split out from ChatContext per ADR 0001 §中期. The theme is persisted to
 * localStorage under STORAGE_THEME_KEY by the side-bar / Sider components
 * (same as before the split).
 */

import { create } from 'zustand';

import type { ThemeMode } from './types';

interface PreferencesState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const usePreferencesStore = create<PreferencesState>(set => ({
  mode: 'light',
  setMode: mode => set({ mode }),
}));
