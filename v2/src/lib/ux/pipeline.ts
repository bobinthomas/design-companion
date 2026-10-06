import { DEFAULT_DESIGN_SYSTEM } from "@/lib/design-system/default";
import { detectGaps, gapBehavior } from "@/lib/design-system/gaps";
import { DesignSystemRegistry } from "@/lib/design-system/registry";
import { KNOWLEDGE_VERSIONS, UX_RULES } from "@/lib/knowledge";
import { resolveComponents } from "@/lib/ux/components/resolve";
import { resolvePatterns } from "@/lib/ux/patterns/resolve";
import { decide, type DesignerOverride } from "@/lib/ux/policy/engine";
import { buildRequirements } from "@/lib/ux/policy/requirements";
import { buildRuleContext, fireRules, toFiredRule } from "@/lib/ux/rules/evaluate";
import type {
  DecisionQuestion,
  DecisionResult,
  DesignSystem,
  PolicyOutcome,
  UXRule,
  UXState,
} from "@/lib/schemas";

export interface PolicyInput {
  state: UXState;
  questions: readonly DecisionQuestion[];
  results: readonly DecisionResult[];
  overrides?: readonly DesignerOverride[];
  /** Defaults to the bundled default design system. */
  designSystem?: DesignSystem;
  rules?: readonly UXRule[];
}

/**
 * The deterministic half of the pipeline (PRD §4.1):
 *
 *   results → rules → decisions → patterns → capability requirements
 *          → design-system resolution → components + gaps
 *
 * No model is called here. Given the same state, results, overrides and
 * knowledge, it always produces the same outcome.
 */
export function runPolicy({
  state,
  questions,
  results,
  overrides = [],
  designSystem = DEFAULT_DESIGN_SYSTEM,
  rules = UX_RULES,
}: PolicyInput): PolicyOutcome {
  const ctx = buildRuleContext(state, questions, results);
  const registry = new DesignSystemRegistry(designSystem);

  const fired = fireRules(ctx, rules);
  const { decisions, warnings, requirementPriority } = decide({ ctx, fired, overrides, registry });
  const patterns = resolvePatterns(ctx, decisions);
  const { requirements, requiredStates } = buildRequirements(decisions, requirementPriority, fired, patterns);
  const { resolutions, gaps } = detectGaps(requirements, registry);
  const components = resolveComponents(resolutions, registry);
  const gapsWithBehavior = gaps.map((g) => ({ ...g, behavior: gapBehavior(g) }));

  return {
    decisions,
    requirements,
    requiredStates,
    patterns,
    components,
    resolutions,
    gaps: gapsWithBehavior,
    blocked: gapsWithBehavior.some((g) => g.behavior === "block"),
    warnings,
    rulesFired: fired.map(toFiredRule),
    versions: {
      decisionModel: results[0]?.model ?? "none",
      questionSet: KNOWLEDGE_VERSIONS.questionSet,
      rules: KNOWLEDGE_VERSIONS.rules,
      policy: KNOWLEDGE_VERSIONS.policy,
      patterns: KNOWLEDGE_VERSIONS.patterns,
      capabilities: KNOWLEDGE_VERSIONS.capabilities,
      compositions: KNOWLEDGE_VERSIONS.compositions,
      normalization: KNOWLEDGE_VERSIONS.normalization,
      designSystem: { id: designSystem.id, version: designSystem.version },
      evaluator: KNOWLEDGE_VERSIONS.evaluator,
      prompts: KNOWLEDGE_VERSIONS.prompts,
    },
  };
}
