/**
 * Auth DTOs (mirrors web/types/permission.ts LoginResponse).
 *
 * Short-term: hand-modeled per ADR 0001. Long-term: generated from OpenAPI.
 */

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  username: string;
  role_codes: string[];
  dept_names: string[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

/** Path for the permission auth login endpoint. */
export const LOGIN_PATH = '/api/v1/serve/permission/auth/login';
