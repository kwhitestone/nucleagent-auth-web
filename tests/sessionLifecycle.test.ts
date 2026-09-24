import "./helpers/source-loader.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test as nodeTest } from "node:test";
import { createRenderer, nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { createI18n } from "vue-i18n";
import { AxiosError } from "axios";

const storage = new Map<string, string>();
const test = (name: string, fn: () => Promise<void>) => nodeTest(name, { timeout: 2000 }, fn);
const parent = { postMessage() {} };
const win = Object.assign(new EventTarget(), { parent, location: { replace() {} }, confirm: () => true });
Object.assign(globalThis, {
  window: win,
  document: { documentElement: { lang: "" } },
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
  },
});

const { useUserStore } = await import("../src/addons/auth-account/store/user.ts");
const { default: http } = await import("../src/addons/auth-account/api/http.ts");
const api = await import("../src/addons/auth-account/api/auth.ts");
const rbac = await import("../src/addons/access-control/api/rbac.ts");
const { authRuntime } = await import("../src/addons/auth-account/runtime.ts");
const { registerAuthRuntime } = await import("../src/contracts/auth-runtime.ts");
const { installShellBridge } = await import("../src/addons/auth-account/composables/useShellBridge.ts");
const session = await import("../src/utils/token.ts");
const { useSessionRequests } = await import("../src/composables/useSessionRequests.ts");
const { toast } = await import("../src/composables/useToast.ts");
const { default: Access } = await import("../src/addons/access-control/views/Access.vue");
const { routerKey } = await import("vue-router");
const panels = await Promise.all([
  import("../src/addons/access-control/components/UsersRolesPanel.vue"),
  import("../src/addons/access-control/components/RolesPermissionsPanel.vue"),
  import("../src/addons/access-control/components/MenusPanel.vue"),
  import("../src/addons/access-control/components/AuditPanel.vue"),
]);
const notices: string[] = [];
toast.show = (message: string) => { notices.push(message); };
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode: () => null, nextSibling: () => null,
});
let store: ReturnType<typeof useUserStore>;
let pinia: ReturnType<typeof createPinia>;
let disposeBridge: () => void;
let unregister: () => void;
const cleanups: Array<() => void> = [];
let pending: Array<{ config: any; resolve: (value: any) => void; reject: (error: any) => void }>;
const router = { currentRoute: { value: { path: "/access" } }, replace() {}, push() {} };
const instanceId = "test-instance-00000001";
let versionBase = 0;
function message(type: string, payload?: unknown, overrides = {}) {
  win.dispatchEvent(Object.assign(new Event("message"), {
    source: parent as any, origin: "http://localhost:26600",
    data: { protocol: "prism-fusion/remote", version: 1, appId: "auth", instanceId, type, payload },
    ...overrides,
  }));
}
function auth(token: string | null, sessionVersion: number) {
  message("auth", { source: "shell", type: "auth", token, sessionVersion: versionBase + sessionVersion });
}
function resolveRequest(request: typeof pending[number], data: unknown) {
  request.resolve({ data: { code: 0, data }, status: 200, headers: {}, config: request.config });
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); await nextTick(); };
function mount(component: any, props = {}) {
  const app = renderer.createApp({ ...component, render: () => null }, props);
  app.use(pinia);
  app.use(createI18n({ legacy: false, locale: "en", missingWarn: false, fallbackWarn: false, messages: { en: {} } }));
  app.provide(routerKey, router as any);
  app.mount({});
  cleanups.push(() => app.unmount());
  return { state: (app as any)._instance.setupState, unmount: () => { cleanups.pop()?.(); } };
}
beforeEach(() => {
  versionBase += 10;
  storage.clear();
  storage.set("nucleagent_access_token", "persisted-untrusted-fixture");
  pinia = createPinia();
  setActivePinia(pinia);
  store = useUserStore();
  notices.length = 0;
  pending = [];
  // No network: deliberately non-cooperative transport to test late completion.
  http.defaults.adapter = (config) => new Promise((resolve, reject) => { pending.push({ config, resolve, reject }); });
  unregister = registerAuthRuntime(authRuntime);
  disposeBridge = installShellBridge(router as any);
  message("host:init");
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  disposeBridge();
  unregister();
  store.$dispose();
});

