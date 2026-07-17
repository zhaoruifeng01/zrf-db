/**
 * Auth adapter for DB-GPT frontend.
 *
 * Unifies the four divergent localStorage + 401-redirect implementations found
 * in web/client/api/index.ts, web/utils/ctx-axios.ts, web/governance/src/utils/axios.ts
 * (two instances) into a single source of truth.
 *
 * Legacy call sites are not migrated in this milestone; new shell code uses
 * this module exclusively.
 */

import { HEADER_USER_ID_KEY, STORAGE_KEYS, clearKey, readRaw, readJSON, removeRaw, writeRaw, writeJSON } from '../storage';

export interface UserInfo {
  user_id?: string;
  user_no?: string;
  user_name?: string;
  role?: string;
  [key: string]: unknown;
}

export function getToken(): string | null {
  return readRaw(STORAGE_KEYS.token);
}

export function setToken(token: string): void {
  writeRaw(STORAGE_KEYS.token, token);
}

export function clearToken(): void {
  clearKey(STORAGE_KEYS.token);
}

export function getUserInfo(): UserInfo | null {
  return readJSON<UserInfo>(STORAGE_KEYS.userInfo);
}

export function setUserInfo(info: UserInfo): void {
  writeJSON(STORAGE_KEYS.userInfo, info);
}

export function getUserInfoValidTime(): number | null {
  const raw = readRaw(STORAGE_KEYS.userInfoValidTime);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function setUserInfoValidTime(epochMs: number): void {
  writeRaw(STORAGE_KEYS.userInfoValidTime, String(epochMs));
}

/** Resolve the active user id for the `user-id` request header. */
export function getUserId(): string | undefined {
  return getUserInfo()?.user_id;
}

/** Auth header value for `Authorization`, or null if no token. */
export function getAuthHeader(): string | null {
  const token = getToken();
  return token ? `Bearer ${token}` : null;
}

/** Wipe all auth-related storage entries. */
export function clearAuth(): void {
  removeRaw(STORAGE_KEYS.token);
  removeRaw(STORAGE_KEYS.userInfo);
  removeRaw(STORAGE_KEYS.userInfoValidTime);
}

/**
 * 401 handler. Clears auth and redirects to /login unless we are already there.
 * Safe to call from any module (browser-only; no-op on SSR).
 */
export function onUnauthorized(): void {
  clearAuth();
  if (typeof window === 'undefined') return;
  const { pathname } = window.location;
  if (pathname.startsWith('/login')) return;
  window.location.href = '/login';
}

export { HEADER_USER_ID_KEY, STORAGE_KEYS };
