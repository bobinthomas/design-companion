"use client";

import { useState } from "react";
import Link from "next/link";
import { InputPanel } from "@/components/InputPanel";
import { ToneSelector } from "@/components/ToneSelector";
import { RefineBar } from "@/components/RefineBar";
import { CopyOutput } from "@/components/CopyOutput";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Badge } from "@/components/Badge";
import { loadSettings } from "@/lib/clientSettings";
import { PROVIDER_LABELS, type Provider } from "@/lib/providers";
import type { CopyOutput as CopyOutputData } from "@/lib/types";

export default function CopyModePage() {
  const [input, setInput] = useState("");
  const [tone, setTone] = useState("Professional");
  const [refinement, setRefinement] = useState("");
  const [output, setOutput] = useState<CopyOutputData | null>(null);
  const [source, setSource] = useState<Provider | "mock" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runGenerate(refinementInstruction?: string) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          tone,
          priorOutput: refinementInstruction ? output : undefined,
          refinementInstruction,
          clientConfig: loadSettings() ?? undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "Something went wrong. Try again in a moment.");
      }
      setOutput(body.data as CopyOutputData);
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
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">UI Copy</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          First-draft microcopy that matches your product&rsquo;s voice.
        </p>
      </div>

      <InputPanel
        value={input}
        onChange={setInput}
        onSubmit={() => runGenerate()}
        isLoading={isLoading}
        placeholder="Describe the screen or flow, e.g. “Onboarding flow for a budgeting app, step 1 of 3.”"
        submitLabel="Generate copy"
        extraFields={<ToneSelector value={tone} onChange={setTone} />}
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
          <CopyOutput output={output} />
          <RefineBar
            value={refinement}
            onChange={setRefinement}
            onSubmit={() => runGenerate(refinement)}
            isLoading={isLoading}
          />
        </div>
      ) : (
        <EmptyState tip='Try: "Empty state and error messages for a file upload component."' />
      )}
    </main>
  );
}