test("persisted credentials never authenticate or dispatch protected consumers before shell auth", async () => {
  assert.equal(store.token, "");
  const results = await Promise.allSettled([
    store.fetchUser(), api.fetchUserInfo(), rbac.listRoles(),
  ]);
  assert.equal(pending.length, 0);
  assert.ok(results.every((result) => result.status === "rejected"));
});

test("Access mount waits for trusted authentication", async () => {
  mount(Access);
  await flush();
  assert.equal(pending.length, 0);
  auth("session-a-fixture", 1);
  await flush();
  assert.ok(pending.length >= 1);
  assert.ok(pending.every(({ config }) => config.headers.Authorization === "Bearer session-a-fixture"));
  assert.equal(storage.get("nucleagent_access_token"), undefined);
});

test("same-token version transition aborts a user-info request and rejects ABA completion", async () => {
  auth("session-a-fixture", 1);
  const request = store.fetchUser();
  const outcome = assert.rejects(request);
  await flush();
  const old = pending[0];
  auth("session-a-fixture", 2);
  assert.equal(old.config.signal?.aborted, true);
  resolveRequest(old, { username: "old", roles: ["admin"], permissions: ["*"], menus: [] });
  await outcome;
  assert.equal(store.user, null);
});

for (const [i, name] of ["users", "roles", "menus", "audit"].entries()) {
  test(`${name} panel unmount cancels owned transport and suppresses late UI errors`, async () => {
    auth("session-a-fixture", 1);
    const { unmount } = mount(panels[i].default, { canWrite: true });
    await flush();
    const requests = [...pending];
    assert.ok(requests.length > 0);
    unmount();
    assert.ok(requests.every(({ config }) => config.signal?.aborted));
    for (const request of requests) request.reject(new Error("obsolete failure"));
    await flush();
    assert.deepEqual(notices, []);
  });
}

test("untrusted origin and old versions cannot change the active session", async () => {
  message("auth", { source: "shell", type: "auth", token: "untrusted", sessionVersion: 1 },
    { origin: "https://untrusted.invalid" });
  assert.equal(store.token, "");
  auth("session-a-fixture", 4);
  auth("older", 3);
  assert.equal(store.token, "session-a-fixture");
});

test("bridge disposal clears session and cancels outstanding requests", async () => {
  auth("session-a-fixture", 1);
  const outcome = assert.rejects(api.fetchUserInfo());
  await flush();
  disposeBridge();
  assert.equal(store.token, "");
  assert.equal(pending[0].config.signal?.aborted, true);
  resolveRequest(pending[0], []);
  await outcome;
});

const userInfo = { id: 1, username: "offline-user", nickName: "Offline", roleId: 2, roles: ["reader"],
  permissions: ["auth:access:read", "auth:audit:read"], menus: [] };
function rejectHTTP(request: typeof pending[number], status: number, data: unknown = {}) {
  request.reject(new AxiosError("HTTP failure", "ERR_BAD_RESPONSE", request.config, undefined,
    { config: request.config, status, statusText: "", headers: {}, data }));
}

test("current user data populates permissions without persistence; logout clears all getters", async () => {
  auth("session-a-fixture", 1);
  const done = store.fetchUser();
  await flush();
  resolveRequest(pending[0], userInfo);
  await done;
  assert.equal(store.displayName, "Offline");
  assert.equal(store.roleId, 2);
  assert.deepEqual(store.roles, ["reader"]);
  assert.deepEqual(store.permissions, userInfo.permissions);
  assert.deepEqual(store.menus, []);
  assert.equal(store.isAuthenticated, true);
  assert.equal(store.can("auth:audit:read"), true);
  assert.equal(store.can("auth:user-role:write"), false);
  assert.equal(session.getAccessToken(), "session-a-fixture");
  store.logout();
  assert.equal(store.token, "");
  assert.equal(store.displayName, "");
  assert.equal(store.roleId, null);
  assert.deepEqual(store.roles, []);
  assert.deepEqual(store.permissions, []);
  assert.deepEqual(store.menus, []);
  assert.equal(store.can("auth:audit:read"), false);
  assert.equal(storage.get("nucleagent_access_token"), undefined);
});

