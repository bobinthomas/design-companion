"use client";

import { useState } from "react";
import Link from "next/link";
import { InputPanel } from "@/components/InputPanel";
import { RefineBar } from "@/components/RefineBar";
import { FeedbackOutput } from "@/components/FeedbackOutput";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Badge } from "@/components/Badge";
import { SAMPLE_FEEDBACK_INPUT } from "@/lib/mocks/feedback";
import { loadSettings } from "@/lib/clientSettings";
import { PROVIDER_LABELS, type Provider } from "@/lib/providers";
import type { FeedbackOutput as FeedbackOutputData } from "@/lib/types";

export default function FeedbackModePage() {
  const [input, setInput] = useState("");
  const [refinement, setRefinement] = useState("");
  const [output, setOutput] = useState<FeedbackOutputData | null>(null);
  const [source, setSource] = useState<Provider | "mock" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runGenerate(refinementInstruction?: string) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          priorOutput: refinementInstruction ? output : undefined,
          refinementInstruction,
          clientConfig: loadSettings() ?? undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "Something went wrong. Try again in a moment.");
      }
      setOutput(body.data as FeedbackOutputData);
      setSource(body.source);
      setRefinement("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Feedback Summary</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Turn raw feedback into clear themes and priorities.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInput(SAMPLE_FEEDBACK_INPUT)}
          className="shrink-0 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-white dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          Load sample feedback
        </button>
      </div>

      <InputPanel
        value={input}
        onChange={setInput}
        onSubmit={() => runGenerate()}
        isLoading={isLoading}
        placeholder="Paste interview notes, survey responses, support tickets, or usability test observations…"
        submitLabel="Summarize feedback"
      />

      {error ? (
        <ErrorState message={error} onRetry={() => runGenerate()} />
      ) : isLoading ? (
        <LoadingState />
      ) : output ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Here&rsquo;s a starting point. Refine it with your team.
            </span>
            {source === "mock" ? (
              <Link href="/settings">
                <Badge>Demo data — add your key in Settings for live generation</Badge>
              </Link>
            ) : source ? (
              <Badge tone="accent">Live · {PROVIDER_LABELS[source]}</Badge>
            ) : null}
          </div>
          <FeedbackOutput output={output} />
          <RefineBar
            value={refinement}
            onChange={setRefinement}
            onSubmit={() => runGenerate(refinement)}
            isLoading={isLoading}
          />
        </div>
      ) : (
        <EmptyState tip='Paste a batch of raw feedback, or click "Load sample feedback" to see it in action.' />
      )}
    </main>
  );
}
