import {
  emitAuthorizationChanged,
  getAuthRuntime,
} from "@/contracts/auth-runtime";

const http = () => getAuthRuntime().http;

const BASE = "/api/v1/addons/rbac";

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

export async function listRoles(): Promise<Role[]> {
  const response = await http().get<Role[]>(`${BASE}/roles`);
  return response.data;
}

export async function createRole(payload: RoleCreateInput): Promise<Role> {
  const response = await http().post<Role>(`${BASE}/roles`, payload);
  emitAuthorizationChanged();
  return response.data;
}

export async function updateRole(roleId: number, payload: RoleUpdateInput): Promise<Role> {
  const response = await http().patch<Role>(`${BASE}/roles/${roleId}`, payload);
  emitAuthorizationChanged();
  return response.data;
}

export async function deleteRole(roleId: number): Promise<void> {
  await http().delete(`${BASE}/roles/${roleId}`);
  emitAuthorizationChanged();
}

export async function listPermissions(): Promise<Permission[]> {
  const response = await http().get<Permission[]>(`${BASE}/permission-catalog`);
  return response.data;
}

export async function listRolePermissions(roleId: number): Promise<Permission[]> {
  const response = await http().get<Permission[]>(`${BASE}/roles/${roleId}/permissions`);
  return response.data;
}

export async function setRolePermissions(roleId: number, permissionIds: readonly number[]): Promise<void> {
  await http().put(`${BASE}/roles/${roleId}/permissions`, { permissionIds: [...permissionIds] });
  emitAuthorizationChanged();
}

export async function listMenus(): Promise<Menu[]> {
  const response = await http().get<Menu[]>(`${BASE}/menus`);
  return response.data;
}

export async function createMenu(payload: MenuInput): Promise<Menu> {
  const response = await http().post<Menu>(`${BASE}/menus`, payload);
  emitAuthorizationChanged();
  return response.data;
}

export async function updateMenu(id: number, payload: MenuInput): Promise<Menu> {
  const response = await http().patch<Menu>(`${BASE}/menus/${id}`, payload);
  emitAuthorizationChanged();
  return response.data;
}

export async function deleteMenu(id: number): Promise<void> {
  await http().delete(`${BASE}/menus/${id}`);
  emitAuthorizationChanged();
}

export async function listUsers(params: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<PageResult<RbacUser>> {
  const response = await http().get<PageResult<RbacUser>>(`${BASE}/users`, { params });
  return response.data;
}

export async function setUserRoles(id: number, roleIds: readonly number[]): Promise<void> {
  await http().put(`${BASE}/users/${id}/roles`, { roleIds: [...roleIds] });
  emitAuthorizationChanged();
}

export async function listAuditLogs(params: {
  page: number;
  pageSize: number;
}): Promise<PageResult<AuditLog>> {
  const response = await http().get<PageResult<AuditLog>>(`${BASE}/audit`, { params });
  return response.data;
}
