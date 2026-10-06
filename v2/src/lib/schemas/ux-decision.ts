import { z } from "zod";
import { decisionProviderIdSchema } from "./decision-result";
import {
  decisionOptionSchema,
  decisionTypeSchema,
  kebabIdSchema,
  prioritySchema,
  ruleTierSchema,
} from "./vocabulary";

/**
 * PRD §14 Decision Object — the application-level decision, distinct from
 * the raw model result. Carries everything the Decision Inspector (§17)
 * needs: What → Why → Questions → Rules → Alternatives → Confidence →
 * Override.
 */

/** A question result cited as evidence for this decision. */
export const decisionEvidenceSchema = z.object({
  questionId: z.string(),
  question: z.string(),
  type: z.enum(["noul", "choice", "score"]),
  /** noul probability, chosen option id, or weighted score. */
  value: z.union([z.number(), z.string()]),
  confidence: z.number().min(0).max(1),
  provider: decisionProviderIdSchema,
});

export const appliedRuleSchema = z.object({
  id: z.string(),
  code: z.string(),
  tier: ruleTierSchema,
  priority: prioritySchema,
  effect: z.enum(["recommend", "avoid", "veto"]),
  /** The option this rule pushed toward or away from. */
  target: decisionOptionSchema,
  /** Signed contribution to the target's score within its tier. */
  contribution: z.number(),
  reason: z.string(),
});

export const decisionAlternativeSchema = z.object({
  choice: decisionOptionSchema,
  reasonRejected: z.string(),
  /** Ruled out by a critical rule, not merely outscored. */
  vetoed: z.boolean().default(false),
});

/** PRD §16 override record. Overrides never alter the underlying rule. */
export const decisionOverrideSchema = z.object({
  decisionId: z.string(),
  systemChoice: decisionOptionSchema,
  designerChoice: decisionOptionSchema,
  overrideReason: z.string().min(1),
  timestamp: z.iso.datetime(),
  actor: z.literal("designer"),
});

/** PRD §15 confidence bands. Thresholds live in policy config, not here. */
export const confidenceBandSchema = z.enum(["proceed", "uncertain", "needs-review"]);

export const uxDecisionSchema = z.object({
  /** "decision.dataPresentation" */
  id: z.string().regex(/^decision\.[a-zA-Z]+$/),
  decision: decisionTypeSchema,
  label: z.string(),
  /** The question this decision answers, in plain language. */
  question: z.string(),
  result: z.object({
    choice: decisionOptionSchema,
    confidence: z.number().min(0).max(1),
  }),
  band: confidenceBandSchema,
  /**
   * decision-model: the model's choice stood. rule: policy determined or
   * changed it. designer: overridden. default: no evidence either way.
   */
  source: z.enum(["decision-model", "rule", "designer", "default"]),
  reasons: z.array(z.string()),
  evidence: z.array(decisionEvidenceSchema),
  rulesApplied: z.array(appliedRuleSchema),
  alternatives: z.array(decisionAlternativeSchema),
  /** Capabilities this choice requires (§21b), for the Inspector's mapping view. */
  requiresCapabilities: z.array(kebabIdSchema).default([]),
  override: decisionOverrideSchema.optional(),
});

export type DecisionEvidence = z.infer<typeof decisionEvidenceSchema>;
export type AppliedRule = z.infer<typeof appliedRuleSchema>;
export type DecisionAlternative = z.infer<typeof decisionAlternativeSchema>;
export type DecisionOverride = z.infer<typeof decisionOverrideSchema>;
export type ConfidenceBand = z.infer<typeof confidenceBandSchema>;
export type UXDecision = z.infer<typeof uxDecisionSchema>;
