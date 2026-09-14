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

/** Login / refresh-token success payload. */
export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresIn: string;
  user: AuthUser;
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

/** API key as returned by the create endpoint (plaintext shown once). */
export interface ApiKeyWithSecret {
  id: number | string;
  name: string;
  prefix: string;
  plaintext: string;
  enable: boolean;
  createdAt: string;
}

/** API key as returned by the list endpoint (no plaintext). */
export interface ApiKey {
  id: number | string;
  name: string;
  prefix: string;
  enable: boolean;
  lastUsed: string;
  createdAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  nickName: string;
}

export interface CreateApiKeyRequest {
  name: string;
}
