import { describe, expect, it } from "vitest";
import acmeJson from "../fixtures/acme-design-system.json";
import { MockDecisionProvider } from "@/lib/decision-model/adapters/mock";
import { importDesignSystem } from "@/lib/design-system/import";
import { ANALYSIS_QUESTIONS } from "@/lib/knowledge";
import { policyOutcomeSchema, uxRuleSchema, uxStateSchema, type DecisionResult, type UXRuleInput } from "@/lib/schemas";
import { expenseDashboardState } from "@/lib/ux/fixtures/expense-dashboard";
import { runPolicy } from "@/lib/ux/pipeline";

const state = uxStateSchema.parse(expenseDashboardState);
const results = await new MockDecisionProvider().evaluate(state, ANALYSIS_QUESTIONS);
const run = (overrides?: Parameters<typeof runPolicy>[0]["overrides"], designSystem?: Parameters<typeof runPolicy>[0]["designSystem"]) =>
  runPolicy({ state, questions: ANALYSIS_QUESTIONS, results, overrides, designSystem });

const outcome = run();
const decision = (slot: string, o = outcome) => o.decisions.find((d) => d.decision === slot)!;

describe("golden test: expense-review dashboard (PRD §41)", () => {
  it("produces a valid, fully traceable outcome", () => {
    expect(() => policyOutcomeSchema.parse(outcome)).not.toThrow();
    expect(outcome.versions.designSystem).toEqual({ id: "default", version: "1.0.0" });
    expect(outcome.versions.decisionModel).toBe("mock-1.0.0");
  });

  it("makes 5–10 decisions, each with evidence and rules", () => {
    expect(outcome.decisions.length).toBeGreaterThanOrEqual(5);
    expect(outcome.decisions.length).toBeLessThanOrEqual(10);
    for (const d of outcome.decisions) {
      expect(d.evidence.length, d.id).toBeGreaterThan(0);
      expect(d.rulesApplied.length, d.id).toBeGreaterThan(0);
      expect(d.reasons.length, d.id).toBeGreaterThan(0);
    }
  });

  it("reaches the decisions a UX designer would expect", () => {
    const choices = Object.fromEntries(outcome.decisions.map((d) => [d.decision, d.result.choice]));
    expect(choices).toMatchObject({
      dataPresentation: "data-table",
      filtering: "persistent-filter-bar",
      search: "visible-search",
      bulkActions: "bulk-action-bar",
      pagination: "paginated",
      detailView: "side-panel",
      actionConfirmation: "confirm-dialog",
      layout: "split-view",
    });
    // No rule or prior speaks to form controls here, so that slot isn't decided.
    expect(choices.selection).toBeUndefined();
  });

  it("explains the data table the way the Decision Inspector needs", () => {
    const table = decision("dataPresentation");
    expect(table.source).toBe("rule");
    expect(table.band).toBe("proceed");
    expect(table.rulesApplied.map((r) => r.code)).toEqual(
      expect.arrayContaining(["DATA_VOLUME_HIGH", "COMPARISON_REQUIRED", "INFO_DENSITY_HIGH"])
    );
    expect(table.evidence.map((e) => e.questionId)).toEqual(
      expect.arrayContaining(["data.volume.high", "data.comparison.required", "data.records.visual"])
    );
    expect(table.requiresCapabilities).toEqual(["tabular-display", "sorting"]);
    expect(table.alternatives.length).toBeGreaterThan(0);
  });

  it("vetoes unprotected destructive actions and prefers confirmation for irreversible ones", () => {
    const confirm = decision("actionConfirmation");
    expect(confirm.alternatives).toEqual(
      expect.arrayContaining([expect.objectContaining({ choice: "none", vetoed: true })])
    );
    expect(confirm.alternatives.find((a) => a.choice === "undo-toast")?.reasonRejected).toMatch(/undo can't take it back/);
  });

  it("flags weakly supported decisions for review", () => {
    expect(decision("navigation").band).not.toBe("proceed");
  });

  it("selects patterns and components from the registries, with no gaps in the default system", () => {
    expect(outcome.patterns[0]).toMatchObject({ pattern: "data-table", role: "primary" });
    expect(outcome.patterns.map((p) => p.pattern)).toEqual(expect.arrayContaining(["filtering", "search", "detail-page"]));
    // Nothing about this brief is a checkout, comparison or sign-up flow.
    for (const unrelated of ["checkout", "comparison", "authentication", "onboarding", "wizard"]) {
      expect(outcome.patterns.map((p) => p.pattern)).not.toContain(unrelated);
    }
    expect(outcome.components.map((c) => c.component)).toEqual(
      expect.arrayContaining(["data-table", "drawer", "search-field", "pagination", "dialog", "toast", "badge", "empty-state"])
    );
    expect(outcome.gaps).toEqual([]);
    expect(outcome.blocked).toBe(false);
    expect(outcome.requiredStates).toEqual(expect.arrayContaining(["loading", "empty", "error", "focus"]));
  });

  it("inherits critical priority on the destructive-confirmation requirement", () => {
    const req = outcome.requirements.find((r) => r.capability === "destructive-confirmation");
    expect(req).toMatchObject({ priority: "critical", requiredBy: { decision: "actionConfirmation" } });
  });

  it("is deterministic", () => {
    expect(run()).toEqual(outcome);
  });
});

describe("designer overrides (PRD §16)", () => {
  it("records the override without changing the rules, and recomputes requirements", () => {
    const o = run([{ decision: "actionConfirmation", choice: "undo-toast", reason: "Rejections are reversible within 24h", timestamp: "2026-10-06T12:00:00.000Z" }]);
    const d = decision("actionConfirmation", o);
    expect(d).toMatchObject({ source: "designer", result: { choice: "undo-toast", confidence: 1 }, band: "proceed" });
    expect(d.override).toEqual({
      decisionId: "decision.actionConfirmation",
      systemChoice: "confirm-dialog",
      designerChoice: "undo-toast",
      overrideReason: "Rejections are reversible within 24h",
      timestamp: "2026-10-06T12:00:00.000Z",
      actor: "designer",
    });
    expect(d.alternatives[0]).toMatchObject({ choice: "confirm-dialog", reasonRejected: expect.stringMatching(/overridden/) });
    // The rules that argued for confirmation are still on record.
    expect(d.rulesApplied.map((r) => r.code)).toContain("IRREVERSIBLE_CONFIRM");
    // undo-toast is also recommended by the critical rule, so its requirement stays critical.
    expect(o.requirements.find((r) => r.capability === "undo-action")).toMatchObject({ priority: "critical" });
    expect(o.requirements.find((r) => r.capability === "destructive-confirmation")).toBeUndefined();
  });

  it("warns when an override contradicts a critical rule", () => {
    const o = run([{ decision: "actionConfirmation", choice: "none", reason: "Speed matters more" }]);
    expect(decision("actionConfirmation", o).result.choice).toBe("none");
    expect(o.warnings.join(" ")).toMatch(/contradicts critical rule DESTRUCTIVE_PROTECTED/);
  });

  it("ignores overrides that aren't options of the slot", () => {
    const o = run([{ decision: "actionConfirmation", choice: "card-grid", reason: "?" }]);
    expect(decision("actionConfirmation", o).source).toBe("rule");
    expect(o.warnings.join(" ")).toMatch(/Ignored override/);
  });
});

describe("PRD §21f worked example through the full policy pipeline", () => {
  const acme = importDesignSystem(acmeJson).designSystem;

  it("blocks on the missing destructive confirmation and marks row selection net-new", () => {
    const o = run(undefined, acme);
    expect(o.blocked).toBe(true);
    const behavior = Object.fromEntries(o.gaps.map((g) => [g.capability, g.behavior]));
    expect(behavior["destructive-confirmation"]).toBe("block");
    expect(behavior["row-selection"]).toBe("mark-net-new");
  });

  it("unblocks after the designer overrides to undo-toast", () => {
    const o = run([{ decision: "actionConfirmation", choice: "undo-toast", reason: "No dialog in our system yet" }], acme);
    expect(o.gaps.find((g) => g.capability === "undo-action")).toBeUndefined();
    expect(o.gaps.filter((g) => g.behavior === "block")).toEqual([]);
    expect(o.blocked).toBe(false);
  });
});

describe("§13 priority order", () => {
  const rule = (input: Partial<UXRuleInput> & Pick<UXRuleInput, "id" | "code" | "tier" | "priority" | "recommend">) =>
    uxRuleSchema.parse({
      category: "tables",
      when: { all: [{ question: "data.volume.high", is: "true" }] },
      decision: "dataPresentation",
      reason: input.id,
      ...input,
    });
  const policyWith = (rules: ReturnType<typeof rule>[], designSystem?: Parameters<typeof runPolicy>[0]["designSystem"]) =>
    decision(
      "dataPresentation",
      runPolicy({ state, questions: ANALYSIS_QUESTIONS, results: withoutPriors(results), rules, designSystem })
    );

  it("never lets any number of visual-tier rules outvote one accessibility rule", () => {
    const visual = Array.from({ length: 10 }, (_, i) =>
      rule({ id: `test.visual.v${i}`, code: `VISUAL_${i}`, tier: "visual", priority: "high", recommend: ["card-grid"] })
    );
    const accessibility = rule({ id: "test.a11y.table", code: "A11Y", tier: "accessibility", priority: "low", recommend: ["data-table"] });
    expect(policyWith([...visual, accessibility]).result.choice).toBe("data-table");
  });

  it("lets the design-system tier break a task-level tie, but not override a clear task preference", () => {
    const cardsOnly = importDesignSystem({
      name: "Cards Only",
      components: [{ name: "Card", capabilities: ["card-display"], states: ["default", "loading", "empty", "populated"] }],
    }).designSystem;

    const tie = [
      rule({ id: "test.task.table", code: "T1", tier: "task", priority: "medium", recommend: ["data-table"] }),
      rule({ id: "test.task.cards", code: "T2", tier: "task", priority: "medium", recommend: ["card-grid"] }),
    ];
    const tied = policyWith(tie, cardsOnly);
    expect(tied.result.choice).toBe("card-grid");
    expect(tied.alternatives.find((a) => a.choice === "data-table")?.reasonRejected).toMatch(/design system can't fully build/);

    const clear = [
      rule({ id: "test.task.table", code: "T1", tier: "task", priority: "high", recommend: ["data-table"] }),
      rule({ id: "test.task.cards", code: "T2", tier: "task", priority: "low", recommend: ["card-grid"] }),
    ];
    expect(policyWith(clear, cardsOnly).result.choice).toBe("data-table");
  });

  it("uses the decision model's probabilities alone when no rule speaks to a slot", () => {
    const o = runPolicy({ state, questions: ANALYSIS_QUESTIONS, results, rules: [] });
    const layout = decision("layout", o);
    const prior = results.find((r) => r.questionId === "decision.layout")!;
    expect(layout.source).toBe("decision-model");
    expect(layout.result.choice).toBe(prior.type === "choice" ? prior.choice : "");
    expect(layout.result.confidence).toBeCloseTo(prior.confidence);
  });
});

/** Drops decision-linked choice results so tests isolate rule behavior. */
function withoutPriors(rs: DecisionResult[]): DecisionResult[] {
  return rs.filter((r) => !r.questionId.startsWith("decision."));
}
