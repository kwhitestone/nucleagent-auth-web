export function createRequestId(randomUUID: () => string): string {
  return randomUUID();
}
