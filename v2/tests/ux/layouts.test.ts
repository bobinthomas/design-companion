import { describe, expect, it, vi } from "vitest";
import acmeJson from "../fixtures/acme-design-system.json";
import type { generateStructured } from "@/lib/ai/generate";
import { MockDecisionProvider } from "@/lib/decision-model/adapters/mock";
import { importDesignSystem } from "@/lib/design-system/import";
import { ANALYSIS_QUESTIONS } from "@/lib/knowledge";
import { buildGenerationSchema, layoutBrainstormSchema, uxStateSchema, type GenerationOutput, type PolicyOutcome } from "@/lib/schemas";
import { createSession, layoutsStale, withAnalysis, withLayouts, withState, analysisSessionSchema } from "@/lib/session/session";
import { expenseDashboardState } from "@/lib/ux/fixtures/expense-dashboard";
import { subscriptionSignupState } from "@/lib/ux/fixtures/subscription-signup";
import { checkDirections } from "@/lib/ux/layouts/checks";
import { composeDirections } from "@/lib/ux/layouts/compose";
import {
  buildLayoutUserPrompt,
  GenerationBlockedError,
  generateLayouts,
  generationVocabulary,
  LAYOUT_SYSTEM_PROMPT,
} from "@/lib/ux/layouts/generate";
import { runPolicy, type PolicyInput } from "@/lib/ux/pipeline";

const expense = uxStateSchema.parse(expenseDashboardState);
const subscription = uxStateSchema.parse(subscriptionSignupState);
const acme = importDesignSystem(acmeJson).designSystem;
const expenseResults = await new MockDecisionProvider().evaluate(expense, ANALYSIS_QUESTIONS);
const subscriptionResults = await new MockDecisionProvider().evaluate(subscription, ANALYSIS_QUESTIONS);

const policy = (state = expense, extra: Partial<PolicyInput> = {}) =>
  runPolicy({
    state,
    questions: ANALYSIS_QUESTIONS,
    results: state === expense ? expenseResults : subscriptionResults,
    ...extra,
  });

const undoOverride = [{ decision: "actionConfirmation" as const, choice: "undo-toast", reason: "No dialog in our system yet" }];

/** Ensures no LLM is configured for draft-path tests. */
async function withoutLlm<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    return await fn();
  } finally {
    if (original) process.env.ANTHROPIC_API_KEY = original;
  }
}

const entries = (o: GenerationOutput, variant = 0) => o.variants[variant].regions.flatMap((r) => r.components);

describe("deterministic draft composer", () => {
  it("drafts three distinct, schema-valid directions for the expense dashboard", () => {
    const outcome = policy();
    const draft = composeDirections(expense, outcome);
    expect(() => buildGenerationSchema(generationVocabulary(outcome)).parse(draft)).not.toThrow();
    expect(draft.variants.map((v) => v.id)).toEqual(["task-first", "exception-first", "focus-first"]);
    // Different emphasis, not the same list: each direction leads with a different region.
    expect(new Set(draft.variants.map((v) => v.regions[0].name)).size).toBe(3);
    expect(draft.variants[1].regions[0].name).toBe("Needs attention");
    expect(draft.variants[0].pattern).toBe("data-table");
  });

  it("uses every selected component, shows every decision, and carries the required data states", () => {
    const outcome = policy();
    const draft = composeDirections(expense, outcome);
    for (const check of checkDirections(draft, outcome)) {
      expect(check.unusedComponents, check.variantId).toEqual([]);
      expect(check.uncoveredDecisions, check.variantId).toEqual([]);
    }
    const table = entries(draft).find((e) => "component" in e && e.component === "data-table");
    expect(table && "states" in table ? table.states : []).toEqual(expect.arrayContaining(["loading", "empty", "error"]));
  });

  it("fits a mobile sign-up flow: guidance-led, no desktop notes, no invented regions", () => {
    const outcome = policy(subscription);
    const draft = composeDirections(subscription, outcome);
    expect(() => buildGenerationSchema(generationVocabulary(outcome)).parse(draft)).not.toThrow();
    expect(draft.variants.map((v) => v.id)).toEqual(["task-first", "guidance-first"]);
    expect(draft.variants[1].regions[0].name).toBe("Progress");
    for (const v of draft.variants) {
      expect(v.mobileNotes.length).toBeGreaterThan(0);
      expect(v.desktopNotes).toEqual([]);
    }
  });
});

