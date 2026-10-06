import { describe, expect, it } from "vitest";
import { buildRuleContext, evaluateCondition, evaluateWhen } from "@/lib/ux/rules/evaluate";
import { ANALYSIS_QUESTIONS } from "@/lib/knowledge";
import { uxStateSchema, type DecisionResult } from "@/lib/schemas";
import { expenseDashboardState } from "@/lib/ux/fixtures/expense-dashboard";

const state = uxStateSchema.parse(expenseDashboardState);
const base = { provider: "jev" as const, model: "jev-test" };
const results: DecisionResult[] = [
  { ...base, questionId: "data.volume.high", type: "noul", noul: 0.93, confidence: 0.93 },
  { ...base, questionId: "data.records.visual", type: "noul", noul: 0.5, confidence: 0.5 },
  {
    ...base,
    questionId: "decision.layout",
    type: "choice",
    choice: "split-view",
    probabilities: { "split-view": 0.6, dashboard: 0.3, "single-page": 0.1, "multi-step": 0, "detail-view": 0 },
    confidence: 0.6,
  },
  {
    ...base,
    questionId: "risk.error-cost",
    type: "score",
    score: 1.7,
    probabilities: { "0": 0.05, "1": 0.2, "2": 0.75 },
    legend: [],
    confidence: 0.75,
  },
];
const ctx = buildRuleContext(state, ANALYSIS_QUESTIONS, results);

describe("condition evaluation", () => {
  it("judges noul results against the policy threshold, or a per-condition minimum", () => {
    expect(evaluateCondition({ question: "data.volume.high", is: "true" }, ctx).matched).toBe(true);
    expect(evaluateCondition({ question: "data.volume.high", is: "true", min: 0.95 }, ctx).matched).toBe(false);
    // 0.5 is neither true nor false at the 0.7 threshold.
    expect(evaluateCondition({ question: "data.records.visual", is: "true" }, ctx).matched).toBe(false);
    expect(evaluateCondition({ question: "data.records.visual", is: "false" }, ctx).matched).toBe(false);
  });

  it("matches choices, optionally requiring a minimum probability", () => {
    expect(evaluateCondition({ question: "decision.layout", choice: "split-view" }, ctx).matched).toBe(true);
    expect(evaluateCondition({ question: "decision.layout", choice: "split-view", min: 0.8 }, ctx).matched).toBe(false);
    expect(evaluateCondition({ question: "decision.layout", choice: "dashboard" }, ctx).matched).toBe(false);
  });

  it("compares scores", () => {
    expect(evaluateCondition({ question: "risk.error-cost", scoreGte: 1.5 }, ctx).matched).toBe(true);
    expect(evaluateCondition({ question: "risk.error-cost", scoreLte: 1 }, ctx).matched).toBe(false);
  });

  it("never matches a question with no result — absent evidence is not evidence", () => {
    expect(evaluateCondition({ question: "task.multi-step.required", is: "false" }, ctx)).toEqual({ matched: false });
  });

  it("reads hard-constraint facts, including ordinal comparisons", () => {
    expect(evaluateCondition({ fact: "context.device", op: "eq", value: "desktop" }, ctx).matched).toBe(true);
    expect(evaluateCondition({ fact: "context.frequency", op: "gte", value: "weekly" }, ctx).matched).toBe(true);
    expect(evaluateCondition({ fact: "user.expertise", op: "gte", value: "expert" }, ctx).matched).toBe(false);
    expect(evaluateCondition({ fact: "constraints.accessibility", op: "in", value: ["WCAG-AA", "WCAG-AAA"] }, ctx).matched).toBe(true);
  });
});

describe("when clauses", () => {
  it("cites evidence from all, any and none conditions", () => {
    const outcome = evaluateWhen(
      {
        all: [{ question: "data.volume.high", is: "true" }],
        none: [{ question: "decision.layout", choice: "dashboard" }],
      },
      ctx
    );
    expect(outcome.matched).toBe(true);
    expect(outcome.evidence.map((e) => e.questionId)).toEqual(["data.volume.high", "decision.layout"]);
  });

  it("fails when an any-list has no match", () => {
    expect(
      evaluateWhen({ any: [{ question: "decision.layout", choice: "dashboard" }, { question: "risk.error-cost", scoreLte: 0.5 }] }, ctx)
        .matched
    ).toBe(false);
  });
});
