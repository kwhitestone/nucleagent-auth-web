/**
 * Token persistence helpers.
 *
 * The access JWT is persisted for page reloads. The refresh credential is an
 * HttpOnly cookie and is deliberately unavailable to application JavaScript.
 * The old localStorage key is removed during every token transition.
 */

const ACCESS_TOKEN_KEY = "nucleagent_access_token";
const REFRESH_TOKEN_KEY = "nucleagent_refresh_token";

export function getAccessToken(): string {
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? "";
}

export function clearLegacyRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  clearLegacyRefreshToken();
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
