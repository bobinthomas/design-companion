"use client";

import { useState } from "react";
import type { GapResolutionKind, PolicyOutcome } from "@/lib/schemas";
import {
  GAP_BEHAVIOR_LABELS,
  card,
  humanize,
  inputClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from "@/lib/client/format";

const GAP_STYLES: Record<string, string> = {
  block: "border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40",
  "mark-net-new": "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
  warn: "border-zinc-200 dark:border-zinc-800",
  none: "border-zinc-200 opacity-70 dark:border-zinc-800",
};

function GapItem({
  gap,
  busy,
  onSettle,
  onReopen,
}: {
  gap: PolicyOutcome["gaps"][number];
  busy: boolean;
  onSettle: (kind: GapResolutionKind, reason: string) => void;
  onReopen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<GapResolutionKind>("accept-risk");
  const [reason, setReason] = useState("");
  const settleable = gap.suggestedResolutions.filter((r) => r !== "override-decision");

  return (
    <li className={`rounded-lg border p-3 text-sm ${GAP_STYLES[gap.behavior]}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-zinc-900 dark:text-zinc-50">
            {humanize(gap.capability)} <span className="font-normal text-zinc-500">· {gap.kind} · {gap.severity}</span>
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">{GAP_BEHAVIOR_LABELS[gap.behavior]}</p>
          {gap.missing.length > 0 && <p className="text-xs text-zinc-500 dark:text-zinc-400">Missing: {gap.missing.join(", ")}</p>}
          {gap.resolution && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {humanize(gap.resolution.kind)}: {gap.resolution.reason}
            </p>
          )}
        </div>
        {gap.status === "open" ? (
          <button type="button" className={secondaryButton} onClick={() => setOpen((v) => !v)}>
            Resolve…
          </button>
        ) : (
          <button type="button" className={secondaryButton} disabled={busy} onClick={onReopen}>
            Reopen
          </button>
        )}
      </div>
      {open && gap.status === "open" && (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim()) {
              onSettle(kind, reason.trim());
              setOpen(false);
            }
          }}
        >
          {gap.affectedDecisions.length > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Or override the {gap.affectedDecisions.map(humanize).join(" / ")} decision to an option your design system supports.
            </p>
          )}
          <select value={kind} onChange={(e) => setKind(e.target.value as GapResolutionKind)} className={inputClass}>
            {settleable.map((r) => (
              <option key={r} value={r}>
                {humanize(r)}
              </option>
            ))}
          </select>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (recorded)" className={inputClass} />
          <div>
            <button type="submit" disabled={busy || !reason.trim()} className={primaryButton}>
              Record
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

/** Patterns, components and design-system gaps derived from the decisions. */
export function SolutionPanel({
  outcome,
  busy,
  onSettleGap,
  onReopenGap,
}: {
  outcome: PolicyOutcome;
  busy: boolean;
  onSettleGap: (gapId: string, kind: GapResolutionKind, reason: string) => void;
  onReopenGap: (gapId: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className={card} aria-labelledby="patterns-title">
        <h2 id="patterns-title" className={sectionTitle}>
          Patterns
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {outcome.patterns.map((p) => (
            <li key={p.pattern} className="flex items-center justify-between gap-2">
              <span className={p.role === "primary" ? "font-semibold text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"}>
                {p.name}
                {p.role === "primary" && <span className="ml-1.5 text-xs font-normal text-violet-700 dark:text-violet-300">primary</span>}
              </span>
              <span className="text-xs text-zinc-400">fit {Math.round(p.score * 100)}%</span>
            </li>
          ))}
          {outcome.patterns.length === 0 && <li className="text-zinc-500">No pattern fits strongly.</li>}
        </ul>
        {outcome.requiredStates.length > 0 && (
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            Required states: {outcome.requiredStates.join(", ")}
          </p>
        )}
      </section>

      <section className={card} aria-labelledby="components-title">
        <h2 id="components-title" className={sectionTitle}>
          Components ({outcome.versions.designSystem.id} {outcome.versions.designSystem.version})
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {outcome.components.map((c) => (
            <li key={c.component}>
              <span className="font-medium text-zinc-900 dark:text-zinc-50">{c.name}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {" "}
                · {c.serves.map(humanize).join(", ")}
                {c.via.includes("composite") ? " (composed)" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={card} aria-labelledby="gaps-title">
        <h2 id="gaps-title" className={sectionTitle}>
          Design-system gaps
        </h2>
        {outcome.blocked && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            Generation is blocked until critical gaps are resolved or accepted.
          </p>
        )}
        <ul className="mt-3 flex flex-col gap-2">
          {outcome.gaps.map((g) => (
            <GapItem
              key={g.id}
              gap={g}
              busy={busy}
              onSettle={(kind, reason) => onSettleGap(g.id, kind, reason)}
              onReopen={() => onReopenGap(g.id)}
            />
          ))}
          {outcome.gaps.length === 0 && <li className="text-sm text-zinc-500">None — your design system can build everything this needs.</li>}
        </ul>
      </section>
    </div>
  );
}
