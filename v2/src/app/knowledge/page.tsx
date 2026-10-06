import type { Metadata } from "next";
import { KnowledgeBrowser } from "@/components/knowledge/KnowledgeBrowser";
import { knowledgeSections } from "@/lib/knowledge/browse";
import { extraKnowledgeSections } from "@/lib/knowledge/extra-sections";

export const metadata: Metadata = { title: "Knowledge · Design Companion V2" };

/**
 * Every rule, pattern, question and capability every decision is built
 * from — the same knowledge the pipeline runs on, rendered at build time.
 */
export default function KnowledgePage() {
  const sections = knowledgeSections(extraKnowledgeSections());
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Knowledge</h1>
        <p className="max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
          The versioned UX knowledge every decision, layout and evaluation is built from. Nothing here lives in a prompt: it&apos;s
          JSON in <code>knowledge/</code>, validated at build time, and every result records the versions it used.
        </p>
      </header>
      <KnowledgeBrowser sections={sections} />
    </main>
  );
}
