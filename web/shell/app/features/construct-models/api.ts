/**
 * Model management API for the shell-native construct/models route.
 *
 * Replaces web/client/api/request.ts#getModelList/startModel/stopModel with
 * @dbgpt/shared GET/POST helpers. Each function unwraps the ResponseType
 * envelope so callers get the inner data directly.
 */

import { GET, POST } from '@dbgpt/shared';

import type { BaseModelParams, IModelData, StartModelParams, SupportModel } from '@/types/model';

const BASE = '/api/v2/serve/model/models';

async function unwrap<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await p;
  return res.data.data;
}

export const modelsApi = {
  /** List all running/stopped model instances. */
  list: () => unwrap<IModelData[]>(GET(BASE)),
  /** Supported model types (providers, hosts, params schema). */
  supportList: () => unwrap<SupportModel[]>(GET('/api/v2/serve/model/model-types')),
  /** Usable model names for the current user (used by chat + prompt editors). */
  usable: () => unwrap<string[]>(GET('/api/v1/model/types')),
  /** Create + start a new model instance. */
  create: (data: StartModelParams) => unwrap<boolean>(POST(BASE, data)),
  /** Start a stopped model. */
  start: (data: BaseModelParams) => unwrap<boolean>(POST(`${BASE}/start`, data)),
  /** Stop a running model; delete_after removes the worker entirely. */
  stop: (data: BaseModelParams) => unwrap<boolean>(POST(`${BASE}/stop`, data)),
};
