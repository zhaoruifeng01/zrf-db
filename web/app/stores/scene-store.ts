/**
 * Scene / routing state store.
 *
 * Split out from ChatContext. `scene` and `chatId` are derived from URL
 * search params (synced by ChatContextProvider). `dbParam`, `agent`,
 * `docId`, and `currentDialogInfo` are set by various consumers.
 *
 * `currentDialogInfo` is also persisted to localStorage under
 * `cur_dialog_info` (read on mount by the provider, written by consumers).
 */

import { create } from 'zustand';

import type { CurrentDialogInfo, Scene } from './types';

interface SceneState {
  scene: Scene;
  chatId: string;
  dbParam: string;
  agent: string;
  docId: number | undefined;
  currentDialogInfo: CurrentDialogInfo;
  setScene: (val: Scene) => void;
  setChatId: (val: string) => void;
  setDbParam: (val: string) => void;
  setAgent: (val: string) => void;
  setDocId: (val: number) => void;
  setCurrentDialogInfo: (val: CurrentDialogInfo) => void;
}

export const useSceneStore = create<SceneState>(set => ({
  scene: '',
  chatId: '',
  dbParam: '',
  agent: '',
  docId: undefined,
  currentDialogInfo: {
    chat_scene: '',
    app_code: '',
  },
  setScene: val => set({ scene: val }),
  setChatId: val => set({ chatId: val }),
  setDbParam: val => set({ dbParam: val }),
  setAgent: val => set({ agent: val }),
  setDocId: val => set({ docId: val }),
  setCurrentDialogInfo: val => set({ currentDialogInfo: val }),
}));
