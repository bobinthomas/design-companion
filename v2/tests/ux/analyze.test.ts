import { describe, expect, it, vi } from "vitest";
import acmeJson from "@knowledge/design-systems/acme-example.json";
import type { generateStructured } from "@/lib/ai/generate";
import { importDesignSystem } from "@/lib/design-system/import";
import { analyzeState, UnknownResultsError } from "@/lib/ux/analyze";
import { expenseDashboardState } from "@/lib/ux/fixtures/expense-dashboard";
import { extractState, pickDemoState, STATE_SYSTEM_PROMPT } from "@/lib/ux/state/extract";
import { uxStateSchema } from "@/lib/schemas";
import {
  acceptDecision,
  addOverride,
  analysisSessionSchema,
  createSession,
  isAccepted,
  removeOverride,
  reopenGap,
  settleGap,
  withAnalysis,
  withState,
} from "@/lib/session/session";

const state = uxStateSchema.parse(expenseDashboardState);
const noBindings = { env: {}, ip: "local" };

describe("state extraction (brief → UX state)", () => {
  it("tells the LLM to describe, not judge, and lists the hard-constraint vocabularies", () => {
    expect(STATE_SYSTEM_PROMPT).toMatch(/DESCRIBE the problem\. You do NOT judge it/);
    expect(STATE_SYSTEM_PROMPT).toContain("desktop | mobile | tablet | multi");
  });

  it("without an LLM, returns a clearly labelled demo state picked by keywords", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const result = await extractState("A checkout for our meal subscription with plan choice");
      expect(result.source).toBe("demo");
      expect(result.state.product).toBe("Meal-kit subscription");
      expect(result.notices[0]).toMatch(/not your brief/);
      const example = await extractState("Design an expense-review dashboard for managers.");
      expect(example.notices[0]).toMatch(/prepared demo state for this example/);
    } finally {
      if (original) process.env.ANTHROPIC_API_KEY = original;
    }
    expect(pickDemoState("Something unrelated entirely").product).toBe("Expense Management");
  });

  it("with an LLM, validates its state and keeps the designer's own brief", async () => {
    const generate = vi.fn().mockResolvedValue({
      data: { ...state, brief: "a paraphrase the model made up" },
      source: "anthropic",
      model: "claude-sonnet-5",
    }) as unknown as typeof generateStructured;
    const result = await extractState("  Managers review expenses daily.  ", { provider: "anthropic", apiKey: "k" }, generate);
    expect(result).toMatchObject({ source: "llm", model: "anthropic:claude-sonnet-5" });
    expect(result.state.brief).toBe("Managers review expenses daily.");
  });
});

describe("analyzeState", () => {
  it("reuses supplied results without calling a decision model", async () => {
    const first = await analyzeState({ state, overrides: [], gapSettlements: [], ctx: noBindings });
    const again = await analyzeState({ state, results: first.results, overrides: [], gapSettlements: [], ctx: noBindings });
    expect(again.decisionModel.notices).toEqual(["Reused earlier decision-model results; the model was not called again."]);
    expect(again.decisions).toEqual(first.decisions);
  });

  it("rejects results for questions it doesn't know", async () => {
    const bogus = [{ questionId: "made.up", type: "noul" as const, noul: 1, confidence: 1, provider: "mock" as const, model: "x" }];
    await expect(analyzeState({ state, results: bogus, overrides: [], gapSettlements: [], ctx: noBindings })).rejects.toBeInstanceOf(
      UnknownResultsError
    );
  });

  it("applies gap settlements so an accepted critical gap stops blocking", async () => {
    const acme = importDesignSystem(acmeJson).designSystem;
    const blocked = await analyzeState({ state, overrides: [], gapSettlements: [], designSystem: acme, ctx: noBindings });
    expect(blocked.blocked).toBe(true);

    const settled = await analyzeState({
      state,
      results: blocked.results,
      overrides: [],
      gapSettlements: [
        { gapId: "gap.destructive-confirmation", kind: "accept-risk", reason: "Shipping v1 behind a feature flag", timestamp: "2026-10-06T12:00:00.000Z" },
      ],
      designSystem: acme,
      ctx: noBindings,
    });
    const gap = settled.gaps.find((g) => g.id === "gap.destructive-confirmation")!;
    expect(gap).toMatchObject({ status: "accepted", behavior: "none", resolution: { reason: "Shipping v1 behind a feature flag" } });
    expect(settled.blocked).toBe(false);
  });
});

describe("analysis session trace (§29 / §50)", () => {
  async function decided() {
    let s = createSession("Design an expense-review dashboard for managers.", "s1", "2026-10-06T10:00:00.000Z");
    s = withState(s, state, { kind: "demo", model: "demo", notices: [] });
    const a = await analyzeState({ state, overrides: [], gapSettlements: [], ctx: noBindings });
    const { results, decisionModel, state: _s, questions: _q, ...outcome } = a;
    return withAnalysis(s, { results, decisionModel: { ...decisionModel, notices: decisionModel.notices }, outcome });
  }

  it("records every step and stays schema-valid", async () => {
    let s = await decided();
    s = acceptDecision(s, "dataPresentation", "data-table");
    s = addOverride(s, { decision: "actionConfirmation", choice: "undo-toast", reason: "Reversible within 24h" });
    s = settleGap(s, { gapId: "gap.x", kind: "accept-risk", reason: "Known" });
    s = reopenGap(s, "gap.x");
    s = removeOverride(s, "actionConfirmation");
    expect(s.events.map((e) => e.type)).toEqual([
      "created",
      "state-extracted",
      "decided",
      "accepted",
      "overridden",
      "gap-settled",
      "gap-reopened",
      "override-removed",
    ]);
    expect(() => analysisSessionSchema.parse(JSON.parse(JSON.stringify(s)))).not.toThrow();
  });

  it("ties acceptance to the accepted choice", async () => {
    let s = await decided();
    s = acceptDecision(s, "actionConfirmation", "confirm-dialog");
    expect(isAccepted(s, "actionConfirmation", "confirm-dialog")).toBe(true);

    // An override changes the choice; the old acceptance no longer stands after re-analysis.
    s = addOverride(s, { decision: "actionConfirmation", choice: "undo-toast", reason: "Reversible" });
    const a = await analyzeState({ state, results: s.results!, overrides: s.overrides, gapSettlements: [], ctx: noBindings });
    const { results, decisionModel, state: _s, questions: _q, ...outcome } = a;
    s = withAnalysis(s, { results, decisionModel, outcome });
    expect(isAccepted(s, "actionConfirmation", "confirm-dialog")).toBe(false);
    expect(s.accepted).toEqual([]);
  });

  it("clears derived results when the designer edits the state", async () => {
    let s = await decided();
    s = addOverride(s, { decision: "layout", choice: "single-page", reason: "x" });
    s = withState(s, { ...state, context: { ...state.context, device: "mobile" } }, { kind: "edited", model: "designer", notices: [] });
    expect(s).toMatchObject({ results: null, outcome: null, overrides: [], accepted: [] });
    expect(s.events.at(-1)?.type).toBe("state-edited");
  });
});
