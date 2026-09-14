<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  createRole,
  deleteRole,
  listPermissions,
  listRolePermissions,
  listRoles,
  setRolePermissions,
  updateRole,
  type Permission,
  type Role,
} from "@/addons/access-control/api/rbac";
import { normalizeNumericIds, toggleNumericSelection } from "@/addons/access-control/composables/authorizationPolicy";
import { accessCatalogKey, accessErrorKey } from "@/addons/access-control/composables/accessI18n";
import { toast } from "@/composables/useToast";

const props = defineProps<{ canWrite: boolean }>();
const { t, te } = useI18n();

interface RoleForm {
  code: string;
  name: string;
  description: string;
  isEnabled: boolean;
}

const roles = ref<Role[]>([]);
const permissions = ref<Permission[]>([]);
const selectedRoleId = ref<number | null>(null);
const selectedPermissionIds = ref<number[]>([]);
const loading = ref(true);
const permissionLoading = ref(false);
const permissionError = ref("");
const saving = ref(false);
const errorMessage = ref("");
const roleDialogOpen = ref(false);
const editingRole = ref<Role | null>(null);
const roleForm = ref<RoleForm>({ code: "", name: "", description: "", isEnabled: true });
let permissionRequestVersion = 0;

const selectedRole = computed(
  () => roles.value.find((role) => role.roleId === selectedRoleId.value) ?? null,
);
const permissionsLocked = computed(
  () => selectedRole.value?.isSystem === true,
);
const permissionGroups = computed(() => {
  const grouped = new Map<string, Permission[]>();
  [...permissions.value]
    .sort((left, right) => (left.module || "").localeCompare(right.module || "") || left.code.localeCompare(right.code))
    .forEach((permission) => {
      const moduleName = permission.module || permission.code.split(":")[0] || "other";
      grouped.set(moduleName, [...(grouped.get(moduleName) ?? []), permission]);
    });
  return [...grouped.entries()].map(([moduleName, items]) => ({ moduleName, items }));
});

function localizedRoleName(role: Role): string {
  const key = accessCatalogKey("roleNames", role.code);
  return te(key) ? t(key) : role.name || role.code;
}

function localizedPermissionName(permission: Permission): string {
  const key = accessCatalogKey("permissionNames", permission.code);
  return te(key) ? t(key) : permission.name || permission.code;
}

function localizedModuleName(moduleName: string): string {
  const key = accessCatalogKey("moduleNames", moduleName);
  return te(key) ? t(key) : moduleName === "other" ? t("access.common.other") : moduleName;
}

async function loadRolePermissions(roleId: number): Promise<void> {
  const currentVersion = ++permissionRequestVersion;
  permissionLoading.value = true;
  permissionError.value = "";
  try {
    const assigned = await listRolePermissions(roleId);
    if (currentVersion === permissionRequestVersion && selectedRoleId.value === roleId) {
      selectedPermissionIds.value = normalizeNumericIds(assigned.map((permission) => permission.id));
    }
  } catch (error) {
    if (currentVersion === permissionRequestVersion && selectedRoleId.value === roleId) {
      permissionError.value = accessErrorKey(error, "access.roles.permissionLoadFailedFallback");
      toast.error(t(permissionError.value));
    }
  } finally {
    if (currentVersion === permissionRequestVersion && selectedRoleId.value === roleId) permissionLoading.value = false;
  }
}

async function load(): Promise<void> {
  loading.value = true;
  errorMessage.value = "";
  try {
    const [roleList, permissionList] = await Promise.all([listRoles(), listPermissions()]);
    roles.value = [...roleList];
    permissions.value = [...permissionList];
    const nextRoleId = roleList.some((role) => role.roleId === selectedRoleId.value)
      ? selectedRoleId.value
      : roleList[0]?.roleId ?? null;
    selectedRoleId.value = nextRoleId;
    if (nextRoleId !== null) await loadRolePermissions(nextRoleId);
  } catch (error) {
    errorMessage.value = accessErrorKey(error, "access.roles.loadFailedFallback");
  } finally {
    loading.value = false;
  }
}

function selectRole(roleId: number): void {
  if (roleId === selectedRoleId.value) return;
  selectedRoleId.value = roleId;
  selectedPermissionIds.value = [];
  void loadRolePermissions(roleId);
}

function togglePermission(permissionId: number, event: Event): void {
  if (!props.canWrite || permissionsLocked.value || permissionError.value) return;
  selectedPermissionIds.value = toggleNumericSelection(
    selectedPermissionIds.value,
    permissionId,
    (event.target as HTMLInputElement).checked,
  );
}

function toggleGroup(items: Permission[], event: Event): void {
  if (!props.canWrite || permissionsLocked.value || permissionError.value) return;
  const checked = (event.target as HTMLInputElement).checked;
  const groupIds = new Set(items.map((item) => item.id));
  const next = checked
    ? [...selectedPermissionIds.value, ...groupIds]
    : selectedPermissionIds.value.filter((id) => !groupIds.has(id));
  selectedPermissionIds.value = normalizeNumericIds(next);
}

