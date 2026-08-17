"use client";

import { useState } from "react";
import { InputPanel } from "@/components/InputPanel";
import { RefineBar } from "@/components/RefineBar";
import { LayoutOutput } from "@/components/LayoutOutput";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Badge } from "@/components/Badge";
import type { LayoutOutput as LayoutOutputData } from "@/lib/types";

export default function LayoutModePage() {
  const [input, setInput] = useState("");
  const [refinement, setRefinement] = useState("");
  const [output, setOutput] = useState<LayoutOutputData | null>(null);
  const [source, setSource] = useState<"claude" | "mock" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runGenerate(refinementInstruction?: string) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          priorOutput: refinementInstruction ? output : undefined,
          refinementInstruction,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "Something went wrong. Try again in a moment.");
      }
      setOutput(body.data as LayoutOutputData);
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
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Layout Brainstorm</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Describe a screen, flow, or feature — get 2–3 structured, genuinely distinct directions.
        </p>
      </div>

      <InputPanel
        value={input}
        onChange={setInput}
        onSubmit={() => runGenerate()}
        isLoading={isLoading}
        placeholder="Describe the screen or flow…"
        submitLabel="Brainstorm layouts"
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
              <Badge>Demo data — add ANTHROPIC_API_KEY for live generation</Badge>
            ) : null}
          </div>
          <LayoutOutput output={output} />
          <RefineBar
            value={refinement}
            onChange={setRefinement}
            onSubmit={() => runGenerate(refinement)}
            isLoading={isLoading}
          />
        </div>
      ) : (
        <EmptyState tip='Try: "A settings screen for managing notification preferences, mobile-first."' />
      )}
    </main>
  );
}
