import axios from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { captureSession, clearTokens, isCurrentSession, SessionCancelledError } from "@/utils/token";
import type { SessionSnapshot } from "@/utils/token";
import type { ApiEnvelope } from "./types";
import { createRequestId } from "./requestIdPolicy";
import { notifyAuthRequired } from "@/addons/auth-account/composables/authRequiredNotifier";
import { outerAware } from "@/outerHost";

/**
 * Shared axios instance.
 *
 * - baseURL is empty: requests use relative `/api/...` URLs which the Vite dev
 *   server proxies to the prism-fusion backend on :26670. In production the
 *   reverse proxy handles the same path.
 * - Protected requests require the current trusted in-memory shell session.
 * - The response interceptor unwraps the unified `{ code, message, data }`
 *   envelope: code === 0 means success and we resolve with `data`; any other
 *   code is rejected with an `ApiError`. Only a current request's 401 may
 *   invalidate the session and notify the shell.
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

const owners = new WeakMap<InternalAxiosRequestConfig, SessionSnapshot>();
function assertRequestCurrent(config: InternalAxiosRequestConfig): void {
  const owner = owners.get(config);
  if (config.signal?.aborted || (owner && !isCurrentSession(owner))) {
    throw new SessionCancelledError();
  }
}

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const publicRegistration = config.method === "post" && config.url === "/api/v1/addons/auth/register";
  const owner = captureSession();
  if (!publicRegistration) {
    if (!isCurrentSession(owner)) throw new SessionCancelledError();
    owners.set(config, owner);
    config.signal = config.signal
      ? AbortSignal.any([owner.signal, config.signal as AbortSignal])
      : owner.signal;
    config.headers.set("Authorization", owner.token);
  } else {
    config.headers.delete("Authorization");
  }
  if (!config.headers.has("X-Request-ID")) {
    config.headers.set("X-Request-ID", createRequestId(() => globalThis.crypto.randomUUID()));
  }
  return config;
}, (error) => { throw error; }, { synchronous: true });

function redirectToLogin(reason: "missing" | "rejected"): void {
  const version = captureSession().version;
  clearTokens();
  // 在 micro-app 子应用模式下，不做 window.location 硬跳转（会劫持整个壳的 URL）。
  // 只清 token，让壳应用自行决定何时切到登录页。
  if (isEmbeddedRuntime()) {
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
      outerAware(import.meta.env.VITE_SHELL_URL ?? "http://localhost:26600"),
    ).toString());
  }
}

http.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope<unknown>>) => {
    assertRequestCurrent(response.config);
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
      if (error.config) assertRequestCurrent(error.config);
      if (axios.isCancel(error)) throw new SessionCancelledError();
      const status = error.response?.status ?? 0;
      if (
        status === 401 &&
        error.config && owners.has(error.config)
      ) {
        redirectToLogin("rejected");
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
