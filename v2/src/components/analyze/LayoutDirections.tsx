"use client";

import { useState } from "react";
import type { DirectionCheck, EvaluationRun, LayoutBrainstorm, LayoutVariant, PolicyOutcome, UXEvaluation } from "@/lib/schemas";
import {
  CompareTable,
  EVALUATION_QUESTION_COUNT,
  EvaluationReport,
  IssueList,
  RunMeta,
  scoreTone,
} from "@/components/evaluate/EvaluationReport";
import {
  BAND_LABELS,
  BAND_STYLES,
  card,
  humanize,
  inputClass,
  pct,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from "@/lib/client/format";

interface Lookups {
  componentName: Map<string, string>;
  ruleCode: Map<string, string>;
  decision: Map<string, { label: string; choice: string }>;
  gapCapability: Map<string, string>;
}

function lookups(outcome: PolicyOutcome): Lookups {
  return {
    componentName: new Map(outcome.components.map((c) => [c.component, c.name])),
    ruleCode: new Map(outcome.rulesFired.map((r) => [r.ruleId, r.code])),
    decision: new Map(outcome.decisions.map((d) => [d.decision, { label: d.label, choice: d.result.choice }])),
    gapCapability: new Map(outcome.gaps.map((g) => [g.id, g.capability])),
  };
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={sectionTitle}>{title}</p>
      <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

/** One direction: a region-by-region wireframe, then the reasoning behind it. */
function DirectionCard({
  variant,
  check,
  evaluation,
  names,
}: {
  variant: LayoutVariant;
  check?: DirectionCheck;
  evaluation?: UXEvaluation;
  names: Lookups;
}) {
  return (
    <article className={`${card} flex flex-col gap-4`} aria-labelledby={`direction-${variant.id}`}>
      <header className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 id={`direction-${variant.id}`} className="font-semibold text-zinc-900 dark:text-zinc-50">
            {variant.title}
          </h3>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {evaluation && (
              <span className={`text-lg font-semibold tabular-nums ${scoreTone(evaluation.overallScore)}`} title="UX evaluation score">
                {evaluation.overallScore}
                <span className="text-xs font-normal text-zinc-400">/100</span>
              </span>
            )}
            {check && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${BAND_STYLES[check.band]}`}
                title="Mean confidence of the decisions this direction builds on"
              >
                {pct(check.confidence)} · {BAND_LABELS[check.band]}
              </span>
            )}
          </div>
        </div>
        {variant.strategy !== variant.title && <p className="text-xs text-violet-700 dark:text-violet-300">{variant.strategy}</p>}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{variant.summary}</p>
      </header>

      <ol className="flex flex-col gap-2" aria-label={`${variant.title} regions, top to bottom`}>
        {variant.regions.map((r, i) => (
          <li key={`${r.name}-${i}`} className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{r.name}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{r.purpose}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {r.components.map((c, j) =>
                "component" in c ? (
                  <li
                    key={j}
                    className="rounded-md bg-white px-2 py-1 text-xs ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700"
                    title={c.states.length > 0 ? `States: ${c.states.join(", ")}` : undefined}
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{names.componentName.get(c.component) ?? c.component}</span>
                    {c.variant && <span className="text-zinc-500"> ({c.variant})</span>}
                    <span className="text-zinc-500 dark:text-zinc-400"> · {c.purpose}</span>
                    {c.states.length > 0 && <span className="block text-[11px] text-zinc-400">states: {c.states.join(", ")}</span>}
                  </li>
                ) : (
                  <li
                    key={j}
                    className="rounded-md border border-dashed border-amber-400 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    <span aria-hidden>◌ </span>
                    <span className="sr-only">Placeholder for a design-system gap: </span>
                    {c.purpose}
                    <span className="block text-[11px] opacity-75">{humanize(names.gapCapability.get(c.gap) ?? c.gap)} · not in your design system</span>
                  </li>
                )
              )}
            </ul>
          </li>
        ))}
      </ol>

      <details className="group text-sm">
        <summary className="cursor-pointer font-medium text-zinc-700 marker:text-zinc-400 dark:text-zinc-300">Why this direction</summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-zinc-700 dark:text-zinc-300">{variant.rationale}</p>
          <List title="Advantages" items={variant.advantages} />
          <List title="Trade-offs" items={variant.tradeoffs} />
          <List
            title="Builds on these decisions"
            items={variant.supportingDecisions.map((d) => {
              const info = names.decision.get(d);
              return info ? `${info.label}: ${humanize(info.choice)}` : humanize(d);
            })}
          />
          {variant.rulesApplied.length > 0 && (
            <div>
              <p className={sectionTitle}>Rules</p>
              <p className="mt-1 font-mono text-xs text-violet-700 dark:text-violet-300">
                {variant.rulesApplied.map((r) => names.ruleCode.get(r) ?? r).join(" · ")}
              </p>
            </div>
          )}
          <List title="On phones" items={variant.mobileNotes} />
          <List title="On desktop" items={variant.desktopNotes} />
        </div>
      </details>

      {evaluation && evaluation.issues.length > 0 && (
        <div>
          <p className={sectionTitle}>Top issues</p>
          <div className="mt-2">
            <IssueList evaluation={evaluation} limit={2} />
          </div>
        </div>
      )}

      {check && (check.uncoveredDecisions.length > 0 || check.unusedComponents.length > 0) && (
        <div className="rounded-lg bg-zinc-100 p-2.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          {check.uncoveredDecisions.length > 0 && (
            <p>Doesn&apos;t show: {check.uncoveredDecisions.map((d) => names.decision.get(d)?.label ?? humanize(d)).join(", ")}</p>
          )}
          {check.unusedComponents.length > 0 && (
            <p>Leaves out: {check.unusedComponents.map((c) => names.componentName.get(c) ?? c).join(", ")}</p>
          )}
        </div>
      )}
    </article>
  );
}

/** PRD §23 Layout Brainstorm: directions inside the space the decisions define. */
export function LayoutDirections({
  outcome,
  runs,
  evaluations,
  stale,
  busy,
  evaluating,
  onGenerate,
  onEvaluate,
}: {
  outcome: PolicyOutcome;
  runs: LayoutBrainstorm[];
  /** The session's evaluation runs, newest first. */
  evaluations: EvaluationRun[];
  /** True when the decisions changed since a run was made against them. */
  stale: (basedOn: readonly { decision: string; choice: string }[]) => boolean;
  busy: boolean;
  evaluating: boolean;
  onGenerate: (instruction: string) => void;
  onEvaluate: (run: LayoutBrainstorm) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const run = runs.find((r) => r.id === selected) ?? runs[0];
  const names = lookups(outcome);
  const blocking = outcome.gaps.filter((g) => g.behavior === "block");
  const evaluation = run ? evaluations.find((e) => e.subjects.every((s) => s.layoutRunId === run.id)) : undefined;
  const runStale = run ? stale(run.basedOn) : false;

  return (
    <section aria-labelledby="layouts-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="layouts-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Layout directions
          </h2>
          <p className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Directions explore the space your decisions define. They use only your design system&apos;s components, and show
            gaps as placeholders.
          </p>
        </div>
        {runs.length > 1 && (
          <select
            aria-label="Earlier layout runs"
            value={run?.id}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {runs.map((r, i) => (
              <option key={r.id} value={r.id}>
                {i === 0 ? "Latest" : `Earlier (${new Date(r.generatedAt).toLocaleTimeString()})`}
                {r.instruction ? ` · ${r.instruction.slice(0, 30)}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {blocking.length > 0 ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          Layouts can&apos;t be generated yet: your design system is missing{" "}
          {blocking.map((g) => humanize(g.capability).toLowerCase()).join(", ")}, which a critical rule requires. Resolve or
          accept {blocking.length === 1 ? "that gap" : "those gaps"} above, or override the{" "}
          {[...new Set(blocking.flatMap((g) => g.affectedDecisions))].map((d) => names.decision.get(d)?.label.toLowerCase() ?? d).join(" / ")}{" "}
          decision.
        </p>
      ) : (
        <form
          className={`${card} flex flex-col gap-3 sm:flex-row sm:items-end`}
          onSubmit={(e) => {
            e.preventDefault();
            setSelected(null);
            onGenerate(instruction);
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Steer the directions (optional; needs an LLM)</span>
            <input
              value={instruction}
              maxLength={500}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Make one direction work well one-handed on a phone"
              className={inputClass}
            />
          </label>
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy ? "Generating…" : runs.length > 0 ? "Generate again" : "Brainstorm layouts"}
          </button>
        </form>
      )}

      {run && (
        <>
          <div className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            <p>
              {run.source === "draft" ? "Drafted without an LLM" : `Generated by ${run.model}`} ·{" "}
              {new Date(run.generatedAt).toLocaleString()} · design system {run.designSystem.id} {run.designSystem.version}
              {run.instruction && <> · steering: &ldquo;{run.instruction}&rdquo;</>}
            </p>
            {run.notices.map((n) => (
              <p key={n}>{n}</p>
            ))}
            {runStale && (
              <p role="status" className="text-amber-800 dark:text-amber-300">
                ⚠ Your decisions have changed since these directions were generated. Generate again to reflect them.
              </p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {run.output.variants.map((v) => (
              <DirectionCard
                key={v.id}
                variant={v}
                check={run.checks.find((c) => c.variantId === v.id)}
                evaluation={evaluation?.evaluations.find((e) => e.subjectId === v.id)}
                names={names}
              />
            ))}
          </div>

          <section aria-labelledby="compare-title" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 id="compare-title" className="font-semibold text-zinc-900 dark:text-zinc-50">
                  Evaluate and compare
                </h3>
                <p className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
                  {run.output.variants.length * EVALUATION_QUESTION_COUNT} atomic questions go to the decision model in one
                  request, plus checks in code, scored across 12 UX categories.
                </p>
              </div>
              <button
                type="button"
                className={evaluation ? secondaryButton : primaryButton}
                disabled={evaluating || busy || runStale}
                title={runStale ? "Generate the directions again first" : undefined}
                onClick={() => onEvaluate(run)}
              >
                {evaluating ? "Evaluating…" : evaluation ? "Evaluate again" : "Evaluate directions"}
              </button>
            </div>
            {evaluation && (
              <>
                <RunMeta run={evaluation} stale={stale(evaluation.basedOn)} />
                <CompareTable run={evaluation} />
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Full reports: every category&apos;s evidence, all issues, all checks
                  </summary>
                  <div className="mt-3 grid gap-4 lg:grid-cols-2">
                    {evaluation.evaluations.map((e) => (
                      <EvaluationReport
                        key={e.subjectId}
                        evaluation={e}
                        label={evaluation.subjects.find((s) => s.id === e.subjectId)?.label ?? e.subjectId}
                      />
                    ))}
                  </div>
                </details>
              </>
            )}
          </section>
          {run.output.assumptions.length > 0 && (
            <div className={card}>
              <List title="Assumptions" items={run.output.assumptions} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
