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

import type { ComponentType, ReactNode } from 'react';
import { Suspense, createElement, isValidElement, lazy } from 'react';

export interface DynamicOptions<T = unknown> {
  loading?: ReactNode | ComponentType<DynamicLoadingProps>;
  ssr?: boolean;
}

export interface DynamicLoadingProps {
  error?: Error | null;
  isLoading?: boolean;
  pastDelay?: boolean;
  retry?: () => void;
  timedOut?: boolean;
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
export function dynamic<T extends object = Record<string, never>>(
  loader: DynamicImport<T>,
  options: DynamicOptions<T> & LoadableGeneratedOptions = {},
): ComponentType<T> {
  void options.ssr;
  void options.loadableGenerated;

  const LazyComponent = lazy(loader);

  function DynamicComponent(props: T) {
    const Loading = options.loading;
    const LazyComponentForRender = LazyComponent as unknown as ComponentType<Record<string, unknown>>;
    const fallback =
      typeof Loading === 'function'
        ? createElement(Loading, { isLoading: true })
        : isValidElement(Loading)
          ? Loading
          : null;

    return (
      <Suspense fallback={fallback}>
        {createElement(LazyComponentForRender, props as Record<string, unknown>)}
      </Suspense>
    );
  }

  DynamicComponent.displayName = 'NextDynamicCompat';
  return DynamicComponent;
}

export default dynamic;
