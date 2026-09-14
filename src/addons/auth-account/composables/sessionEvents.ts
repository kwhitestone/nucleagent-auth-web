import { SESSION_CHANGE_EVENT } from "@/contracts/auth-runtime";

export { SESSION_CHANGE_EVENT } from "@/contracts/auth-runtime";

export function emitSessionChange(authenticated: boolean): void {
  window.dispatchEvent(new CustomEvent(SESSION_CHANGE_EVENT, {
    detail: { authenticated },
  }));
}
