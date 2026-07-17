/**
 * TanStack Query hooks for construct/prompt.
 *
 * Reads: usePromptList, usePromptTargets, usePromptTemplate.
 * Writes: useAddPrompt, useUpdatePrompt, useDeletePrompt, useLlmOutVerify.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { promptApi, type PromptListQuery } from './api';
import { promptKeys } from './query-keys';
import type { IPrompt, LlmOutVerifyParams, OperatePromptParams } from '@/types/prompt';

export function usePromptList(query: PromptListQuery) {
  return useQuery({
    queryKey: promptKeys.list(query.page, query.page_size),
    queryFn: () => promptApi.list(query),
  });
}

export function usePromptTargets(type: string | undefined) {
  return useQuery({
    queryKey: promptKeys.targets(type ?? ''),
    queryFn: () => promptApi.targets(type!),
    enabled: !!type,
  });
}

export function usePromptTemplate(type: string | undefined, target: string | undefined) {
  return useQuery({
    queryKey: promptKeys.template(type ?? '', target ?? ''),
    queryFn: () => promptApi.templateLoad({ prompt_type: type!, target: target! }),
    enabled: !!type && !!target,
  });
}

function useInvalidateList() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: promptKeys.all });
}

export function useAddPrompt() {
  const invalidate = useInvalidateList();
  return useMutation({
    mutationFn: (data: OperatePromptParams) => promptApi.add(data),
    onSettled: invalidate,
  });
}

export function useUpdatePrompt() {
  const invalidate = useInvalidateList();
  return useMutation({
    mutationFn: (data: OperatePromptParams) => promptApi.update(data),
    onSettled: invalidate,
  });
}

export function useDeletePrompt() {
  const invalidate = useInvalidateList();
  return useMutation({
    mutationFn: (data: IPrompt) => promptApi.remove(data),
    onSettled: invalidate,
  });
}

export function useLlmOutVerify() {
  return useMutation({
    mutationFn: (data: LlmOutVerifyParams) => promptApi.outVerify(data),
  });
}
