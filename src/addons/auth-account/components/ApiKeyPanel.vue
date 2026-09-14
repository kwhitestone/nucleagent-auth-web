<script setup lang="ts">
/**
 * API Key 面板 —— 已移除 Element Plus。
 *
 * el-table  → 原生 table（功能等价，样式用 Aurora token）
 * el-dialog → 原生 modal（绝对定位 + 遮罩）
 * ElMessage → useToast
 * ElMessageBox.confirm → 原生 window.confirm
 * 校验：name 必填，提交时检查。
 */
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { createApiKey, deleteApiKey, listApiKeys } from "@/addons/auth-account/api/auth";
import type { ApiKey, ApiKeyWithSecret } from "@/addons/auth-account/api/types";
import { toast } from "@/composables/useToast";
import { SESSION_CHANGE_EVENT } from "@/addons/auth-account/composables/sessionEvents";

const { t } = useI18n();

const keys = ref<ApiKey[]>([]);
const loading = ref(false);
const createLoading = ref(false);

const createDialogVisible = ref(false);
const createForm = ref({ name: "" });

const plaintextDialogVisible = ref(false);
const createdKey = ref<ApiKeyWithSecret | null>(null);

async function loadKeys(): Promise<void> {
  loading.value = true;
  try {
    keys.value = await listApiKeys();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t("common.networkError"));
  } finally {
    loading.value = false;
  }
}

function openCreateDialog(): void {
  createForm.value = { name: "" };
  createDialogVisible.value = true;
}

async function handleCreate(): Promise<void> {
  if (!createForm.value.name.trim()) {
    toast.warning(t("apiKey.createPlaceholder"));
    return;
  }
  createLoading.value = true;
  try {
    const created = await createApiKey({ name: createForm.value.name.trim() });
    createdKey.value = created;
    createDialogVisible.value = false;
    plaintextDialogVisible.value = true;
    toast.success(t("apiKey.createSuccess"));
    await loadKeys();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t("apiKey.createFailed"));
  } finally {
    createLoading.value = false;
  }
}

async function handleDelete(key: ApiKey): Promise<void> {
  // EP 的 ElMessageBox.confirm 体验更好，但为移除 EP 改用原生 confirm。
  if (!window.confirm(t("apiKey.deleteConfirm"))) return;
  try {
    await deleteApiKey(key.id);
    toast.success(t("apiKey.deleteSuccess"));
    await loadKeys();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t("apiKey.deleteFailed"));
  }
}

async function copyPlaintext(): Promise<void> {
  if (!createdKey.value) return;
  try {
    await navigator.clipboard.writeText(createdKey.value.plaintext);
    toast.success(t("common.copied"));
  } catch {
    toast.warning(t("common.copy"));
  }
}

function onSessionChange(event: Event): void {
  const authenticated = (event as CustomEvent<{ authenticated?: unknown }>).detail
    ?.authenticated === true;
  createdKey.value = null;
  plaintextDialogVisible.value = false;
  createDialogVisible.value = false;
  keys.value = [];
  if (authenticated) void loadKeys();
}

onMounted(() => {
  window.addEventListener(SESSION_CHANGE_EVENT, onSessionChange);
  void loadKeys();
});
onBeforeUnmount(() => {
  window.removeEventListener(SESSION_CHANGE_EVENT, onSessionChange);
  createdKey.value = null;
});
</script>

