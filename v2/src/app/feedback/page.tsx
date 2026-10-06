"use client";

import { useEffect, useState } from "react";
import { credentials, postJson } from "@/lib/client/api";
import { PROVIDER_LABELS, card, humanize, inputClass, pct, primaryButton, secondaryButton, sectionTitle } from "@/lib/client/format";
import { sessionLabel, type AnalysisSession } from "@/lib/session/session";
import { loadSessions } from "@/lib/session/storage";
import { deleteFeedbackRun, loadFeedbackRuns, saveFeedbackRun } from "@/lib/ux/feedback/storage";
import type { FeedbackIssue, FeedbackRun } from "@/lib/schemas";

const SAMPLE = `Interview notes, managers:
- "I can't find the export button. I need it every day for finance and it's buried in a menu."
- Couldn't find where to change the approval limit.
- "I rejected the wrong report by accident and it was deleted, I had to start over."
- The status colours are confusing, I didn't understand what amber means.
- Approving one by one is tedious, I have 200 a week and it takes forever.
- I love how fast the search is.
- After I click approve nothing happened, did it work? I'm worried it didn't go through.`;

const PRIORITY_STYLES: Record<FeedbackIssue["priority"], string> = {
  P0: "bg-rose-600 text-white",
  P1: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  P2: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  P3: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const SEVERITY_LABELS = ["Cosmetic", "Minor", "Major", "Blocking"];

/** PRD §25 Feedback Summary V2: cluster → judge each issue → rule-backed recommended changes. */
export default function FeedbackPage() {
  const [text, setText] = useState("");
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [contextId, setContextId] = useState("");
  const [runs, setRuns] = useState<FeedbackRun[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount
    setRuns(loadFeedbackRuns());
    setSessions(loadSessions().filter((s) => s.state));
  }, []);

  const run = runs.find((r) => r.id === selected) ?? runs[0];

  async function summarize() {
    setBusy(true);
    setError(null);
    try {
      const session = sessions.find((s) => s.id === contextId);
      const r = await postJson<FeedbackRun>("/api/ux/feedback", {
        ...credentials(),
        feedback: text,
        ...(session?.state ? { context: { sessionId: session.id, state: session.state } } : {}),
      });
      saveFeedbackRun(r);
      setRuns(loadFeedbackRuns());
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Feedback Summary</h1>
        <p className="max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
          Paste interview notes, survey answers or support tickets. Comments are grouped into UX issues with real quotes, the
          decision model judges each issue (does it block the task? is it frequent? is it about finding things?), and versioned
          rules turn those judgments into prioritised changes.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}

      <form
        className={`${card} flex flex-col gap-3`}
        onSubmit={(e) => {
          e.preventDefault();
          summarize();
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className={sectionTitle}>Raw feedback</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            maxLength={20000}
            placeholder="One comment per line works best. Quotes are kept verbatim."
            className={inputClass}
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          {sessions.length > 0 && (
            <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm">
              <span className={sectionTitle}>Read against (optional)</span>
              <select value={contextId} onChange={(e) => setContextId(e.target.value)} className={inputClass}>
                <option value="">No analysis</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {sessionLabel(s)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="submit" disabled={busy || text.trim().length < 20} className={primaryButton}>
            {busy ? "Summarizing…" : "Summarize"}
          </button>
          <button type="button" className={secondaryButton} onClick={() => setText(SAMPLE)}>
            Use sample notes
          </button>
        </div>
      </form>

      {run && (
        <section aria-labelledby="summary-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="summary-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {run.issues.length} issues{run.context ? ` · ${run.context.product}` : ""}
            </h2>
            <div className="flex flex-wrap gap-2">
              {runs.length > 1 && (
                <select
                  aria-label="Earlier summaries"
                  value={run.id}
                  onChange={(e) => setSelected(e.target.value)}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {runs.map((r, i) => (
                    <option key={r.id} value={r.id}>
                      {i === 0 ? "Latest" : new Date(r.createdAt).toLocaleString()} · {r.issues.length} issues
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  deleteFeedbackRun(run.id);
                  setRuns(loadFeedbackRuns());
                  setSelected(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            <p>
              Grouped by {run.source === "draft" ? "keywords (no LLM)" : run.model} · judged by{" "}
              {PROVIDER_LABELS[run.decisionModel.provider] ?? run.decisionModel.provider} ({run.decisionModel.model}) · feedback rules{" "}
              {run.versions.feedbackRules}
            </p>
            {run.notices.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>

          <ul className="flex flex-col gap-3">
            {run.issues.map((issue) => (
              <li key={issue.id} className={`${card} flex flex-col gap-3`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 rounded px-1.5 py-0.5 text-xs font-semibold ${PRIORITY_STYLES[issue.priority]}`}>{issue.priority}</span>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{issue.title}</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{issue.summary}</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {humanize(issue.kind)} · {SEVERITY_LABELS[Math.round(issue.severity)]} ({issue.severity.toFixed(1)}/3) · {issue.mentions} quote
                    {issue.mentions === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Why {issue.priority}: {issue.priorityReason}</p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className={sectionTitle}>Evidence</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {issue.evidence.map((q) => (
                        <li key={q}>
                          <blockquote className="border-l-2 border-zinc-200 pl-2 text-sm italic text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                            {q}
                          </blockquote>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className={sectionTitle}>Recommended changes</p>
                    {issue.recommendations.length === 0 ? (
                      <p className="mt-1 text-sm text-zinc-500">No rule applies. Look at the evidence directly.</p>
                    ) : (
                      <ul className="mt-1 flex flex-col gap-2">
                        {issue.recommendations.map((r) => (
                          <li key={r.ruleId} className="text-sm">
                            <p className="text-zinc-900 dark:text-zinc-50">{r.text}</p>
                            <p className="text-xs text-zinc-500">
                              <span className="font-mono text-violet-700 dark:text-violet-300">{r.code}</span>
                              {r.capabilities.length > 0 && ` · needs ${r.capabilities.map((c) => humanize(c).toLowerCase()).join(", ")}`}
                              {r.relatedRules.length > 0 && ` · see ${r.relatedRules.join(", ")}`}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <details className="text-sm">
                  <summary className="cursor-pointer text-zinc-700 dark:text-zinc-300">Judgments behind this</summary>
                  <ul className="mt-2 flex flex-col gap-1">
                    {issue.judgments.map((j) => (
                      <li key={j.questionId} className="flex justify-between gap-3 text-zinc-600 dark:text-zinc-400">
                        <span>
                          {j.type === "noul" ? (Number(j.value) >= 0.7 ? "✓" : Number(j.value) <= 0.3 ? "✗" : "?") : "≈"} {j.question}
                        </span>
                        <span className="shrink-0 text-xs">{j.type === "noul" ? pct(Number(j.value)) : `level ${Number(j.value).toFixed(1)}`}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>

          {(run.positives.length > 0 || run.nextQuestions.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {run.positives.length > 0 && (
                <section className={card}>
                  <p className={sectionTitle}>What&apos;s working</p>
                  {run.positives.map((p) => (
                    <div key={p.title} className="mt-2">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{p.title}</p>
                      {p.evidence.map((q) => (
                        <blockquote key={q} className="mt-1 border-l-2 border-emerald-300 pl-2 text-sm italic text-zinc-700 dark:text-zinc-300">
                          {q}
                        </blockquote>
                      ))}
                    </div>
                  ))}
                </section>
              )}
              {run.nextQuestions.length > 0 && (
                <section className={card}>
                  <p className={sectionTitle}>Worth researching next</p>
                  <ul className="mt-2 list-disc pl-4 text-sm text-zinc-700 dark:text-zinc-300">
                    {run.nextQuestions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
