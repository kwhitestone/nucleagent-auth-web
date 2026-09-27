/**
 * 子应用 ↔ 主壳 的 postMessage 通道桥接（iframe 方案，auth/executor 简化版）。
 *
 * 仅同步登录态：iframe 跨域 localStorage 不共享，壳登录后把 token 推过来，
 * 仅在已验证通道收到 auth 后使用内存会话。
 *
 * 仅在被 iframe 嵌入时（window.parent !== window）生效。
 */
import { useUserStore } from "@/addons/auth-account/store/user";
import { createRemoteChildChannel } from "@prism-fusion/plugin-runtime/remote";
import {
  resolveShellLocale,
  resolveShellViewPath,
  shouldAcceptShellSessionVersion,
} from "./shellMessagePolicy";
import { resetSession } from "@/utils/token";
import type { Router } from "vue-router";
import { setLocale } from "@/i18n";
import { AUTHORIZATION_CHANGED_EVENT } from "./authorizationEvents";
import { setAuthRequiredNotifier } from "./authRequiredNotifier";
import { outerAware } from "@/outerHost";

const SHELL_ORIGIN = new URL(
  outerAware(import.meta.env.VITE_SHELL_URL ?? "http://localhost:26600"),
).origin;
let activeChannel: ReturnType<typeof createRemoteChildChannel> | undefined;

export function isInShell(): boolean {
  return typeof window !== "undefined" && window.parent !== window;
}

export function installShellBridge(router: Router): () => void {
  if (!isInShell()) return () => undefined;
  const userStore = useUserStore();
  let currentSessionVersion = 0;
  resetSession();

  const channel = createRemoteChildChannel({
    appId: "auth",
    hostOrigin: SHELL_ORIGIN,
    parent: window.parent,
    messages: {
      toChild: ["auth", "view", "locale"],
      fromChild: ["auth-required", "login-request", "authorization-changed"],
    },
    onConnected() {
      currentSessionVersion = 0;
      resetSession();
    },
    onMessage(type, payload) {
      handleVerifiedMessage(type, payload);
    },
  });
  activeChannel = channel;

  function handleVerifiedMessage(type: string, payload: unknown): void {
    const shellLocale = type === "locale" ? resolveShellLocale(payload) : null;
    if (shellLocale) {
      setLocale(shellLocale);
      return;
    }
    const viewPath = type === "view" ? resolveShellViewPath(payload) : null;
    if (viewPath) {
      if (router.currentRoute.value.path !== viewPath) void router.replace(viewPath);
      return;
    }
    if (type !== "auth" || !payload || typeof payload !== "object") return;
    const d = payload as {
      source?: string;
      type?: string;
      token?: string | null;
      sessionVersion?: number;
    };
    if (d?.source !== "shell" || d.type !== "auth") return;
    if (!shouldAcceptShellSessionVersion(
      currentSessionVersion,
      d.sessionVersion as number,
    )) return;
    if (d.token !== null && d.token !== undefined &&
        (typeof d.token !== "string" || d.token.length === 0 || d.token.length > 8192)) return;
    currentSessionVersion = d.sessionVersion as number;
    userStore.acceptShellToken(d.token ?? "", currentSessionVersion);
  }

  function notifyAuthorizationChanged(): void {
    activeChannel?.send("authorization-changed", {
      source: "sub",
      type: "authorization-changed",
    });
  }

  const onMessage = (event: MessageEvent) => channel.receive(event);
  window.addEventListener("message", onMessage);
  window.addEventListener(AUTHORIZATION_CHANGED_EVENT, notifyAuthorizationChanged);
  setAuthRequiredNotifier((payload) => channel.send("auth-required", payload));
  channel.ready();
  return () => {
    window.removeEventListener("message", onMessage);
    window.removeEventListener(AUTHORIZATION_CHANGED_EVENT, notifyAuthorizationChanged);
    setAuthRequiredNotifier(undefined);
    channel.dispose();
    if (activeChannel === channel) {
      activeChannel = undefined;
      resetSession();
    }
  };
}
