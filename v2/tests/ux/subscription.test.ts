import { describe, expect, it } from "vitest";
import { MockDecisionProvider } from "@/lib/decision-model/adapters/mock";
import { ANALYSIS_QUESTIONS } from "@/lib/knowledge";
import { policyOutcomeSchema, uxStateSchema } from "@/lib/schemas";
import { subscriptionSignupState } from "@/lib/ux/fixtures/subscription-signup";
import { runPolicy } from "@/lib/ux/pipeline";

/**
 * Second golden scenario: a mobile-first consumer sign-up and checkout.
 * Exercises knowledge the expense dashboard doesn't: payment, plan
 * comparison, authentication, forms, hard device constraints.
 */
const state = uxStateSchema.parse(subscriptionSignupState);
const results = await new MockDecisionProvider().evaluate(state, ANALYSIS_QUESTIONS);
const outcome = runPolicy({ state, questions: ANALYSIS_QUESTIONS, results });
const decision = (slot: string) => outcome.decisions.find((d) => d.decision === slot);

describe("golden test: subscription sign-up and checkout (mobile)", () => {
  it("produces a valid outcome", () => {
    expect(() => policyOutcomeSchema.parse(outcome)).not.toThrow();
  });

  it("structures the flow as steps with progress", () => {
    expect(decision("layout")?.result.choice).toBe("multi-step");
    expect(decision("navigation")?.result.choice).toBe("stepper");
    expect(decision("formStructure")?.result.choice).toBe("wizard");
  });

  it("treats the phone as a hard constraint: split view is vetoed, not merely discouraged", () => {
    const layout = decision("layout")!;
    expect(layout.rulesApplied).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "SMALL_SCREEN_SPLIT_VIEW", effect: "veto", target: "split-view" })])
    );
    // No record list here, so no detail-view decision is made at all.
    expect(decision("detailView")).toBeUndefined();
  });

  it("surfaces the wizard vs. short-auth-form conflict as uncertain instead of hiding it", () => {
    const form = decision("formStructure")!;
    expect(form.rulesApplied.map((r) => r.code)).toEqual(expect.arrayContaining(["STEPPED_DATA_ENTRY", "SHORT_AUTH_FORM"]));
    expect(form.band).not.toBe("proceed");
    expect(form.alternatives[0]).toMatchObject({ choice: "single-page-form" });
  });

  it("keeps input errors persistent and inline (WCAG 3.3.1)", () => {
    const feedback = decision("statusFeedback")!;
    expect(feedback.result.choice).toBe("inline-message");
    expect(feedback.rulesApplied).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "ERRORS_PERSISTENT", effect: "avoid", target: "toast" })])
    );
  });

  it("matches the checkout-family patterns, and nothing from the expense dashboard", () => {
    const ids = outcome.patterns.map((p) => p.pattern);
    expect(outcome.patterns[0]).toMatchObject({ pattern: "wizard", role: "primary" });
    expect(ids).toEqual(expect.arrayContaining(["checkout", "onboarding", "authentication", "comparison"]));
    expect(ids).not.toContain("data-table");
    expect(ids).not.toContain("filtering");
  });

  it("builds from the default design system without gaps", () => {
    expect(outcome.components.map((c) => c.component)).toEqual(expect.arrayContaining(["stepper", "form", "text-field", "button"]));
    expect(outcome.gaps).toEqual([]);
  });
});
