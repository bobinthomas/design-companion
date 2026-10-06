import { z } from "zod";
import manifestJson from "@knowledge/manifest.json";
import policyJson from "@knowledge/policy.json";
import analysisQuestionsJson from "@knowledge/questions/analysis.json";
import capabilitiesJson from "@knowledge/capabilities.json";
import compositionsJson from "@knowledge/compositions.json";
import decisionCapabilitiesJson from "@knowledge/decision-capabilities.json";
import normalizationJson from "@knowledge/normalization.json";
import patternsJson from "@knowledge/patterns.json";
import accessibilityRulesJson from "@knowledge/ux-rules/accessibility.json";
import errorPreventionRulesJson from "@knowledge/ux-rules/error-prevention.json";
import feedbackRulesJson from "@knowledge/ux-rules/feedback.json";
import filteringRulesJson from "@knowledge/ux-rules/filtering.json";
import formsRulesJson from "@knowledge/ux-rules/forms.json";
import layoutRulesJson from "@knowledge/ux-rules/layout.json";
import navigationRulesJson from "@knowledge/ux-rules/navigation.json";
import responsiveRulesJson from "@knowledge/ux-rules/responsive.json";
import searchRulesJson from "@knowledge/ux-rules/search.json";
import selectionRulesJson from "@knowledge/ux-rules/selection.json";
import tablesRulesJson from "@knowledge/ux-rules/tables.json";
import {
  capabilityDefinitionSchema,
  compositionRecipeSchema,
  DECISION_OPTIONS,
  decisionQuestionSchema,
  kebabIdSchema,
  semverSchema,
  uxPatternSchema,
  uxRuleSchema,
  type CapabilityDefinition,
  type CompositionRecipe,
  type DecisionQuestion,
  type DecisionType,
  type UXPattern,
  type UXRule,
} from "@/lib/schemas";

/**
 * Bundled, versioned UX knowledge. Workers have no runtime filesystem, so
 * every knowledge file is imported statically and validated once at module
 * load — an invalid file fails the build and the test suite, never a
 * request.
 */

const manifestSchema = z.object({
  questionSet: semverSchema,
  rules: semverSchema,
  policy: semverSchema,
  patterns: semverSchema,
  capabilities: semverSchema,
  compositions: semverSchema,
  normalization: semverSchema,
  evaluator: semverSchema,
  prompts: semverSchema,
});

const probability = z.number().min(0).max(1);
const gapBehaviorSchema = z.enum(["block", "mark-net-new", "warn"]);

export const policyConfigSchema = z
  .object({
    confidence: z.object({ proceed: probability, review: probability }),
    noulTrueThreshold: probability,
    quota: z.object({ jevRequestsPerIpPerDay: z.number().int().min(0) }),
    /** §21c gap policy: what each gap severity does to generation. */
    gaps: z.object({
      critical: gapBehaviorSchema,
      high: gapBehaviorSchema,
      medium: gapBehaviorSchema,
      low: gapBehaviorSchema,
    }),
    /** §21e confidence assigned to inferred capability claims. */
    capabilityMapping: z.object({
      maxQuestionsPerImport: z.number().int().min(0),
      inferredFromName: probability,
      inferredFromProps: probability,
      inferredFromNameAndProps: probability,
    }),
    /** UX policy ranking (§13): how evidence and rules turn into a choice. */
    ranking: z.object({
      /** Scores within this distance at a tier count as tied, letting the next tier decide. */
      tieTolerance: z.number().min(0),
      /** Weight of a decision-linked choice question's probability (task tier). */
      priorWeight: z.number().min(0),
      priorityWeights: z.object({
        critical: z.number().positive(),
        high: z.number().positive(),
        medium: z.number().positive(),
        low: z.number().positive(),
      }),
      /** Design-system-tier penalty per required capability, by resolution outcome. */
      designSystemPenalty: z.object({
        partial: z.number().min(0),
        unconfirmed: z.number().min(0),
        missing: z.number().min(0),
      }),
      maxAlternatives: z.number().int().min(0),
      defaultRequirementPriority: z.enum(["critical", "high", "medium", "low"]),
    }),
  })
  .refine((p) => p.confidence.proceed > p.confidence.review, {
    message: "proceed threshold must be above review threshold",
  });

export type PolicyConfig = z.infer<typeof policyConfigSchema>;
export type GapBehavior = z.infer<typeof gapBehaviorSchema>;

const normalizationSchema = z.object({
  /** canonical component id → normalized aliases and the capabilities its name implies */
  components: z.record(
    kebabIdSchema,
    z.object({ aliases: z.array(z.string()).min(1), capabilities: z.array(kebabIdSchema) })
  ),
  /** canonical variant → aliases, plus capabilities the variant implies */
  variants: z.record(
    kebabIdSchema,
    z.object({ aliases: z.array(z.string()).min(1), capabilities: z.array(kebabIdSchema).default([]) })
  ),
  /** canonical state → aliases */
  states: z.record(z.string(), z.array(z.string()).min(1)),
  /** capability → normalized prop names that hint at it */
  props: z.record(kebabIdSchema, z.array(z.string()).min(1)),
});

export type NormalizationTables = z.infer<typeof normalizationSchema>;

const decisionCapabilitiesSchema = z
  .record(z.string(), z.record(z.string(), z.array(kebabIdSchema)))
  .superRefine((map, ctx) => {
    for (const [decision, options] of Object.entries(DECISION_OPTIONS)) {
      const mapped = Object.keys(map[decision] ?? {}).sort();
      const expected = [...options].sort();
      if (JSON.stringify(mapped) !== JSON.stringify(expected)) {
        ctx.addIssue({
          code: "custom",
          message: `decision-capabilities.${decision} must map exactly ${expected.join(", ")}`,
        });
      }
    }
  });

export const KNOWLEDGE_VERSIONS = manifestSchema.parse(manifestJson);
export const POLICY = policyConfigSchema.parse(policyJson);

export const ANALYSIS_QUESTIONS: readonly DecisionQuestion[] = z
  .array(decisionQuestionSchema)
  .parse(analysisQuestionsJson);

export const CAPABILITIES: readonly CapabilityDefinition[] = z
  .array(capabilityDefinitionSchema)
  .parse(capabilitiesJson);

export const CAPABILITY_BY_ID: ReadonlyMap<string, CapabilityDefinition> = new Map(
  CAPABILITIES.map((c) => [c.id, c])
);

export const COMPOSITIONS: readonly CompositionRecipe[] = z
  .array(compositionRecipeSchema)
  .parse(compositionsJson);

/** The capabilities each decision option needs from the design system (§21b). */
export const DECISION_CAPABILITIES = decisionCapabilitiesSchema.parse(
  decisionCapabilitiesJson
) as Record<DecisionType, Record<string, string[]>>;

export const NORMALIZATION: NormalizationTables = normalizationSchema.parse(normalizationJson);

/** The UX rule library (§12), one file per area, in evaluation order. */
export const UX_RULES: readonly UXRule[] = z.array(uxRuleSchema).parse([
  ...accessibilityRulesJson,
  ...tablesRulesJson,
  ...filteringRulesJson,
  ...searchRulesJson,
  ...layoutRulesJson,
  ...errorPreventionRulesJson,
  ...feedbackRulesJson,
  ...navigationRulesJson,
  ...selectionRulesJson,
  ...formsRulesJson,
  ...responsiveRulesJson,
]);

/** The UX pattern registry (§18). */
export const UX_PATTERNS: readonly UXPattern[] = z.array(uxPatternSchema).parse(patternsJson);
