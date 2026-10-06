import { analysisSessionSchema, type AnalysisSession } from "@/lib/session/session";

const STORAGE_KEY = "design-companion-v2:analysis-sessions";
const MAX_SESSIONS = 20;

/**
 * Analysis sessions live only in this browser. Storage can be unavailable
 * (private windows, blocked site data) or hold an older format, so every
 * read is defensive: invalid entries are skipped, never thrown.
 */
export function loadSessions(): AnalysisSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((s) => {
      const result = analysisSessionSchema.safeParse(s);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

/** Saves a session as the most recent, keeping at most MAX_SESSIONS. */
export function saveSession(session: AnalysisSession): void {
  if (typeof window === "undefined") return;
  try {
    const rest = loadSessions().filter((s) => s.id !== session.id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([session, ...rest].slice(0, MAX_SESSIONS)));
  } catch {
    // Storage full or unavailable: the session still works in memory.
  }
}

export function deleteSession(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loadSessions().filter((s) => s.id !== id)));
  } catch {
    // ignore
  }
}

/** The full trace as a downloadable JSON file. */
export function downloadSession(session: AnalysisSession): void {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `design-companion-trace-${session.id.slice(0, 8)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
