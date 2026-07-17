import type { Config } from '@react-router/dev/config';

/**
 * React Router Framework Mode config.
 *
 * `ssr: false` deploys the shell as a client-only SPA, matching the FastAPI
 * static-hosting contract (see adr/0001-unify-frontend-stack.md §目标模式).
 * No Node BFF, no SSR, no rewrites/proxy at runtime - dev proxy is handled
 * by Vite, production by Python serving the same origin.
 */
export default {
  ssr: false,
  // Built assets land here so the Python dbgpt_app can serve them at /shell/*.
  // Set to the default `build` if you want to inspect locally without Python.
  buildDirectory: './build',
} satisfies Config;
