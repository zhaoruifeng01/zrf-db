/**
 * Shared API response types.
 *
 * Mirrors the envelope used by web/client/api/index.ts so call sites and
 * server DTOs do not change shape when migrating to @dbgpt/shared.
 */

import type { AxiosResponse } from 'axios';

export interface ResponseType<T = unknown> {
  data: T;
  err_code: string | null;
  err_msg: string | null;
  success: boolean;
}

export type ApiResponse<T = unknown, D = unknown> = AxiosResponse<ResponseType<T>, D>;

export type SuccessTuple<T = unknown, D = unknown> = [null, T, ResponseType<T>, ApiResponse<T, D>];

export type FailedTuple<T = unknown, D = unknown> = [Error, null, null, null];

export type ResultTuple<T = unknown, D = unknown> = SuccessTuple<T, D> | FailedTuple<T, D>;

/** Numeric error codes used by legacy DB-GPT backend. */
export const enum ERROR_CODE {
  NO_PERMISSION = -1,
  SERVICE_ERROR = -2,
  INVALID = -3,
  IS_EXITS = -4,
  MISSING_PARAMETER = -5,
}
