"use client";

import { useMemo, useState } from "react";
import type { KnowledgeSection } from "@/lib/knowledge/browse";
import { card, inputClass } from "@/lib/client/format";

/** Tabs per section, a search box across ids, titles, tags and bodies, and expandable entries. */
export function KnowledgeBrowser({ sections }: { sections: KnowledgeSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const [query, setQuery] = useState("");
  const section = sections.find((s) => s.id === active) ?? sections[0];
  const q = query.trim().toLowerCase();

  const counts = useMemo(
    () =>
      Object.fromEntries(
        sections.map((s) => [
          s.id,
          q ? s.entries.filter((e) => [e.id, e.title, e.group, e.body, ...e.tags].join(" ").toLowerCase().includes(q)).length : s.entries.length,
        ])
      ),
    [sections, q]
  );

  const entries = section.entries.filter((e) => !q || [e.id, e.title, e.group, e.body, ...e.tags].join(" ").toLowerCase().includes(q));
  const groups = [...new Set(entries.map((e) => e.group))];

  return (
    <div className="flex flex-col gap-5">
      <input
        type="search"
        aria-label="Search knowledge"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search rules, patterns, questions, capabilities… e.g. WCAG, destructive, mobile"
        className={inputClass}
      />
      <div role="tablist" aria-label="Knowledge sections" className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <button
            key={s.id}
            role="tab"
            type="button"
            aria-selected={s.id === section.id}
            onClick={() => setActive(s.id)}
            className={`rounded-full px-3 py-1.5 text-sm ring-1 transition-colors ${
              s.id === section.id
                ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 dark:ring-zinc-50"
                : "text-zinc-700 ring-zinc-200 hover:bg-zinc-100 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800"
            }`}
          >
            {s.label} <span className="opacity-60">{counts[s.id]}</span>
          </button>
        ))}
      </div>

      <section role="tabpanel" aria-label={section.label} className="flex flex-col gap-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {section.description} <span className="text-zinc-400">· version {section.version}</span>
        </p>
        {entries.length === 0 && <p className="text-sm text-zinc-500">Nothing matches &ldquo;{query}&rdquo; here.</p>}
        {groups.map((g) => (
          <div key={g} className="flex flex-col gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">{g}</h2>
            <ul className="flex flex-col gap-2">
              {entries
                .filter((e) => e.group === g)
                .map((e) => (
                  <li key={e.id} className={`${card} p-0`}>
                    <details>
                      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 p-4">
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">{e.title}</span>
                        <code className="text-xs text-zinc-400">{e.id}</code>
                        <span className="flex flex-wrap gap-1">
                          {e.tags.map((t) => (
                            <span key={t} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              {t}
                            </span>
                          ))}
                        </span>
                      </summary>
                      <pre className="overflow-x-auto whitespace-pre-wrap border-t border-zinc-100 p-4 font-mono text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
                        {e.body}
                      </pre>
                    </details>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
