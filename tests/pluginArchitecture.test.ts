import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) =>
  readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("auth web is composed from scoped V2 addons", () => {
  const main = source("main.ts");
  const router = source("router/index.ts");
  const account = source("addons/auth-account/index.ts");
  const access = source("addons/access-control/index.ts");
  const shellBridge = source("addons/auth-account/composables/useShellBridge.ts");
  const http = source("addons/auth-account/api/http.ts");

  assert.match(main, /@prism-fusion\/plugin-runtime/);
  assert.match(main, /await nextHost\.install\(\)[\s\S]*nextApp\.use\(router\)/);
  assert.doesNotMatch(router, /views\/(Login|Register|Home|Access)/);
  assert.doesNotMatch(router, /beforeEach/);
  assert.match(account, /apiVersion:\s*["']prism-fusion\/v2["']/);
  assert.match(account, /router\.beforeEach/);
  assert.match(account, /routeScopes:\s*\[[^\]]*["']\/login["']/s);
  assert.match(access, /requires:\s*\[[^\]]*auth-account/s);
  assert.match(access, /routeScopes:\s*\[[^\]]*["']\/access["']/s);
  assert.match(shellBridge, /createRemoteChildChannel/);
  assert.doesNotMatch(shellBridge, /window\.parent\.postMessage/);
  assert.doesNotMatch(http, /window\.parent\.postMessage/);
  assert.equal(existsSync(new URL("../src/views", import.meta.url)), false);
});
