/**
 * @dbgpt/shared - cross-cutting frontend primitives for DB-GPT.
 *
 * Scope of this milestone (ADR 0001, short-term baseline):
 * - api:    single Axios instance + typed methods + SSE adapter
 * - auth:   token / user-info / 401 handler (single source of truth)
 * - storage: central key registry + safe JSON localStorage adapter
 *
 * Design tokens are intentionally NOT re-exported here. They live in
 * web/design-tokens/ and stay in place during the strangler migration to avoid
 * breaking the existing Next.js app's imports. The new Vite shell consumes
 * them via a Vite alias.
 */

export * from './api';
export * from './auth';
export * from './storage';
