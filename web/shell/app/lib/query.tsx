/**
 * TanStack Query singleton + provider.
 *
 * Per ADR 0001 §状态层: server state lives in TanStack Query. The shell mounts
 * one QueryClient; route modules access it via useQuery/useMutation without
 * touching axios directly (they go through @dbgpt/shared/api methods).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export { createQueryClient };
