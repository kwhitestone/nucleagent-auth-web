export const AUTHORIZATION_CHANGED_EVENT = "nucleagent:authorization-changed";

export function emitAuthorizationChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTHORIZATION_CHANGED_EVENT));
}
