"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { postJson, credentials } from "@/lib/client/api";
import { PROVIDER_LABELS, card, humanize, inputClass, pct, primaryButton, secondaryButton, sectionTitle } from "@/lib/client/format";
import { activeDesignSystem } from "@/lib/design-system/client-storage";
import { decisionsChangedSince, sessionLabel, withCopy, type AnalysisSession } from "@/lib/session/session";
import { loadSessions, saveSession } from "@/lib/session/storage";
import type { CopyRun, CopyTarget } from "@/lib/schemas";

const TONES = ["clear, calm and concise", "friendly and warm", "formal and precise", "playful but respectful"];

const INTERACTION_LABELS: Record<CopyTarget["interaction"], string> = {
  "confirm-dialog": "Confirmation dialog",
  "undo-toast": "Undo in a toast",
  "inline-confirm": "Inline confirmation",
  none: "No protection needed",
};

function requestCopy(session: AnalysisSession, tone: string): Promise<CopyRun> {
  const ds = activeDesignSystem();
  return postJson("/api/ux/copy", {
    ...credentials(),
    state: session.state,
    results: session.results,
    overrides: session.overrides,
    gapSettlements: session.gapSettlements,
    ...(ds ? { designSystem: ds } : {}),
    tone,
  });
}

/** PRD §24 UI Copy V2: policy decides what each action needs; the LLM writes the words; code checks them. */
export default function CopyPage() {
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [tone, setTone] = useState(TONES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const decided = loadSessions().filter((s) => s.outcome && s.results);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount
    setSessions(decided);
    setSessionId(decided[0]?.id ?? "");
  }, []);

  const session = sessions.find((s) => s.id === sessionId);
  const run = session?.copy.find((r) => r.id === selectedRun) ?? session?.copy[0];

  async function generate() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const next = withCopy(session, await requestCopy(session, tone));
      saveSession(next);
      setSessions((all) => all.map((s) => (s.id === next.id ? next : s)));
      setSelectedRun(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      // Clipboard unavailable; the text is still selectable.
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">UI Copy</h1>
        <p className="max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
          Microcopy for the actions and states of a saved analysis. The decision model judges each action&apos;s risk, UX policy
          decides what copy it needs (a confirmation, an undo, a count), and only then are the words written and checked
          against the copy guidelines.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}

      {sessions.length === 0 ? (
        <section className={`${card} flex flex-col items-start gap-3 text-sm`}>
          <p className="text-zinc-700 dark:text-zinc-300">Copy is written for an analysed problem. Run an analysis first.</p>
          <Link href="/analyze" className={primaryButton}>
            Go to UX Analyze
          </Link>
        </section>
      ) : (
        <form
          className={`${card} flex flex-col gap-3 sm:flex-row sm:items-end`}
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className={sectionTitle}>For</span>
            <select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setSelectedRun(null); }} className={inputClass}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {sessionLabel(s)} · {s.state?.actions.length ?? 0} actions
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className={sectionTitle}>Tone</span>
            <input list="tones" value={tone} maxLength={120} onChange={(e) => setTone(e.target.value)} className={inputClass} />
            <datalist id="tones">
              {TONES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <button type="submit" disabled={busy || !tone.trim()} className={primaryButton}>
            {busy ? "Writing…" : run ? "Write again" : "Write copy"}
          </button>
        </form>
      )}

      {session && run && (
        <section aria-labelledby="copy-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="copy-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Copy <span className="text-sm font-normal text-zinc-500">· {run.tone}</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {session.copy.length > 1 && (
                <select
                  aria-label="Earlier copy runs"
                  value={run.id}
                  onChange={(e) => setSelectedRun(e.target.value)}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {session.copy.map((r, i) => (
                    <option key={r.id} value={r.id}>
                      {i === 0 ? "Latest" : new Date(r.generatedAt).toLocaleString()} · {r.tone}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  const blob = new Blob([JSON.stringify(Object.fromEntries(Object.entries(run.copy).map(([k, v]) => [k, v.text])), null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "copy-strings.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download strings (JSON)
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            <p>
              Risk judged by {PROVIDER_LABELS[run.decisionModel.provider] ?? run.decisionModel.provider} ({run.decisionModel.model}) · words by{" "}
              {run.source === "draft" ? "templates (no LLM)" : run.model} · guidelines {run.versions.copyGuidelines}
            </p>
            {run.notices.map((n) => (
              <p key={n}>{n}</p>
            ))}
            {run.toneNotes && <p>Tone: {run.toneNotes}</p>}
            {decisionsChangedSince(session, run.basedOn) && (
              <p role="status" className="text-amber-800 dark:text-amber-300">
                ⚠ The decisions have changed since this copy was written. Write it again to reflect them.
              </p>
            )}
            <p>
              {run.lint.filter((l) => l.severity === "error").length} guideline errors · {run.lint.filter((l) => l.severity === "warning").length}{" "}
              warnings
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {run.targets.map((t) => (
              <article key={t.id} className={`${card} flex flex-col gap-3`} aria-labelledby={`copy-${t.id}`}>
                <header className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 id={`copy-${t.id}`} className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {t.kind === "screen" ? `Screen: ${t.name}` : t.name}
                    </h3>
                    {t.kind === "action" && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {INTERACTION_LABELS[t.interaction]}
                      </span>
                    )}
                  </div>
                  {t.risk && (
                    <p className="flex flex-wrap gap-1 text-xs">
                      {(
                        [
                          ["destructive", t.risk.destructive, "Destructive"],
                          ["reversible", t.risk.reversible, "Undoable"],
                          ["notifiesOthers", t.risk.notifiesOthers, "Affects others"],
                          ["costsMoney", t.risk.costsMoney, "Costs money"],
                        ] as const
                      ).map(([key, on, label]) => {
                        const ev = t.risk!.evidence.find((e) => e.questionId.endsWith(key === "notifiesOthers" ? "notifies-others" : key === "costsMoney" ? "costs-money" : key));
                        return (
                          <span
                            key={key}
                            title={ev ? `${ev.question} ${pct(Number(ev.value))}` : undefined}
                            className={`rounded px-1.5 py-0.5 ${on ? "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300" : "bg-zinc-100 text-zinc-400 line-through dark:bg-zinc-800"}`}
                          >
                            {label}
                          </span>
                        );
                      })}
                      {t.bulk && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">Bulk</span>}
                    </p>
                  )}
                  <ul className="list-disc pl-4 text-xs text-zinc-500 dark:text-zinc-400">
                    {t.requirements.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </header>
                <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                  {run.slots
                    .filter((s) => s.target === t.id)
                    .map((s) => {
                      const entry = run.copy[s.id];
                      const issues = run.lint.filter((l) => l.slotId === s.id);
                      return (
                        <li key={s.id} className="flex flex-col gap-1 py-2 text-sm">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs text-zinc-500">{s.label}</span>
                            <span className={`text-[11px] tabular-nums ${entry && entry.text.length > s.maxChars ? "text-rose-600" : "text-zinc-400"}`}>
                              {entry?.text.length ?? 0}/{s.maxChars}
                            </span>
                          </div>
                          {entry && (
                            <button
                              type="button"
                              onClick={() => copyText(s.id, entry.text)}
                              className="text-left font-medium text-zinc-900 hover:text-violet-700 dark:text-zinc-50 dark:hover:text-violet-300"
                              title="Copy to clipboard"
                            >
                              {entry.text} {copied === s.id && <span className="text-xs font-normal text-emerald-600">copied</span>}
                            </button>
                          )}
                          {entry && entry.alternatives.length > 0 && (
                            <p className="text-xs text-zinc-500">or: {entry.alternatives.map((a) => `“${a}”`).join(" · ")}</p>
                          )}
                          {issues.map((l, i) => (
                            <p key={i} className={`text-xs ${l.severity === "error" ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"}`}>
                              {l.severity === "error" ? "✗" : "!"} {humanize(l.code.toLowerCase().replace(/_/g, "-"))}: {l.message}
                            </p>
                          ))}
                        </li>
                      );
                    })}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
