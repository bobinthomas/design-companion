import Link from "next/link";
import { NAV_ITEMS } from "@/lib/nav";

const PIPELINE = [
  { step: "Understand", owner: "LLM" },
  { step: "Decide", owner: "UX rules" },
  { step: "Constrain", owner: "Design system" },
  { step: "Generate", owner: "LLM" },
  { step: "Validate", owner: "Evaluator" },
  { step: "Direct", owner: "You" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-14">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          AI that reasons about UX before it generates it.
        </h1>
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
          Design Companion V2 turns your requirement into a structured UX intent, makes
          rule-backed decisions you can inspect and override, and only then uses AI to explore
          solutions inside that design space.
        </p>
      </section>

      <ol className="flex flex-wrap gap-2 text-sm" aria-label="How V2 works">
        {PIPELINE.map((p, i) => (
          <li
            key={p.step}
            className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <span className="text-xs text-zinc-400">{i + 1}</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-50">{p.step}</span>
            <span className="text-zinc-500 dark:text-zinc-400">· {p.owner}</span>
          </li>
        ))}
      </ol>

      <section className="grid gap-4 sm:grid-cols-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-violet-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-700"
          >
            <span className="font-medium text-zinc-900 group-hover:text-violet-700 dark:text-zinc-50 dark:group-hover:text-violet-300">
              {item.label} →
            </span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">{item.description}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