<template>
  <div class="api-key-panel">
    <div class="api-key-panel__header">
      <h2 class="api-key-panel__title">{{ t("home.apiKeysTitle") }}</h2>
      <button class="na-btn na-btn--primary" type="button" @click="openCreateDialog">
        {{ t("apiKey.create") }}
      </button>
    </div>

    <table class="key-table">
      <thead>
        <tr>
          <th>{{ t("apiKey.name") }}</th>
          <th>{{ t("apiKey.prefix") }}</th>
          <th>{{ t("apiKey.enabled") }}</th>
          <th>{{ t("apiKey.createdAt") }}</th>
          <th>{{ t("apiKey.actions") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading"><td colspan="5" class="key-empty">{{ t("common.loading") }}</td></tr>
        <tr v-else-if="!keys.length"><td colspan="5" class="key-empty">{{ t("apiKey.empty") }}</td></tr>
        <tr v-for="k in keys" :key="k.id">
          <td>{{ k.name }}</td>
          <td class="key-mono">{{ k.prefix }}</td>
          <td>
            <span class="key-tag" :class="k.enable ? 'key-tag--on' : 'key-tag--off'">
              {{ k.enable ? t("apiKey.enabledText") : t("apiKey.disabledText") }}
            </span>
          </td>
          <td class="key-mono">{{ k.createdAt }}</td>
          <td>
            <button class="na-btn na-btn--danger" type="button" @click="handleDelete(k)">
              {{ t("common.delete") }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 创建对话框（原生 modal） -->
    <div v-if="createDialogVisible" class="na-modal-overlay" @click.self="createDialogVisible = false">
      <div class="na-modal">
        <h3 class="na-modal__title">{{ t("apiKey.create") }}</h3>
        <label class="na-field">
          <span class="na-field__label">{{ t("apiKey.name") }}</span>
          <input v-model="createForm.name" type="text" class="na-field__input" :placeholder="t('apiKey.createPlaceholder')" @keyup.enter="handleCreate" />
        </label>
        <div class="na-modal__actions">
          <button class="na-btn" type="button" @click="createDialogVisible = false">{{ t("common.cancel") }}</button>
          <button class="na-btn na-btn--primary" type="button" :disabled="createLoading" @click="handleCreate">{{ t("common.confirm") }}</button>
        </div>
      </div>
    </div>

    <!-- 明文展示对话框（仅创建后一次） -->
    <div v-if="plaintextDialogVisible" class="na-modal-overlay">
      <div class="na-modal">
        <h3 class="na-modal__title">{{ t("apiKey.plaintextTitle") }}</h3>
        <p class="na-alert">{{ t("apiKey.plaintextTip") }}</p>
        <div class="api-key-panel__plaintext">
          <code>{{ createdKey?.plaintext }}</code>
          <button class="na-btn na-btn--link" type="button" @click="copyPlaintext">{{ t("common.copy") }}</button>
        </div>
        <div class="na-modal__actions">
          <button class="na-btn na-btn--primary" type="button" @click="plaintextDialogVisible = false">{{ t("common.close") }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.api-key-panel { width: 100%; }

.api-key-panel__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.api-key-panel__title { margin: 0; font-size: 18px; font-weight: 600; color: var(--text-primary); }

.key-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.key-table th {
  text-align: left; padding: 10px 12px; font-weight: 600;
  color: var(--text-secondary); border-bottom: 1px solid var(--border);
  background: var(--bg-subtle);
}
.key-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); color: var(--text-primary); }
.key-table tr:hover td { background: var(--bg-hover); }
.key-mono { font-family: var(--font-mono); font-size: 12px; }
.key-empty { text-align: center; color: var(--text-tertiary); padding: 24px; }

.key-tag {
  padding: 2px 8px; border-radius: var(--r-full); font-size: 11px; font-weight: 600;
}
.key-tag--on { background: rgba(16, 185, 129, 0.15); color: var(--emerald-500); }
.key-tag--off { background: var(--bg-subtle); color: var(--text-tertiary); }

.api-key-panel__plaintext {
  display: flex; align-items: center; gap: 12px;
  margin-top: 16px; padding: 12px;
  background: var(--bg-subtle); border-radius: var(--r-md);
  word-break: break-all;
}
.api-key-panel__plaintext code { flex: 1; font-size: 13px; color: var(--text-primary); font-family: var(--font-mono); }

/* 原生按钮 / modal / field 复用样式 */
.na-btn {
  padding: 8px 16px; border-radius: var(--r-md);
  border: 1px solid var(--border); background: var(--bg-card);
  color: var(--text-primary); font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.2s var(--ease);
}
.na-btn:hover { background: var(--bg-hover); transform: translateY(-1px); }
.na-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.na-btn--primary {
  background: var(--grad-teal-indigo); background-size: 200% 200%;
  animation: gradient-flow 5s var(--ease) infinite;
  border-color: transparent; color: white; box-shadow: var(--shadow-glow-teal);
}
.na-btn--danger { border-color: var(--rose-400); color: var(--rose-500); background: transparent; }
.na-btn--link { border: none; background: transparent; color: var(--indigo-500); }

.na-modal-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.na-modal {
  width: 420px; max-width: calc(100vw - 32px);
  background: var(--bg-card); border-radius: var(--r-xl);
  box-shadow: var(--shadow-xl); padding: 24px;
}
.na-modal__title { margin: 0 0 16px; font-size: 18px; font-weight: 600; color: var(--text-primary); }
.na-modal__actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }

.na-field { display: flex; flex-direction: column; gap: 6px; }
.na-field__label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.na-field__input {
  width: 100%; padding: 10px 14px; border: 1.5px solid var(--border); border-radius: var(--r-md);
  font-size: 14px; color: var(--text-primary); background: var(--bg-card);
  outline: none; transition: all 0.2s var(--ease);
}
.na-field__input:focus { border-color: var(--teal-400); box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.08); }

.na-alert {
  margin: 0; padding: 10px 14px; border-radius: var(--r-md);
  background: rgba(245, 158, 11, 0.1); color: var(--amber-600);
  font-size: 12.5px;
}
</style>
