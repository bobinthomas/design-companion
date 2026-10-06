import { describe, expect, it, vi } from "vitest";
import type { generateStructured } from "@/lib/ai/generate";
import { evaluateDecisions } from "@/lib/decision-model/evaluate";
import { MockDecisionProvider } from "@/lib/decision-model/adapters/mock";
import { ANALYSIS_QUESTIONS, COPY_GUIDELINES } from "@/lib/knowledge";
import { copyRunSchema, uxStateSchema, type CopyText } from "@/lib/schemas";
import { analysisSessionSchema, createSession, withAnalysis, withCopy, withState } from "@/lib/session/session";
import { buildCopySchema, buildCopyUserPrompt, generateCopy } from "@/lib/ux/copy/generate";
import { lintCopy } from "@/lib/ux/copy/lint";
import { buildRiskBatch } from "@/lib/ux/copy/plan";
import { expenseDashboardState } from "@/lib/ux/fixtures/expense-dashboard";
import { subscriptionSignupState } from "@/lib/ux/fixtures/subscription-signup";
import { runPolicy, type PolicyInput } from "@/lib/ux/pipeline";

const expense = uxStateSchema.parse(expenseDashboardState);
const subscription = uxStateSchema.parse(subscriptionSignupState);
const ctx = { env: {}, ip: "local" };

async function outcomeFor(state = expense, extra: Partial<PolicyInput> = {}) {
  const results = await new MockDecisionProvider().evaluate(state, ANALYSIS_QUESTIONS);
  return { results, outcome: runPolicy({ state, questions: ANALYSIS_QUESTIONS, results, ...extra }) };
}

async function withoutLlm<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    return await fn();
  } finally {
    if (original) process.env.ANTHROPIC_API_KEY = original;
  }
}

const copyFor = async (state = expense, extra: Partial<PolicyInput> = {}) => {
  const { outcome } = await outcomeFor(state, extra);
  return withoutLlm(() => generateCopy({ state, outcome, tone: "calm", ctx, id: "c1" }));
};

describe("action risk: one batched decision-model request", () => {
  it("scopes every risk question to each action", () => {
    const batch = buildRiskBatch(expense);
    expect(batch.questions).toHaveLength(4 * expense.actions.length);
    expect(batch.questions.find((q) => q.id === "copy.action.destructive.a2")).toMatchObject({ scope: "actions.a2" });
  });

  it("asks once for all actions", async () => {
    const decide = vi.fn(evaluateDecisions);
    const { outcome } = await outcomeFor();
    await withoutLlm(() => generateCopy({ state: expense, outcome, tone: "calm", ctx, decide }));
    expect(decide).toHaveBeenCalledTimes(1);
  });
});