describe("Layout Brainstorm generation", () => {
  it("refuses while a critical gap blocks generation (PRD §21c)", async () => {
    const blocked = policy(expense, { designSystem: acme });
    expect(blocked.blocked).toBe(true);
    const attempt = generateLayouts({ state: expense, outcome: blocked });
    await expect(attempt).rejects.toBeInstanceOf(GenerationBlockedError);
    await expect(attempt).rejects.toThrow(/destructive-confirmation/);
  });

  it("after the designer's override, shows every net-new gap as a placeholder in every direction (PRD §21f)", async () => {
    const outcome = policy(expense, { designSystem: acme, overrides: undoOverride });
    expect(outcome.blocked).toBe(false);
    const netNew = outcome.gaps.filter((g) => g.behavior === "mark-net-new").map((g) => g.id);
    expect(netNew).toContain("gap.row-selection");

    const run = await withoutLlm(() => generateLayouts({ state: expense, outcome, id: "run-1" }));
    expect(run.source).toBe("draft");
    for (const check of run.checks) {
      expect(check.gapPlaceholders).toEqual(expect.arrayContaining(netNew));
      expect(check.uncoveredDecisions).toEqual([]);
    }
    const placeholder = entries(run.output).find((e) => "gap" in e && e.gap === "gap.row-selection");
    expect(placeholder && placeholder.purpose).toMatch(/Net-new component required: Row selection/);
    // Only Acme's own components appear.
    const used = run.output.variants.flatMap((_, i) => entries(run.output, i).flatMap((e) => ("component" in e ? [e.component] : [])));
    expect(new Set(used)).toEqual(new Set(outcome.components.map((c) => c.component)));
  });

  it("without an LLM, labels the draft and says steering wasn't applied", async () => {
    const run = await withoutLlm(() =>
      generateLayouts({ state: expense, outcome: policy(), instruction: "Make one direction mobile-first", id: "r", now: new Date("2026-10-06T12:00:00Z") })
    );
    expect(() => layoutBrainstormSchema.parse(run)).not.toThrow();
    expect(run).toMatchObject({ source: "draft", model: "draft", instruction: "Make one direction mobile-first", generatedAt: "2026-10-06T12:00:00.000Z" });
    expect(run.notices.join(" ")).toMatch(/drafted deterministically[\s\S]*Steering instructions need an LLM/);
    expect(run.basedOn).toContainEqual({ decision: "dataPresentation", choice: "data-table" });
    expect(run.checks.every((c) => c.band !== undefined && c.confidence > 0.6)).toBe(true);
  });

  it("with an LLM, sends the constrained space and validates against the per-request schema", async () => {
    const outcome = policy(expense, { designSystem: acme, overrides: undoOverride });
    const valid = composeDirections(expense, outcome);
    const generate = vi.fn().mockResolvedValue({ data: valid, source: "anthropic", model: "claude-sonnet-5" });
    const run = await generateLayouts({
      state: expense,
      outcome,
      clientConfig: { provider: "anthropic", apiKey: "k" },
      instruction: "Favour keyboard use",
      generate: generate as unknown as typeof generateStructured,
    });
    expect(run).toMatchObject({ source: "llm", model: "anthropic:claude-sonnet-5", notices: [] });

    const call = generate.mock.calls[0][0];
    expect(call.systemPrompt).toBe(LAYOUT_SYSTEM_PROMPT);
    expect(call.maxTokens).toBe(8192);
    expect(call.userPrompt).toMatch(/actionConfirmation = undo-toast/);
    expect(call.userPrompt).toMatch(/gap\.row-selection: Row selection — NET-NEW REQUIRED/);
    expect(call.userPrompt).toMatch(/DESIGNER'S STEERING.*Favour keyboard use/);
    expect(call.userPrompt).not.toMatch(/- dialog "/); // Acme has no Dialog to offer

    // The schema the model is held to rejects invented components and hidden net-new gaps.
    const invented = structuredClone(valid);
    invented.variants[0].regions[0].components[0] = { component: "magic-grid", purpose: "?", states: [] };
    expect(call.schema.safeParse(invented).success).toBe(false);
    const hidden = structuredClone(valid);
    for (const r of hidden.variants[0].regions) r.components = r.components.filter((c) => !("gap" in c && c.gap === "gap.row-selection"));
    hidden.variants[0].regions = hidden.variants[0].regions.filter((r) => r.components.length > 0);
    expect(call.schema.safeParse(hidden).success).toBe(false);
  });

  it("lists vetoed options in the prompt so the model can't reintroduce them", () => {
    expect(buildLayoutUserPrompt(expense, policy())).toMatch(/actionConfirmation = confirm-dialog.*Ruled out: none\./);
  });
});

describe("direction checks", () => {
  it("reports decisions a direction doesn't show and components it leaves out", () => {
    const outcome: PolicyOutcome = policy();
    const thin: GenerationOutput = {
      variants: [
        { ...composeDirections(expense, outcome).variants[0], regions: [{ name: "Table", purpose: "x", components: [{ component: "data-table", purpose: "x", states: [] }] }], supportingDecisions: ["dataPresentation"] },
      ],
      assumptions: [],
    };
    const [check] = checkDirections(thin, outcome);
    expect(check.uncoveredDecisions).toEqual(expect.arrayContaining(["detailView", "search", "actionConfirmation"]));
    expect(check.uncoveredDecisions).not.toContain("dataPresentation");
    expect(check.unusedComponents).toEqual(expect.arrayContaining(["drawer", "dialog"]));
    expect(check.confidence).toBeCloseTo(outcome.decisions.find((d) => d.decision === "dataPresentation")!.result.confidence, 2);
  });
});

describe("layouts in the session trace", () => {
  it("records runs, detects stale directions, and clears them when the state changes", async () => {
    const outcome = policy();
    let s = createSession(expense.brief, "s1");
    s = withState(s, expense, { kind: "demo", model: "demo", notices: [] });
    s = withAnalysis(s, { results: expenseResults, decisionModel: { provider: "mock", model: "mock-1.0.0", notices: [] }, outcome });
    const run = await withoutLlm(() => generateLayouts({ state: expense, outcome }));
    s = withLayouts(s, run);
    expect(s.events.at(-1)).toMatchObject({ type: "layouts-generated", detail: expect.stringMatching(/3 directions \(Task first, Exception first, Focus first\) via draft/) });
    expect(layoutsStale(s, run)).toBe(false);
    expect(() => analysisSessionSchema.parse(JSON.parse(JSON.stringify(s)))).not.toThrow();

    const overridden = policy(expense, { overrides: [{ decision: "layout", choice: "single-page", reason: "x" }] });
    s = withAnalysis(s, { results: expenseResults, decisionModel: { provider: "mock", model: "mock-1.0.0", notices: [] }, outcome: overridden });
    expect(layoutsStale(s, run)).toBe(true);

    s = withState(s, { ...expense, context: { ...expense.context, device: "mobile" } }, { kind: "edited", model: "designer", notices: [] });
    expect(s.layouts).toEqual([]);
  });

  it("still loads sessions saved before layouts existed", () => {
    const { layouts: _l, ...old } = createSession("brief", "old");
    expect(analysisSessionSchema.parse(old).layouts).toEqual([]);
  });
});
