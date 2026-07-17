/**
 * next/dynamic compatibility shim for the shell.
 *
 * `next/dynamic` wraps `React.lazy` with Suspense and supports an `ssr: false`
 * option that the legacy chat modules rely on (e.g. dynamically loading
 * Monaco/DbEditor/ChatContainer without server rendering).
 *
 * The shell is already `ssr: false` globally (see react-router.config.ts), so
 * every lazy component is client-only by default. We still accept the option
 * for API parity. Callers wrap their own <Suspense> boundary, matching how
 * next/dynamic consumers in this repo render today.
 */

import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';
import { lazy } from 'react';

export interface DynamicOptions<T = unknown> {
  loading?: ReactNode;
  ssr?: boolean;
}

export interface LoadableGeneratedOptions {
  loadableGenerated?: {
    test?: RegExp;
    modules?: string[];
  };
}

type DynamicImport<T> = () => Promise<{ default: ComponentType<T> }>;

/**
 * Subset of `next/dynamic`'s signature. Supports both:
 *   dynamic(() => import('./Foo'))
 *   dynamic(() => import('./Foo'), { loading: <Spinner />, ssr: false })
 *
 * Components are always client-side in the shell, so `ssr: false` is a no-op
 * but accepted. `loading` is accepted for API parity but ignored - callers
 * wrap their own Suspense boundary. Revisit if a legacy caller regresses.
 */
export function dynamic<T>(
  loader: DynamicImport<T>,
  options: DynamicOptions<T> & LoadableGeneratedOptions = {},
): LazyExoticComponent<ComponentType<T>> {
  void options.ssr;
  void options.loading;
  void options.loadableGenerated;
  return lazy(loader);
}

export default dynamic;