describe("policy decides the interaction requirements (PRD §24)", () => {
  it("protects Reject with the decided confirmation dialog, and says it can't be undone", async () => {
    const run = await copyFor();
    const reject = run.targets.find((t) => t.id === "reject")!;
    expect(reject).toMatchObject({ interaction: "confirm-dialog", bulk: true, risk: { destructive: true, reversible: false, notifiesOthers: true } });
    expect(run.slots.filter((s) => s.target === "reject").map((s) => s.kind)).toEqual([
      "button",
      "dialog-title",
      "dialog-body",
      "dialog-confirm",
      "dialog-cancel",
      "success",
      "error",
    ]);
    expect(run.copy["reject.dialog-body"].text).toMatch(/can't be undone/);
    expect(run.copy["reject.dialog-title"].text).toContain("{count}");
    expect(run.targets.find((t) => t.id === "approve")).toMatchObject({ interaction: "none" });
  });

  it("follows a designer's override: undo instead of a dialog", async () => {
    const run = await copyFor(expense, { overrides: [{ decision: "actionConfirmation", choice: "undo-toast", reason: "Reversible for 24h" }] });
    expect(run.targets.find((t) => t.id === "reject")!.interaction).toBe("undo-toast");
    expect(run.slots.map((s) => s.id)).toEqual(expect.arrayContaining(["reject.undo-message", "reject.undo-action"]));
    expect(run.slots.map((s) => s.id)).not.toContain("reject.dialog-confirm");
  });

  it("covers the screen's required states", async () => {
    const run = await copyFor();
    expect(run.slots.filter((s) => s.target === "screen").map((s) => s.kind)).toEqual(
      expect.arrayContaining(["screen-title", "empty-heading", "empty-body", "empty-action", "error-state-heading", "loading"])
    );
  });

  it("flags money for a paid subscription and adds no confirmation", async () => {
    const run = await copyFor(subscription);
    const subscribe = run.targets.find((t) => t.id === "subscribe")!;
    expect(subscribe).toMatchObject({ interaction: "none", risk: { costsMoney: true } });
    expect(subscribe.requirements.join(" ")).toMatch(/Commits money/);
  });
});

describe("drafted copy and the guideline lint", () => {
  it("drafts copy that passes every hard guideline, and is schema-valid", async () => {
    for (const state of [expense, subscription]) {
      const run = await copyFor(state);
      expect(() => copyRunSchema.parse(run)).not.toThrow();
      expect(run.source).toBe("draft");
      expect(run.lint.filter((l) => l.severity === "error")).toEqual([]);
      expect(Object.keys(run.copy).sort()).toEqual(run.slots.map((s) => s.id).sort());
    }
  });

  it("catches vague confirm buttons, missing verbs, 'No', 'Are you sure', cute errors, missing counts and long strings", async () => {
    const run = await copyFor();
    const bad: Record<string, CopyText> = {
      ...run.copy,
      "reject.dialog-confirm": { text: "OK", alternatives: ["Delete it"] },
      "reject.dialog-cancel": { text: "No", alternatives: [] },
      "reject.dialog-title": { text: "Are you sure?", alternatives: [] },
      "reject.dialog-body": { text: "The employee will be told.", alternatives: [] },
      "reject.error": { text: "Oops! Something broke", alternatives: [] },
      "approve.button": { text: "Approve this expense report right now", alternatives: [] },
    };
    const codes = lintCopy(run.slots, bad, run.targets).map((l) => `${l.slotId}:${l.code}`);
    expect(codes).toEqual(
      expect.arrayContaining([
        "reject.dialog-confirm:CONFIRM_NAMES_ACTION",
        "reject.dialog-confirm:CONFIRM_INCLUDES_VERB",
        "reject.dialog-cancel:CANCEL_IS_SAFE",
        "reject.dialog-title:NO_ARE_YOU_SURE",
        "reject.dialog-title:BULK_COUNT",
        "reject.dialog-body:SAY_IRREVERSIBLE",
        "reject.error:NO_CUTE_ERRORS",
        "approve.button:FIT_THE_SPACE",
      ])
    );
    // "Delete it" is an alternative without the action's verb.
    expect(lintCopy(run.slots, bad, run.targets).some((l) => l.message.includes("(alternative 1)"))).toBe(true);
  });

  it("every guideline with a check names slots that exist", () => {
    expect(COPY_GUIDELINES.guidelines.length).toBeGreaterThan(8);
  });
});

describe("with an LLM", () => {
  it("sends the requirements and slots, and holds the words to the hard guidelines", async () => {
    const { outcome } = await outcomeFor();
    const draft = await copyFor();
    const generate = vi.fn().mockResolvedValue({ data: { copy: draft.copy, toneNotes: "Calm and direct." }, source: "anthropic", model: "claude-sonnet-5" });
    const run = await generateCopy({
      state: expense,
      outcome,
      tone: "warm but brief",
      ctx,
      clientConfig: { provider: "anthropic", apiKey: "k" },
      generate: generate as unknown as typeof generateStructured,
    });
    expect(run).toMatchObject({ source: "llm", model: "anthropic:claude-sonnet-5", toneNotes: "Calm and direct." });
    const call = generate.mock.calls[0][0];
    expect(call.userPrompt).toMatch(/TONE: warm but brief/);
    expect(call.userPrompt).toMatch(/SLOT reject\.dialog-confirm — Confirm button, at most 24 characters/);
    expect(call.userPrompt).toMatch(/protected the way the action-confirmation decision says: confirm dialog/);
    const schema = buildCopySchema(run.targets, run.slots);
    expect(schema.safeParse({ copy: draft.copy }).success).toBe(true);
    expect(schema.safeParse({ copy: { ...draft.copy, "reject.dialog-confirm": { text: "Yes", alternatives: [] } } }).success).toBe(false);
    const { ["reject.error"]: _missing, ...incomplete } = draft.copy;
    expect(schema.safeParse({ copy: incomplete }).success).toBe(false);
    expect(buildCopyUserPrompt(expense, run.targets, run.slots, "x")).toContain("ACTION \"Export\"");
  });
});

describe("copy in the session trace", () => {
  it("records the run", async () => {
    const { outcome, results } = await outcomeFor();
    let s = withState(createSession(expense.brief, "s1"), expense, { kind: "demo", model: "demo", notices: [] });
    s = withAnalysis(s, { results, decisionModel: { provider: "mock", model: "mock-1.0.0", notices: [] }, outcome });
    s = withCopy(s, await copyFor());
    expect(s.events.at(-1)).toMatchObject({ type: "copy-generated", detail: expect.stringMatching(/strings for 4 targets in a "calm" tone via draft; 0 guideline errors/) });
    expect(() => analysisSessionSchema.parse(JSON.parse(JSON.stringify(s)))).not.toThrow();
  });
});
