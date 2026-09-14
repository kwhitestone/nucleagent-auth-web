import type { PluginModule } from "@prism-fusion/plugin-runtime";

const accessControl: PluginModule = {
  name: "access-control",
  description: "Role, permission, menu and authorization audit management",
  manifest: {
    apiVersion: "prism-fusion/v2",
    kind: "frontend-addon",
    id: "access-control",
    version: "0.1.0",
    requires: [{ id: "auth-account" }],
    routeScopes: ["/access"],
  },
  routes: [
    {
      path: "/access",
      name: "access",
      component: () => import("./views/Access.vue"),
      meta: { requiresAuth: true },
    },
  ],
};

export default accessControl;
