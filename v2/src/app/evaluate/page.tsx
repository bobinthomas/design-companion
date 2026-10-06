"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CompareTable, EVALUATION_QUESTION_COUNT, EvaluationReport, RunMeta } from "@/components/evaluate/EvaluationReport";
import { requestEvaluation } from "@/lib/client/api";
import { card, humanize, inputClass, primaryButton, secondaryButton, sectionTitle } from "@/lib/client/format";
import { decisionsChangedSince, sessionLabel, withEvaluation, type AnalysisSession } from "@/lib/session/session";
import { loadSessions, saveSession } from "@/lib/session/storage";

interface Draft {
  title: string;
  description: string;
}

const EMPTY: Draft = { title: "", description: "" };
const MAX_SUBJECTS = 3;

/**
 * PRD §27 UX Evaluate for a designer's own UI or spec, described in words.
 * It is judged against the decisions of a saved analysis, so "good" means
 * good for that problem, not good in general.
 */
export default function EvaluatePage() {
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [drafts, setDrafts] = useState<Draft[]>([{ ...EMPTY }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  useEffect(() => {
    const decided = loadSessions().filter((s) => s.outcome && s.results);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount
    setSessions(decided);
    setSessionId(decided[0]?.id ?? "");
  }, []);

  const session = sessions.find((s) => s.id === sessionId);
  const runs = session?.evaluations.filter((r) => r.subjects.every((s) => s.kind === "description")) ?? [];
  const run = runs.find((r) => r.id === selectedRun) ?? runs[0];
  const valid = drafts.every((d) => d.title.trim() && d.description.trim().length >= 20);

  async function evaluate() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const subjects = drafts.map((d) => ({ kind: "description" as const, title: d.title.trim(), description: d.description.trim() }));
      const next = withEvaluation(session, await requestEvaluation(session, subjects));
      saveSession(next);
      setSessions((all) => all.map((s) => (s.id === next.id ? next : s)));
      setSelectedRun(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">UX Evaluate</h1>
        <p className="max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
          Describe a UI or spec and check it against the task, UX rules, accessibility and your design system. It&apos;s judged
          against a saved analysis, so the score means &ldquo;good for this problem&rdquo;, not good in general.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}

      {sessions.length === 0 ? (
        <section className={`${card} flex flex-col items-start gap-3 text-sm`}>
          <p className="text-zinc-700 dark:text-zinc-300">
            Evaluation needs decisions to judge against. Run an analysis first; it&apos;s saved in this browser.
          </p>
          <Link href="/analyze" className={primaryButton}>
            Go to UX Analyze
          </Link>
        </section>
      ) : (
        <form
          className={`${card} flex flex-col gap-4`}
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) evaluate();
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className={sectionTitle}>Judge against</span>
            <select
              value={sessionId}
              onChange={(e) => {
                setSessionId(e.target.value);
                setSelectedRun(null);
              }}
              className={inputClass}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {sessionLabel(s)} · {s.outcome!.decisions.length} decisions
                </option>
              ))}
            </select>
          </label>
          {session?.outcome && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {session.outcome.decisions.map((d) => `${d.label}: ${humanize(d.result.choice).toLowerCase()}`).join(" · ")}
            </p>
          )}

          {drafts.map((d, i) => (
            <fieldset key={i} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {drafts.length > 1 ? `Solution ${i + 1}` : "Your solution"}
              </legend>
              <input
                aria-label={`Solution ${i + 1} name`}
                value={d.title}
                maxLength={80}
                onChange={(e) => setDrafts((all) => all.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                placeholder="Name, e.g. Card inbox"
                className={inputClass}
              />
              <textarea
                aria-label={`Solution ${i + 1} description`}
                value={d.description}
                maxLength={6000}
                rows={5}
                onChange={(e) => setDrafts((all) => all.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                placeholder="Describe the screen top to bottom: regions, components, actions, and what users see while loading, when empty and on errors."
                className={inputClass}
              />
              {drafts.length > 1 && (
                <button
                  type="button"
                  className={`${secondaryButton} self-start`}
                  onClick={() => setDrafts((all) => all.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              )}
            </fieldset>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy || !valid} className={primaryButton}>
              {busy ? "Evaluating…" : drafts.length > 1 ? "Evaluate and compare" : "Evaluate"}
            </button>
            {drafts.length < MAX_SUBJECTS && (
              <button type="button" className={secondaryButton} onClick={() => setDrafts((all) => [...all, { ...EMPTY }])}>
                Add a solution to compare
              </button>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {drafts.length * EVALUATION_QUESTION_COUNT} questions in one decision-model request.
            </p>
          </div>
        </form>
      )}

      {session && run && (
        <section aria-labelledby="results-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="results-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Results
            </h2>
            {runs.length > 1 && (
              <select
                aria-label="Earlier evaluations"
                value={run.id}
                onChange={(e) => setSelectedRun(e.target.value)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {runs.map((r, i) => (
                  <option key={r.id} value={r.id}>
                    {i === 0 ? "Latest" : new Date(r.evaluatedAt).toLocaleString()} · {r.subjects.map((s) => s.label).join(", ")}
                  </option>
                ))}
              </select>
            )}
          </div>
          <RunMeta run={run} stale={decisionsChangedSince(session, run.basedOn)} />
          {run.evaluations.length > 1 && <CompareTable run={run} />}
          <div className={`grid gap-4 ${run.evaluations.length > 1 ? "lg:grid-cols-2" : ""}`}>
            {run.evaluations.map((e) => (
              <EvaluationReport key={e.subjectId} evaluation={e} label={run.subjects.find((s) => s.id === e.subjectId)?.label ?? e.subjectId} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
