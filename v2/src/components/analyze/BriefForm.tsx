"use client";

import { useState } from "react";
import { EXPENSE_DASHBOARD_BRIEF } from "@/lib/ux/fixtures/expense-dashboard";
import { SUBSCRIPTION_SIGNUP_BRIEF } from "@/lib/ux/fixtures/subscription-signup";
import { card, inputClass, primaryButton } from "@/lib/client/format";

const EXAMPLES = [EXPENSE_DASHBOARD_BRIEF, SUBSCRIPTION_SIGNUP_BRIEF];

export function BriefForm({
  initial,
  busy,
  onSubmit,
}: {
  initial?: string;
  busy: boolean;
  onSubmit: (brief: string) => void;
}) {
  const [brief, setBrief] = useState(initial ?? "");
  const tooShort = brief.trim().length < 12;

  return (
    <form
      className={`${card} flex flex-col gap-3`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!tooShort) onSubmit(brief.trim());
      }}
    >
      <label htmlFor="brief" className="font-medium text-zinc-900 dark:text-zinc-50">
        Describe the UX problem
      </label>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Who it&apos;s for, what they need to get done, and anything you already know about their
        context. You&apos;ll review the structured description before any decisions are made.
      </p>
      <textarea
        id="brief"
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        rows={4}
        placeholder="e.g. Managers need to review and approve their team's expenses every day…"
        className={inputClass}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>Try:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setBrief(example)}
            className="rounded-full border border-zinc-200 px-2.5 py-1 text-left hover:border-violet-300 hover:text-violet-700 dark:border-zinc-700 dark:hover:border-violet-700 dark:hover:text-violet-300"
          >
            {example}
          </button>
        ))}
      </div>
      <div>
        <button type="submit" disabled={busy || tooShort} className={primaryButton}>
          {busy ? "Describing the problem…" : "Describe the problem"}
        </button>
      </div>
    </form>
  );
}
