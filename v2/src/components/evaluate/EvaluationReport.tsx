"use client";

import { EVALUATION_CATEGORIES, EVALUATION_CATEGORY_LABELS, type DecisionQuestion, type EvaluationRun, type UXEvaluation } from "@/lib/schemas";
import { PROVIDER_LABELS, card, pct, sectionTitle } from "@/lib/client/format";
import evaluationQuestions from "@knowledge/questions/evaluation.json";

export const EVALUATION_QUESTION_COUNT = evaluationQuestions.length;

const QUESTION_TEXT = new Map((evaluationQuestions as unknown as DecisionQuestion[]).map((q) => [q.id, q.question]));

export const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-rose-600 text-white",
  high: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

/** Green from 85, amber from 65, red below — the same thresholds as decision confidence. */
export function scoreTone(score: number): string {
  if (score >= 85) return "text-emerald-700 dark:text-emerald-300";
  if (score >= 65) return "text-amber-700 dark:text-amber-300";
  return "text-rose-700 dark:text-rose-300";
}

function barTone(score: number): string {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 65) return "bg-amber-500";
  return "bg-rose-500";
}

/** Plain-language source of an issue: the question, check, rule or gap that produced it. */
export function issueSource(issue: UXEvaluation["issues"][number], evaluation: UXEvaluation): string {
  const parts: string[] = [];
  if (issue.from.questionId) parts.push(`Question: ${QUESTION_TEXT.get(issue.from.questionId) ?? issue.from.questionId}`);
  if (issue.from.checkId) parts.push(`Check: ${evaluation.checks.find((c) => c.id === issue.from.checkId)?.label ?? issue.from.checkId}`);
  if (issue.from.ruleId) parts.push(`Rule: ${issue.from.ruleId}`);
  if (issue.from.gapId) parts.push(`Gap: ${issue.from.gapId}`);
  return parts.join(" · ");
}

export function RunMeta({ run, stale }: { run: EvaluationRun; stale: boolean }) {
  return (
    <div className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
      <p>
        Judged by <strong className="font-medium text-zinc-700 dark:text-zinc-300">{PROVIDER_LABELS[run.provider] ?? run.provider}</strong> ({run.model}) ·
        evaluator {run.evaluations[0]?.versions.evaluator} · {new Date(run.evaluatedAt).toLocaleString()}
      </p>
      {run.notices.map((n) => (
        <p key={n}>{n}</p>
      ))}
      {stale && (
        <p role="status" className="text-amber-800 dark:text-amber-300">
          ⚠ The decisions have changed since this evaluation. Evaluate again to reflect them.
        </p>
      )}
    </div>
  );
}

