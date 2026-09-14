import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("account labels and logout feedback use the shared reactive locale", () => {
  const source = readFileSync(new URL("../src/addons/auth-account/views/Home.vue", import.meta.url), "utf8");
  for (const key of ["home.logout", "home.logoutSuccess", "home.userInfoTitle", "common.nickname", "common.username", "home.roleId"]) {
    assert.ok(source.includes(`t("${key}")`), `${key} must be translated`);
  }
});
