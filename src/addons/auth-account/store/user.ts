import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { fetchUserInfo } from "@/addons/auth-account/api/auth";
import type { UserInfo } from "@/addons/auth-account/api/types";
import { hasPermission } from "@/addons/auth-account/composables/permissionPolicy";
import {
  clearLegacyRefreshToken,
  clearTokens,
  getAccessToken,
} from "@/utils/token";

/**
 * User store.
 *
 * State is mutated only through actions (immutable-style: every action
 * reassigns the refs rather than mutating nested fields). The access token is
 * persisted to localStorage via the token utils so it survives reloads; the
 * `token` ref is hydrated from localStorage on store creation.
 */
export const useUserStore = defineStore("user", () => {
  clearLegacyRefreshToken();
  const token = ref<string>(getAccessToken());
  const user = ref<UserInfo | null>(null);

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

  function acceptShellToken(accessToken: string): void {
    if (token.value !== accessToken) user.value = null;
    localStorage.setItem("nucleagent_access_token", accessToken);
    localStorage.removeItem("nucleagent_refresh_token");
    token.value = accessToken;
  }

  async function fetchUser(): Promise<UserInfo> {
    const requestToken = token.value;
    const info = await fetchUserInfo();
    if (token.value !== requestToken) {
      throw new Error("Session changed while user information was loading");
    }
    user.value = info;
    return info;
  }

  function logout(): void {
    user.value = null;
    token.value = "";
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