test("request captures token synchronously and never dispatches with a replacement identity", async () => {
  auth("session-a-fixture", 1);
  const result = assert.rejects(api.fetchUserInfo());
  auth("session-b-fixture", 2);
  await flush();
  for (const request of pending) {
    assert.equal(request.config.headers.Authorization, "Bearer session-a-fixture");
    assert.equal(request.config.signal.aborted, true);
    resolveRequest(request, []);
  }
  await result;
});

test("current 401 clears identity and reports the exact memory session version", async () => {
  const sent: any[] = [];
  const previous = parent.postMessage;
  parent.postMessage = (envelope: any) => { sent.push(envelope); };
  try {
    auth("session-a-fixture", 1);
    const result = assert.rejects(api.fetchUserInfo(), { status: 401 });
    await flush();
    rejectHTTP(pending[0], 401, { message: "Rejected" });
    await result;
    assert.equal(store.token, "");
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].payload, { source: "sub", type: "auth-required",
      reason: "rejected", sessionVersion: versionBase + 1 });
    assert.ok(!JSON.stringify(sent).includes("session-a-fixture"));
  } finally { parent.postMessage = previous; }
});

test("old 401 after A-B-A cannot log out the new same-token session", async () => {
  auth("session-a-fixture", 1);
  const result = assert.rejects(api.fetchUserInfo());
  await flush();
  auth("session-b-fixture", 2);
  auth("session-a-fixture", 3);
  rejectHTTP(pending[0], 401);
  await result;
  assert.equal(store.token, "session-a-fixture");
});

test("caller cancellation aborts transport without invalidating the current session", async () => {
  auth("session-a-fixture", 1);
  const owner = new AbortController();
  const result = assert.rejects(api.fetchUserInfo(owner.signal));
  await flush();
  owner.abort();
  assert.equal(pending[0].config.signal.aborted, true);
  resolveRequest(pending[0], []);
  await result;
  assert.equal(store.token, "session-a-fixture");
});

test("duplicate token/version is idempotent, a token refresh aborts even at the same version", async () => {
  auth("session-a-fixture", 1);
  const original = session.captureSession();
  auth("session-a-fixture", 1);
  assert.equal(session.captureSession(), original);
  auth("session-b-fixture", 1);
  assert.equal(original.signal.aborted, true);
  assert.equal(store.token, "session-b-fixture");
});

test("invalid token/version input cannot establish a session even at the inner boundary", async () => {
  for (const version of [NaN, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    session.acceptShellSession("invalid-fixture", version);
  }
  session.acceptShellSession("x".repeat(8193), 1);
  assert.equal(store.token, "");
  auth("session-a-fixture", 4);
  session.acceptShellSession("older", versionBase + 3);
  assert.equal(store.token, "session-a-fixture");
});

test("all channel envelope validations remain enforced before accepting auth", async () => {
  const payload = { source: "shell", type: "auth", token: "invalid-fixture", sessionVersion: versionBase + 1 };
  const base = { protocol: "prism-fusion/remote", version: 1, appId: "auth", instanceId, type: "auth", payload };
  for (const data of [
    { ...base, protocol: "other" }, { ...base, version: 2 }, { ...base, appId: "core" },
    { ...base, instanceId: "different-instance-000001" }, { ...base, type: "unknown" },
    { ...base, payload: null }, { ...base, payload: { ...payload, source: "other" } },
    { ...base, payload: { ...payload, type: "logout" } },
    { ...base, payload: { ...payload, token: "" } },
    { ...base, payload: { ...payload, token: 12 } },
    { ...base, payload: { ...payload, sessionVersion: -1 } },
  ]) message("auth", payload, { data });
  message("auth", payload, { source: {} });
  assert.equal(store.token, "");
  assert.equal(pending.length, 0);
});

test("reconnected channel requires fresh auth and ignores the old instance", async () => {
  auth("session-a-fixture", 1);
  const snapshot = session.captureSession();
  const newId = "test-instance-00000002";
  const base = { protocol: "prism-fusion/remote", version: 1, appId: "auth", instanceId: newId };
  message("host:init", undefined, { data: { ...base, type: "host:init" } });
  assert.equal(store.token, "");
  assert.equal(snapshot.signal.aborted, true);
  auth("session-a-fixture", 2);
  assert.equal(store.token, "");
  message("auth", undefined, { data: { ...base, type: "auth",
    payload: { source: "shell", type: "auth", token: "session-b-fixture", sessionVersion: 1 } } });
  assert.equal(store.token, "session-b-fixture");
});

test("storage denial cannot prevent memory-only authentication or logout", async () => {
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", { configurable: true,
    get() { throw new Error("denied"); } });
  try {
    auth("session-a-fixture", 1);
    assert.equal(store.token, "session-a-fixture");
    store.logout();
    assert.equal(store.token, "");
  } finally { Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: previous }); }
});

