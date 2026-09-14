<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  createMenu,
  deleteMenu,
  listMenus,
  listPermissions,
  updateMenu,
  type Menu,
  type MenuInput,
  type Permission,
} from "@/addons/access-control/api/rbac";
import {
  collectDescendantMenuIds,
  flattenMenuTree,
  formatPermissionExpression,
  parsePermissionExpression,
} from "@/addons/access-control/composables/authorizationPolicy";
import { accessCatalogKey, accessErrorKey } from "@/addons/access-control/composables/accessI18n";
import { toast } from "@/composables/useToast";

const props = defineProps<{ canWrite: boolean }>();
const { t, te } = useI18n();

const emptyMenuForm = (): MenuInput => ({
  parentId: 0,
  code: "",
  title: "",
  titleKey: "",
  path: "",
  icon: "",
  app: "shell",
  type: "menu",
  permissionCode: "",
  sort: 0,
  isVisible: true,
});

const menus = ref<Menu[]>([]);
const permissions = ref<Permission[]>([]);
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref("");
const dialogOpen = ref(false);
const editingMenu = ref<Menu | null>(null);
const menuForm = ref<MenuInput>(emptyMenuForm());
const selectedPermissionCodes = ref<string[]>([]);

const menuApps = ["shell", "auth", "core", "executor", "deliverables"] as const;

const menuRows = computed(() => flattenMenuTree(menus.value));
const forbiddenParentIds = computed(() => editingMenu.value
  ? new Set([editingMenu.value.id, ...collectDescendantMenuIds(menus.value, editingMenu.value.id)])
  : new Set<number>());
const parentOptions = computed(() => menuRows.value
  .filter(({ item }) => item.type !== "button" && !forbiddenParentIds.value.has(item.id)));
const editingProtectedAccessMenu = computed(() => editingMenu.value?.code === "account_access");

function isProtectedAccessMenu(menu: Menu): boolean {
  return menu.code === "account_access";
}

function localizedMenuTitle(menu: Menu): string {
  if (menu.titleKey && te(menu.titleKey)) return t(menu.titleKey);
  const key = accessCatalogKey("menuNames", menu.code);
  return te(key) ? t(key) : menu.title;
}

function localizedPermissionName(permission: Permission): string {
  const key = accessCatalogKey("permissionNames", permission.code);
  return te(key) ? t(key) : permission.name || permission.code;
}

