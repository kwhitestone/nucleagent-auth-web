<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import {
  SESSION_CHANGE_EVENT,
  useAuthContext,
} from "@/contracts/auth-runtime";
import UsersRolesPanel from "@/addons/access-control/components/UsersRolesPanel.vue";
import RolesPermissionsPanel from "@/addons/access-control/components/RolesPermissionsPanel.vue";
import MenusPanel from "@/addons/access-control/components/MenusPanel.vue";
import AuditPanel from "@/addons/access-control/components/AuditPanel.vue";
import { accessCatalogKey, accessErrorKey } from "@/addons/access-control/composables/accessI18n";

type AccessTab = "users" | "roles" | "menus" | "audit";

const router = useRouter();
const userStore = useAuthContext();
const { t, te } = useI18n();
const activeTab = ref<AccessTab>("users");
const identityLoading = ref(true);
const identityError = ref("");
const contentVersion = ref(0);
let identityRequestVersion = 0;

const tabs = computed<Array<{ key: AccessTab; label: string; description: string; required: string[] }>>(() => [
  { key: "users", label: t("access.tabs.users.label"), description: t("access.tabs.users.description"), required: ["auth:user:read", "auth:role:read"] },
  { key: "roles", label: t("access.tabs.roles.label"), description: t("access.tabs.roles.description"), required: ["auth:role:read", "auth:permission:read"] },
  { key: "menus", label: t("access.tabs.menus.label"), description: t("access.tabs.menus.description"), required: ["auth:menu:read", "auth:permission:read"] },
  { key: "audit", label: t("access.tabs.audit.label"), description: t("access.tabs.audit.description"), required: ["auth:audit:read"] },
]);

const accessibleTabs = computed(() => userStore.can("auth:access:read")
  ? tabs.value.filter((tab) => tab.required.every((permission) => userStore.can(permission)))
  : []);
const activeDescription = computed(
  () => tabs.value.find((tab) => tab.key === activeTab.value)?.description ?? "",
);

const localizedRoles = computed(() => userStore.roles.map((role) => {
  const key = accessCatalogKey("roleNames", role);
  return te(key) ? t(key) : role;
}));

async function refreshIdentity(): Promise<void> {
  const currentVersion = ++identityRequestVersion;
  identityLoading.value = true;
  identityError.value = "";
  try {
    await userStore.fetchUser();
    if (currentVersion !== identityRequestVersion) return;
    if (!accessibleTabs.value.some((tab) => tab.key === activeTab.value)) {
      activeTab.value = accessibleTabs.value[0]?.key ?? "users";
    }
    contentVersion.value += 1;
  } catch (error) {
    if (currentVersion !== identityRequestVersion) return;
    identityError.value = accessErrorKey(error, "access.page.identityLoadFailedFallback");
  } finally {
    if (currentVersion === identityRequestVersion) identityLoading.value = false;
  }
}

function onSessionChange(event: Event): void {
  const authenticated = (event as CustomEvent<{ authenticated?: unknown }>).detail
    ?.authenticated === true;
  if (authenticated) void refreshIdentity();
  else {
    identityRequestVersion += 1;
    userStore.logout();
    identityLoading.value = false;
  }
}

onMounted(() => {
  window.addEventListener(SESSION_CHANGE_EVENT, onSessionChange);
  void refreshIdentity();
});
onBeforeUnmount(() => window.removeEventListener(SESSION_CHANGE_EVENT, onSessionChange));
</script>

<template>
  <div class="access-view">
    <main class="access-shell">
      <header class="access-header">
        <div>
          <button class="access-back" type="button" @click="router.push('/')">{{ t("access.page.backAccount") }}</button>
          <h1>{{ t("access.page.title") }}</h1>
          <p>{{ activeDescription }}</p>
        </div>
        <div class="access-identity" :aria-label="t('access.page.currentAdministrator')">
          <span>{{ userStore.displayName || userStore.user?.username || t("access.page.administrator") }}</span>
          <small>{{ localizedRoles.join(" / ") || t("access.page.authenticated") }}</small>
        </div>
      </header>

      <nav v-if="!identityLoading && accessibleTabs.length" class="access-tabs" role="tablist" :aria-label="t('access.page.tabListLabel')">
        <button
          v-for="tab in accessibleTabs"
          :id="`access-tab-${tab.key}`"
          :key="tab.key"
          class="access-tab"
          :class="{ 'access-tab--active': activeTab === tab.key }"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.key"
          :aria-controls="`access-panel-${tab.key}`"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>

      <section v-if="identityLoading" class="access-content rbac-panel">
        <div class="rbac-state" aria-live="polite"><span class="rbac-skeleton"></span><span class="rbac-skeleton"></span><span class="rbac-skeleton"></span></div>
      </section>
      <section v-else-if="identityError" class="access-content rbac-panel">
        <div class="rbac-state" role="alert"><strong>{{ t("access.page.identityLoadFailedTitle") }}</strong><p>{{ t(identityError) }}</p><button class="rbac-button" type="button" @click="refreshIdentity">{{ t("access.common.retry") }}</button></div>
      </section>
      <section v-else-if="!accessibleTabs.length" class="access-content rbac-panel">
        <div class="rbac-state" role="alert"><strong>{{ t("access.page.noAccessTitle") }}</strong><p>{{ t("access.page.noAccessDescription") }}</p><button class="rbac-button" type="button" @click="router.push('/')">{{ t("access.page.backAccount") }}</button></div>
      </section>
      <section
        v-else
        :id="`access-panel-${activeTab}`"
        class="access-content"
        role="tabpanel"
        :aria-labelledby="`access-tab-${activeTab}`"
      >
        <UsersRolesPanel v-if="activeTab === 'users'" :key="`users-${contentVersion}`" :can-write="userStore.can('auth:user-role:write')" />
        <RolesPermissionsPanel v-else-if="activeTab === 'roles'" :key="`roles-${contentVersion}`" :can-write="userStore.can('auth:role:write')" />
        <MenusPanel v-else-if="activeTab === 'menus'" :key="`menus-${contentVersion}`" :can-write="userStore.can('auth:menu:write')" />
        <AuditPanel v-else :key="`audit-${contentVersion}`" />
      </section>
    </main>
  </div>
</template>

<style src="../access.css"></style>
