<script setup lang="ts">
/**
 * 注册页 —— 独立运行模式入口。已移除 Element Plus，改原生表单 + useToast。
 * 校验沿用原 EP 规则（三字段 required）。
 */
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { register } from "@/addons/auth-account/api/auth";
import { toast } from "@/composables/useToast";

const { t } = useI18n();
const router = useRouter();

const loading = ref(false);
const errorMsg = ref("");
const form = reactive({ username: "", password: "", nickName: "" });

async function handleSubmit(): Promise<void> {
  if (loading.value) return;
  if (!form.username.trim() || !form.password || !form.nickName.trim()) {
    errorMsg.value = t("register.enterUsername");
    return;
  }
  loading.value = true;
  errorMsg.value = "";
  try {
    await register({
      username: form.username.trim(),
      password: form.password,
      nickName: form.nickName.trim(),
    });
    toast.success(t("register.success"));
    router.push("/login");
  } catch (error) {
    errorMsg.value = error instanceof Error ? error.message : t("register.failed");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1 class="auth-card__title">{{ t("register.title") }}</h1>
      <p class="auth-card__subtitle">{{ t("register.subtitle") }}</p>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <label class="auth-field">
          <span class="auth-field__label">{{ t("common.nickname") }}</span>
          <input v-model="form.nickName" type="text" class="auth-field__input" :placeholder="t('register.nicknamePlaceholder')" />
        </label>
        <label class="auth-field">
          <span class="auth-field__label">{{ t("common.username") }}</span>
          <input v-model="form.username" type="text" class="auth-field__input" :placeholder="t('register.usernamePlaceholder')" autocomplete="username" />
        </label>
        <label class="auth-field">
          <span class="auth-field__label">{{ t("common.password") }}</span>
          <input v-model="form.password" type="password" class="auth-field__input" :placeholder="t('register.passwordPlaceholder')" autocomplete="new-password" @keyup.enter="handleSubmit" />
        </label>

        <p v-if="errorMsg" class="auth-error">{{ errorMsg }}</p>

        <button type="submit" class="auth-card__submit" :disabled="loading">
          {{ loading ? t("common.sending") : t("register.submit") }}
        </button>
      </form>

      <p class="auth-card__footer">
        {{ t("register.hasAccount") }}
        <router-link to="/login">{{ t("register.loginLink") }}</router-link>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-form { display: flex; flex-direction: column; gap: 14px; }
.auth-field { display: flex; flex-direction: column; gap: 6px; }
.auth-field__label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.auth-field__input {
  width: 100%; padding: 10px 14px;
  border: 1.5px solid var(--border); border-radius: var(--r-md);
  font-size: 14px; color: var(--text-primary); background: var(--bg-card);
  outline: none; transition: all 0.2s var(--ease);
}
.auth-field__input:focus { border-color: var(--teal-400); box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.08); }
.auth-error { color: var(--rose-500); font-size: 12.5px; margin: 0; }
.auth-card__submit {
  margin-top: 4px; padding: 12px; border: none; border-radius: var(--r-md);
  background: var(--grad-teal-indigo); background-size: 200% 200%;
  animation: gradient-flow 5s var(--ease) infinite;
  color: white; font-weight: 600; cursor: pointer;
  box-shadow: var(--shadow-glow-teal); transition: all 0.2s var(--ease);
}
.auth-card__submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--shadow-glow-indigo); }
.auth-card__submit:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