test("channel accepts locale/view messages", async () => {
  message("locale", { source: "shell", type: "locale", locale: "en" });
  assert.equal(document.documentElement.lang, "en");
  message("view", { source: "shell", type: "view", path: "/access" });
});

const protectedCalls = [
  () => api.fetchUserInfo(),
  () => rbac.listRoles(), () => rbac.listPermissions(), () => rbac.listRolePermissions(1),
  () => rbac.listMenus(), () => rbac.listUsers({ page: 1, pageSize: 20 }),
  () => rbac.listAuditLogs({ page: 1, pageSize: 30 }),
  () => rbac.createRole({ code: "reader", name: "Reader", description: "" }),
  () => rbac.updateRole(1, { name: "Reader" }), () => rbac.deleteRole(1),
  () => rbac.setRolePermissions(1, [2]), () => rbac.setUserRoles(1, [2]),
  () => rbac.createMenu({ parentId: 0, code: "sample", title: "Sample", path: "/sample",
    app: "auth", type: "menu", sort: 0, isVisible: true }),
  () => rbac.updateMenu(1, { parentId: 0, code: "sample", title: "Sample", path: "/sample",
    app: "auth", type: "menu", sort: 0, isVisible: true }),
  () => rbac.deleteMenu(1),
];

test("every protected API refuses pre-auth dispatch, including all RBAC mutations", async () => {
  const results = await Promise.allSettled(protectedCalls.map((call) => call()));
  assert.ok(results.every((result) => result.status === "rejected"));
  assert.equal(pending.length, 0);
});

test("every current protected API retains methods/envelopes and authorization notifications", async () => {
  auth("session-a-fixture", 1);
  let notifications = 0;
  const listener = () => { notifications++; };
  win.addEventListener("nucleagent:authorization-changed", listener);
  try {
    const results = protectedCalls.map((call) => call());
    await flush();
    assert.equal(pending.length, protectedCalls.length);
    for (const request of pending) {
      assert.equal(request.config.headers.Authorization, "Bearer session-a-fixture");
      assert.equal(request.config.withCredentials, true);
      assert.equal(request.config.headers["X-Refresh-Cookie-Only"], "1");
      assert.ok(request.config.headers["X-Request-ID"]);
      resolveRequest(request, []);
    }
    await Promise.all(results);
    assert.equal(notifications, 8);
  } finally { win.removeEventListener("nucleagent:authorization-changed", listener); }
});

test("RBAC mutation that settles across a session transition emits no authorization event", async () => {
  auth("session-a-fixture", 1);
  let notifications = 0;
  const listener = () => { notifications++; };
  win.addEventListener("nucleagent:authorization-changed", listener);
  try {
    const result = assert.rejects(rbac.setUserRoles(1, [2]));
    await flush();
    auth(null, 2);
    resolveRequest(pending[0], {});
    await result;
    assert.equal(notifications, 0);
  } finally { win.removeEventListener("nucleagent:authorization-changed", listener); }
});

test("public registration remains anonymous and its 401 cannot clear a trusted session", async () => {
  auth("session-a-fixture", 1);
  const done = assert.rejects(http.post("/api/v1/addons/auth/register",
    { username: "offline", password: "offline-fixture", nickName: "Offline" }));
  await flush();
  assert.equal(pending[0].config.headers.Authorization, undefined);
  rejectHTTP(pending[0], 401);
  await done;
  assert.equal(store.token, "session-a-fixture");
});

