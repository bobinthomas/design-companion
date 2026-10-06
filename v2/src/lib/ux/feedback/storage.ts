import { feedbackRunSchema, type FeedbackRun } from "@/lib/schemas";

const KEY = "design-companion-v2:feedback-runs";
const MAX_RUNS = 10;

/** Feedback summaries live only in this browser, newest first. Reads are defensive. */
export function loadFeedbackRuns(): FeedbackRun[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((r) => {
      const result = feedbackRunSchema.safeParse(r);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

export function saveFeedbackRun(run: FeedbackRun): void {
  if (typeof window === "undefined") return;
  try {
    const rest = loadFeedbackRuns().filter((r) => r.id !== run.id);
    window.localStorage.setItem(KEY, JSON.stringify([run, ...rest].slice(0, MAX_RUNS)));
  } catch {
    // Storage full or unavailable.
  }
}

export function deleteFeedbackRun(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(loadFeedbackRuns().filter((r) => r.id !== id)));
  } catch {
    // ignore
  }
}