export function IssueList({ evaluation, limit }: { evaluation: UXEvaluation; limit?: number }) {
  const issues = limit ? evaluation.issues.slice(0, limit) : evaluation.issues;
  if (evaluation.issues.length === 0) return <p className="text-sm text-zinc-500">No issues found.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {issues.map((issue, i) => (
        <li key={i} className="text-sm">
          <div className="flex items-start gap-2">
            <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${SEVERITY_STYLES[issue.severity]}`}>
              {issue.severity}
            </span>
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{issue.issue}</p>
              <p className="text-zinc-600 dark:text-zinc-400">{issue.recommendation}</p>
              <p className="text-xs text-zinc-400">
                {EVALUATION_CATEGORY_LABELS[issue.category]}
                {issue.location ? ` · ${issue.location}` : ""} · {issueSource(issue, evaluation)}
              </p>
            </div>
          </div>
        </li>
      ))}
      {limit && evaluation.issues.length > limit && (
        <li className="text-xs text-zinc-500">+ {evaluation.issues.length - limit} more</li>
      )}
    </ul>
  );
}

/** One subject in full: overall score, 12 categories with their evidence, issues, checks. */
export function EvaluationReport({ evaluation, label }: { evaluation: UXEvaluation; label: string }) {
  return (
    <article className={`${card} flex flex-col gap-5`} aria-label={`Evaluation of ${label}`}>
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{label}</h3>
        <p className={`text-3xl font-semibold tabular-nums ${scoreTone(evaluation.overallScore)}`}>
          {evaluation.overallScore}
          <span className="text-sm font-normal text-zinc-400">/100</span>
        </p>
      </header>

      <section>
        <p className={sectionTitle}>Categories</p>
        <ul className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {EVALUATION_CATEGORIES.map((c) => {
            const s = evaluation.categories[c];
            const basis = [
              ...s.evidence.map((e) => `${e.question} (${e.type === "noul" ? pct(Number(e.value)) : `level ${Number(e.value).toFixed(1)}`})`),
              ...s.checks.map((id) => {
                const check = evaluation.checks.find((x) => x.id === id);
                return check ? `${check.passed ? "✓" : "✗"} ${check.label}` : id;
              }),
            ];
            return (
              <li key={c} className="text-sm" title={basis.join("\n")}>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-700 dark:text-zinc-300">{EVALUATION_CATEGORY_LABELS[c]}</span>
                  <span className={`tabular-nums ${scoreTone(s.score)}`}>{s.score}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden>
                  <div className={`h-1.5 rounded-full ${barTone(s.score)}`} style={{ width: `${s.score}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <p className={sectionTitle}>Issues</p>
        <div className="mt-2">
          <IssueList evaluation={evaluation} />
        </div>
      </section>

      {evaluation.checks.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">
            Deterministic checks ({evaluation.checks.filter((c) => c.passed).length}/{evaluation.checks.length} passed)
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {evaluation.checks.map((c) => (
              <li key={c.id} className={c.passed ? "text-zinc-600 dark:text-zinc-400" : "text-rose-700 dark:text-rose-300"}>
                {c.passed ? "✓" : "✗"} {c.label}
                {c.detail && <span className="text-xs text-zinc-500"> — {c.detail}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

/** PRD §46 Compare Solutions: every category side by side, best in each row marked. */
export function CompareTable({ run }: { run: EvaluationRun }) {
  const label = (id: string) => run.subjects.find((s) => s.id === id)?.label ?? id;
  const rows: { key: string; name: string; scores: number[] }[] = [
    { key: "overall", name: "Overall", scores: run.evaluations.map((e) => e.overallScore) },
    ...EVALUATION_CATEGORIES.map((c) => ({ key: c, name: EVALUATION_CATEGORY_LABELS[c], scores: run.evaluations.map((e) => e.categories[c].score) })),
    { key: "issues", name: "Critical / high issues", scores: run.evaluations.map((e) => e.issues.filter((i) => i.severity === "critical" || i.severity === "high").length) },
  ];

  return (
    <div className={`${card} overflow-x-auto p-0`}>
      <table className="w-full min-w-[28rem] text-sm">
        <caption className="sr-only">Evaluation scores by category for each direction; the best in each row is marked.</caption>
        <thead>
          <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
            <th scope="col" className="p-3 font-medium text-zinc-500">Category</th>
            {run.evaluations.map((e) => (
              <th key={e.subjectId} scope="col" className="p-3 text-right font-medium text-zinc-900 dark:text-zinc-50">
                {label(e.subjectId)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const best = row.key === "issues" ? Math.min(...row.scores) : Math.max(...row.scores);
            const spread = Math.max(...row.scores) !== Math.min(...row.scores);
            return (
              <tr key={row.key} className={`border-b border-zinc-100 last:border-0 dark:border-zinc-900 ${row.key === "overall" ? "font-semibold" : ""}`}>
                <th scope="row" className="p-3 text-left font-normal text-zinc-700 dark:text-zinc-300">
                  {row.name}
                </th>
                {row.scores.map((score, i) => (
                  <td key={i} className={`p-3 text-right tabular-nums ${row.key === "issues" ? "" : scoreTone(score)}`}>
                    {score}
                    {spread && score === best && run.evaluations.length > 1 && (
                      <span className="ml-1 text-xs text-violet-700 dark:text-violet-300" aria-label="best">
                        ★
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
