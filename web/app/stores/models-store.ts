/**
 * Model selection store.
 *
 * Split out from ChatContext. `modelList` is fetched by the
 * ChatContextProvider via useRequest(getUsableModels) and synced here;
 * `model` is the currently selected model name.
 */

import { create } from 'zustand';

interface ModelsState {
  model: string;
  modelList: string[];
  setModel: (val: string) => void;
  setModelList: (val: string[]) => void;
}

export const useModelsStore = create<ModelsState>(set => ({
  model: '',
  modelList: [],
  setModel: val => set({ model: val }),
  setModelList: val => set({ modelList: val }),
}));
