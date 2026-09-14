import axios from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { getAccessToken, clearTokens } from "@/utils/token";
import type { ApiEnvelope } from "./types";
import { shouldHandleUnauthorized } from "./authFailurePolicy";
import { createRequestId } from "./requestIdPolicy";
import { emitSessionChange } from "@/addons/auth-account/composables/sessionEvents";
import { notifyAuthRequired } from "@/addons/auth-account/composables/authRequiredNotifier";

/**
 * Shared axios instance.
 *
 * - baseURL is empty: requests use relative `/api/...` URLs which the Vite dev
 *   server proxies to the prism-fusion backend on :26670. In production the
 *   reverse proxy handles the same path.
 * - The request interceptor attaches the JWT from localStorage.
 * - The response interceptor unwraps the unified `{ code, message, data }`
 *   envelope: code === 0 means success and we resolve with `data`; any other
 *   code is rejected with an `ApiError`. HTTP 401 clears tokens and bounces
 *   the user back to /login.
 */
const http = axios.create({
  baseURL: "",
  timeout: 15000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "X-Refresh-Cookie-Only": "1",
  },
});

/** Error thrown when the envelope reports a business failure (code !== 0). */
export class ApiError extends Error {
  code: number;
  status: number;

  constructor(message: string, code: number, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function isEmbeddedRuntime(): boolean {
  const w = globalThis as Record<string, unknown>;
  return w.__MICRO_APP_ENVIRONMENT__ === true ||
    (typeof window !== "undefined" && window.parent !== window);
}

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!config.headers.has("X-Request-ID")) {
    config.headers.set("X-Request-ID", createRequestId(() => globalThis.crypto.randomUUID()));
  }
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function redirectToLogin(reason: "missing" | "rejected"): void {
  clearTokens();
  // 在 micro-app 子应用模式下，不做 window.location 硬跳转（会劫持整个壳的 URL）。
  // 只清 token，让壳应用自行决定何时切到登录页。
  if (isEmbeddedRuntime()) {
    emitSessionChange(false);
    const version = Number(localStorage.getItem("nucleagent_session_version") ?? "0");
    notifyAuthRequired({
      source: "sub",
      type: "auth-required",
      reason,
      sessionVersion: Number.isSafeInteger(version) && version >= 0 ? version : 0,
    });
    return;
  }
  // 独立运行时也不直接刷新/登录：cookie 不按端口隔离，跨 origin 无法共享
  // Web Lock。统一回到 shell，确保只有一个认证 mutation authority。
  if (typeof window !== "undefined") {
    window.location.replace(new URL(
      "/account",
      import.meta.env.VITE_SHELL_URL ?? "http://localhost:26600",
    ).toString());
  }
}

http.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope<unknown>>) => {
    const envelope = response.data;
    // Some endpoints (e.g. raw passthrough) may not follow the envelope;
    // treat a missing `code` as a pass-through success.
    if (envelope === null || typeof envelope !== "object" || !("code" in envelope)) {
      return response;
    }

    if (envelope.code === 0) {
      // Resolve with the unwrapped payload so callers deal with `data` directly.
      return { ...response, data: envelope.data };
    }

    // Business failure: reject so callers can `.catch()` it.
    throw new ApiError(
      envelope.message || "Request failed",
      envelope.code,
      response.status,
    );
  },
  async (error: unknown) => {
    // Network or HTTP-level error.
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0;
      const requestAuthorization = error.config?.headers?.get("Authorization");
      if (
        status === 401 &&
        shouldHandleUnauthorized(getAccessToken(), requestAuthorization)
      ) {
        const reason = typeof requestAuthorization === "string" ? "rejected" : "missing";
        redirectToLogin(reason);
      }
      const envelope = error.response?.data as (ApiEnvelope<unknown> & {
        detail?: string;
        title?: string;
      }) | undefined;
      const message =
        envelope?.message || envelope?.detail || envelope?.title || error.message || "Network error";
      return Promise.reject(new ApiError(message, envelope?.code ?? -1, status));
    }
    return Promise.reject(error);
  },
);

export default http;
