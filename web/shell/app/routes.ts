import type { RouteConfig } from '@react-router/dev/routes';

/**
 * Route registry for the shell.
 *
 * Migrated domains land here as route modules. Per ADR 0001 §中期: routes are
 * the strangler boundary - each migration adds a route here and removes the
 * corresponding page from the legacy Next app.
 *
 * `file` is relative to the app directory (app/). React Router v7 Framework
 * Mode resolves the module and its exports (default = component, meta, loader,
 * etc.). Each file must be unique - use a redirect loader for alias paths.
 */
export default [
  { path: '/', file: 'routes/index.tsx' },
  { path: '/health', file: 'routes/health.tsx' },
  { path: '/login', file: 'routes/login.tsx' },
  { path: '/governance', file: 'routes/governance.tsx' },
  { path: '/conversations', file: 'routes/conversations.tsx' },
  { path: '/chat', file: 'routes/chat.tsx' },
  { path: '/construct/models', file: 'routes/construct-models.tsx' },
  { path: '/construct/prompt', file: 'routes/construct-prompt.tsx' },
  { path: '/construct/prompt/:type', file: 'routes/construct-prompt.$type.tsx' },
] satisfies RouteConfig;
