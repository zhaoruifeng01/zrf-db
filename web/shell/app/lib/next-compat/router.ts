/**
 * next/router compatibility shim for the shell.
 *
 * The legacy Next.js Pages Router exports `useRouter` from `next/router`.
 * Its callers in chat modules use `.push(to)` and `.pathname` - the same
 * surface as the App Router's `next/navigation`. We re-export the same
 * adapter so both import paths resolve to one implementation.
 *
 * Aliased via vite.config.ts (`next/router` -> here). The legacy Next.js app
 * keeps resolving the real `next/router` from node_modules.
 */

export { useRouter, type AppRouter } from './navigation';
