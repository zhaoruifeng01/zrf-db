/**
 * Single Axios instance for DB-GPT frontend.
 *
 * Replaces the four divergent instances in:
 * - web/client/api/index.ts
 * - web/utils/ctx-axios.ts
 * - web/governance/src/utils/axios.ts (instance + permissionApi)
 *
 * Configuration is injected via configureApi() so the shared package stays
 * free of any build-tool env coupling (no import.meta.env, no process.env
 * hard requirement). The shell calls configureApi() once at boot.
 */

import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import { getAuthHeader, getUserId, onUnauthorized } from '../auth';
import { HEADER_USER_ID_KEY } from '../storage';

/** Endpoints that legitimately need longer timeouts (heavy server work). */
export const LONG_TIME_API: readonly string[] = [
  '/db/add',
  '/db/test/connect',
  '/db/summary',
  '/params/file/load',
  '/chat/prepare',
  '/model/start',
  '/model/stop',
  '/editor/sql/run',
  '/sql/editor/submit',
  '/editor/chart/run',
  '/chart/editor/submit',
  '/document/upload',
  '/document/sync',
  '/agent/install',
  '/agent/uninstall',
  '/personal/agent/upload',
] as const;

const DEFAULT_TIMEOUT_MS = 100_000;
const LONG_TIMEOUT_MS = 60_000;

export interface ApiClientOptions {
  baseURL?: string;
  /** Override the long-timeout endpoint list (defaults to LONG_TIME_API). */
  longTimeApi?: readonly string[];
  /** Override timeout defaults. */
  defaultTimeoutMs?: number;
  longTimeoutMs?: number;
  /** Custom 401 handler. Defaults to onUnauthorized from @dbgpt/shared/auth. */
  onUnauthorized?: () => void;
}

let instance: AxiosInstance;
let configured = false;

function resolveBaseURL(): string {
  // Prefer explicit injection; fall back to process.env for legacy Next.js compat.
  if (typeof process !== 'undefined' && process.env?.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }
  return '';
}

function createInstance(options: ApiClientOptions = {}): AxiosInstance {
  const baseURL = options.baseURL ?? resolveBaseURL();
  const defaultTimeout = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const longTimeout = options.longTimeoutMs ?? LONG_TIMEOUT_MS;
  const longTimeApi = options.longTimeApi ?? LONG_TIME_API;
  const handleUnauthorized = options.onUnauthorized ?? onUnauthorized;

  const ins = axios.create({ baseURL });

  ins.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const url = config.url ?? '';
    const isLongTime = longTimeApi.some(pattern => url.indexOf(pattern) >= 0);
    if (!config.timeout) {
      config.timeout = isLongTime ? longTimeout : defaultTimeout;
    }
    const userId = getUserId();
    if (userId) {
      config.headers.set(HEADER_USER_ID_KEY, userId);
    }
    const auth = getAuthHeader();
    if (auth) {
      config.headers.set('Authorization', auth);
    }
    return config;
  });

  ins.interceptors.response.use(
    response => response,
    error => {
      if (error?.response?.status === 401) {
        handleUnauthorized();
      }
      return Promise.reject(error);
    },
  );

  return ins;
}

/** Configure (or reconfigure) the singleton API client. Call once at shell boot. */
export function configureApi(options: ApiClientOptions = {}): AxiosInstance {
  instance = createInstance(options);
  configured = true;
  return instance;
}

/** Get the configured singleton Axios instance. Auto-initializes with defaults. */
export function getApi(): AxiosInstance {
  if (!configured || !instance) {
    return configureApi();
  }
  return instance;
}

export { axios };
export type { AxiosInstance };
