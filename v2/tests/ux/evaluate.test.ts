import { describe, expect, it, vi } from "vitest";
import acmeJson from "@knowledge/design-systems/acme-example.json";
import { evaluateDecisions } from "@/lib/decision-model/evaluate";
import { MockDecisionProvider } from "@/lib/decision-model/adapters/mock";
import { importDesignSystem } from "@/lib/design-system/import";
import { ANALYSIS_QUESTIONS, EVALUATION_QUESTIONS, evaluationCategoryOf } from "@/lib/knowledge";
import { EVALUATION_CATEGORIES, evaluationRunSchema, uxStateSchema, type LayoutVariant } from "@/lib/schemas";
import { analysisSessionSchema, createSession, decisionsChangedSince, withAnalysis, withEvaluation, withState } from "@/lib/session/session";
import { buildEvaluationBatch, type PreparedSubject } from "@/lib/ux/evaluate/batch";
import { evaluateSubjects, questionValue } from "@/lib/ux/evaluate/evaluate";
import { expenseDashboardState } from "@/lib/ux/fixtures/expense-dashboard";
import { composeDirections } from "@/lib/ux/layouts/compose";
import { runPolicy, type PolicyInput } from "@/lib/ux/pipeline";

const state = uxStateSchema.parse(expenseDashboardState);
const results = await new MockDecisionProvider().evaluate(state, ANALYSIS_QUESTIONS);
const policy = (extra: Partial<PolicyInput> = {}) => runPolicy({ state, questions: ANALYSIS_QUESTIONS, results, ...extra });
const ctx = { env: {}, ip: "local" };

const directions = (outcome = policy()): PreparedSubject[] =>
  composeDirections(state, outcome).variants.map((variant) => ({ kind: "direction", id: variant.id, label: variant.title, variant }));

const evaluate = (subjects: PreparedSubject[], outcome = policy()) => evaluateSubjects({ state, outcome, subjects, ctx, id: "e1" });

describe("evaluation knowledge", () => {
  it("covers all 12 PRD §27 categories with atomic noul and score questions", () => {
    expect(new Set(EVALUATION_QUESTIONS.map(evaluationCategoryOf))).toEqual(new Set(EVALUATION_CATEGORIES));
    expect(EVALUATION_QUESTIONS.every((q) => q.type !== "choice" && q.purpose === "evaluation")).toBe(true);
  });
});

describe("one batched decision-model request", () => {
  it("scopes a copy of every question to each solution", () => {
    const subjects = directions();
    const batch = buildEvaluationBatch(state, policy(), subjects);
    expect(batch.questions).toHaveLength(EVALUATION_QUESTIONS.length * subjects.length);
    const q = batch.questions.find((x) => x.id === "eval.task.primary-central.s2")!;
    expect(q).toMatchObject({ scope: "solutions.s2" });
    expect(q.instructions).toMatch(/^Judge only the solution at solutions\.s2 \("Exception first"\)/);
    expect(batch.state).toMatchObject({ problem: { primaryTask: "Review and approve expenses" }, solutions: { s1: { title: "Task first" } } });
    expect(JSON.stringify(batch.state.solutions)).toMatch(/NEW COMPONENT NEEDED|DataTable/);
  });

  it("evaluates three directions with a single provider call", async () => {
    const decide = vi.fn(evaluateDecisions);
    await evaluateSubjects({ state, outcome: policy(), subjects: directions(), ctx, decide });
    expect(decide).toHaveBeenCalledTimes(1);
  });

  it("lets the mock judge each solution on its own text", async () => {
    const run = await evaluate(directions());
    const byId = Object.fromEntries(run.evaluations.map((e) => [e.subjectId, e]));
    // Focus first trades scanning speed for depth; the mock picks that up from its own trade-offs only.
    expect(byId["focus-first"].issues.map((i) => i.from.questionId)).toContain("eval.interaction.efficient");
    expect(byId["task-first"].issues.map((i) => i.from.questionId)).not.toContain("eval.interaction.efficient");
  });
});

