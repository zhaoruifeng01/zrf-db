/**
 * Governance API client + DTOs.
 *
 * Wraps the two backend prefixes used by the legacy Vue governance console:
 * - /api/v1/serve/governance  (datasources, grants, mask-rules, catalog, audit)
 * - /api/v1/serve/permission  (users, roles, depts)
 *
 * Each helper unwraps the ResponseType envelope so callers get the inner data
 * directly, matching the legacy `unwrap()` helper in web/governance/src/utils/axios.ts.
 */

import { DELETE, GET, POST } from '@dbgpt/shared';

const GOV_BASE = '/api/v1/serve/governance';
const PERM_BASE = '/api/v1/serve/permission';

// --- Types (mirrors web/governance/src/App.vue inline types) ---

export interface Datasource {
  id: number;
  db_name: string;
  db_type: string;
  comment?: string;
  policy?: { status: string; business_domain?: string; health_status: string } | null;
}

export interface Grant {
  id: number;
  role_code: string;
  datasource_id: number;
  table_pattern: string;
  permission: string;
}

export interface GrantInput {
  role_code: string;
  datasource_id: number;
  table_pattern: string;
  permission: string;
}

export interface MaskRule {
  id: number;
  datasource_id: number;
  table_name: string;
  column_name: string;
  role_code?: string | null;
  mask_type: string;
}

export interface MaskRuleInput {
  datasource_id: number;
  table_name: string;
  column_name: string;
  role_code?: string | null;
  mask_type: string;
}

export interface Product {
  id: number;
  product_key: string;
  title: string;
  description?: string;
  resource_type: string;
  resource_definition?: string;
  status: string;
  rate_limit_per_minute?: number;
}

export interface ProductInput {
  product_key: string;
  datasource_id: number;
  title: string;
  description?: string;
  resource_type: string;
  resource_definition?: string;
  status: string;
  rate_limit_per_minute: number;
}

export interface AuditLog {
  id: number;
  gmt_created: string;
  username: string;
  action: string;
  datasource_id?: number;
  status: string;
  detail?: string;
}

export interface User {
  id: number;
  username: string;
  real_name?: string;
  email?: string;
  phone?: string;
  status: number;
  roles?: { id: number; role_code: string; role_name: string }[];
  departments?: { id: number; dept_name: string; dept_code: string }[];
}

export interface UserInput {
  username: string;
  password: string;
  email?: string;
  real_name?: string;
  phone?: string;
  role_ids: number[];
  dept_ids: number[];
}

export interface Role {
  id: number;
  role_code: string;
  role_name: string;
  description?: string;
  status: number;
}

export interface RoleInput {
  role_code: string;
  role_name: string;
  description?: string;
}

export interface Dept {
  id: number;
  dept_name: string;
  dept_code: string;
  parent_id: number;
  order_num: number;
  status: number;
  children?: Dept[];
}

export interface DeptInput {
  dept_name: string;
  dept_code: string;
  parent_id: number;
  order_num: number;
}

interface PaginatedUsers {
  items: User[];
  total?: number;
}

// --- Governance API ---

async function unwrap<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await p;
  return res.data.data;
}

export const governanceApi = {
  getOverview: () => unwrap<Record<string, number>>(GET(`${GOV_BASE}/overview`)),
  getDatasources: () => unwrap<Datasource[]>(GET(`${GOV_BASE}/datasources`)),
  testDatasource: (id: number) => unwrap<{ message: string }>(POST(`${GOV_BASE}/datasources/${id}/health`)),
  getGrants: () => unwrap<Grant[]>(GET(`${GOV_BASE}/grants`)),
  createGrant: (data: GrantInput) => unwrap<Grant>(POST(`${GOV_BASE}/grants`, data)),
  deleteGrant: (id: number) => unwrap<null>(DELETE(`${GOV_BASE}/grants/${id}`)),
  getMaskRules: () => unwrap<MaskRule[]>(GET(`${GOV_BASE}/mask-rules`)),
  createMaskRule: (data: MaskRuleInput) => unwrap<MaskRule>(POST(`${GOV_BASE}/mask-rules`, data)),
  deleteMaskRule: (id: number) => unwrap<null>(DELETE(`${GOV_BASE}/mask-rules/${id}`)),
  getProducts: () => unwrap<Product[]>(GET(`${GOV_BASE}/catalog/products`)),
  createProduct: (data: ProductInput) => unwrap<Product>(POST(`${GOV_BASE}/catalog/products`, data)),
  getAuditLogs: () => unwrap<AuditLog[]>(GET(`${GOV_BASE}/audit-logs`)),
};

// --- Permission API ---

export const permissionApi = {
  getUsers: (page = 1, pageSize = 100) =>
    unwrap<PaginatedUsers>(GET(`${PERM_BASE}/users`, { page, page_size: pageSize })),
  createUser: (data: UserInput) => unwrap<User>(POST(`${PERM_BASE}/users`, data)),
  deleteUser: (id: number) => unwrap<null>(DELETE(`${PERM_BASE}/users/${id}`)),
  getRoles: () => unwrap<Role[]>(GET(`${PERM_BASE}/roles`)),
  createRole: (data: RoleInput) => unwrap<Role>(POST(`${PERM_BASE}/roles`, data)),
  deleteRole: (id: number) => unwrap<null>(DELETE(`${PERM_BASE}/roles/${id}`)),
  getDepts: () => unwrap<Dept[]>(GET(`${PERM_BASE}/depts`)),
  createDept: (data: DeptInput) => unwrap<Dept>(POST(`${PERM_BASE}/depts`, data)),
  deleteDept: (id: number) => unwrap<null>(DELETE(`${PERM_BASE}/depts/${id}`)),
};

// --- Helpers ---

/** Flatten the dept tree (each node + its children) into a flat list. */
export function flattenDepts(depts: Dept[]): Dept[] {
  const result: Dept[] = [];
  const walk = (items: Dept[]) => {
    for (const item of items) {
      result.push(item);
      if (item.children?.length) walk(item.children);
    }
  };
  walk(depts);
  return result;
}
