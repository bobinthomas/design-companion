import { describe, expect, it } from "vitest";
import {
  buildGenerationSchema,
  capabilityRequirementSchema,
  decisionQuestionSchema,
  decisionResultSchema,
  designSystemGapSchema,
  designSystemSchema,
  uxDecisionSchema,
  uxPatternSchema,
  uxRuleSchema,
  uxStateSchema,
} from "@/lib/schemas";
import { expenseDashboardState } from "@/lib/ux/fixtures/expense-dashboard";

describe("UXState", () => {
  it("accepts the expense dashboard fixture and applies defaults", () => {
    const state = uxStateSchema.parse(expenseDashboardState);
    expect(state.constraints.accessibility).toBe("WCAG-AA");
    expect(state.tasks.some((t) => t.kind === "primary")).toBe(true);
  });

  it("rejects a state with no primary task", () => {
    const result = uxStateSchema.safeParse({
      ...expenseDashboardState,
      tasks: [{ name: "Browse", kind: "supporting", frequency: "daily" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects hard-constraint values outside the vocabulary", () => {
    const result = uxStateSchema.safeParse({
      ...expenseDashboardState,
      context: { ...expenseDashboardState.context, device: "smartwatch" },
    });
    expect(result.success).toBe(false);
  });
});

describe("DecisionQuestion", () => {
  it("accepts each question type", () => {
    const questions = [
      {
        id: "data.volume.high",
        purpose: "analysis",
        category: "data",
        type: "noul",
        question: "Is the expected data volume high?",
        instructions: "Judge whether users routinely work with more records than fit on one screen.",
        criteria: { true: "Hundreds of records or more", false: "A handful of records" },
      },
      {
        id: "data.presentation.fit",
        purpose: "analysis",
        category: "data",
        type: "choice",
        question: "Which data presentation best fits the task?",
        instructions: "Pick the presentation that best supports the primary task.",
        criteria: { "data-table": "Rows and columns", "card-grid": "Visual cards" },
      },
      {
        id: "data.density.need",
        purpose: "analysis",
        category: "data",
        type: "score",
        question: "How important is information density?",
        instructions: "Rate how much information users need visible at once.",
        criteria: ["Low", "Medium", "High"],
      },
    ];
    for (const q of questions) {
      expect(decisionQuestionSchema.safeParse(q).success).toBe(true);
    }
  });

  it("rejects a choice question with a single option", () => {
    const result = decisionQuestionSchema.safeParse({
      id: "data.presentation.fit",
      purpose: "analysis",
      category: "data",
      type: "choice",
      question: "?",
      instructions: "?",
      criteria: { "data-table": "Rows" },
    });
    expect(result.success).toBe(false);
  });
});

describe("DecisionResult", () => {
  it("discriminates by type", () => {
    const noul = decisionResultSchema.parse({
      questionId: "data.volume.high",
      type: "noul",
      noul: 0.93,
      confidence: 0.93,
      provider: "jev",
      model: "jev-1.13.0",
    });
    expect(noul.type).toBe("noul");

    const badChoice = decisionResultSchema.safeParse({
      questionId: "data.presentation.fit",
      type: "choice",
      noul: 0.9,
      confidence: 0.9,
      provider: "jev",
      model: "jev-1.13.0",
    });
    expect(badChoice.success).toBe(false);
  });
});

describe("UXRule", () => {
  const base = {
    id: "tables.high-volume.comparison",
    code: "DATA_VOLUME_HIGH",
    category: "tables",
    tier: "task",
    priority: "high",
    when: {
      all: [
        { question: "data.volume.high", is: "true" },
        { question: "data.comparison.required", is: "true" },
      ],
    },
    decision: "dataPresentation",
    recommend: ["data-table"],
    avoid: ["card-grid"],
    requiresCapabilities: ["tabular-display", "sorting"],
    reason: "High-volume comparison is fastest in rows and columns.",
  };

  it("accepts question and fact conditions", () => {
    expect(uxRuleSchema.safeParse(base).success).toBe(true);
    const withFact = {
      ...base,
      when: { all: [{ fact: "context.device", op: "eq", value: "desktop" }] },
    };
    expect(uxRuleSchema.safeParse(withFact).success).toBe(true);
  });

  it("rejects facts that policy may not read directly", () => {
    const result = uxRuleSchema.safeParse({
      ...base,
      when: { all: [{ fact: "context.dataVolume", op: "eq", value: "high" }] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects options that don't belong to the rule's decision slot", () => {
    const result = uxRuleSchema.safeParse({ ...base, recommend: ["checkbox"] });
    expect(result.success).toBe(false);
  });

  it("rejects a rule with no effect", () => {
    const result = uxRuleSchema.safeParse({
      ...base,
      recommend: [],
      avoid: [],
      requiresCapabilities: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("UXDecision", () => {
  it("accepts a decision with evidence and an override record", () => {
    const result = uxDecisionSchema.safeParse({
      id: "decision.dataPresentation",
      decision: "dataPresentation",
      label: "Data presentation",
      question: "Which data presentation pattern best fits the task?",
      result: { choice: "data-table", confidence: 0.94 },
      band: "proceed",
      source: "rule",
      reasons: ["High data volume", "Comparison required"],
      evidence: [
        {
          questionId: "data.volume.high",
          question: "Is the expected data volume high?",
          type: "noul",
          value: 0.97,
          confidence: 0.97,
          provider: "jev",
        },
      ],
      rulesApplied: [
        {
          id: "tables.high-volume.comparison",
          code: "DATA_VOLUME_HIGH",
          tier: "task",
          priority: "high",
          effect: "recommend",
          target: "data-table",
          contribution: 1.5,
          reason: "High-volume comparison is fastest in rows and columns.",
        },
      ],
      alternatives: [{ choice: "card-grid", reasonRejected: "Weak for high-volume comparison." }],
      override: {
        decisionId: "decision.dataPresentation",
        systemChoice: "data-table",
        designerChoice: "card-grid",
        overrideReason: "Records are visually distinct and sparse.",
        timestamp: "2026-10-06T12:00:00Z",
        actor: "designer",
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("UXPattern", () => {
  it("references capabilities, not components", () => {
    const result = uxPatternSchema.safeParse({
      id: "data-table",
      name: "Data Table",
      purpose: "Review and manipulate large structured datasets",
      requiredCapabilities: ["tabular-display", "sorting"],
      requiredStates: ["loading", "empty", "error", "populated"],
      recommendedWhen: [{ question: "data.volume.high", is: "true" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("Design system contracts", () => {
  it("accepts a normalized design system with capability claims and tiered tokens", () => {
    const result = designSystemSchema.safeParse({
      id: "default",
      name: "Default",
      version: "1.0.0",
      source: { kind: "bundled" },
      tokens: [
        { name: "color.violet.600", tier: "primitive", category: "color", value: "#7c3aed" },
        { name: "semantic.primary", tier: "semantic", category: "color", ref: "color.violet.600" },
      ],
      components: [
        {
          id: "button",
          name: "Button",
          category: "action",
          capabilities: [
            { capability: "primary-action", level: "full", source: "declared", confidence: 1 },
          ],
          states: ["default", "hover", "focus", "disabled", "loading"],
          variants: ["primary", "secondary", "destructive", "ghost"],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("requires a capability requirement to say what required it", () => {
    const result = capabilityRequirementSchema.safeParse({
      capability: "destructive-confirmation",
      priority: "critical",
      tier: "accessibility",
      requiredBy: {},
    });
    expect(result.success).toBe(false);
  });

  it("requires accepted gaps to record a resolution", () => {
    const gap = {
      id: "gap.row-selection",
      capability: "row-selection",
      kind: "partial",
      severity: "high",
      suggestedResolutions: ["extend-component", "accept-risk"],
      status: "accepted",
    };
    expect(designSystemGapSchema.safeParse(gap).success).toBe(false);
    expect(
      designSystemGapSchema.safeParse({
        ...gap,
        resolution: { kind: "accept-risk", reason: "Shipping v1 without bulk select", timestamp: "2026-10-06T12:00:00Z" },
      }).success
    ).toBe(true);
  });
});

describe("Generation", () => {
  const variant = (components: unknown[]) => ({
    id: "task-first",
    title: "Task first",
    strategy: "Task first",
    summary: "Pending approvals up front",
    rationale: "Primary task is daily review",
    pattern: "data-table",
    regions: [{ name: "Queue", purpose: "Pending items", components }],
    advantages: ["Fast"],
    tradeoffs: ["Less overview"],
  });
  const schema = buildGenerationSchema({
    patternIds: ["data-table"],
    componentIds: ["table", "button"],
    ruleIds: ["tables.high-volume.comparison"],
    gapIds: ["gap.row-selection"],
  });

  it("accepts registry components and known gap placeholders", () => {
    const result = schema.safeParse({
      variants: [
        variant([{ component: "table", purpose: "List expenses" }]),
        variant([{ gap: "gap.row-selection", purpose: "Bulk select" }]),
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invented components and unknown gaps", () => {
    const invented = schema.safeParse({
      variants: [
        variant([{ component: "magic-grid", purpose: "?" }]),
        variant([{ component: "table", purpose: "?" }]),
      ],
    });
    expect(invented.success).toBe(false);
    const unknownGap = schema.safeParse({
      variants: [
        variant([{ gap: "gap.teleport", purpose: "?" }]),
        variant([{ component: "table", purpose: "?" }]),
      ],
    });
    expect(unknownGap.success).toBe(false);
  });

  it("allows no gap placeholders when there are no gaps", () => {
    const noGaps = buildGenerationSchema({
      patternIds: ["data-table"],
      componentIds: ["table"],
      ruleIds: [],
      gapIds: [],
    });
    const result = noGaps.safeParse({
      variants: [
        variant([{ gap: "gap.row-selection", purpose: "?" }]),
        variant([{ component: "table", purpose: "?" }]),
      ],
    });
    expect(result.success).toBe(false);
  });
});
