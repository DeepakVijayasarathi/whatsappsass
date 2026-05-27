/**
 * Runtime app config — fetched from the backend /config endpoint once per session.
 * Falls back to window.location.origin so nothing breaks if the call fails.
 */

interface AppConfig {
  appUrl: string;
  appName: string;
  contactEmail: string;
}

let cached: AppConfig | null = null;

export async function getAppConfig(): Promise<AppConfig> {
  if (cached) return cached;
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const data = await res.json() as AppConfig;
      cached = {
        appUrl:       data.appUrl || (typeof window !== "undefined" ? window.location.origin : ""),
        appName:      data.appName || "WA SaaS Lite",
        contactEmail: data.contactEmail || "hello@example.com",
      };
      return cached;
    }
  } catch { /* fallthrough */ }
  // Fallback: use current browser origin
  cached = {
    appUrl:       typeof window !== "undefined" ? window.location.origin : "",
    appName:      "WA SaaS Lite",
    contactEmail: "hello@example.com",
  };
  return cached;
}

/** Synchronous getter — returns cached value or empty string before first load */
export function getAppUrl(): string {
  return cached?.appUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
}

export function getAppName(): string {
  return cached?.appName ?? "WA SaaS Lite";
}
