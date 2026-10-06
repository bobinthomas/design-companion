"use client";

import type { DecisionQuestion, DecisionResult } from "@/lib/schemas";
import { card, humanize, pct } from "@/lib/client/format";

function answer(r: DecisionResult): string {
  if (r.type === "noul") return `${r.noul >= 0.7 ? "Yes" : r.noul <= 0.3 ? "No" : "Unsure"} (${pct(r.noul)})`;
  if (r.type === "choice") return humanize(r.choice);
  return `${r.score.toFixed(2)} of ${Math.max(0, r.legend.length - 1)}`;
}

/** Every atomic question and its raw answer — the evidence layer, unfiltered. */
export function QuestionsTable({
  questions,
  results,
}: {
  questions: readonly DecisionQuestion[];
  results: readonly DecisionResult[];
}) {
  const byId = new Map(results.map((r) => [r.questionId, r]));
  return (
    <details className={card}>
      <summary className="cursor-pointer text-sm font-medium text-zinc-900 dark:text-zinc-50">
        All {questions.length} questions and raw answers
      </summary>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="py-2 pr-4 font-medium">Question</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Answer</th>
              <th className="py-2 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {questions.map((q) => {
              const r = byId.get(q.id);
              return (
                <tr key={q.id}>
                  <td className="py-2 pr-4 text-zinc-800 dark:text-zinc-200">
                    {q.question}
                    <div className="font-mono text-xs text-zinc-400">{q.id}</div>
                  </td>
                  <td className="py-2 pr-4 text-zinc-500">{q.type}</td>
                  <td className="py-2 pr-4 text-zinc-800 dark:text-zinc-200">{r ? answer(r) : "—"}</td>
                  <td className="py-2 text-zinc-500">{r ? pct(r.confidence) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
