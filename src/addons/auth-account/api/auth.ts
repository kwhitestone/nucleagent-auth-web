import http from "./http";
import type { UserInfo } from "./types";

const BASE = "/api/v1/addons/auth";

/**
 * GET /user-info
 * Requires Authorization: <token> (bare, see A-16).
 * Registration and personal API keys moved to the shell's /account (UNI A-12 ext.).
 */
export async function fetchUserInfo(signal?: AbortSignal): Promise<UserInfo> {
  const response = await http.get<UserInfo>(`${BASE}/user-info`, { signal });
  return response.data;
}
