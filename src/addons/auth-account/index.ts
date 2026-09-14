import type { PluginModule } from "@prism-fusion/plugin-runtime";

import { registerAuthRuntime } from "@/contracts/auth-runtime";
import router from "@/router";
import { getAccessToken } from "@/utils/token";
import { authRuntime } from "./runtime";
import { mustDelegateAuthMutationsToShell } from "./composables/authAuthorityPolicy";
import { installShellBridge } from "./composables/useShellBridge";

let removeShellBridge: (() => void) | undefined;
let removeAuthGuard: (() => void) | undefined;
let unregisterRuntime: (() => void) | undefined;

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

const authAccount: PluginModule = {
  name: "auth-account",
  description: "Authentication, account and API-key user experience",
  manifest: {
    apiVersion: "prism-fusion/v2",
    kind: "frontend-addon",
    id: "auth-account",
    version: "0.1.0",
    requires: [],
    routeScopes: ["/login", "/register", "/home"],
  },
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("./views/Login.vue"),
      meta: { public: true },
    },
    {
      path: "/register",
      name: "register",
      component: () => import("./views/Register.vue"),
      meta: { public: true },
    },
    {
      path: "/home",
      name: "home",
      component: () => import("./views/Home.vue"),
      meta: { requiresAuth: true },
    },
  ],
  setup() {
    unregisterRuntime = registerAuthRuntime(authRuntime);
    removeAuthGuard = router.beforeEach((to) => {
      const authenticated = Boolean(getAccessToken());
      if (to.meta.requiresAuth && !authenticated) {
        return { name: "login", query: { redirect: to.fullPath } };
      }
      if (to.meta.public && authenticated && to.name !== "register") {
        return { name: "home" };
      }
      return true;
    });
    removeShellBridge = installShellBridge(router);
  },
  destroy() {
    removeShellBridge?.();
    removeShellBridge = undefined;
    removeAuthGuard?.();
    removeAuthGuard = undefined;
    unregisterRuntime?.();
    unregisterRuntime = undefined;
  },
};

export default authAccount;
