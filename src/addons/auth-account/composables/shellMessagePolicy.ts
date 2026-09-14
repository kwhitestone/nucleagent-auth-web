export function shouldAcceptShellSessionVersion(
  currentVersion: number,
  incomingVersion: number,
): boolean {
  return Number.isSafeInteger(incomingVersion) &&
    incomingVersion >= 0 &&
    incomingVersion >= currentVersion;
}

export function resolveShellViewPath(message: unknown): string | null {
  if (message === null || typeof message !== "object") return null;
  const data = message as { source?: unknown; type?: unknown; view?: unknown };
  if (data.source !== "shell" || data.type !== "view") return null;
  const path = (data as { path?: unknown }).path;
  if (typeof path === "string") {
    const normalized = path.trim();
    if (normalized.startsWith("/") && !normalized.startsWith("//") && !normalized.includes("\\") && normalized.length <= 512) {
      return normalized;
    }
    return null;
  }
  if (data.view === "account") return "/";
  if (data.view === "access") return "/access";
  return null;
}

export function resolveShellLocale(message: unknown): "zh" | "en" | null {
  if (message === null || typeof message !== "object") return null;
  const data = message as { source?: unknown; type?: unknown; locale?: unknown };
  if (data.source !== "shell" || data.type !== "locale") return null;
  return data.locale === "zh" || data.locale === "en" ? data.locale : null;
}
