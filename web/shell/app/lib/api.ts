/**
 * API client boot for the shell.
 *
 * Injects Vite env into @dbgpt/shared's configureApi() so the shared package
 * stays free of build-tool coupling. Called once from app/root.tsx.
 */

import { configureApi } from '@dbgpt/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

let booted = false;

export function bootApi(): void {
  if (booted) return;
  booted = true;
  configureApi({ baseURL: API_BASE_URL });
}
