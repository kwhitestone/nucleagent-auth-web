import assert from "node:assert/strict";
import test from "node:test";

import {
  collectDescendantMenuIds,
  flattenMenuTree,
  formatPermissionExpression,
  normalizeNumericIds,
  parsePermissionExpression,
  toggleNumericSelection,
} from "../src/addons/access-control/composables/authorizationPolicy.ts";
import { hasPermission } from "../src/addons/auth-account/composables/permissionPolicy.ts";

test("matches exact, namespace wildcard and global permissions", () => {
  assert.equal(hasPermission(["access:role:read"], "access:role:read"), true);
  assert.equal(hasPermission(["access:role:*"], "access:role:write"), true);
  assert.equal(hasPermission(["*"], "access:audit:read"), false);
  assert.equal(hasPermission(["*:*:*"], "access:audit:read"), true);
  assert.equal(hasPermission(["access:*"], "access"), false);
  assert.equal(hasPermission(["access:*"], "access:role:read"), false);
  assert.equal(hasPermission(["access:role:read"], "access:role:write"), false);
  assert.equal(hasPermission(["access:*:read"], "access:role:read"), true);
  assert.equal(hasPermission(["access:role:*:extra"], "access:role:read"), false);
  assert.equal(hasPermission([], ""), false);
});

test("normalizes any-of permission expressions without mutating selections", () => {
  const selected = ["auth:menu:read", " auth:role:read ", "auth:menu:read", ""];
  assert.deepEqual(parsePermissionExpression(" auth:menu:read | auth:role:read | "), ["auth:menu:read", "auth:role:read"]);
  assert.equal(formatPermissionExpression(selected), "auth:menu:read|auth:role:read");
  assert.deepEqual(selected, ["auth:menu:read", " auth:role:read ", "auth:menu:read", ""]);
});

test("normalizes and toggles numeric selections without mutating the input", () => {
  const original = [4, 2, 4];
  assert.deepEqual(normalizeNumericIds([4, "2", 4, 0, -1, "bad", 3.5]), [2, 4]);

  const added = toggleNumericSelection(original, 3, true);
  const removed = toggleNumericSelection(added, 4, false);

  assert.deepEqual(original, [4, 2, 4]);
  assert.deepEqual(added, [2, 3, 4]);
  assert.deepEqual(removed, [2, 3]);
  assert.notEqual(added, original);
});

test("flattens menu trees deterministically and terminates on orphans and cycles", () => {
  const menus = [
    { id: 2, parentId: 1, title: "Child", sort: 20 },
    { id: 1, parentId: 0, title: "Root", sort: 10 },
    { id: 3, parentId: 99, title: "Orphan", sort: 30 },
    { id: 4, parentId: 5, title: "Cycle A", sort: 40 },
    { id: 5, parentId: 4, title: "Cycle B", sort: 50 },
  ];

  const rows = flattenMenuTree(menus);

  assert.deepEqual(rows.map(({ item }) => item.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(rows.map(({ depth }) => depth), [0, 1, 0, 0, 1]);
  assert.equal(rows[2]?.orphaned, true);
  assert.equal(rows[3]?.cyclic, true);
  assert.equal(rows[4]?.cyclic, true);
  assert.deepEqual(menus.map(({ id }) => id), [2, 1, 3, 4, 5]);
});

test("collects descendants without looping through a cyclic branch", () => {
  const menus = [
    { id: 1, parentId: 0, title: "Root", sort: 1 },
    { id: 2, parentId: 1, title: "Child", sort: 1 },
    { id: 3, parentId: 2, title: "Grandchild", sort: 1 },
    { id: 4, parentId: 5, title: "Cycle A", sort: 1 },
    { id: 5, parentId: 4, title: "Cycle B", sort: 1 },
  ];

  assert.deepEqual(collectDescendantMenuIds(menus, 1), new Set([2, 3]));
  assert.deepEqual(collectDescendantMenuIds(menus, 4), new Set([5]));
});
