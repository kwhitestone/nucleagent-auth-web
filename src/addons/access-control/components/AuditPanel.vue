<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { listAuditLogs, type AuditLog } from "@/addons/access-control/api/rbac";
import { accessErrorKey, auditActionKey } from "@/addons/access-control/composables/accessI18n";
import { useSessionRequests } from "@/composables/useSessionRequests";

const PAGE_SIZE = 30;
const { locale, t } = useI18n();

const logs = ref<AuditLog[]>([]);
const page = ref(1);
const total = ref(0);
const loading = ref(true);
const errorMessage = ref("");
const run = useSessionRequests(() => {
  logs.value = [];
  page.value = 1;
  total.value = 0;
  loading.value = false;
  errorMessage.value = "";
});

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale.value === "zh" ? "zh-CN" : "en-US");
}

function formatAction(action: string): string {
  const key = auditActionKey(action);
  return key ? t(key) : action;
}

function formatDetail(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function load(): Promise<void> {
  await run("load", (signal) => listAuditLogs({ page: page.value, pageSize: PAGE_SIZE }, signal), {
    start: () => { loading.value = true; errorMessage.value = ""; },
    success: (result) => {
      logs.value = [...result.items];
      total.value = result.total;
      page.value = result.page;
    },
    error: (error) => { errorMessage.value = accessErrorKey(error, "access.audit.loadFailedFallback"); },
    finish: () => { loading.value = false; },
  });
}

function changePage(nextPage: number): void {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) return;
  page.value = nextPage;
  void load();
}

onMounted(() => void load());
</script>

<template>
  <article class="rbac-panel">
    <header class="rbac-panel__header">
      <div><h2>{{ t("access.audit.title") }}</h2><p>{{ t("access.audit.description") }}</p></div>
      <div class="rbac-toolbar__group"><span class="rbac-tag rbac-tag--neutral">{{ t("access.audit.total", { count: total }) }}</span><button class="rbac-button" type="button" :disabled="loading" @click="load">{{ t("access.common.refresh") }}</button></div>
    </header>

    <div v-if="loading" class="rbac-state" aria-live="polite">
      <span class="rbac-skeleton"></span><span class="rbac-skeleton"></span><span class="rbac-skeleton"></span>
    </div>
    <div v-else-if="errorMessage" class="rbac-state" role="alert">
      <strong>{{ t("access.audit.loadFailedTitle") }}</strong><p>{{ t(errorMessage) }}</p>
      <button class="rbac-button" type="button" @click="load">{{ t("access.common.retry") }}</button>
    </div>
    <div v-else-if="!logs.length" class="rbac-state"><strong>{{ t("access.audit.emptyTitle") }}</strong><p>{{ t("access.audit.emptyDescription") }}</p></div>
    <template v-else>
      <div class="rbac-table-wrap">
        <table class="rbac-table">
          <thead><tr><th>{{ t("access.audit.table.time") }}</th><th>{{ t("access.audit.table.actor") }}</th><th>{{ t("access.audit.table.action") }}</th><th>{{ t("access.audit.table.target") }}</th><th>{{ t("access.audit.table.requestId") }}</th><th>{{ t("access.audit.table.detail") }}</th></tr></thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id">
              <td class="rbac-table__mono">{{ formatTime(log.createdAt) }}</td>
              <td><span class="rbac-table__primary">{{ t("access.audit.actor", { id: log.actorId ?? "-" }) }}</span></td>
              <td><span class="rbac-tag">{{ formatAction(log.action) }}</span></td>
              <td class="rbac-table__mono">{{ log.target }}</td>
              <td class="rbac-table__mono">{{ log.requestId || "-" }}</td>
              <td><div class="audit-detail" :title="formatDetail(log.detail)">{{ formatDetail(log.detail) }}</div></td>
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
</template>
