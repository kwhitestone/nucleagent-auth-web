<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  listRoles,
  listUsers,
  setUserRoles,
  type RbacUser,
  type Role,
} from "@/addons/access-control/api/rbac";
import { toggleNumericSelection } from "@/addons/access-control/composables/authorizationPolicy";
import { accessCatalogKey, accessErrorKey } from "@/addons/access-control/composables/accessI18n";
import { toast } from "@/composables/useToast";

const props = defineProps<{ canWrite: boolean }>();
const { t, te } = useI18n();

const PAGE_SIZE = 20;

const users = ref<RbacUser[]>([]);
const roles = ref<Role[]>([]);
const page = ref(1);
const total = ref(0);
const keyword = ref("");
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref("");
const editingUser = ref<RbacUser | null>(null);
const selectedRoleIds = ref<number[]>([]);
let loadVersion = 0;

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

function roleLabel(roleId: number): string {
  const role = roles.value.find((item) => item.roleId === roleId);
  return role ? localizedRoleName(role) : `#${roleId}`;
}

function localizedRoleName(role: Role): string {
  const key = accessCatalogKey("roleNames", role.code);
  return te(key) ? t(key) : role.name || role.code;
}

async function load(): Promise<void> {
  const currentVersion = ++loadVersion;
  loading.value = true;
  errorMessage.value = "";
  try {
    const [userPage, roleList] = await Promise.all([
      listUsers({ page: page.value, pageSize: PAGE_SIZE, search: keyword.value.trim() || undefined }),
      listRoles(),
    ]);
    if (currentVersion !== loadVersion) return;
    users.value = [...userPage.items];
    roles.value = [...roleList];
    total.value = userPage.total;
    page.value = userPage.page;
  } catch (error) {
    if (currentVersion !== loadVersion) return;
    errorMessage.value = accessErrorKey(error, "access.users.loadFailedFallback");
  } finally {
    if (currentVersion === loadVersion) loading.value = false;
  }
}

function search(): void {
  page.value = 1;
  void load();
}

function changePage(nextPage: number): void {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) return;
  page.value = nextPage;
  void load();
}

function openAssignment(user: RbacUser): void {
  if (!props.canWrite) return;
  editingUser.value = { ...user, roleIds: [...user.roleIds], roleCodes: [...user.roleCodes] };
  selectedRoleIds.value = [...user.roleIds];
}

function closeAssignment(): void {
  if (saving.value) return;
  editingUser.value = null;
  selectedRoleIds.value = [];
}

function toggleRole(roleId: number, event: Event): void {
  selectedRoleIds.value = toggleNumericSelection(
    selectedRoleIds.value,
    roleId,
    (event.target as HTMLInputElement).checked,
  );
}

