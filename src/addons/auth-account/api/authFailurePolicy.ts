const BEARER_PREFIX = "Bearer ";

export function shouldHandleUnauthorized(
  currentToken: string,
  requestAuthorization: unknown,
): boolean {
  if (!currentToken) return true;
  if (typeof requestAuthorization !== "string") return false;
  if (!requestAuthorization.startsWith(BEARER_PREFIX)) return false;
  return requestAuthorization.slice(BEARER_PREFIX.length) === currentToken;
}