test("current HTTP errors and non-envelope responses preserve their contracts", async () => {
  auth("session-a-fixture", 1);
  for (const data of [{ detail: "Unavailable" }, { title: "Unavailable" }, {}, undefined]) {
    const done = assert.rejects(api.fetchUserInfo(), { status: 503 });
    await flush();
    rejectHTTP(pending.at(-1)!, 503, data);
    await done;
  }
  const business = assert.rejects(api.fetchUserInfo(), { code: 4, status: 200 });
  await flush();
  const request = pending.at(-1)!;
  request.resolve({ data: { code: 4 }, status: 200, headers: {}, config: request.config });
  await business;
  const raw = http.get("/api/v1/addons/auth/user-info", { headers: { "X-Request-ID": "kept" } });
  await flush();
  const last = pending.at(-1)!;
  assert.equal(last.config.headers["X-Request-ID"], "kept");
  last.resolve({ data: "raw", status: 200, headers: {}, config: last.config });
  assert.equal((await raw).data, "raw");
});

test("latest user request owns the store even within one session", async () => {
  auth("session-a-fixture", 1);
  const first = assert.rejects(store.fetchUser());
  const second = store.fetchUser();
  await flush();
  resolveRequest(pending[1], userInfo);
  await second;
  resolveRequest(pending[0], { ...userInfo, username: "obsolete" });
  await first;
  assert.equal(store.user?.username, "offline-user");
});

test("view owner drops a result after transport settles but before its completion callback", async () => {
  auth("session-a-fixture", 1);
  const component = { setup() { return { run: useSessionRequests(() => {}) }; } };
  const { state } = mount(component);
  let release!: (value: string) => void;
  let completed = false;
  const done = state.run("work", () => new Promise<string>((resolve) => { release = resolve; }),
    { success: () => { completed = true; } });
  release("old");
  auth("session-b-fixture", 2);
  await done;
  assert.equal(completed, false);
});

test("view replacement aborts previous work; failure aborts unfinished siblings", async () => {
  auth("session-a-fixture", 1);
  const { state, unmount } = mount({ setup() { return { run: useSessionRequests(() => {}) }; } });
  let oldSignal!: AbortSignal;
  let release!: (value: string) => void;
  const old = state.run("work", (signal: AbortSignal) => {
    oldSignal = signal; return new Promise<string>((resolve) => { release = resolve; });
  }, { success: () => { throw new Error("obsolete callback"); } });
  let failed = false;
  await state.run("work", async () => { throw new Error("current"); },
    { error: () => { failed = true; } });
  assert.equal(oldSignal.aborted, true);
  assert.equal(failed, true);
  release("late");
  await old;
  unmount();
  await state.run("after-unmount", () => { throw new Error("must not run"); }, {});
});

for (const [i, name] of ["users", "roles", "menus", "audit"].entries()) {
  test(`${name} panel clears displayed identity data on version change and drops late success`, async () => {
    auth("session-a-fixture", 1);
    const { state } = mount(panels[i].default, { canWrite: true });
    await flush();
    const initial = [...pending];
    for (const request of initial) {
      resolveRequest(request, request.config.url.endsWith("/users") || request.config.url.endsWith("/audit")
        ? { items: [], total: 0, page: 1, pageSize: 20 } : []);
    }
    await flush();
    const done = state.load();
    await flush();
    const requests = pending.slice(initial.length);
    auth("session-b-fixture", 2);
    for (const request of requests) {
      assert.equal(request.config.signal.aborted, true);
      resolveRequest(request, request.config.url.endsWith("/users") || request.config.url.endsWith("/audit")
        ? { items: [{ id: 1 }], total: 1, page: 1 } : [{ id: 1, roleId: 1, code: "old" }]);
    }
    await done;
    assert.deepEqual(state[["users", "roles", "menus", "logs"][i]], []);
    assert.equal(state.loading, false);
    assert.equal(state.errorMessage, "");
    assert.deepEqual(notices, []);
  });
}

