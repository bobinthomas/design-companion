import { isProvider, type Provider } from "@/lib/providers";

const STORAGE_KEY = "design-companion:provider-settings";
export const SETTINGS_CHANGED_EVENT = "design-companion:settings-changed";

export interface StoredSettings {
  provider: Provider;
  apiKey: string;
  model?: string;
}

/**
 * Bring-your-own-key settings live only in this browser's localStorage —
 * never sent anywhere except as part of a generation request, and never
 * persisted server-side. Safe defaults on any read/parse failure: no key.
 */
export function loadSettings(): StoredSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isProvider(parsed?.provider) || typeof parsed?.apiKey !== "string" || !parsed.apiKey) {
      return null;
    }
    return {
      provider: parsed.provider,
      apiKey: parsed.apiKey,
      model: typeof parsed.model === "string" && parsed.model ? parsed.model : undefined,
    };
  } catch {
    return null;
  }
}

export function saveSettings(settings: StoredSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
}

export function clearSettings(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
}
