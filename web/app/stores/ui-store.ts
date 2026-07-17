/**
 * UI layout state store.
 *
 * Split out from ChatContext. `isContract` controls the chat mode-tab
 * contract state; `isMenuExpand` controls the side menu expansion.
 * Both are pure UI state with no async dependency.
 */

import { create } from 'zustand';

interface UIState {
  isContract: boolean;
  isMenuExpand: boolean;
  setIsContract: (val: boolean) => void;
  setIsMenuExpand: (val: boolean) => void;
}

export const useUIStore = create<UIState>(set => ({
  isContract: false,
  isMenuExpand: false,
  setIsContract: val => set({ isContract: val }),
  setIsMenuExpand: val => set({ isMenuExpand: val }),
}));
