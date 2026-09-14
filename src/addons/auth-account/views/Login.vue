<script setup lang="ts">
/**
 * 兼容登录页。认证 mutation 统一由 shell 执行；本页不会直接提交凭据。
 */
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "@/composables/useToast";
import { requestShellLogin } from "@/addons/auth-account/composables/useShellBridge";

const { t } = useI18n();
const loading = ref(false);
const errorMsg = ref("");
const form = reactive({ username: "", password: "" });

async function handleSubmit(): Promise<void> {
  if (loading.value) return;
  if (!form.username.trim() || !form.password) {
    errorMsg.value = t("login.enterUsername");
    return;
  }
  loading.value = true;
  errorMsg.value = "";
  try {
    if (!requestShellLogin()) {
      window.location.replace(new URL(
        "/account",
        import.meta.env.VITE_SHELL_URL ?? "http://localhost:26600",
      ).toString());
    }
    toast.info("请在主应用登录窗口中完成认证");
  } catch (error) {
    errorMsg.value = error instanceof Error ? error.message : t("login.failed");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1 class="auth-card__title">{{ t("login.title") }}</h1>
      <p class="auth-card__subtitle">{{ t("login.subtitle") }}</p>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <label class="auth-field">
          <span class="auth-field__label">{{ t("common.username") }}</span>
          <input
            v-model="form.username"
            type="text"
            class="auth-field__input"
            :placeholder="t('login.usernamePlaceholder')"
            autocomplete="username"
          />
        </label>
        <label class="auth-field">
          <span class="auth-field__label">{{ t("common.password") }}</span>
          <input
            v-model="form.password"
            type="password"
            class="auth-field__input"
            :placeholder="t('login.passwordPlaceholder')"
            autocomplete="current-password"
            @keyup.enter="handleSubmit"
          />
        </label>

        <p v-if="errorMsg" class="auth-error">{{ errorMsg }}</p>

        <button type="submit" class="auth-card__submit" :disabled="loading">
          {{ loading ? t("common.sending") : t("login.title") }}
        </button>
      </form>

      <p class="auth-card__footer">
        {{ t("register.hasAccount") }}
        <router-link to="/register">{{ t("register.loginLink") }}</router-link>
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
