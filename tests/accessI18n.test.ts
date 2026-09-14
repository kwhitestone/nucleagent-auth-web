import assert from "node:assert/strict";
import test from "node:test";

import en from "../src/i18n/en.ts";
import zh from "../src/i18n/zh.ts";
import { accessErrorKey, auditActionKey, accessCatalogKey } from "../src/addons/access-control/composables/accessI18n.ts";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, nested]) => flattenKeys(nested, prefix ? `${prefix}.${key}` : key))
    .sort();
}

test("RBAC management console exposes matching Chinese and English messages", () => {
  assert.ok("access" in zh, "Chinese access messages are missing");
  assert.ok("access" in en, "English access messages are missing");
  assert.deepEqual(flattenKeys(en.access), flattenKeys(zh.access));
});

test("RBAC translations cover page, validation, dialog, table, and audit copy", () => {
  const requiredKeys = [
    "page.title",
    "tabs.users.label",
    "tabs.roles.label",
    "tabs.menus.label",
    "tabs.audit.label",
    "users.assignment.title",
    "roles.validation.invalidCode",
    "roles.dialog.deleteConfirm",
    "menus.dialog.permissionHelp",
    "menus.table.protectedDeleteTitle",
    "audit.table.requestId",
    "pagination.label",
  ];
  const keys = new Set(flattenKeys(zh.access));
  for (const key of requiredKeys) assert.ok(keys.has(key), `missing access.${key}`);
});

test("RBAC dynamic data resolves through stable localization keys", () => {
  assert.equal(accessCatalogKey("permissionNames", "auth:role:read"), "access.permissionNames.auth:role:read");
  assert.equal(accessCatalogKey("menuNames", "account_access"), "access.menuNames.account_access");
  assert.equal(auditActionKey("role.permissions.update"), "access.audit.actions.rolePermissionsUpdate");
  assert.equal(auditActionKey("custom.action"), undefined);
});

test("RBAC API failures resolve to localized status categories", () => {
  assert.equal(accessErrorKey({ status: 403 }, "access.users.loadFailedFallback"), "access.errors.forbidden");
  assert.equal(accessErrorKey({ status: 409 }, "access.users.loadFailedFallback"), "access.errors.conflict");
  assert.equal(accessErrorKey({ status: 422 }, "access.users.loadFailedFallback"), "access.errors.validation");
  assert.equal(accessErrorKey({ status: 503 }, "access.users.loadFailedFallback"), "access.errors.unavailable");
  assert.equal(accessErrorKey({ status: 0 }, "access.users.loadFailedFallback"), "access.errors.network");
  assert.equal(accessErrorKey({ status: 418 }, "access.users.loadFailedFallback"), "access.users.loadFailedFallback");
  assert.equal(accessErrorKey(null, "access.users.loadFailedFallback"), "access.users.loadFailedFallback");
  assert.equal(accessErrorKey(new Error("boom"), "access.users.loadFailedFallback"), "access.users.loadFailedFallback");
});
