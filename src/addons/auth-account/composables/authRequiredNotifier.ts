export interface AuthRequiredPayload {
  source: "sub";
  type: "auth-required";
  reason: "missing" | "rejected";
  sessionVersion: number;
}

let notifier: ((payload: AuthRequiredPayload) => boolean) | undefined;

export function setAuthRequiredNotifier(
  nextNotifier: typeof notifier,
): void {
  notifier = nextNotifier;
}

export function notifyAuthRequired(payload: AuthRequiredPayload): boolean {
  return notifier?.(payload) ?? false;
}
