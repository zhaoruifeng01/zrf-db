/**
 * next/navigation compatibility shim for the shell.
 *
 * Lets legacy modules under web/new-components/** and web/components/** keep
 * their `import { useRouter, useSearchParams } from 'next/navigation'` lines
 * unchanged when reused by the shell. The shell is a React Router CSR app,
 * so we map the Next.js navigation hooks onto React Router equivalents.
 *
 * Scope: surface used by migrated modules - `useRouter().push/replace`,
 * `useRouter().pathname`, `useRouter().query`, and `useSearchParams().get()`.
 * Extend on demand as more pages migrate.
 *
 * This file is aliased via vite.config.ts (`next/navigation` -> here). It is
 * NOT importable from the legacy Next.js app - that tree still resolves the
 * real `next/navigation` from node_modules.
 */

import { useCallback, useMemo } from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams as useRRSearchParams,
} from 'react-router';

/**
 * Next.js `useRouter()` subset used by migrated modules. Real Next router
 * exposes more (back, forward, prefetch, reload, asPath), but callers only
 * use `.push`, `.replace`, `.pathname`, and `.query`. Add fields here as
 * callers need them.
 *
 * `query` merges dynamic route params (useParams) with URL search params so
 * legacy callers like `router.query.type` work whether `type` is a `[type]`
 * segment or `?type=...`.
 */
export interface AppRouter {
  push: (to: string) => void;
  replace: (to: string) => void;
  /** Current pathname without query string. Mirrors Next.js `router.asPath`'s path part. */
  pathname: string;
  /** Merged route params + search params. Mirrors Next.js `router.query`. */
  query: Record<string, string | string[] | undefined>;
}

export function useRouter(): AppRouter {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useRRSearchParams();

  const query = useMemo<Record<string, string | string[] | undefined>>(() => {
    const merged: Record<string, string | string[] | undefined> = { ...params };
    searchParams.forEach((value, key) => {
      // Mirror Next.js query semantics: repeated keys become arrays.
      const existing = merged[key];
      if (existing === undefined) {
        merged[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        merged[key] = [existing, value];
      }
    });
    return merged;
  }, [params, searchParams]);

  return {
    push: useCallback((to: string) => navigate(to), [navigate]),
    replace: useCallback((to: string) => navigate(to, { replace: true }), [navigate]),
    pathname: location.pathname,
    query,
  };
}

/**
 * Next.js `useSearchParams()` returns `URLSearchParams | null` (null during
 * static rendering). React Router always returns a non-null URLSearchParams.
 * Callers in migrated modules use `searchParams?.get(...)` so returning the
 * URLSearchParams directly is compatible.
 */
export function useSearchParams(): URLSearchParams {
  const [params] = useRRSearchParams();
  return params;
}
