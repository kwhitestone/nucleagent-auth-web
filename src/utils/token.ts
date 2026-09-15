import { emitSessionChange } from "@/addons/auth-account/composables/sessionEvents";

export interface SessionSnapshot {
  readonly token: string;
  readonly version: number;
  readonly signal: AbortSignal;
}

let controller = new AbortController();
let session: SessionSnapshot = Object.freeze({ token: "", version: 0, signal: controller.signal });
const listeners = new Set<() => void>();

export class SessionCancelledError extends Error {
  constructor() {
    super("Trusted session is unavailable or changed");
    this.name = "SessionCancelledError";
  }
}

export function clearPersistedCredentials(): void {
  // Storage may be denied in embedded contexts. It is never an auth authority.
  try {
    for (const key of ["nucleagent_access_token", "nucleagent_refresh_token", "nucleagent_session_version"]) {
      localStorage.removeItem(key);
    }
  } catch { /* Memory remains fail-closed even when storage cannot be cleared. */ }
}

export const captureSession = (): SessionSnapshot => session;
export const getAccessToken = (): string => session.token;
export const isCurrentSession = (snapshot: SessionSnapshot): boolean =>
  snapshot === session && !!snapshot.token && !snapshot.signal.aborted;

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function transition(token: string, version: number): void {
  const previous = controller;
  controller = new AbortController();
  session = Object.freeze({ token, version, signal: controller.signal });
  previous.abort();
  clearPersistedCredentials();
  for (const listener of listeners) listener();
  emitSessionChange(Boolean(token));
}

/** Only the validated shell channel may accept a token/version pair. */
export function acceptShellSession(token: string, version: number): void {
  if (!Number.isSafeInteger(version) || version < session.version || version < 0 ||
      typeof token !== "string" || token.length > 8192) return;
  if (session.token === token && session.version === version) return;
  transition(token, version);
}

export function clearTokens(): void {
  transition("", session.version);
}

/** A new channel installation must wait for its own trusted handshake. */
export function resetSession(): void {
  transition("", 0);
}
