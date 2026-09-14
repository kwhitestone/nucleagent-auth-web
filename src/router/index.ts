import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";

// The shell embeds this app in a plain iframe, where `__MICRO_APP_ENVIRONMENT__`
// is never set, so detecting only that flag left embedded runs on history mode.
// Mirror core and deliverables: treat any framed run as embedded.
// The base is "/" in both modes — this app is served from the root of its own
// domain, not from an `/auth` sub-path of the shell.
const isEmbedded =
  (globalThis as Record<string, unknown>).__MICRO_APP_ENVIRONMENT__ === true ||
  (typeof window !== "undefined" && window.parent !== window);

export const coreRoutes: RouteRecordRaw[] = [
  { path: "/", name: "auth-root", redirect: "/home" },
  {
    path: "/:pathMatch(.*)*",
    name: "auth-fallback",
    redirect: "/home",
  },
];

const router = createRouter({
  history: isEmbedded ? createWebHashHistory("/") : createWebHistory("/"),
  routes: coreRoutes,
});

export default router;
