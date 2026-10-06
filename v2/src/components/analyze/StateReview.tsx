"use client";

import { useState } from "react";
import {
  ACCESSIBILITY_LEVELS,
  AUDIENCES,
  DEVICES,
  EXPERTISE,
  FREQUENCIES,
  uxStateSchema,
  type UXState,
} from "@/lib/schemas";
import { card, humanize, inputClass, primaryButton, secondaryButton, sectionTitle } from "@/lib/client/format";

interface Props {
  state: UXState;
  source: { kind: "llm" | "demo" | "edited"; model: string; notices: string[] };
  decided: boolean;
  busy: boolean;
  questionCount: number;
  onChange: (state: UXState) => void;
  onDecide: () => void;
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={inputClass}>
        {options.map((o) => (
          <option key={o} value={o}>
            {humanize(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * PRD §46 step 3: the designer reviews the UX state before any decision is
 * made. Hard constraints are editable in place (policy reads them as
 * facts); everything else via the JSON editor, validated before it's used.
 */
export function StateReview({ state, source, decided, busy, questionCount, onChange, onDecide }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  function startEditing() {
    setDraft(JSON.stringify(state, null, 2));
    setDraftError(null);
    setEditing(true);
  }

  function saveDraft() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setDraftError("That isn't valid JSON.");
      return;
    }
    const result = uxStateSchema.safeParse(parsed);
    if (!result.success) {
      const issue = result.error.issues[0];
      setDraftError(`${issue.path.join(".") || "state"}: ${issue.message}`);
      return;
    }
    onChange(result.data);
    setEditing(false);
  }

  const set = <K extends keyof UXState>(key: K, value: UXState[K]) => onChange({ ...state, [key]: value });

  return (
    <section className={`${card} flex flex-col gap-5`} aria-labelledby="state-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="state-title" className="font-medium text-zinc-900 dark:text-zinc-50">
            UX state
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {source.kind === "llm" && `Described by ${source.model}. It describes the problem; it doesn't judge it.`}
            {source.kind === "demo" && "Demo state (no LLM key configured)."}
            {source.kind === "edited" && "Edited by you."}
          </p>
        </div>
        {!editing && (
          <button type="button" onClick={startEditing} className={secondaryButton}>
            Edit as JSON
          </button>
        )}
      </div>

      {source.notices.map((n) => (
        <p key={n} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {n}
        </p>
      ))}

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={22}
            spellCheck={false}
            aria-label="UX state JSON"
            className={`${inputClass} font-mono text-xs`}
          />
          {draftError && (
            <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
              {draftError}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={saveDraft} className={primaryButton}>
              Save state
            </button>
            <button type="button" onClick={() => setEditing(false)} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className={sectionTitle}>Product</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{state.product}</dd>
              <dd className="text-zinc-600 dark:text-zinc-400">{state.summary}</dd>
            </div>
            <div>
              <dt className={sectionTitle}>Users</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{state.user.role}</dd>
              {state.user.description && <dd className="text-zinc-600 dark:text-zinc-400">{state.user.description}</dd>}
            </div>
            <div>
              <dt className={sectionTitle}>Goal</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{state.goal.primary}</dd>
              {state.goal.secondary.length > 0 && (
                <dd className="text-zinc-600 dark:text-zinc-400">{state.goal.secondary.join(" · ")}</dd>
              )}
            </div>
            <div>
              <dt className={sectionTitle}>Tasks</dt>
              <dd className="mt-1">
                <ul className="flex flex-col gap-0.5 text-zinc-700 dark:text-zinc-300">
                  {state.tasks.map((t) => (
                    <li key={t.name}>
                      {t.kind === "primary" ? <strong className="font-medium">{t.name}</strong> : t.name}
                      <span className="text-zinc-400"> · {t.frequency}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt className={sectionTitle}>Data</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{state.data.entity}</dd>
              <dd className="text-zinc-600 dark:text-zinc-400">{state.context.dataVolume || state.data.description}</dd>
            </div>
            <div>
              <dt className={sectionTitle}>Actions</dt>
              <dd className="mt-1 text-zinc-700 dark:text-zinc-300">
                {state.actions.length > 0 ? state.actions.map((a) => a.name).join(" · ") : "—"}
              </dd>
            </div>
          </dl>

          <fieldset className="flex flex-col gap-3">
            <legend className={sectionTitle}>Hard constraints (policy reads these directly)</legend>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Select label="Device" value={state.context.device} options={DEVICES} onChange={(device) => set("context", { ...state.context, device })} />
              <Select label="Frequency" value={state.context.frequency} options={FREQUENCIES} onChange={(frequency) => set("context", { ...state.context, frequency })} />
              <Select label="Expertise" value={state.user.expertise} options={EXPERTISE} onChange={(expertise) => set("user", { ...state.user, expertise })} />
              <Select label="Audience" value={state.user.audience} options={AUDIENCES} onChange={(audience) => set("user", { ...state.user, audience })} />
              <Select label="Accessibility" value={state.constraints.accessibility} options={ACCESSIBILITY_LEVELS} onChange={(accessibility) => set("constraints", { ...state.constraints, accessibility })} />
            </div>
          </fieldset>

          {state.ambiguities.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className={sectionTitle}>Assumptions to confirm ({state.ambiguities.length})</h3>
              <ul className="flex flex-col gap-2">
                {state.ambiguities.map((a, i) => (
                  <li key={`${a.field}-${i}`} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                    <div>
                      <p className="text-zinc-900 dark:text-zinc-50">{a.question}</p>
                      <p className="text-zinc-500 dark:text-zinc-400">
                        Assumed: {a.assumption} <span className="text-zinc-400">({a.field})</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-violet-700 underline underline-offset-2 dark:text-violet-300"
                      onClick={() => set("ambiguities", state.ambiguities.filter((_, j) => j !== i))}
                    >
                      Assumption is right
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {!editing && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onDecide} disabled={busy} className={primaryButton}>
            {busy ? "Asking the decision model…" : decided ? "Re-run decisions with fresh judgments" : "Make UX decisions"}
          </button>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Sends this state to the decision model as {questionCount} atomic questions.
          </span>
        </div>
      )}
    </section>
  );
}
