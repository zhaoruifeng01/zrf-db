/**
 * Typed request helpers for the singleton API client.
 *
 * These mirror the GET/POST/PATCH/PUT/DELETE signatures in
 * web/client/api/index.ts so call sites migrate by changing the import path
 * only.
 */

import type { AxiosRequestConfig } from 'axios';

import { getApi } from './client';
import type { ApiResponse } from './types';

export function GET<Params = unknown, Response = unknown, D = unknown>(
  url: string,
  params?: Params,
  config?: AxiosRequestConfig<D>,
): Promise<ApiResponse<Response, D>> {
  return getApi().get<Params, ApiResponse<Response, D>>(url, { params, ...config });
}

export function POST<Data = unknown, Response = unknown, D = unknown>(
  url: string,
  data?: Data,
  config?: AxiosRequestConfig<D>,
): Promise<ApiResponse<Response, D>> {
  return getApi().post<Data, ApiResponse<Response, D>>(url, data, config);
}

export function PATCH<Data = unknown, Response = unknown, D = unknown>(
  url: string,
  data?: Data,
  config?: AxiosRequestConfig<D>,
): Promise<ApiResponse<Response, D>> {
  return getApi().patch<Data, ApiResponse<Response, D>>(url, data, config);
}

export function PUT<Data = unknown, Response = unknown, D = unknown>(
  url: string,
  data?: Data,
  config?: AxiosRequestConfig<D>,
): Promise<ApiResponse<Response, D>> {
  return getApi().put<Data, ApiResponse<Response, D>>(url, data, config);
}

export function DELETE<Params = unknown, Response = unknown, D = unknown>(
  url: string,
  params?: Params,
  config?: AxiosRequestConfig<D>,
): Promise<ApiResponse<Response, D>> {
  return getApi().delete<Params, ApiResponse<Response, D>>(url, { params, ...config });
}
