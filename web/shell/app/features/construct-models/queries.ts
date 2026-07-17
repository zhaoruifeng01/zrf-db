/**
 * TanStack Query hooks for construct/models.
 *
 * Server state lives here (ADR 0001 §状态层): useQuery for reads, useMutation
 * for start/stop/create. Mutations invalidate the list key so the table
 * refreshes without manual refetch calls.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { modelsApi } from './api';
import { modelsKeys } from './query-keys';
import type { BaseModelParams, StartModelParams } from '@/types/model';

export function useModels() {
  return useQuery({
    queryKey: modelsKeys.list(),
    queryFn: modelsApi.list,
  });
}

/** Usable model names for the current user. Shared across chat, prompt, etc. */
export function useUsableModels() {
  return useQuery({
    queryKey: modelsKeys.usable(),
    queryFn: modelsApi.usable,
  });
}

function useInvalidateModels() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: modelsKeys.list() });
}

export function useStartModel() {
  const invalidate = useInvalidateModels();
  return useMutation({
    mutationFn: (data: BaseModelParams) => modelsApi.start(data),
    onSettled: invalidate,
  });
}

export function useStopModel() {
  const invalidate = useInvalidateModels();
  return useMutation({
    mutationFn: (data: BaseModelParams) => modelsApi.stop(data),
    onSettled: invalidate,
  });
}

export function useCreateModel() {
  const invalidate = useInvalidateModels();
  return useMutation({
    mutationFn: (data: StartModelParams) => modelsApi.create(data),
    onSettled: invalidate,
  });
}
