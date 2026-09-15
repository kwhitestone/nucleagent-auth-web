import type { AxiosInstance } from "axios";

export interface AuthUserInfo {
  id: number | string;
  username: string;
  nickName?: string;
  roles: string[];
  permissions: string[];
}

export interface AuthContext {
  readonly token: string;
  readonly user: AuthUserInfo | null;
  readonly displayName: string;
  readonly roles: string[];
  readonly can: (permission: string) => boolean;
  readonly acceptShellToken: (accessToken: string, version: number) => void;
  readonly fetchUser: (signal?: AbortSignal) => Promise<AuthUserInfo>;
  readonly logout: () => void;
}

export interface AuthRuntime {
  readonly http: AxiosInstance;
  readonly useAuthContext: () => AuthContext;
  readonly emitAuthorizationChanged: () => void;
}

export const SESSION_CHANGE_EVENT = "nucleagent:session-change";

let activeRuntime: AuthRuntime | undefined;

export function registerAuthRuntime(runtime: AuthRuntime): () => void {
  if (activeRuntime) throw new Error("Auth runtime is already registered");
  activeRuntime = runtime;
  return () => {
    if (activeRuntime === runtime) activeRuntime = undefined;
  };
}

export function getAuthRuntime(): AuthRuntime {
  if (!activeRuntime) throw new Error("Auth runtime is not installed");
  return activeRuntime;
}

export const useAuthContext = (): AuthContext => getAuthRuntime().useAuthContext();
export const emitAuthorizationChanged = (): void => {
  getAuthRuntime().emitAuthorizationChanged();
};
