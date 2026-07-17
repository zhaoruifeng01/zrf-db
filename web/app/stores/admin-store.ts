/**
 * Admin list store.
 *
 * Split out from ChatContext. `adminList` is fetched by the
 * ChatContextProvider via useRequest(queryAdminList) and synced here.
 * Currently has zero consumers reading from ChatContext, but the fetch
 * logic is preserved for backward compatibility.
 */

import { create } from 'zustand';

import type { UserInfoResponse } from './types';

interface AdminState {
  adminList: UserInfoResponse[];
  setAdminList: (val: UserInfoResponse[]) => void;
}

export const useAdminStore = create<AdminState>(set => ({
  adminList: [],
  setAdminList: val => set({ adminList: val }),
}));
