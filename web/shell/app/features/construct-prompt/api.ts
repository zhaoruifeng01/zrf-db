/**
 * Prompt management API for the shell-native construct/prompt routes.
 *
 * Replaces web/client/api/prompt/index.ts with @dbgpt/shared GET/POST helpers.
 * Each function unwraps the ResponseType envelope so callers get the inner
 * data directly. The legacy module stays in place for unmigrated callers;
 * removed once the prompt domain finishes stage 3 (ADR 0002).
 */

import { GET, POST } from '@dbgpt/shared';

import type {
  DebugParams,
  IPrompt,
  LlmOutVerifyParams,
  OperatePromptParams,
  PromptListResponse,
  PromptTemplateLoadProps,
  PromptTemplateLoadResponse,
} from '@/types/prompt';

async function unwrap<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await p;
  return res.data.data;
}

export interface PromptTarget {
  name: string;
  desc?: string;
}

export interface PromptListQuery {
  page: number;
  page_size: number;
}

export const promptApi = {
  /** Targets (scenes) available for a given prompt type. */
  targets: (type: string) => unwrap<PromptTarget[]>(GET(`/prompt/type/targets?prompt_type=${type}`)),
  /** Load the prompt template + variables + response format for a (type, target). */
  templateLoad: (props: PromptTemplateLoadProps) =>
    unwrap<PromptTemplateLoadResponse>(POST(`/prompt/template/load?prompt_type=${props.prompt_type}&target=${props.target}`, props)),
  /** Create a new prompt. */
  add: (data: OperatePromptParams) => unwrap<null>(POST('/prompt/add', data)),
  /** Update an existing prompt. */
  update: (data: OperatePromptParams) => unwrap<null>(POST('/prompt/update', data)),
  /** Delete a prompt. Accepts the row shape (IPrompt) since the backend only
   * needs identifying fields; using OperatePromptParams would force callers to
   * fabricate required-but-unused fields like prompt_desc. */
  remove: (data: IPrompt) => unwrap<null>(POST('/prompt/delete', data)),
  /** Paginated prompt list. */
  list: (query: PromptListQuery) => unwrap<PromptListResponse>(POST(`/prompt/query_page?page=${query.page}&page_size=${query.page_size}`, query)),
  /** Verify LLM output against the prompt's response schema. */
  outVerify: (data: LlmOutVerifyParams) => unwrap<Record<string, any>>(POST('/prompt/response/verify', data)),
};

/**
 * Debug an LLM call against a prompt via SSE. Lives next to the API helpers so
 * the prompt feature owns the endpoint contract; the streaming consumer is in
 * the edit page because it needs direct access to event callbacks.
 */
export const PROMPT_DEBUG_ENDPOINT = '/prompt/template/debug';
export type { DebugParams };
