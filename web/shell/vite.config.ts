import { reactRouter } from '@react-router/dev/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig, loadEnv } from 'vite';

const appDir = fileURLToPath(new URL('./app', import.meta.url));
const webDir = fileURLToPath(new URL('..', import.meta.url));
const designTokens = fileURLToPath(new URL('../design-tokens/index.ts', import.meta.url));
const nextCompat = fileURLToPath(new URL('./app/lib/next-compat/', import.meta.url));
const webPublicDir = fileURLToPath(new URL('./public/', import.meta.url));

// https://reactrouter.com/start/framework/installation
export default defineConfig(({ mode }) => {
  // Load .env / .env.{mode} for VITE_API_BASE_URL so we can statically define
  // process.env.API_BASE_URL for legacy modules that read it (Next.js convention).
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = env.VITE_API_BASE_URL ?? env.API_BASE_URL ?? '';

  return {
    plugins: [
      reactRouter(),
      react(),
      tsconfigPaths({
        projects: ['./tsconfig.json'],
      }),
    ],
    resolve: {
      alias: [
        // `~` is the React Router convention for the shell app directory.
        { find: '~/', replacement: `${appDir}/` },
        // design-tokens stay in web/design-tokens during the migration; shell
        // consumes them via this alias so we don't duplicate the token source.
        { find: '@/design-tokens', replacement: designTokens },
        // During the strangler migration the shell reuses modules from the
        // legacy web/ tree (web/client/api, web/types, web/utils, web/hooks,
        // web/new-components, web/app/stores, web/app/chat-context, web/locales).
        // `@/` matches the legacy webpack alias so those modules import without
        // edits. Once the migration completes this alias goes away.
        { find: '@/', replacement: `${webDir}/` },
        // Next.js shims: legacy chat modules under web/new-components/chat/** and
        // web/components/chat/** import `next/navigation`, `next/router`,
        // `next/image`, and `next/dynamic`. The shell is not a Next.js app, so
        // these imports are routed to a compatibility layer under
        // app/lib/next-compat/ that maps them onto react-router and <img>.
        // The legacy Next.js app keeps resolving the real packages from its own
        // node_modules - this alias only applies inside the shell build.
        { find: 'next/navigation', replacement: `${nextCompat}navigation.ts` },
        { find: 'next/router', replacement: `${nextCompat}router.ts` },
        { find: 'next/image', replacement: `${nextCompat}image.tsx` },
        { find: 'next/dynamic', replacement: `${nextCompat}dynamic.tsx` },
      ],
    },
    // Serve the legacy web/public/ assets (LOGO, icons, models, etc.) so that
    // <Image src="/LOGO_SMALL.png" /> resolves identically to the Next.js app.
    // Vite copies this directory into dist/ at build time.
    publicDir: webPublicDir,
    // Legacy modules read `process.env.API_BASE_URL` (Next.js convention). Vite
    // does not expose process.env to the browser, so statically replace it with
    // the Vite env. Callers that need runtime env should use import.meta.env.
    define: {
      'process.env.API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
    server: {
      port: 5174,
      proxy: {
        // Dev-only: proxy /api to the FastAPI backend. In production, the shell
        // is served by the same Python process, so no proxy is needed.
        '^/api|/docs|/openapi.json': {
          target: 'http://127.0.0.1:5670',
          changeOrigin: true,
        },
      },
    },
    build: {
      // Keep the shell bundle honest. Raise only when a heavy route (Monaco, G6)
      // lands here during the migration.
      chunkSizeWarningLimit: 800,
    },
  };
});
