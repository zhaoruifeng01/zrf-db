import { apiInterceptors, getUsableModels, queryAdminList } from '@/client/api';
import { useAdminStore } from '@/app/stores/admin-store';
import { useChatStore } from '@/app/stores/chat-store';
import { useModelsStore } from '@/app/stores/models-store';
import { usePreferencesStore } from '@/app/stores/preferences-store';
import { useSceneStore } from '@/app/stores/scene-store';
import { useUIStore } from '@/app/stores/ui-store';
import type { ThemeMode } from '@/app/stores/types';
import { ChatHistoryResponse, DialogueListResponse, IChatDialogueSchema } from '@/types/chat';
import { UserInfoResponse } from '@/types/userinfo';
import { getUserId } from '@/utils';
import { STORAGE_THEME_KEY } from '@/utils/constants/index';
import { useRequest } from 'ahooks';
import { useSearchParams } from 'next/navigation';
import { createContext, useEffect } from 'react';

interface IChatContext {
  mode: ThemeMode;
  isContract?: boolean;
  isMenuExpand?: boolean;
  scene: IChatDialogueSchema['chat_mode'] | (string & {});
  chatId: string;
  model: string;
  modelList: string[];
  dbParam?: string;
  agent: string;
  dialogueList?: DialogueListResponse;
  setAgent?: (val: string) => void;
  setMode: (mode: ThemeMode) => void;
  setModel: (val: string) => void;
  setIsContract: (val: boolean) => void;
  setIsMenuExpand: (val: boolean) => void;
  setDbParam: (val: string) => void;
  currentDialogue?: DialogueListResponse[0];
  history: ChatHistoryResponse;
  setHistory: (val: ChatHistoryResponse) => void;
  docId?: number;
  setDocId: (docId: number) => void;
  currentDialogInfo: {
    chat_scene: string;
    app_code: string;
  };
  setCurrentDialogInfo: (val: { chat_scene: string; app_code: string }) => void;
  adminList: UserInfoResponse[];
  refreshDialogList?: any;
}

function getDefaultTheme(): ThemeMode {
  const theme = localStorage.getItem(STORAGE_THEME_KEY) as ThemeMode;
  if (theme) return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const ChatContext = createContext<IChatContext>({
  mode: 'light',
  scene: '',
  chatId: '',
  model: '',
  modelList: [],
  dbParam: undefined,
  dialogueList: [],
  agent: '',
  setAgent: () => {},
  setModel: () => {},
  setIsContract: () => {},
  setIsMenuExpand: () => {},
  setDbParam: () => void 0,
  setMode: () => void 0,
  history: [],
  setHistory: () => {},
  docId: undefined,
  setDocId: () => {},
  currentDialogInfo: {
    chat_scene: '',
    app_code: '',
  },
  setCurrentDialogInfo: () => {},
  adminList: [],
  refreshDialogList: () => {},
});

const ChatContextProvider = ({ children }: { children: React.ReactElement }) => {
  const searchParams = useSearchParams();
  const chatId = searchParams?.get('id') ?? '';
  const scene = searchParams?.get('scene') ?? '';
  const db_param = searchParams?.get('db_param') ?? '';

  // --- Store hooks (subscribe to individual slices) ---
  const mode = usePreferencesStore(s => s.mode);
  const setMode = usePreferencesStore(s => s.setMode);

  const model = useModelsStore(s => s.model);
  const modelList = useModelsStore(s => s.modelList);
  const setModel = useModelsStore(s => s.setModel);
  const setModelList = useModelsStore(s => s.setModelList);

  const isContract = useUIStore(s => s.isContract);
  const isMenuExpand = useUIStore(s => s.isMenuExpand);
  const setIsContract = useUIStore(s => s.setIsContract);
  const setIsMenuExpand = useUIStore(s => s.setIsMenuExpand);

  const dbParam = useSceneStore(s => s.dbParam);
  const agent = useSceneStore(s => s.agent);
  const docId = useSceneStore(s => s.docId);
  const currentDialogInfo = useSceneStore(s => s.currentDialogInfo);
  const setScene = useSceneStore(s => s.setScene);
  const setChatId = useSceneStore(s => s.setChatId);
  const setDbParam = useSceneStore(s => s.setDbParam);
  const setAgent = useSceneStore(s => s.setAgent);
  const setDocId = useSceneStore(s => s.setDocId);
  const setCurrentDialogInfo = useSceneStore(s => s.setCurrentDialogInfo);

  const history = useChatStore(s => s.history);
  const setHistory = useChatStore(s => s.setHistory);

  const adminList = useAdminStore(s => s.adminList);
  const setAdminList = useAdminStore(s => s.setAdminList);

  // --- Sync URL search params to scene store ---
  useEffect(() => {
    setScene(scene);
    setChatId(chatId);
    setDbParam(db_param || db_param);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, chatId, db_param]);

  // --- Fetch model list (same useRequest as original) ---
  const { data: fetchedModelList = [] } = useRequest(async () => {
    const [, res] = await apiInterceptors(getUsableModels());
    return res ?? [];
  });

  useEffect(() => {
    setModelList(fetchedModelList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedModelList]);

  // --- Auto-select first model when list loads (same as original) ---
  useEffect(() => {
    setModel(fetchedModelList[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedModelList, fetchedModelList?.length]);

  // --- Fetch admin list (same useRequest as original) ---
  const { run: queryAdminListRun } = useRequest(
    async () => {
      const [, res] = await apiInterceptors(queryAdminList({ role: 'admin' }));
      return res ?? [];
    },
    {
      onSuccess: data => {
        setAdminList(data);
      },
      manual: true,
    },
  );

  useEffect(() => {
    if (getUserId()) {
      queryAdminListRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryAdminListRun, getUserId()]);

  // --- Initialize theme from localStorage (same as original) ---
  useEffect(() => {
    setMode(getDefaultTheme());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Initialize currentDialogInfo from localStorage (same as original) ---
  useEffect(() => {
    try {
      const dialogInfo = JSON.parse(localStorage.getItem('cur_dialog_info') || '');
      setCurrentDialogInfo(dialogInfo);
    } catch {
      setCurrentDialogInfo({
        chat_scene: '',
        app_code: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Build context value (same shape as original) ---
  // Note: dialogueList, currentDialogue, and refreshDialogList are intentionally
  // NOT provided (same as the original). They remain as their default values
  // (undefined / no-op) and are instead provided by ChatContentContext in
  // pages/chat/index.tsx.
  const contextValue: IChatContext = {
    isContract,
    isMenuExpand,
    scene,
    chatId,
    model,
    modelList,
    dbParam: dbParam || db_param,
    agent,
    setAgent,
    mode,
    setMode,
    setModel,
    setIsContract,
    setIsMenuExpand,
    setDbParam,
    history,
    setHistory,
    docId,
    setDocId,
    currentDialogInfo,
    setCurrentDialogInfo,
    adminList,
  };

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
};

export { ChatContext, ChatContextProvider };
