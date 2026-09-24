import {
  createPluginHost,
  type HeadlessPluginHost,
} from "@prism-fusion/plugin-runtime";
import { createPinia } from "pinia";
import { createApp, type App as VueApp } from "vue";

import accessControl from "./addons/access-control";
import authAccount, { redirectDelegatedAuthToShell } from "./addons/auth-account";
import App from "./App.vue";
import i18n from "./i18n";
import router, { coreRoutes } from "./router";
import "./styles/aurora.css";
import "./styles/global.css";

const MOUNT_ID = "auth-app";

let app: VueApp | null = null;
let host: HeadlessPluginHost | null = null;

async function mount(): Promise<void> {
  if (app) return;
  const nextApp = createApp(App);
  nextApp.use(createPinia());
  nextApp.use(i18n);

  const nextHost = createPluginHost({
    app: nextApp,
    router,
    coreRoutes,
    homePath: "/access",
  });
  nextHost.register([authAccount, accessControl]);
  await nextHost.install();
  nextApp.use(router);
  await router.isReady();
  nextApp.mount(`#${MOUNT_ID}`);
  app = nextApp;
  host = nextHost;
}

async function unmount(): Promise<void> {
  await host?.uninstall();
  host = null;
  app?.unmount();
  app = null;
}

const w = globalThis as Record<string, unknown>;
const isMicroApp = w.__MICRO_APP_ENVIRONMENT__ === true;
if (redirectDelegatedAuthToShell(isMicroApp)) {
  // Navigation is owned by the auth addon; this host remains unmounted.
} else if (isMicroApp) {
  w.mount = mount;
  w.unmount = unmount;
} else {
  void mount();
}