async function load(): Promise<void> {
  loading.value = true;
  errorMessage.value = "";
  try {
    const [menuList, permissionList] = await Promise.all([listMenus(), listPermissions()]);
    menus.value = [...menuList];
    permissions.value = [...permissionList].sort((left, right) => left.code.localeCompare(right.code));
  } catch (error) {
    errorMessage.value = accessErrorKey(error, "access.menus.loadFailedFallback");
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  if (!props.canWrite) return;
  editingMenu.value = null;
  menuForm.value = emptyMenuForm();
  selectedPermissionCodes.value = [];
  dialogOpen.value = true;
}

function openEdit(menu: Menu): void {
  if (!props.canWrite) return;
  editingMenu.value = { ...menu };
  menuForm.value = {
    parentId: menu.parentId,
    code: menu.code,
    title: menu.title,
    titleKey: menu.titleKey ?? "",
    path: menu.path,
    icon: menu.icon ?? "",
    app: menuApps.some((app) => app === menu.app) ? menu.app : "shell",
    type: menu.type,
    permissionCode: menu.permissionCode ?? "",
    sort: menu.sort,
    isVisible: menu.isVisible,
  };
  selectedPermissionCodes.value = parsePermissionExpression(menu.permissionCode ?? "");
  dialogOpen.value = true;
}

async function saveMenu(): Promise<void> {
  if (!props.canWrite) return;
  const payload: MenuInput = {
    ...menuForm.value,
    parentId: Number(menuForm.value.parentId) || 0,
    code: menuForm.value.code.trim(),
    title: menuForm.value.title.trim(),
    titleKey: menuForm.value.titleKey?.trim(),
    path: menuForm.value.path.trim(),
    icon: menuForm.value.icon?.trim(),
    app: menuForm.value.app,
    permissionCode: formatPermissionExpression(selectedPermissionCodes.value),
    sort: Math.max(0, Number(menuForm.value.sort) || 0),
  };
  if (!/^[a-z][a-z0-9_-]{1,63}$/.test(payload.code)) {
    toast.warning(t("access.menus.validation.invalidCode"));
    return;
  }
  if (!payload.title) {
    toast.warning(t("access.menus.validation.titleRequired"));
    return;
  }
  if (payload.type === "menu" && !payload.path) {
    toast.warning(t("access.menus.validation.pathRequired"));
    return;
  }
  if (payload.path && (!payload.path.startsWith("/") || payload.path.startsWith("//") || payload.path.includes("://"))) {
    toast.warning(t("access.menus.validation.invalidPath"));
    return;
  }
  saving.value = true;
  try {
    if (editingMenu.value) await updateMenu(editingMenu.value.id, payload);
    else await createMenu(payload);
    dialogOpen.value = false;
    toast.success(t(editingMenu.value ? "access.menus.success.updated" : "access.menus.success.created"));
    await load();
  } catch (error) {
    toast.error(t(accessErrorKey(error, "access.menus.errors.saveFailed")));
  } finally {
    saving.value = false;
  }
}

async function removeMenu(menu: Menu): Promise<void> {
  if (!props.canWrite || !window.confirm(t("access.menus.dialog.deleteConfirm", { title: localizedMenuTitle(menu) }))) return;
  try {
    await deleteMenu(menu.id);
    toast.success(t("access.menus.success.deleted"));
    await load();
  } catch (error) {
    toast.error(t(accessErrorKey(error, "access.menus.errors.deleteFailed")));
  }
}

onMounted(() => void load());
</script>

<template>
  <article class="rbac-panel">
    <header class="rbac-panel__header">
      <div><h2>{{ t("access.menus.title") }}</h2><p>{{ t("access.menus.description") }}</p></div>
      <button v-if="canWrite" class="rbac-button rbac-button--primary" type="button" @click="openCreate">{{ t("access.menus.create") }}</button>
    </header>

    <div v-if="loading" class="rbac-state" aria-live="polite">
      <span class="rbac-skeleton"></span><span class="rbac-skeleton"></span><span class="rbac-skeleton"></span>
    </div>
    <div v-else-if="errorMessage" class="rbac-state" role="alert">
      <strong>{{ t("access.menus.loadFailedTitle") }}</strong><p>{{ t(errorMessage) }}</p>
      <button class="rbac-button" type="button" @click="load">{{ t("access.common.retry") }}</button>
    </div>
    <div v-else-if="!menuRows.length" class="rbac-state">
      <strong>{{ t("access.menus.emptyTitle") }}</strong><p>{{ t("access.menus.emptyDescription") }}</p>
      <button v-if="canWrite" class="rbac-button rbac-button--primary" type="button" @click="openCreate">{{ t("access.menus.create") }}</button>
    </div>
    <div v-else class="rbac-table-wrap">
      <table class="rbac-table">
        <thead><tr><th>{{ t("access.menus.table.title") }}</th><th>{{ t("access.menus.table.type") }}</th><th>{{ t("access.menus.table.pathApp") }}</th><th>{{ t("access.menus.table.permission") }}</th><th>{{ t("access.menus.table.sort") }}</th><th>{{ t("access.menus.table.status") }}</th><th>{{ t("access.menus.table.actions") }}</th></tr></thead>
        <tbody>
          <tr
            v-for="row in menuRows"
            :key="row.item.id"
            :class="[{ 'menu-row--muted': !row.item.isVisible }, { 'menu-row--warning': row.orphaned || row.cyclic }]"
          >
            <td>
              <div class="menu-title"><span class="menu-title__indent" :style="{ width: `${row.depth * 18}px` }"></span><span class="rbac-table__primary">{{ localizedMenuTitle(row.item) }}</span></div>
              <span class="rbac-table__secondary">{{ row.item.code }}<template v-if="row.orphaned"> · {{ t("access.menus.table.orphaned") }}</template><template v-else-if="row.cyclic"> · {{ t("access.menus.table.cyclic") }}</template></span>
            </td>
            <td><span class="rbac-tag rbac-tag--neutral">{{ t(`access.menus.types.${row.item.type}`) }}</span></td>
            <td><span class="rbac-table__mono">{{ row.item.path || "-" }}</span><span class="rbac-table__secondary">{{ row.item.app || "shell" }}</span></td>
            <td><span class="rbac-table__mono">{{ row.item.permissionCode || t("access.common.public") }}</span></td>
            <td>{{ row.item.sort }}</td>
            <td><span class="rbac-tag" :class="row.item.isVisible ? 'rbac-tag--success' : 'rbac-tag--neutral'">{{ row.item.isVisible ? t("access.common.visible") : t("access.common.hidden") }}</span></td>
            <td><div v-if="canWrite" class="rbac-table__actions"><button class="rbac-button rbac-button--quiet" type="button" @click="openEdit(row.item)">{{ t("access.common.edit") }}</button><button class="rbac-button rbac-button--quiet rbac-button--danger" type="button" :disabled="isProtectedAccessMenu(row.item)" :title="isProtectedAccessMenu(row.item) ? t('access.menus.table.protectedDeleteTitle') : ''" @click="removeMenu(row.item)">{{ t("access.common.delete") }}</button></div><span v-else class="rbac-table__secondary">{{ t("access.common.readOnly") }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </article>

  <div v-if="dialogOpen" class="rbac-modal-overlay" @click.self="!saving && (dialogOpen = false)">
    <section class="rbac-modal rbac-modal--wide" role="dialog" aria-modal="true" aria-labelledby="menu-dialog-title">
      <header class="rbac-modal__header">
        <div><h3 id="menu-dialog-title">{{ t(editingMenu ? "access.menus.dialog.editTitle" : "access.menus.dialog.createTitle") }}</h3><p>{{ t("access.menus.dialog.subtitle") }}</p></div>
        <button class="rbac-modal__close" type="button" :aria-label="t('access.common.close')" :disabled="saving" @click="dialogOpen = false">×</button>
      </header>
      <div class="rbac-form-grid">
        <label class="rbac-field"><span>{{ t("access.menus.dialog.title") }}</span><input v-model="menuForm.title" class="rbac-input" maxlength="128" /></label>
        <label class="rbac-field"><span>{{ t("access.menus.dialog.code") }}</span><input v-model="menuForm.code" class="rbac-input" maxlength="64" :disabled="editingProtectedAccessMenu" /></label>
        <label class="rbac-field rbac-field--full"><span>{{ t("access.menus.dialog.titleKey") }}</span><input v-model="menuForm.titleKey" class="rbac-input" maxlength="128" placeholder="menu.access" /></label>
        <label class="rbac-field"><span>{{ t("access.menus.dialog.type") }}</span><select v-model="menuForm.type" class="rbac-select" :disabled="editingProtectedAccessMenu"><option value="group">{{ t("access.menus.types.group") }}</option><option value="menu">{{ t("access.menus.types.menu") }}</option><option value="button">{{ t("access.menus.types.button") }}</option></select></label>
        <label class="rbac-field"><span>{{ t("access.menus.dialog.parent") }}</span><select v-model.number="menuForm.parentId" class="rbac-select" :disabled="editingProtectedAccessMenu"><option :value="0">{{ t("access.common.root") }}</option><option v-for="row in parentOptions" :key="row.item.id" :value="row.item.id">{{ "　".repeat(row.depth) }}{{ localizedMenuTitle(row.item) }}</option></select></label>
        <label class="rbac-field"><span>{{ t("access.menus.dialog.path") }}</span><input v-model="menuForm.path" class="rbac-input" placeholder="/account/access" maxlength="255" :disabled="editingProtectedAccessMenu" /></label>
        <label class="rbac-field"><span>{{ t("access.menus.dialog.app") }}</span><select v-model="menuForm.app" class="rbac-select" :disabled="editingProtectedAccessMenu"><option value="shell">shell</option><option value="auth">auth</option><option value="core">core</option><option value="executor">executor</option><option value="deliverables">deliverables</option></select></label>
        <label class="rbac-field"><span>{{ t("access.menus.dialog.permission") }}</span><select v-model="selectedPermissionCodes" class="rbac-select rbac-select--multiple" multiple size="6" :disabled="editingProtectedAccessMenu"><option v-for="permission in permissions" :key="permission.id" :value="permission.code">{{ permission.code }} - {{ localizedPermissionName(permission) }}</option></select><small>{{ t(editingProtectedAccessMenu ? "access.menus.dialog.protectedPermissionHelp" : "access.menus.dialog.permissionHelp") }}</small></label>
        <label class="rbac-field"><span>{{ t("access.menus.dialog.sort") }}</span><input v-model.number="menuForm.sort" class="rbac-input" type="number" min="0" max="100000" /></label>
        <label class="rbac-field rbac-field--full"><span>{{ t("access.menus.dialog.icon") }}</span><input v-model="menuForm.icon" class="rbac-input" maxlength="512" /><small>{{ t("access.menus.dialog.iconHelp") }}</small></label>
        <label class="rbac-checkline rbac-field--full"><input v-model="menuForm.isVisible" type="checkbox" :disabled="editingProtectedAccessMenu" />{{ t("access.menus.dialog.visible") }}</label>
      </div>
      <footer class="rbac-modal__actions">
        <button class="rbac-button" type="button" :disabled="saving" @click="dialogOpen = false">{{ t("access.common.cancel") }}</button>
        <button class="rbac-button rbac-button--primary" type="button" :disabled="saving" @click="saveMenu">{{ saving ? t("access.common.saving") : t("access.menus.dialog.save") }}</button>
      </footer>
    </section>
  </div>
</template>
