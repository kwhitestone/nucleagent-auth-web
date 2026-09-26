import assert from "node:assert/strict";
import test from "node:test";

import { shouldHandleUnauthorized } from "../src/addons/auth-account/api/authFailurePolicy.ts";

test("does not let a stale or pre-auth 401 clear a fresh iframe token", () => {
  assert.equal(shouldHandleUnauthorized("fresh", undefined), false);
  assert.equal(shouldHandleUnauthorized("fresh", "old"), false);
  assert.equal(shouldHandleUnauthorized("fresh", "fresh"), true);
  assert.equal(shouldHandleUnauthorized("", undefined), true);
  assert.equal(shouldHandleUnauthorized("fresh", "Bearer fresh"), false, "A-16: header is the bare token");
});
