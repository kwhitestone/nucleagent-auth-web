export function shouldHandleUnauthorized(
  currentToken: string,
  requestAuthorization: unknown,
): boolean {
  if (!currentToken) return true;
  // A-16: the gateway rejects `Bearer `-prefixed tokens, so the header is the bare token.
  return requestAuthorization === currentToken;
}
