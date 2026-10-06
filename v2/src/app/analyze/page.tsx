"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BriefForm } from "@/components/analyze/BriefForm";
import { DecisionCard } from "@/components/analyze/DecisionCard";
import { DecisionInspector } from "@/components/analyze/DecisionInspector";
import { LayoutDirections } from "@/components/analyze/LayoutDirections";
import { QuestionsTable } from "@/components/analyze/QuestionsTable";
import { SolutionPanel } from "@/components/analyze/SolutionPanel";
import { StateReview } from "@/components/analyze/StateReview";
import { requestAnalysis, requestEvaluation, requestLayouts, requestState } from "@/lib/client/api";
import { PROVIDER_LABELS, card, secondaryButton } from "@/lib/client/format";
import {
  acceptDecision,
  addOverride,
  createSession,
  decisionsChangedSince,
  isAccepted,
  removeOverride,
  reopenGap,
  sessionTitle,
  settleGap,
  withAnalysis,
  withEvaluation,
  withLayouts,
  withState,
  type AnalysisSession,
} from "@/lib/session/session";
import { deleteSession, downloadSession, loadSessions, saveSession } from "@/lib/session/storage";
import type { DecisionQuestion, DecisionType, GapResolutionKind, LayoutBrainstorm } from "@/lib/schemas";
import analysisQuestions from "@knowledge/questions/analysis.json";

// The question set is static knowledge; import the file directly rather than
// the validating loader, which would pull every knowledge file into the page.
const QUESTIONS = analysisQuestions as unknown as DecisionQuestion[];

export default function AnalyzePage() {
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [session, setSession] = useState<AnalysisSession | null>(null);
  const [busy, setBusy] = useState<null | "state" | "decide" | "policy" | "layouts" | "evaluate">(null);
  const [error, setError] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<DecisionType | null>(null);

  useEffect(() => {
    const stored = loadSessions();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount
    setSessions(stored);
  }, []);

  function commit(next: AnalysisSession) {
    setSession(next);
    saveSession(next);
    setSessions(loadSessions());
  }

  async function run<T>(kind: NonNullable<typeof busy>, task: () => Promise<T>): Promise<T | undefined> {
    setBusy(kind);
    setError(null);
    try {
      return await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again in a moment.");
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  async function describe(brief: string) {
    await run("state", async () => {
      const extraction = await requestState(brief);
      commit(withState(createSession(brief), extraction.state, { kind: extraction.source, model: extraction.model, notices: extraction.notices }));
    });
  }

  /** Re-runs policy (or the decision model too, when `fresh`) for an updated session. */
  async function analyze(next: AnalysisSession, fresh: boolean) {
    await run(fresh ? "decide" : "policy", async () => {
      commit(withAnalysis(next, await requestAnalysis(next, fresh)));
    });
  }

  async function brainstorm(current: AnalysisSession, instruction: string) {
    await run("layouts", async () => {
      commit(withLayouts(current, await requestLayouts(current, instruction)));
    });
  }

  async function evaluateDirections(current: AnalysisSession, layoutRun: LayoutBrainstorm) {
    await run("evaluate", async () => {
      const subjects = layoutRun.output.variants.map((variant) => ({ kind: "direction" as const, variant, layoutRunId: layoutRun.id }));
      commit(withEvaluation(current, await requestEvaluation(current, subjects)));
    });
  }

  const outcome = session?.outcome ?? null;
  const inspected = inspecting && outcome ? outcome.decisions.find((d) => d.decision === inspecting) : undefined;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">UX Analyze</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Understand the problem, make defensible UX decisions, and see what your design system can build.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sessions.length > 0 && (
            <select
              aria-label="Previous analyses"
              value={session?.id ?? ""}
              onChange={(e) => {
                setSession(sessions.find((s) => s.id === e.target.value) ?? null);
                setInspecting(null);
              }}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">New analysis</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {sessionTitle(s)}
                </option>
              ))}
            </select>
          )}
          {session && (
            <>
              <button type="button" className={secondaryButton} onClick={() => downloadSession(session)}>
                Export trace
              </button>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  deleteSession(session.id);
                  setSessions(loadSessions());
                  setSession(null);
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}

      {!session?.state && <BriefForm key={session?.id ?? "new"} initial={session?.brief} busy={busy === "state"} onSubmit={describe} />}

      {session?.state && session.stateSource && (
        <StateReview
          state={session.state}
          source={session.stateSource}
          decided={Boolean(outcome)}
          busy={busy === "decide"}
          questionCount={QUESTIONS.length}
          onChange={(state) => commit(withState(session, state, { kind: "edited", model: "designer", notices: [] }))}
          onDecide={() => analyze(session, true)}
        />
      )}

      {session && outcome && session.decisionModel && (
        <>
          <section className={`${card} flex flex-col gap-2 text-sm`} aria-label="Decision model">
            <p className="text-zinc-700 dark:text-zinc-300">
              Decision model: <strong className="font-medium">{PROVIDER_LABELS[session.decisionModel.provider] ?? session.decisionModel.provider}</strong>{" "}
              <span className="text-zinc-400">({session.decisionModel.model})</span>
              {session.decisionModel.provider !== "jev" && (
                <>
                  {" "}·{" "}
                  <Link href="/settings" className="text-violet-700 underline underline-offset-2 dark:text-violet-300">
                    set up Jev
                  </Link>
                </>
              )}
            </p>
            {session.decisionModel.notices.map((n) => (
              <p key={n} className="text-zinc-500 dark:text-zinc-400">
                {n}
              </p>
            ))}
            {outcome.warnings.map((w) => (
              <p key={w} role="alert" className="text-amber-800 dark:text-amber-300">
                ⚠ {w}
              </p>
            ))}
          </section>

          <section aria-labelledby="decisions-title" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 id="decisions-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                UX decisions <span className="text-sm font-normal text-zinc-400">({outcome.decisions.length})</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {session.accepted.length} accepted · {session.overrides.length} overridden
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {outcome.decisions.map((d) => (
                <DecisionCard
                  key={d.id}
                  decision={d}
                  accepted={isAccepted(session, d.decision, d.result.choice)}
                  onAccept={() => commit(acceptDecision(session, d.decision, d.result.choice))}
                  onInspect={() => setInspecting(d.decision)}
                />
              ))}
            </div>
          </section>

          <SolutionPanel
            outcome={outcome}
            busy={busy !== null}
            onSettleGap={(gapId, kind: GapResolutionKind, reason) => analyze(settleGap(session, { gapId, kind, reason }), false)}
            onReopenGap={(gapId) => analyze(reopenGap(session, gapId), false)}
          />

          <LayoutDirections
            key={session.id}
            outcome={outcome}
            runs={session.layouts}
            evaluations={session.evaluations}
            stale={(basedOn) => decisionsChangedSince(session, basedOn)}
            busy={busy === "layouts"}
            evaluating={busy === "evaluate"}
            onGenerate={(instruction) => brainstorm(session, instruction)}
            onEvaluate={(layoutRun) => evaluateDirections(session, layoutRun)}
          />

          {session.results && outcome && <QuestionsTable questions={QUESTIONS} results={session.results} />}
        </>
      )}

      {inspected && session && (
        <DecisionInspector
          key={inspected.id + inspected.result.choice}
          decision={inspected}
          busy={busy !== null}
          onClose={() => setInspecting(null)}
          onOverride={(choice, reason) => analyze(addOverride(session, { decision: inspected.decision, choice, reason }), false)}
          onRemoveOverride={() => analyze(removeOverride(session, inspected.decision), false)}
        />
      )}
    </main>
  );
}