describe("evaluating layout directions", () => {
  it("produces a schema-valid, traceable evaluation for each direction", async () => {
    const run = await evaluate(directions());
    expect(() => evaluationRunSchema.parse(run)).not.toThrow();
    expect(run.subjects.map((s) => s.label)).toEqual(["Task first", "Exception first", "Focus first"]);
    for (const e of run.evaluations) {
      expect(Object.keys(e.categories).sort()).toEqual([...EVALUATION_CATEGORIES].sort());
      expect(e.overallScore).toBeGreaterThan(60);
      expect(e.versions).toMatchObject({ decisionModel: "mock-1.0.0", evaluator: "1.0.0" });
      // Drafts carry out every decision and the required data states.
      expect(e.checks.filter((c) => !c.passed)).toEqual([]);
      expect(e.categories.taskEffectiveness.evidence[0]).toMatchObject({ questionId: "eval.task.primary-central", provider: "mock" });
      expect(e.categories.errorPrevention.checks).toContain("check.decision.actionConfirmation");
    }
  });

  it("flags decisions a direction doesn't carry out, citing the check and the rule", async () => {
    const outcome = policy();
    const full = composeDirections(state, outcome).variants[0];
    const thin: LayoutVariant = {
      ...full,
      id: "thin",
      regions: [{ name: "Expenses", purpose: "List", components: [{ component: "data-table", purpose: "Expenses", states: [] }] }],
    };
    const [e] = (await evaluate([{ kind: "direction", id: "thin", label: "Thin", variant: thin }], outcome)).evaluations;
    const confirm = e.issues.find((i) => i.from.checkId === "check.decision.actionConfirmation")!;
    expect(confirm).toMatchObject({ severity: "high", category: "errorPrevention", from: { ruleId: expect.any(String) } });
    expect(e.issues.map((i) => i.from.checkId)).toEqual(expect.arrayContaining(["check.states.empty", "check.states.error", "check.decision.detailView"]));
    expect(e.categories.requiredStates.score).toBeLessThan(50);
    expect(e.overallScore).toBeLessThan((await evaluate(directions(outcome).slice(0, 1), outcome)).evaluations[0].overallScore);
  });

  it("caps the score when an override breaks a critical rule", async () => {
    const outcome = policy({ overrides: [{ decision: "actionConfirmation", choice: "none", reason: "Speed matters more" }] });
    const [e] = (await evaluate(directions(outcome).slice(0, 1), outcome)).evaluations;
    expect(e.issues[0]).toMatchObject({ severity: "critical", category: "errorPrevention", from: { checkId: "check.critical.actionConfirmation", ruleId: expect.stringMatching(/destructive/) } });
    expect(e.categories.errorPrevention.score).toBeLessThanOrEqual(40);
    expect(e.overallScore).toBeLessThanOrEqual(59);
  });

  it("checks net-new gap placeholders against an incomplete design system (PRD §21f)", async () => {
    const outcome = policy({
      designSystem: importDesignSystem(acmeJson).designSystem,
      overrides: [{ decision: "actionConfirmation", choice: "undo-toast", reason: "No dialog yet" }],
    });
    const [e] = (await evaluate(directions(outcome).slice(0, 1), outcome)).evaluations;
    const netNew = e.checks.filter((c) => c.id.startsWith("check.ds.net-new."));
    expect(netNew.map((c) => c.gapId)).toContain("gap.row-selection");
    expect(netNew.every((c) => c.passed)).toBe(true);
  });
});

describe("evaluating a described UI", () => {
  it("judges it with questions only, plus the decision-level checks", async () => {
    const run = await evaluate([
      {
        kind: "description",
        id: "description",
        label: "Card inbox",
        description: "A grid of expense cards. Managers drag a card to the Approved column; red and green dots show status. Rejecting immediately deletes the report.",
      },
    ]);
    const [e] = run.evaluations;
    expect(e.checks.map((c) => c.id)).toEqual(["check.ds.no-blocking-gaps", "check.critical.actionConfirmation"]);
    const flagged = e.issues.map((i) => i.from.questionId);
    expect(flagged).toEqual(expect.arrayContaining(["eval.a11y.keyboard", "eval.errors.destructive-protected", "eval.states.represented"]));
    expect(e.issues[0].severity).toBe("critical");
    expect(e.overallScore).toBeLessThanOrEqual(59);
    expect(run.notices.join(" ")).toMatch(/structural checks need a generated direction/);
    expect(run.subjects[0]).toMatchObject({ kind: "description", description: expect.stringMatching(/grid of expense cards/) });
  });
});

describe("scoring arithmetic", () => {
  it("maps noul probabilities and score levels onto 0–100", () => {
    expect(questionValue({ questionId: "q.a", type: "noul", noul: 0.88, confidence: 0.88, provider: "mock", model: "m" })).toBeCloseTo(88);
    expect(
      questionValue({ questionId: "q.b", type: "score", score: 2, probabilities: { "0": 0, "1": 0, "2": 1, "3": 0 }, legend: ["a", "b", "c", "d"], confidence: 1, provider: "mock", model: "m" })
    ).toBeCloseTo(66.67, 1);
  });
});

describe("evaluations in the session trace", () => {
  it("records runs, detects changed decisions, and clears them on a state edit", async () => {
    const outcome = policy();
    let s = withState(createSession(state.brief, "s1"), state, { kind: "demo", model: "demo", notices: [] });
    s = withAnalysis(s, { results, decisionModel: { provider: "mock", model: "mock-1.0.0", notices: [] }, outcome });
    const run = await evaluate(directions(outcome));
    s = withEvaluation(s, run);
    expect(s.events.at(-1)).toMatchObject({ type: "evaluated", detail: expect.stringMatching(/^Task first \d+, Exception first \d+, Focus first \d+ via mock/) });
    expect(decisionsChangedSince(s, run.basedOn)).toBe(false);
    expect(() => analysisSessionSchema.parse(JSON.parse(JSON.stringify(s)))).not.toThrow();
    s = withState(s, state, { kind: "edited", model: "designer", notices: [] });
    expect(s.evaluations).toEqual([]);
  });
});
