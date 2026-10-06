import { z } from "zod";
import { capabilityRequirementSchema } from "./capability-requirement";
import { capabilityResolutionSchema, designSystemGapSchema } from "./design-system-gap";
import { decisionEvidenceSchema, uxDecisionSchema } from "./ux-decision";
import { knowledgeVersionsSchema } from "./versions";
import { decisionTypeSchema, kebabIdSchema, prioritySchema, ruleTierSchema, stateSchema } from "./vocabulary";

/**
 * The UX policy layer's output (PRD §11, §19): decisions plus everything
 * derived from them — capability requirements, patterns, components and
 * design-system gaps — with the rules that fired and the evidence behind
 * them, so the whole result is traceable.
 */

export const firedRuleSchema = z.object({
  ruleId: z.string(),
  code: z.string(),
  tier: ruleTierSchema,
  priority: prioritySchema,
  decision: decisionTypeSchema.optional(),
  evidence: z.array(decisionEvidenceSchema),
});

export const patternMatchSchema = z.object({
  pattern: kebabIdSchema,
  name: z.string(),
  /** 0..1 fit from matched conditions and compatible decisions. */
  score: z.number().min(0).max(1),
  role: z.enum(["primary", "supporting"]),
  /** Question ids whose conditions matched. */
  matchedQuestions: z.array(z.string()),
  /** "decision=choice" pairs the pattern is consistent with. */
  matchedDecisions: z.array(z.string()),
});

export const componentSelectionSchema = z.object({
  component: kebabIdSchema,
  name: z.string(),
  /** Capabilities this component provides in the solution. */
  serves: z.array(kebabIdSchema).min(1),
  /** Direct claim, or as part of a composition recipe. */
  via: z.array(z.enum(["direct", "composite"])).min(1),
});

export const gapWithBehaviorSchema = designSystemGapSchema.and(
  z.object({ behavior: z.enum(["block", "mark-net-new", "warn", "none"]) })
);

export const policyOutcomeSchema = z.object({
  decisions: z.array(uxDecisionSchema),
  requirements: z.array(capabilityRequirementSchema),
  requiredStates: z.array(stateSchema),
  patterns: z.array(patternMatchSchema),
  components: z.array(componentSelectionSchema),
  resolutions: z.array(capabilityResolutionSchema),
  gaps: z.array(gapWithBehaviorSchema),
  /** True when an open gap blocks generation (§21c). */
  blocked: z.boolean(),
  /** Plain-language cautions, e.g. an override that contradicts a critical rule. */
  warnings: z.array(z.string()),
  rulesFired: z.array(firedRuleSchema),
  versions: knowledgeVersionsSchema,
});

export type FiredRule = z.infer<typeof firedRuleSchema>;
export type PatternMatch = z.infer<typeof patternMatchSchema>;
export type ComponentSelection = z.infer<typeof componentSelectionSchema>;
export type GapWithBehavior = z.infer<typeof gapWithBehaviorSchema>;
export type PolicyOutcome = z.infer<typeof policyOutcomeSchema>;
