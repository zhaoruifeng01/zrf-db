/**
 * TanStack Query key factory for construct/models.
 *
 * Centralizing keys keeps invalidation predictable: any mutation that
 * modifies the model list invalidates ['construct', 'models', 'list'].
 */

export const modelsKeys = {
  all: ['construct', 'models'] as const,
  list: () => [...modelsKeys.all, 'list'] as const,
  usable: () => [...modelsKeys.all, 'usable'] as const,
};
