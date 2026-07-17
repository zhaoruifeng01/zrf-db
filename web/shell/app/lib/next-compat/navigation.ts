/**
 * next/navigation compatibility shim for the shell.
 *
 * Lets legacy modules under web/new-components/chat/** and web/components/chat/**
 * keep their `import { useRouter, useSearchParams } from 'next/navigation'`
 * lines unchanged when reused by the shell. The shell is a React Router CSR
 * app, so we map the Next.js navigation hooks onto React Router equivalents.
 *
 * Scope: only the surface used by chat-related modules - `useRouter().push`
 * and `useSearchParams().get()`. Extend on demand as more pages migrate.
 *
 * This file is aliased via vite.config.ts (`next/navigation` -> here). It is
 * NOT importable from the legacy Next.js app - that tree still resolves the
 * real `next/navigation` from node_modules.
 */

import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams as useRRSearchParams } from 'react-router';

/**
 * Next.js `useRouter()` subset used by chat modules. Real Next router exposes
 * more (back, forward, prefetch, reload, query, asPath), but chat modules only
 * call `.push(to)`. We add `.pathname` and `.replace` for safety; add fields
 * here as callers need them.
 */
export interface AppRouter {
  push: (to: string) => void;
  replace: (to: string) => void;
  /** Current pathname without query string. Mirrors Next.js `router.pathname`. */
  pathname: string;
}

export function useRouter(): AppRouter {
  const navigate = useNavigate();
  const location = useLocation();

  return {
    push: useCallback((to: string) => navigate(to), [navigate]),
    replace: useCallback((to: string) => navigate(to, { replace: true }), [navigate]),
    pathname: location.pathname,
  };
}

/**
 * Next.js `useSearchParams()` returns `URLSearchParams | null` (null during
 * static rendering). React Router always returns a non-null URLSearchParams.
 * Callers in the chat modules use `searchParams?.get(...)` so returning the
 * URLSearchParams directly is compatible.
 */
export function useSearchParams(): URLSearchParams {
  const [params] = useRRSearchParams();
  return params;
}
