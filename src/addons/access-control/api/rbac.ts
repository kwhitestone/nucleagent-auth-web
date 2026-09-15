import {
  emitAuthorizationChanged,
  getAuthRuntime,
} from "@/contracts/auth-runtime";
import { captureSession, isCurrentSession, SessionCancelledError } from "@/utils/token";

const http = () => getAuthRuntime().http;

const BASE = "/api/v1/addons/rbac";

async function mutation<T>(send: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const owner = captureSession();
  const response = await send();
  if (!isCurrentSession(owner) || signal?.aborted) throw new SessionCancelledError();
  emitAuthorizationChanged();
  return response;
}

export interface Role {
  id: number;
  roleId: number;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isEnabled: boolean;
  permissionCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Permission {
  id: number;
  code: string;
  name: string;
  module?: string;
  description?: string;
  isSystem?: boolean;
  isHighRisk?: boolean;
}

export type MenuType = "group" | "menu" | "button";
export type MenuApp = "shell" | "auth" | "core" | "executor" | "deliverables";

export interface Menu {
  id: number;
  parentId: number;
  code: string;
  title: string;
  titleKey?: string;
  path: string;
  icon?: string;
  app: MenuApp;
  type: MenuType;
  permissionCode?: string;
  sort: number;
  isVisible: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RbacUser {
  id: number;
  username: string;
  nickName?: string;
  email?: string;
  enable: number;
  roleIds: number[];
  roleCodes: string[];
}

export interface AuditLog {
  id: number | string;
  actorId?: number | string;
  action: string;
  target: string;
  detail?: unknown;
  requestId?: string;
  createdAt: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RoleCreateInput {
  code: string;
  name: string;
  description: string;
}

export interface RoleUpdateInput {
  name?: string;
  description?: string;
  isEnabled?: boolean;
}

export type MenuInput = Omit<Menu, "id" | "createdAt" | "updatedAt">;

export async function listRoles(signal?: AbortSignal): Promise<Role[]> {
  const response = await http().get<Role[]>(`${BASE}/roles`, { signal });
  return response.data;
}

export async function createRole(payload: RoleCreateInput, signal?: AbortSignal): Promise<Role> {
  const response = await mutation(() => http().post<Role>(`${BASE}/roles`, payload, { signal }), signal);
  return response.data;
}

export async function updateRole(roleId: number, payload: RoleUpdateInput, signal?: AbortSignal): Promise<Role> {
  const response = await mutation(() => http().patch<Role>(`${BASE}/roles/${roleId}`, payload, { signal }), signal);
  return response.data;
}

export async function deleteRole(roleId: number, signal?: AbortSignal): Promise<void> {
  await mutation(() => http().delete(`${BASE}/roles/${roleId}`, { signal }), signal);
}

export async function listPermissions(signal?: AbortSignal): Promise<Permission[]> {
  const response = await http().get<Permission[]>(`${BASE}/permission-catalog`, { signal });
  return response.data;
}

export async function listRolePermissions(roleId: number, signal?: AbortSignal): Promise<Permission[]> {
  const response = await http().get<Permission[]>(`${BASE}/roles/${roleId}/permissions`, { signal });
  return response.data;
}

export async function setRolePermissions(roleId: number, permissionIds: readonly number[], signal?: AbortSignal): Promise<void> {
  await mutation(() => http().put(`${BASE}/roles/${roleId}/permissions`, { permissionIds: [...permissionIds] }, { signal }), signal);
}

export async function listMenus(signal?: AbortSignal): Promise<Menu[]> {
  const response = await http().get<Menu[]>(`${BASE}/menus`, { signal });
  return response.data;
}

export async function createMenu(payload: MenuInput, signal?: AbortSignal): Promise<Menu> {
  const response = await mutation(() => http().post<Menu>(`${BASE}/menus`, payload, { signal }), signal);
  return response.data;
}

export async function updateMenu(id: number, payload: MenuInput, signal?: AbortSignal): Promise<Menu> {
  const response = await mutation(() => http().patch<Menu>(`${BASE}/menus/${id}`, payload, { signal }), signal);
  return response.data;
}

export async function deleteMenu(id: number, signal?: AbortSignal): Promise<void> {
  await mutation(() => http().delete(`${BASE}/menus/${id}`, { signal }), signal);
}

export async function listUsers(params: {
  page: number;
  pageSize: number;
  search?: string;
}, signal?: AbortSignal): Promise<PageResult<RbacUser>> {
  const response = await http().get<PageResult<RbacUser>>(`${BASE}/users`, { params, signal });
  return response.data;
}

export async function setUserRoles(id: number, roleIds: readonly number[], signal?: AbortSignal): Promise<void> {
  await mutation(() => http().put(`${BASE}/users/${id}/roles`, { roleIds: [...roleIds] }, { signal }), signal);
}

export async function listAuditLogs(params: {
  page: number;
  pageSize: number;
}, signal?: AbortSignal): Promise<PageResult<AuditLog>> {
  const response = await http().get<PageResult<AuditLog>>(`${BASE}/audit`, { params, signal });
  return response.data;
}
