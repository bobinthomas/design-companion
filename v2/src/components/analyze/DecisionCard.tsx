"use client";

import type { UXDecision } from "@/lib/schemas";
import {
  BAND_LABELS,
  BAND_STYLES,
  SOURCE_LABELS,
  SOURCE_STYLES,
  card,
  humanize,
  pct,
  secondaryButton,
} from "@/lib/client/format";

/**
 * PRD §47: one decision, with who determined it made visible, its
 * confidence, why, and the designer's actions.
 */
export function DecisionCard({
  decision,
  accepted,
  onAccept,
  onInspect,
}: {
  decision: UXDecision;
  accepted: boolean;
  onAccept: () => void;
  onInspect: () => void;
}) {
  const vetoed = decision.alternatives.filter((a) => a.vetoed);
  return (
    <article className={`${card} flex flex-col gap-3`} aria-label={`${decision.label} decision`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            {decision.label}
          </h3>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {humanize(decision.result.choice)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${BAND_STYLES[decision.band]}`}
          title="Confidence is a signal, not proof of correctness."
        >
          {pct(decision.result.confidence)} · {BAND_LABELS[decision.band]}
        </span>
      </div>

      <p className={`text-xs font-medium ${SOURCE_STYLES[decision.source]}`}>{SOURCE_LABELS[decision.source]}</p>

      {decision.reasons.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Why?</p>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
            {decision.reasons.slice(0, 2).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {vetoed.length > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Ruled out: {vetoed.map((a) => humanize(a.choice)).join(", ")}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {decision.source === "designer" ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Your choice · overrode {humanize(decision.override?.systemChoice ?? "")}</span>
        ) : accepted ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            ✓ Accepted
          </span>
        ) : (
          <button type="button" onClick={onAccept} className={secondaryButton}>
            Accept
          </button>
        )}
        <button type="button" onClick={onInspect} className={secondaryButton}>
          {decision.source === "designer" ? "Inspect" : "Inspect / change"}
        </button>
      </div>
    </article>
  );
}
