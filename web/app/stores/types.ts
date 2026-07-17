/**
 * Shared types for the split chat-context stores.
 *
 * These mirror the types previously inlined in web/app/chat-context.tsx.
 * Extracting them here lets each store import just what it needs without
 * creating a circular dependency on the context module.
 */

import type { ChatHistoryResponse, DialogueListResponse, IChatDialogueSchema } from '@/types/chat';
import type { UserInfoResponse } from '@/types/userinfo';

export type ThemeMode = 'dark' | 'light';

export type Scene = IChatDialogueSchema['chat_mode'] | (string & {});

export interface CurrentDialogInfo {
  chat_scene: string;
  app_code: string;
}

// Re-export for convenience so callers can import everything from one place.
export type { ChatHistoryResponse, DialogueListResponse, UserInfoResponse };