function isGroupSelected(items: Permission[]): boolean {
  return items.length > 0 && items.every((item) => selectedPermissionIds.value.includes(item.id));
}

async function savePermissions(): Promise<void> {
  if (selectedRoleId.value === null || permissionsLocked.value || permissionError.value || !props.canWrite) return;
  saving.value = true;
  try {
    await setRolePermissions(selectedRoleId.value, selectedPermissionIds.value);
    toast.success(t("access.roles.success.permissionsSaved"));
  } catch (error) {
    toast.error(t(accessErrorKey(error, "access.roles.errors.permissionSaveFailed")));
  } finally {
    saving.value = false;
  }
}

function openCreateRole(): void {
  if (!props.canWrite) return;
  editingRole.value = null;
  roleForm.value = { code: "", name: "", description: "", isEnabled: true };
  roleDialogOpen.value = true;
}

function openEditRole(role: Role): void {
  if (!props.canWrite || role.isSystem) return;
  editingRole.value = { ...role };
  roleForm.value = {
    code: role.code,
    name: role.name,
    description: role.description ?? "",
    isEnabled: role.isEnabled,
  };
  roleDialogOpen.value = true;
}

async function saveRole(): Promise<void> {
  if (!props.canWrite) return;
  const payload = {
    code: roleForm.value.code.trim(),
    name: roleForm.value.name.trim(),
    description: roleForm.value.description.trim(),
    isEnabled: roleForm.value.isEnabled,
  };
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(payload.code)) {
    toast.warning(t("access.roles.validation.invalidCode"));
    return;
  }
  if (!payload.name) {
    toast.warning(t("access.roles.validation.nameRequired"));
    return;
  }
  saving.value = true;
  try {
    if (editingRole.value) {
      await updateRole(editingRole.value.roleId, {
        name: payload.name,
        description: payload.description,
        isEnabled: payload.isEnabled,
      });
    } else {
      await createRole({ code: payload.code, name: payload.name, description: payload.description });
    }
    roleDialogOpen.value = false;
    toast.success(t(editingRole.value ? "access.roles.success.updated" : "access.roles.success.created"));
    await load();
  } catch (error) {
    toast.error(t(accessErrorKey(error, "access.roles.errors.roleSaveFailed")));
  } finally {
    saving.value = false;
  }
}

async function removeRole(role: Role): Promise<void> {
  if (!props.canWrite || role.isSystem || !window.confirm(t("access.roles.dialog.deleteConfirm", { name: localizedRoleName(role) }))) return;
  try {
    await deleteRole(role.roleId);
    toast.success(t("access.roles.success.deleted"));
    if (selectedRoleId.value === role.roleId) selectedRoleId.value = null;
    await load();
  } catch (error) {
    toast.error(t(accessErrorKey(error, "access.roles.errors.deleteFailed")));
  }
}

onMounted(() => void load());
</script>

