import { defineStore } from "pinia";
import { computed, onScopeDispose, ref, shallowRef } from "vue";
import { fetchUserInfo } from "@/addons/auth-account/api/auth";
import type { UserInfo } from "@/addons/auth-account/api/types";
import { hasPermission } from "@/addons/auth-account/composables/permissionPolicy";
import {
  acceptShellSession,
  captureSession,
  clearPersistedCredentials,
  clearTokens,
  isCurrentSession,
  SessionCancelledError,
  subscribeSession,
} from "@/utils/token";

/**
 * User store.
 *
 * State is mutated only through actions (immutable-style: every action
 * reassigns the refs rather than mutating nested fields). Only the validated
 * shell session supplies an in-memory access token.
 */
export const useUserStore = defineStore("user", () => {
  clearPersistedCredentials();
  const session = shallowRef(captureSession());
  const token = computed(() => session.value.token);
  const user = ref<UserInfo | null>(null);
  let userRequest = 0;
  onScopeDispose(subscribeSession(() => {
    session.value = captureSession();
    user.value = null;
    userRequest += 1;
  }));

  const isAuthenticated = computed(() => !!token.value);
  const displayName = computed(
    () => user.value?.nickName || user.value?.username || "",
  );
  const roleId = computed(() => user.value?.roleId ?? null);
  const roles = computed(() => user.value?.roles ?? []);
  const permissions = computed(() => user.value?.permissions ?? []);
  const menus = computed(() => user.value?.menus ?? []);

  function can(required: string): boolean {
    return hasPermission(permissions.value, required);
  }

  function acceptShellToken(accessToken: string, version: number): void {
    acceptShellSession(accessToken, version);
  }

  async function fetchUser(signal?: AbortSignal): Promise<UserInfo> {
    const owner = captureSession();
    const request = ++userRequest;
    const info = await fetchUserInfo(signal);
    if (!isCurrentSession(owner) || signal?.aborted || request !== userRequest) {
      throw new SessionCancelledError();
    }
    user.value = info;
    return info;
  }

  function logout(): void {
    clearTokens();
  }

  return {
    // state
    token,
    user,
    // getters
    isAuthenticated,
    displayName,
    roleId,
    roles,
    permissions,
    menus,
    can,
    // actions
    acceptShellToken,
    fetchUser,
    logout,
  };
});
