import type { PluginModule } from "@prism-fusion/plugin-runtime";

import { registerAuthRuntime } from "@/contracts/auth-runtime";
import router from "@/router";
import { authRuntime } from "./runtime";
import { mustDelegateAuthMutationsToShell } from "./composables/authAuthorityPolicy";
import { installShellBridge } from "./composables/useShellBridge";

let removeShellBridge: (() => void) | undefined;
let unregisterRuntime: (() => void) | undefined;

/**
 * Sign-in and the personal account page are the shell's (/login, /account;
 * UNI L4 + A-12 ext.). A standalone visit goes there; framed, this app only
 * serves the /access admin console and the shell guards it before framing.
 */
export function redirectDelegatedAuthToShell(isMicroApp: boolean): boolean {
  const isEmbedded = isMicroApp || window.parent !== window;
  if (!mustDelegateAuthMutationsToShell(isEmbedded)) return false;
  const shellURL = new URL(
    "/account",
    import.meta.env.VITE_SHELL_URL ?? "http://localhost:26600",
  );
  window.location.replace(shellURL.toString());
  return true;
}

/** Session plumbing only: auth runtime + shell bridge. It owns no routes. */
const authAccount: PluginModule = {
  name: "auth-account",
  description: "Shell session bridge and auth runtime for the access console",
  manifest: {
    apiVersion: "prism-fusion/v2",
    kind: "frontend-addon",
    id: "auth-account",
    version: "0.1.0",
    requires: [],
    routeScopes: [],
  },
  setup() {
    unregisterRuntime = registerAuthRuntime(authRuntime);
    removeShellBridge = installShellBridge(router);
  },
  destroy() {
    removeShellBridge?.();
    removeShellBridge = undefined;
    unregisterRuntime?.();
    unregisterRuntime = undefined;
  },
};

export default authAccount;