<template>
  <article class="rbac-panel">
    <header class="rbac-panel__header">
      <div><h2>{{ t("access.roles.title") }}</h2><p>{{ t("access.roles.description") }}</p></div>
      <button v-if="canWrite" class="rbac-button rbac-button--primary" type="button" @click="openCreateRole">{{ t("access.roles.create") }}</button>
    </header>

    <div v-if="loading" class="rbac-state" aria-live="polite">
      <span class="rbac-skeleton"></span><span class="rbac-skeleton"></span><span class="rbac-skeleton"></span>
    </div>
    <div v-else-if="errorMessage" class="rbac-state" role="alert">
      <strong>{{ t("access.roles.loadFailedTitle") }}</strong><p>{{ t(errorMessage) }}</p>
      <button class="rbac-button" type="button" @click="load">{{ t("access.common.retry") }}</button>
    </div>
    <div v-else-if="!roles.length" class="rbac-state">
      <strong>{{ t("access.roles.emptyTitle") }}</strong><p>{{ t("access.roles.emptyDescription") }}</p>
      <button v-if="canWrite" class="rbac-button rbac-button--primary" type="button" @click="openCreateRole">{{ t("access.roles.create") }}</button>
    </div>
    <div v-else class="role-matrix">
      <aside class="role-matrix__sidebar">
        <div class="role-matrix__list">
          <button
            v-for="role in roles"
            :key="role.roleId"
            class="role-matrix__item"
            :class="{ 'role-matrix__item--active': selectedRoleId === role.roleId }"
            type="button"
            @click="selectRole(role.roleId)"
          >
            <strong>{{ localizedRoleName(role) }}<span v-if="role.isSystem" class="rbac-tag rbac-tag--neutral">{{ t("access.common.system") }}</span></strong>
            <small>{{ role.code }} / ID {{ role.roleId }}</small>
          </button>
        </div>
      </aside>

      <section class="role-matrix__body">
        <div v-if="selectedRole" class="rbac-toolbar">
          <div>
            <strong>{{ localizedRoleName(selectedRole) }}</strong>
            <span class="rbac-table__secondary">{{ t("access.roles.permissionCount", { count: selectedPermissionIds.length }) }}</span>
          </div>
          <div class="rbac-toolbar__group">
            <button v-if="canWrite" class="rbac-button" type="button" :disabled="selectedRole.isSystem" @click="openEditRole(selectedRole)">{{ t("access.roles.edit") }}</button>
            <button v-if="canWrite" class="rbac-button rbac-button--danger" type="button" :disabled="selectedRole.isSystem" @click="removeRole(selectedRole)">{{ t("access.roles.delete") }}</button>
            <button v-if="canWrite" class="rbac-button rbac-button--primary" type="button" :disabled="saving || permissionLoading || permissionsLocked || Boolean(permissionError)" @click="savePermissions">{{ saving ? t("access.common.saving") : t("access.roles.savePermissions") }}</button>
            <span v-else class="rbac-table__secondary">{{ t("access.common.readOnlyAccess") }}</span>
          </div>
        </div>

        <div v-if="permissionLoading" class="rbac-state" aria-live="polite">
          <span class="rbac-skeleton"></span><span class="rbac-skeleton"></span><span class="rbac-skeleton"></span>
        </div>
        <div v-else-if="permissionError" class="rbac-state" role="alert">
          <strong>{{ t("access.roles.permissionLoadFailedTitle") }}</strong><p>{{ t(permissionError) }}</p>
          <button class="rbac-button" type="button" @click="selectedRoleId !== null && loadRolePermissions(selectedRoleId)">{{ t("access.common.retry") }}</button>
        </div>
        <div v-else-if="!permissions.length" class="rbac-state"><strong>{{ t("access.roles.emptyPermissionsTitle") }}</strong><p>{{ t("access.roles.emptyPermissionsDescription") }}</p></div>
        <div v-else>
          <section v-for="group in permissionGroups" :key="group.moduleName" class="permission-group">
            <header class="permission-group__header">
              <strong>{{ localizedModuleName(group.moduleName) }}</strong>
              <label class="rbac-checkline">
                <input type="checkbox" :checked="isGroupSelected(group.items)" :disabled="permissionsLocked || !canWrite" @change="toggleGroup(group.items, $event)" />
                {{ t("access.roles.selectGroup") }}
              </label>
            </header>
            <div class="rbac-choice-list">
              <label v-for="permission in group.items" :key="permission.id" class="rbac-choice">
                <input type="checkbox" :checked="selectedPermissionIds.includes(permission.id)" :disabled="permissionsLocked || !canWrite" @change="togglePermission(permission.id, $event)" />
                <span><strong>{{ localizedPermissionName(permission) }}</strong><small>{{ permission.code }}</small></span>
              </label>
            </div>
          </section>
        </div>
      </section>
    </div>
  </article>

  <div v-if="roleDialogOpen" class="rbac-modal-overlay" @click.self="!saving && (roleDialogOpen = false)">
    <section class="rbac-modal" role="dialog" aria-modal="true" aria-labelledby="role-dialog-title">
      <header class="rbac-modal__header">
        <div><h3 id="role-dialog-title">{{ t(editingRole ? "access.roles.dialog.editTitle" : "access.roles.dialog.createTitle") }}</h3><p>{{ t("access.roles.dialog.subtitle") }}</p></div>
        <button class="rbac-modal__close" type="button" :aria-label="t('access.common.close')" :disabled="saving" @click="roleDialogOpen = false">×</button>
      </header>
      <div class="rbac-form-grid">
        <label class="rbac-field"><span>{{ t("access.roles.dialog.name") }}</span><input v-model="roleForm.name" class="rbac-input" maxlength="64" /></label>
        <label class="rbac-field"><span>{{ t("access.roles.dialog.code") }}</span><input v-model="roleForm.code" class="rbac-input" maxlength="64" :disabled="Boolean(editingRole)" /></label>
        <label class="rbac-field rbac-field--full"><span>{{ t("access.roles.dialog.description") }}</span><textarea v-model="roleForm.description" class="rbac-textarea" maxlength="255"></textarea></label>
        <label v-if="editingRole" class="rbac-checkline rbac-field--full"><input v-model="roleForm.isEnabled" type="checkbox" />{{ t("access.roles.dialog.enable") }}</label>
        <p v-else class="rbac-field rbac-field--full rbac-form-note">{{ t("access.roles.dialog.defaultEnabled") }}</p>
      </div>
      <footer class="rbac-modal__actions">
        <button class="rbac-button" type="button" :disabled="saving" @click="roleDialogOpen = false">{{ t("access.common.cancel") }}</button>
        <button class="rbac-button rbac-button--primary" type="button" :disabled="saving" @click="saveRole">{{ saving ? t("access.common.saving") : t("access.roles.dialog.save") }}</button>
      </footer>
    </section>
  </div>
</template>
