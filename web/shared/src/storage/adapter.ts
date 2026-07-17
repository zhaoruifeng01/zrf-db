/**
 * Single localStorage adapter for DB-GPT frontend.
 *
 * All read/write of localStorage in new code goes through here so that:
 * - JSON parsing failures are contained and return null instead of throwing.
 * - Key names come from the central STORAGE_KEYS registry.
 * - SSR/window-undefined cases are handled once.
 *
 * Legacy call sites in web/ that read localStorage directly are not migrated
 * in the short-term baseline milestone; they will be replaced as each route
 * moves to the new shell.
 */

import { STORAGE_KEYS, type StorageKey } from './keys';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readRaw(key: StorageKey): string | null {
  return getStorage()?.getItem(key) ?? null;
}

export function writeRaw(key: StorageKey, value: string): void {
  getStorage()?.setItem(key, value);
}

export function removeRaw(key: StorageKey): void {
  getStorage()?.removeItem(key);
}

export function readJSON<T>(key: StorageKey): T | null {
  const raw = readRaw(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJSON(key: StorageKey, value: unknown): void {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch {
    // Quota or serialization error: swallow; callers may surface via telemetry.
  }
}

export function clearKey(key: StorageKey): void {
  removeRaw(key);
}

export { STORAGE_KEYS };