async function saveAssignment(): Promise<void> {
  if (!editingUser.value || !props.canWrite) return;
  if (selectedRoleIds.value.length === 0) {
    toast.warning(t("access.users.validation.minimumRole"));
    return;
  }
  saving.value = true;
  try {
    await setUserRoles(editingUser.value.id, selectedRoleIds.value);
    toast.success(t("access.users.success.updated"));
    editingUser.value = null;
    selectedRoleIds.value = [];
    await load();
  } catch (error) {
    toast.error(t(accessErrorKey(error, "access.users.errors.assignmentFailed")));
  } finally {
    saving.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <article class="rbac-panel">
    <header class="rbac-panel__header">
      <div>
        <h2>{{ t("access.users.title") }}</h2>
        <p>{{ t("access.users.description") }}</p>
      </div>
      <span class="rbac-tag rbac-tag--neutral">{{ t("access.users.total", { count: total }) }}</span>
    </header>

    <form class="rbac-toolbar" @submit.prevent="search">
      <div class="rbac-toolbar__group">
        <input v-model="keyword" class="rbac-input" type="search" :placeholder="t('access.users.searchPlaceholder')" :aria-label="t('access.users.searchLabel')" />
        <button class="rbac-button" type="submit">{{ t("access.users.search") }}</button>
      </div>
      <button class="rbac-button" type="button" :disabled="loading" @click="load">{{ t("access.common.refresh") }}</button>
    </form>

    <div v-if="loading" class="rbac-state" aria-live="polite">
      <span class="rbac-skeleton"></span><span class="rbac-skeleton"></span><span class="rbac-skeleton"></span>
    </div>
    <div v-else-if="errorMessage" class="rbac-state" role="alert">
      <strong>{{ t("access.users.loadFailedTitle") }}</strong>
      <p>{{ t(errorMessage) }}</p>
      <button class="rbac-button" type="button" @click="load">{{ t("access.common.retry") }}</button>
    </div>
    <div v-else-if="!users.length" class="rbac-state">
      <strong>{{ t("access.users.emptyTitle") }}</strong>
      <p>{{ t("access.users.emptyDescription") }}</p>
    </div>
    <template v-else>
      <div class="rbac-table-wrap">
        <table class="rbac-table">
          <thead><tr><th>{{ t("access.users.table.user") }}</th><th>{{ t("access.users.table.status") }}</th><th>{{ t("access.users.table.roles") }}</th><th>{{ t("access.users.table.actions") }}</th></tr></thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>
                <span class="rbac-table__primary">{{ user.nickName || user.username }}</span>
                <span class="rbac-table__secondary">@{{ user.username }}<template v-if="user.email"> · {{ user.email }}</template></span>
              </td>
              <td><span class="rbac-tag" :class="user.enable === 1 ? 'rbac-tag--success' : 'rbac-tag--neutral'">{{ user.enable === 1 ? t("access.common.enabled") : t("access.common.disabled") }}</span></td>
              <td>
                <div v-if="user.roleIds.length" class="rbac-tag-list">
                  <span v-for="roleId in user.roleIds" :key="roleId" class="rbac-tag">{{ roleLabel(roleId) }}</span>
                </div>
                <span v-else class="rbac-table__secondary">{{ t("access.common.unassigned") }}</span>
              </td>
              <td><button v-if="canWrite" class="rbac-button rbac-button--quiet" type="button" @click="openAssignment(user)">{{ t("access.users.assignment.action") }}</button><span v-else class="rbac-table__secondary">{{ t("access.common.readOnly") }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer class="rbac-pagination">
        <span>{{ t("access.pagination.label", { page, total: totalPages }) }}</span>
        <button class="rbac-button" type="button" :disabled="page <= 1" @click="changePage(page - 1)">{{ t("access.common.previous") }}</button>
        <button class="rbac-button" type="button" :disabled="page >= totalPages" @click="changePage(page + 1)">{{ t("access.common.next") }}</button>
      </footer>
    </template>
  </article>

  <div v-if="editingUser" class="rbac-modal-overlay" @click.self="closeAssignment">
    <section class="rbac-modal" role="dialog" aria-modal="true" aria-labelledby="assign-role-title">
      <header class="rbac-modal__header">
        <div><h3 id="assign-role-title">{{ t("access.users.assignment.title") }}</h3><p>{{ editingUser.nickName || editingUser.username }} (@{{ editingUser.username }})</p></div>
        <button class="rbac-modal__close" type="button" :aria-label="t('access.common.close')" @click="closeAssignment">×</button>
      </header>
      <div class="rbac-choice-list">
        <label v-for="role in roles" :key="role.roleId" class="rbac-choice">
          <input
            type="checkbox"
            :checked="selectedRoleIds.includes(role.roleId)"
            :disabled="!role.isEnabled && !selectedRoleIds.includes(role.roleId)"
            @change="toggleRole(role.roleId, $event)"
          />
          <span><strong>{{ localizedRoleName(role) }}</strong><small>{{ role.code }} / ID {{ role.roleId }}</small></span>
        </label>
      </div>
      <p v-if="selectedRoleIds.length === 0" class="rbac-inline-warning">{{ t("access.users.assignment.minimum") }}</p>
      <footer class="rbac-modal__actions">
        <button class="rbac-button" type="button" :disabled="saving" @click="closeAssignment">{{ t("access.common.cancel") }}</button>
        <button class="rbac-button rbac-button--primary" type="button" :disabled="saving || selectedRoleIds.length === 0" @click="saveAssignment">{{ saving ? t("access.common.saving") : t("access.users.assignment.save") }}</button>
      </footer>
    </section>
  </div>
</template>
