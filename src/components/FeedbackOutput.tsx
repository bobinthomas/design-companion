import { Badge } from "@/components/Badge";
import { CopyButton } from "@/components/CopyButton";
import type {
  FeedbackOutput as FeedbackOutputData,
  FeedbackTheme,
  FeedbackIssue,
} from "@/lib/types";

const STRENGTH_TONE: Record<FeedbackTheme["strength"], "positive" | "negative" | "neutral"> = {
  "strong-positive": "positive",
  positive: "positive",
  mixed: "neutral",
  negative: "negative",
  "strong-negative": "negative",
};

const STRENGTH_LABEL: Record<FeedbackTheme["strength"], string> = {
  "strong-positive": "Strong positive",
  positive: "Positive",
  mixed: "Mixed",
  negative: "Negative",
  "strong-negative": "Strong negative",
};

const PRIORITY_TONE: Record<FeedbackIssue["priority"], "negative" | "warning" | "neutral"> = {
  P0: "negative",
  P1: "warning",
  P2: "neutral",
  P3: "neutral",
};

function outputToMarkdown(output: FeedbackOutputData): string {
  const parts: string[] = [];
  parts.push(
    [
      "## Key Themes",
      ...output.themes.map(
        (t) => `- **${t.name}** (${STRENGTH_LABEL[t.strength]}) — ${t.evidence.join("; ")}`
      ),
    ].join("\n")
  );
  if (output.prioritizedIssues.length) {
    parts.push(
      [
        "## Prioritized Issues",
        ...output.prioritizedIssues.map(
          (i) => `- [${i.priority}] ${i.issue} (Severity: ${i.severity}) — ${i.recommendation}`
        ),
      ].join("\n")
    );
  }
  if (output.positiveSignals.length) {
    parts.push(["## Positive Signals", ...output.positiveSignals.map((s) => `- ${s}`)].join("\n"));
  }
  if (output.nextSteps.length) {
    parts.push(["## Suggested Next Steps", ...output.nextSteps.map((s) => `- ${s}`)].join("\n"));
  }
  return parts.join("\n\n");
}

export function FeedbackOutput({ output }: { output: FeedbackOutputData }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <CopyButton text={outputToMarkdown(output)} label="Copy all" />
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Key Themes
        </h3>
        <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
          {output.themes.map((theme) => (
            <li key={theme.name} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {theme.name}
                </span>
                <Badge tone={STRENGTH_TONE[theme.strength]}>{STRENGTH_LABEL[theme.strength]}</Badge>
              </div>
              <ul className="space-y-1 pl-1 text-xs text-zinc-500 dark:text-zinc-400">
                {theme.evidence.map((e, i) => (
                  <li key={i}>&ldquo;{e.replace(/^"|"$/g, "")}&rdquo;</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {output.prioritizedIssues.length ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Prioritized Issues
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  <th className="pb-2 pr-3 font-medium">Priority</th>
                  <th className="pb-2 pr-3 font-medium">Issue</th>
                  <th className="pb-2 pr-3 font-medium">Severity</th>
                  <th className="pb-2 font-medium">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {output.prioritizedIssues.map((issue, i) => (
                  <tr key={i} className="align-top">
                    <td className="py-2 pr-3">
                      <Badge tone={PRIORITY_TONE[issue.priority]}>{issue.priority}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-zinc-800 dark:text-zinc-200">{issue.issue}</td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">{issue.severity}</td>
                    <td className="py-2 text-zinc-600 dark:text-zinc-400">{issue.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        {output.positiveSignals.length ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Positive Signals
            </h3>
            <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
              {output.positiveSignals.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {output.nextSteps.length ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Suggested Next Steps
            </h3>
            <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
              {output.nextSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
