/**
 * TanStack Query key factory for construct/prompt.
 */

export const promptKeys = {
  all: ['construct', 'prompt'] as const,
  list: (page: number, pageSize: number) => [...promptKeys.all, 'list', page, pageSize] as const,
  targets: (type: string) => [...promptKeys.all, 'targets', type] as const,
  template: (type: string, target: string) => [...promptKeys.all, 'template', type, target] as const,
};
