export type AccessCatalog = "menuNames" | "moduleNames" | "permissionNames" | "roleNames";

const AUDIT_ACTION_KEYS: Readonly<Record<string, string>> = Object.freeze({
  "role.create": "access.audit.actions.roleCreate",
  "role.update": "access.audit.actions.roleUpdate",
  "role.delete": "access.audit.actions.roleDelete",
  "role.permissions.update": "access.audit.actions.rolePermissionsUpdate",
  "user.roles.update": "access.audit.actions.userRolesUpdate",
  "menu.create": "access.audit.actions.menuCreate",
  "menu.update": "access.audit.actions.menuUpdate",
  "menu.delete": "access.audit.actions.menuDelete",
});

const STATUS_ERROR_KEYS: Readonly<Record<number, string>> = Object.freeze({
  400: "access.errors.validation",
  403: "access.errors.forbidden",
  404: "access.errors.notFound",
  409: "access.errors.conflict",
  422: "access.errors.validation",
  500: "access.errors.unavailable",
  502: "access.errors.unavailable",
  503: "access.errors.unavailable",
  504: "access.errors.unavailable",
});

export function accessCatalogKey(catalog: AccessCatalog, code: string): string {
  return `access.${catalog}.${code}`;
}

export function auditActionKey(action: string): string | undefined {
  return AUDIT_ACTION_KEYS[action];
}

export function accessErrorKey(error: unknown, fallbackKey: string): string {
  if (error === null || typeof error !== "object" || !("status" in error)) return fallbackKey;
  const status = Number((error as { status?: unknown }).status);
  if (status === 0) return "access.errors.network";
  return STATUS_ERROR_KEYS[status] ?? fallbackKey;
}
