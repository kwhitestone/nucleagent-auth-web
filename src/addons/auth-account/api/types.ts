/**
 * Shared API type definitions matching the nucleagent-auth backend contract.
 */

/** Unified envelope returned by every endpoint: { code, message, data } */
export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

/** User object returned by login / refresh-token / user-info. */
export interface AuthUser {
  id: number | string;
  username: string;
  nickName?: string;
  headerImg?: string;
  roleId?: number;
  roles?: string[];
}

/** User-info success payload (extends AuthUser with roles). */
export interface UserInfo extends AuthUser {
  roles: string[];
  permissions: string[];
  menus: Array<{
    id: number;
    parentId: number;
    code: string;
    title: string;
    path: string;
    icon?: string;
    app?: string;
    type: "group" | "menu" | "button";
    permissionCode?: string;
    sort: number;
    isVisible: boolean;
  }>;
}

