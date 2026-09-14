import assert from "node:assert/strict";
import test from "node:test";

import { mustDelegateAuthMutationsToShell } from "../src/addons/auth-account/composables/authAuthorityPolicy.ts";

test("top-level auth runtime delegates authentication to the shell", () => {
  assert.equal(mustDelegateAuthMutationsToShell(false), true);
  assert.equal(mustDelegateAuthMutationsToShell(true), false);
});
