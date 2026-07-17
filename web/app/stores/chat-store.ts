/**
 * Chat history store.
 *
 * Split out from ChatContext. `history` holds the current conversation's
 * message list; `setHistory` replaces it wholesale (same semantics as
 * the original useState setter).
 */

import { create } from 'zustand';

import type { ChatHistoryResponse } from './types';

interface ChatState {
  history: ChatHistoryResponse;
  setHistory: (val: ChatHistoryResponse) => void;
}

export const useChatStore = create<ChatState>(set => ({
  history: [],
  setHistory: val => set({ history: val }),
}));
