import http from "./http";
import type {
  ApiKey,
  ApiKeyWithSecret,
  CreateApiKeyRequest,
  RegisterRequest,
  UserInfo,
} from "./types";

const BASE = "/api/v1/addons/auth";

/**
 * POST /register
 * Body: { username, password, nickName } -> { code, message }
 */
export async function register(payload: RegisterRequest): Promise<void> {
  await http.post(`${BASE}/register`, payload);
}

/**
 * GET /user-info
 * Requires Authorization: Bearer <token>.
 */
export async function fetchUserInfo(signal?: AbortSignal): Promise<UserInfo> {
  const response = await http.get<UserInfo>(`${BASE}/user-info`, { signal });
  return response.data;
}

/**
 * POST /api-keys
 * Requires Authorization. Plaintext is returned only once.
 */
export async function createApiKey(
  payload: CreateApiKeyRequest,
  signal?: AbortSignal,
): Promise<ApiKeyWithSecret> {
  const response = await http.post<ApiKeyWithSecret>(`${BASE}/api-keys`, payload, { signal });
  return response.data;
}

/**
 * GET /api-keys
 * Requires Authorization.
 */
export async function listApiKeys(signal?: AbortSignal): Promise<ApiKey[]> {
  const response = await http.get<ApiKey[]>(`${BASE}/api-keys`, { signal });
  return response.data;
}

/**
 * DELETE /api-keys/:id
 * Requires Authorization.
 */
export async function deleteApiKey(id: number | string, signal?: AbortSignal): Promise<void> {
  await http.delete(`${BASE}/api-keys/${id}`, { signal });
}
