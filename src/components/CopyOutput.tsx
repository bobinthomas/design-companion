import { CopyButton } from "@/components/CopyButton";
import type { CopyOutput as CopyOutputData } from "@/lib/types";

function outputToMarkdown(output: CopyOutputData): string {
  const parts = output.groups.map((g) =>
    [
      `## ${g.group}`,
      ...g.items.map((item) => {
        const alt = item.alternatives.length
          ? `\n  Alternatives: ${item.alternatives.join(" / ")}`
          : "";
        return `- **${item.label}:** ${item.value}${alt}`;
      }),
    ].join("\n")
  );
  return parts.join("\n\n");
}

export function CopyOutput({ output }: { output: CopyOutputData }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        {output.toneNotes ? (
          <p className="text-xs italic text-zinc-500 dark:text-zinc-400">{output.toneNotes}</p>
        ) : (
          <span />
        )}
        <CopyButton text={outputToMarkdown(output)} label="Copy all" />
      </div>

      <div className="flex flex-col gap-4">
        {output.groups.map((group) => (
          <div
            key={group.group}
            className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {group.group}
            </h3>
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {group.items.map((item) => (
                <li key={item.label} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                        {item.label}
                      </span>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100">{item.value}</p>
                    </div>
                    <CopyButton text={item.value} />
                  </div>
                  {item.alternatives.length ? (
                    <div className="flex flex-wrap gap-1.5 pl-0.5">
                      {item.alternatives.map((alt, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        >
                          {alt}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
