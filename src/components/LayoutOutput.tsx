import { Badge } from "@/components/Badge";
import { CopyButton } from "@/components/CopyButton";
import type { LayoutDirection, LayoutOutput as LayoutOutputData } from "@/lib/types";

function directionToMarkdown(d: LayoutDirection): string {
  const lines = [`## ${d.title}${d.recommended ? " (Recommended)" : ""}`, ""];
  lines.push("**Hierarchy**", ...d.hierarchy.map((h) => `- ${h}`), "");
  lines.push(
    "**Sections**",
    ...d.sections.map((s) => `- ${s.name}: ${s.purpose}`),
    ""
  );
  if (d.interactionPatterns.length) {
    lines.push("**Interaction patterns**", ...d.interactionPatterns.map((p) => `- ${p}`), "");
  }
  if (d.mobileNotes.length) {
    lines.push("**Mobile**", ...d.mobileNotes.map((n) => `- ${n}`), "");
  }
  if (d.desktopNotes.length) {
    lines.push("**Desktop**", ...d.desktopNotes.map((n) => `- ${n}`), "");
  }
  return lines.join("\n");
}

function outputToMarkdown(output: LayoutOutputData): string {
  const parts = output.directions.map(directionToMarkdown);
  if (output.assumptions.length) {
    parts.push(["**Assumptions**", ...output.assumptions.map((a) => `- ${a}`)].join("\n"));
  }
  return parts.join("\n\n");
}

export function LayoutOutput({ output }: { output: LayoutOutputData }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <CopyButton text={outputToMarkdown(output)} label="Copy all" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {output.directions.map((direction) => (
          <div
            key={direction.title}
            className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {direction.title}
              </h3>
              {direction.recommended ? <Badge tone="accent">Recommended</Badge> : null}
            </div>

            <div>
              <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Hierarchy
              </h4>
              <ol className="list-decimal space-y-1 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
                {direction.hierarchy.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ol>
            </div>

            <div>
              <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Sections
              </h4>
              <ul className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                {direction.sections.map((s) => (
                  <li key={s.name}>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{s.name}</span>
                    {" — "}
                    {s.purpose}
                  </li>
                ))}
              </ul>
            </div>

            {direction.interactionPatterns.length ? (
              <div>
                <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Interaction patterns
                </h4>
                <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
                  {direction.interactionPatterns.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {direction.mobileNotes.length || direction.desktopNotes.length ? (
              <div className="grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div>
                  <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    Mobile
                  </h4>
                  <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {direction.mobileNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    Desktop
                  </h4>
                  <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {direction.desktopNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {output.assumptions.length ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 p-4 dark:border-zinc-800">
          <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Assumptions
          </h4>
          <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-600 dark:text-zinc-400">
            {output.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