test("Access identity permissions retain read-only tabs and never restore prior account rights", async () => {
  auth("session-a-fixture", 1);
  const { state } = mount(Access);
  await flush();
  resolveRequest(pending[0], userInfo);
  await flush();
  assert.deepEqual(state.accessibleTabs.map((tab: any) => tab.key), ["audit"]);
  assert.equal(store.can("auth:user-role:write"), false);
  const done = state.refreshIdentity();
  await flush();
  const old = pending.at(-1)!;
  auth(null, 2);
  resolveRequest(old, { ...userInfo, permissions: ["*"] });
  await done;
  assert.deepEqual(state.accessibleTabs, []);
  assert.equal(store.user, null);
  assert.equal(state.identityError, "");
});

test("all RBAC write controls remain closed for read-only permissions", async () => {
  auth("session-a-fixture", 1);
  const { state: users } = mount(panels[0].default, { canWrite: false });
  const { state: roles } = mount(panels[1].default, { canWrite: false });
  const { state: menus } = mount(panels[2].default, { canWrite: false });
  await flush();
  const count = pending.length;
  const role = { id: 1, roleId: 1, code: "reader", name: "Reader", isSystem: false };
  const menu = { id: 1, code: "sample", title: "Sample" };
  users.openAssignment({ id: 1, roleIds: [1], roleCodes: ["reader"] });
  await users.saveAssignment();
  roles.openCreateRole(); roles.openEditRole(role);
  await roles.saveRole(); await roles.savePermissions(); await roles.removeRole(role);
  menus.openCreate(); menus.openEdit(menu);
  await menus.saveMenu(); await menus.removeMenu(menu);
  assert.equal(users.editingUser, null);
  assert.equal(roles.roleDialogOpen, false);
  assert.equal(menus.dialogOpen, false);
  assert.equal(pending.length, count);
});

for (const action of ["assignment", "role", "permissions", "menu"]) {
  test(`late RBAC ${action} mutation cannot toast, reload, or notify authorization after logout`, async () => {
    auth("session-a-fixture", 1);
    const index = action === "assignment" ? 0 : action === "menu" ? 2 : 1;
    const { state } = mount(panels[index].default, { canWrite: true });
    await flush();
    for (const request of [...pending]) resolveRequest(request,
      request.config.url.endsWith("/users") ? { items: [], total: 0, page: 1 } : []);
    await flush();
    if (action === "assignment") {
      state.openAssignment({ id: 1, roleIds: [2], roleCodes: ["reader"] });
    } else if (action === "role") {
      state.openCreateRole();
      state.roleForm = { code: "reader", name: "Reader", description: "", isEnabled: true };
    } else if (action === "permissions") {
      state.roles = [{ id: 1, roleId: 1, isSystem: false }];
      state.selectedRoleId = 1;
      state.selectedPermissionIds = [2];
    } else {
      state.openCreate();
      state.menuForm = { ...state.menuForm, code: "sample", title: "Sample", path: "/sample" };
    }
    let notifications = 0;
    const listener = () => { notifications++; };
    win.addEventListener("nucleagent:authorization-changed", listener);
    try {
      const method = { assignment: "saveAssignment", role: "saveRole",
        permissions: "savePermissions", menu: "saveMenu" }[action]!;
      const done = state[method]();
      await flush();
      const request = pending.at(-1)!;
      assert.ok(["post", "put"].includes(request.config.method));
      auth(null, 2);
      const count = pending.length;
      resolveRequest(request, {});
      await done;
      assert.equal(request.config.signal.aborted, true);
      assert.equal(pending.length, count);
      assert.equal(notifications, 0);
      assert.deepEqual(notices, []);
      assert.equal(state.saving, false);
    } finally { win.removeEventListener("nucleagent:authorization-changed", listener); }
  });
}

test("current API failures reach mounted UI but obsolete failures do not", async () => {
  auth("session-a-fixture", 1);
  const { state } = mount(panels[3].default);
  await flush();
  rejectHTTP(pending[0], 503, { message: "Current failure" });
  await flush();
  assert.notEqual(state.errorMessage, "");
  const done = state.load();
  await flush();
  auth(null, 2);
  rejectHTTP(pending.at(-1)!, 503, { message: "Old failure" });
  await done;
  assert.equal(state.errorMessage, "");
  assert.deepEqual(notices, []);
});
