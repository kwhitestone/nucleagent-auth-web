import assert from "node:assert/strict";
import test from "node:test";

import { createRequestId } from "../src/addons/auth-account/api/requestIdPolicy.ts";

test("request IDs use the supplied cryptographically secure UUID source", () => {
  assert.equal(
    createRequestId(() => "123e4567-e89b-12d3-a456-426614174000"),
    "123e4567-e89b-12d3-a456-426614174000",
  );
});
