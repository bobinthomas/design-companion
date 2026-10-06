import type { ConfidenceBand, UXDecision } from "@/lib/schemas";

/** "persistent-filter-bar" → "Persistent filter bar" */
export function humanize(id: string): string {
  const text = id.replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const pct = (p: number) => `${Math.round(p * 100)}%`;

export const BAND_LABELS: Record<ConfidenceBand, string> = {
  proceed: "Confident",
  uncertain: "Uncertain",
  "needs-review": "Needs review",
};

export const BAND_STYLES: Record<ConfidenceBand, string> = {
  proceed: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
  uncertain: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
  "needs-review": "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900",
};

/** PRD §47: make system-determined vs model-judged vs designer-chosen visible. */
export const SOURCE_LABELS: Record<UXDecision["source"], string> = {
  rule: "Determined by UX rules",
  "decision-model": "Decision-model judgment",
  designer: "Designer decision",
  default: "Default (no evidence)",
};

export const SOURCE_STYLES: Record<UXDecision["source"], string> = {
  rule: "text-violet-700 dark:text-violet-300",
  "decision-model": "text-sky-700 dark:text-sky-300",
  designer: "text-zinc-900 dark:text-zinc-50",
  default: "text-zinc-500 dark:text-zinc-400",
};

export const PROVIDER_LABELS: Record<string, string> = {
  jev: "Jev",
  llm: "Your LLM, answering as a decision model",
  mock: "Demo judgments (keyword-based)",
};

export const GAP_BEHAVIOR_LABELS: Record<string, string> = {
  block: "Blocks generation",
  "mark-net-new": "Net-new component needed",
  warn: "Warning",
  none: "Settled",
};

export const card =
  "rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";
export const sectionTitle = "text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500";
export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200";
export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";
export const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:ring-violet-900";
