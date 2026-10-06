"use client";

import { useEffect, useRef, useState } from "react";
import { DECISION_OPTIONS, type UXDecision } from "@/lib/schemas";
import {
  BAND_LABELS,
  BAND_STYLES,
  PROVIDER_LABELS,
  SOURCE_LABELS,
  humanize,
  inputClass,
  pct,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from "@/lib/client/format";

const EFFECT_LABELS = { recommend: "Recommends", avoid: "Avoids", veto: "Rules out" } as const;

type Effect = keyof typeof EFFECT_LABELS;

/** One entry per rule, with every option it recommended, avoided or ruled out. */
function groupRules(applied: UXDecision["rulesApplied"]) {
  const groups = new Map<string, UXDecision["rulesApplied"][number] & { targets: Record<Effect, string[]> }>();
  for (const r of applied) {
    const g = groups.get(r.id) ?? { ...r, targets: { recommend: [], avoid: [], veto: [] } };
    g.targets[r.effect].push(r.target);
    groups.set(r.id, g);
  }
  return [...groups.values()];
}

function evidenceText(e: UXDecision["evidence"][number]): { mark: string; value: string } {
  if (e.type === "noul") {
    const v = Number(e.value);
    return { mark: v >= 0.7 ? "✓" : v <= 0.3 ? "✗" : "?", value: `${pct(v)} likely` };
  }
  if (e.type === "choice") return { mark: "→", value: humanize(String(e.value)) };
  return { mark: "≈", value: `level ${Number(e.value).toFixed(1)}` };
}

/**
 * PRD §17 Decision Inspector: DECISION · RECOMMENDATION · CONFIDENCE · WHY ·
 * QUESTIONS · RULES · ALTERNATIVES, plus the override action (§16).
 */
export function DecisionInspector({
  decision,
  busy,
  onClose,
  onOverride,
  onRemoveOverride,
}: {
  decision: UXDecision;
  busy: boolean;
  onClose: () => void;
  onOverride: (choice: string, reason: string) => void;
  onRemoveOverride: () => void;
}) {
  const options = DECISION_OPTIONS[decision.decision] as readonly string[];
  const [choice, setChoice] = useState(options.find((o) => o !== decision.result.choice) ?? options[0]);
  const [reason, setReason] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const vetoes = new Map(decision.rulesApplied.filter((r) => r.effect === "veto").map((r) => [r.target, r]));

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/30" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspector-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col gap-6 overflow-y-auto bg-white p-6 shadow-xl outline-none dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={sectionTitle}>Decision</p>
            <h2 id="inspector-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {decision.label}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{decision.question}</p>
          </div>
          <button type="button" onClick={onClose} className={secondaryButton} aria-label="Close inspector">
            Close
          </button>
        </div>

        <section className="flex flex-wrap items-center gap-3">
          <div>
            <p className={sectionTitle}>Recommendation</p>
            <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{humanize(decision.result.choice)}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{SOURCE_LABELS[decision.source]}</p>
          </div>
          <span className={`ml-auto rounded-full px-3 py-1 text-sm font-medium ring-1 ${BAND_STYLES[decision.band]}`}>
            {pct(decision.result.confidence)} · {BAND_LABELS[decision.band]}
          </span>
        </section>

        {decision.override && (
          <section className="rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
            <p className="font-medium text-zinc-900 dark:text-zinc-50">
              You changed this from {humanize(decision.override.systemChoice)} to {humanize(decision.override.designerChoice)}.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">Reason: {decision.override.overrideReason}</p>
            <p className="mt-1 text-xs text-zinc-500">The rules themselves are unchanged.</p>
            <button type="button" disabled={busy} onClick={onRemoveOverride} className={`${secondaryButton} mt-2`}>
              Return to the system recommendation
            </button>
          </section>
        )}

        <section>
          <p className={sectionTitle}>Why</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
            {decision.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>

        <section>
          <p className={sectionTitle}>Questions (evidence)</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {decision.evidence.map((e) => {
              const { mark, value } = evidenceText(e);
              return (
                <li key={e.questionId} className="flex items-start gap-2">
                  <span aria-hidden className="w-4 shrink-0 font-mono text-zinc-500">{mark}</span>
                  <span className="flex-1 text-zinc-800 dark:text-zinc-200">{e.question}</span>
                  <span className="shrink-0 text-right text-xs text-zinc-500 dark:text-zinc-400">
                    {value}
                    <br />
                    {PROVIDER_LABELS[e.provider] ?? e.provider}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <p className={sectionTitle}>Rules</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {groupRules(decision.rulesApplied).map((r) => (
              <li key={r.id} className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
                <p className="font-mono text-xs text-violet-700 dark:text-violet-300">
                  {r.code} · {r.tier} · {r.priority}
                </p>
                {(["recommend", "avoid", "veto"] as const).map((effect) =>
                  r.targets[effect].length > 0 ? (
                    <p key={effect} className="text-zinc-800 dark:text-zinc-200">
                      {EFFECT_LABELS[effect]} {r.targets[effect].map(humanize).join(", ")}
                    </p>
                  ) : null
                )}
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{r.reason}</p>
              </li>
            ))}
            {decision.rulesApplied.length === 0 && (
              <li className="text-zinc-500">No rules applied; this came from the decision model alone.</li>
            )}
          </ul>
        </section>

        {decision.alternatives.length > 0 && (
          <section>
            <p className={sectionTitle}>Alternatives</p>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {decision.alternatives.map((a) => (
                <li key={a.choice}>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {humanize(a.choice)} {a.vetoed && <span className="text-xs font-normal text-rose-700 dark:text-rose-300">(ruled out)</span>}
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400">{a.reasonRejected}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {decision.requiresCapabilities.length > 0 && (
          <section>
            <p className={sectionTitle}>Needs from the design system</p>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{decision.requiresCapabilities.map(humanize).join(" · ")}</p>
          </section>
        )}

        <form
          className="flex flex-col gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim()) onOverride(choice, reason.trim());
          }}
        >
          <p className={sectionTitle}>Override</p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Use instead</span>
            <select value={choice} onChange={(e) => setChoice(e.target.value)} className={inputClass}>
              {options
                .filter((o) => o !== decision.result.choice)
                .map((o) => (
                  <option key={o} value={o}>
                    {humanize(o)}
                    {vetoes.has(o) ? " (ruled out by a critical rule)" : ""}
                  </option>
                ))}
            </select>
          </label>
          {vetoes.has(choice) && (
            <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
              {vetoes.get(choice)!.code}: {vetoes.get(choice)!.reason} You can still choose it; the conflict will be recorded.
            </p>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Reason (recorded in the trace)</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputClass} placeholder="e.g. Users focus on one expense at a time." />
          </label>
          <div>
            <button type="submit" disabled={busy || !reason.trim()} className={primaryButton}>
              {busy ? "Applying…" : "Override decision"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
