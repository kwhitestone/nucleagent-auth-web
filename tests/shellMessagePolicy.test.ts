import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveShellLocale,
  resolveShellViewPath,
  shouldAcceptShellSessionVersion,
} from "../src/addons/auth-account/composables/shellMessagePolicy.ts";

test("accepts only supported locale messages from the shell protocol", () => {
  assert.equal(resolveShellLocale({ source: "shell", type: "locale", locale: "en" }), "en");
  assert.equal(resolveShellLocale({ source: "shell", type: "locale", locale: "zh" }), "zh");
  assert.equal(resolveShellLocale({ source: "shell", type: "locale", locale: "fr" }), null);
  assert.equal(resolveShellLocale({ source: "sub", type: "locale", locale: "en" }), null);
  assert.equal(resolveShellLocale(null), null);
});

test("rejects a shell session older than the current iframe session", () => {
  assert.equal(shouldAcceptShellSessionVersion(7, 6), false);
  assert.equal(shouldAcceptShellSessionVersion(7, 7), true);
  assert.equal(shouldAcceptShellSessionVersion(7, 8), true);
});

test("maps only supported shell view intents to local routes", () => {
  assert.equal(resolveShellViewPath({ source: "shell", type: "view", view: "account" }), "/");
  assert.equal(resolveShellViewPath({ source: "shell", type: "view", view: "access" }), "/access");
  assert.equal(resolveShellViewPath({ source: "sub", type: "view", view: "access" }), null);
  assert.equal(resolveShellViewPath({ source: "shell", type: "auth", view: "access" }), null);
  assert.equal(resolveShellViewPath({ source: "shell", type: "view", view: "admin" }), null);
  assert.equal(resolveShellViewPath(null), null);
  assert.equal(resolveShellViewPath({ source: "shell", type: "view", path: "/access/roles" }), "/access/roles");
  assert.equal(resolveShellViewPath({ source: "shell", type: "view", path: "//evil.test" }), null);
});
