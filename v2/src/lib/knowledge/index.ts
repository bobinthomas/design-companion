import { z } from "zod";
import manifestJson from "@knowledge/manifest.json";
import policyJson from "@knowledge/policy.json";
import analysisQuestionsJson from "@knowledge/questions/analysis.json";
import evaluationQuestionsJson from "@knowledge/questions/evaluation.json";
import evaluatorJson from "@knowledge/evaluator.json";
import copyQuestionsJson from "@knowledge/questions/copy.json";
import copyGuidelinesJson from "@knowledge/copy-guidelines.json";
import feedbackQuestionsJson from "@knowledge/questions/feedback.json";
import feedbackKnowledgeJson from "@knowledge/feedback-rules.json";
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
  COPY_SLOT_KINDS,
  copySlotKindSchema,
  DECISION_OPTIONS,
  decisionQuestionSchema,
  EVALUATION_CATEGORIES,
  evaluationCategorySchema,
  FEEDBACK_ISSUE_KINDS,
  feedbackIssueKindSchema,
  feedbackRuleSchema,
  type EvaluationCategory,
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
  copyGuidelines: semverSchema,
  feedbackRules: semverSchema,
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

/** "task-effectiveness" → "taskEffectiveness" */
export function evaluationCategoryOf(question: DecisionQuestion): EvaluationCategory {
  return evaluationCategorySchema.parse(question.category.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()));
}

/** PRD §28 atomic evaluation questions (templates; scoped per solution at request time). */
export const EVALUATION_QUESTIONS: readonly DecisionQuestion[] = z
  .array(decisionQuestionSchema)
  .parse(evaluationQuestionsJson)
  .map((q) => {
    if (q.purpose !== "evaluation") throw new Error(`${q.id}: purpose must be "evaluation"`);
    if (q.type === "choice") throw new Error(`${q.id}: evaluation questions are noul or score`);
    evaluationCategoryOf(q);
    return q;
  });

const severitySchema = z.enum(["critical", "high", "medium", "low"]);

export const evaluatorConfigSchema = z
  .object({
    categoryWeights: z.record(evaluationCategorySchema, z.number().positive()),
    /** Share of a category score that comes from questions when checks also apply. */
    questionShare: probability,
    /** A failed critical check caps its category (and the overall score) here. */
    criticalCategoryCap: z.number().min(0).max(100),
    criticalOverallCap: z.number().min(0).max(100),
    /** Noul answers below `failBelow` raise the configured issue; below `unsureBelow`, a low-severity "may" issue. */
    unsureBelow: probability,
    failBelow: probability,
    questions: z.record(
      z.string(),
      z.object({ severity: severitySchema, issue: z.string().min(1), recommendation: z.string().min(1) })
    ),
  })
  .superRefine((c, ctx) => {
    const ids = new Set(EVALUATION_QUESTIONS.map((q) => q.id));
    for (const id of ids) if (!c.questions[id]) ctx.addIssue({ code: "custom", message: `evaluator.questions is missing ${id}` });
    for (const id of Object.keys(c.questions)) if (!ids.has(id)) ctx.addIssue({ code: "custom", message: `evaluator.questions.${id} has no question` });
    const covered = new Set(EVALUATION_QUESTIONS.map(evaluationCategoryOf));
    for (const category of EVALUATION_CATEGORIES) {
      if (!covered.has(category)) ctx.addIssue({ code: "custom", message: `no evaluation question for ${category}` });
    }
  });

export const EVALUATOR = evaluatorConfigSchema.parse(evaluatorJson);

/** PRD §24: per-action risk questions, asked once per action in one batched request. */
export const COPY_QUESTIONS: readonly DecisionQuestion[] = z
  .array(decisionQuestionSchema)
  .parse(copyQuestionsJson)
  .map((q) => {
    if (q.purpose !== "copy" || q.type !== "noul") throw new Error(`${q.id}: copy questions are noul with purpose "copy"`);
    return q;
  });

const guidelineCheckSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("forbidExact"), values: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("forbidPhrase"), values: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("includesActionVerb") }),
  z.object({ type: z.literal("mustMentionWhen"), when: z.enum(["irreversible", "bulk"]), values: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("maxChars") }),
]);

export const copyGuidelineSchema = z.object({
  id: z.string().regex(/^copy\.[a-z0-9-]+$/),
  code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  appliesTo: z.array(z.union([copySlotKindSchema, z.literal("*")])).min(1),
  severity: z.enum(["error", "warning"]),
  text: z.string().min(1),
  check: guidelineCheckSchema.optional(),
  source: z.string().optional(),
});

export const copyGuidelinesSchema = z
  .object({
    slots: z.record(copySlotKindSchema, z.object({ label: z.string().min(1), maxChars: z.number().int().positive() })),
    guidelines: z.array(copyGuidelineSchema).min(1),
  })
  .superRefine((g, ctx) => {
    for (const kind of COPY_SLOT_KINDS) if (!g.slots[kind]) ctx.addIssue({ code: "custom", message: `copy-guidelines.slots is missing ${kind}` });
    const ids = g.guidelines.map((x) => x.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "copy guideline ids must be unique" });
  });

export type CopyGuideline = z.infer<typeof copyGuidelineSchema>;
export const COPY_GUIDELINES = copyGuidelinesSchema.parse(copyGuidelinesJson);

/** PRD §25: per-issue questions, asked once per issue in one batched request. */
export const FEEDBACK_QUESTIONS: readonly DecisionQuestion[] = z
  .array(decisionQuestionSchema)
  .parse(feedbackQuestionsJson)
  .map((q) => {
    if (q.purpose !== "feedback") throw new Error(`${q.id}: purpose must be "feedback"`);
    return q;
  });

const feedbackKnowledgeSchema = z
  .object({
    kinds: z.record(feedbackIssueKindSchema, z.object({ label: z.string().min(1), keywords: z.array(z.string()) })),
    positiveKeywords: z.array(z.string().min(1)),
    rules: z.array(feedbackRuleSchema).min(1),
  })
  .superRefine((k, ctx) => {
    const questions = new Map(FEEDBACK_QUESTIONS.map((q) => [q.id, q]));
    const ruleCodes = new Set(UX_RULES.map((r) => r.code));
    for (const kind of FEEDBACK_ISSUE_KINDS) if (!k.kinds[kind]) ctx.addIssue({ code: "custom", message: `feedback kinds is missing ${kind}` });
    for (const rule of k.rules) {
      for (const c of [...(rule.when.all ?? []), ...(rule.when.any ?? []), ...(rule.when.none ?? [])]) {
        if ("fact" in c) ctx.addIssue({ code: "custom", message: `${rule.id}: feedback rules can't use facts` });
        else {
          const q = questions.get(c.question);
          if (!q) ctx.addIssue({ code: "custom", message: `${rule.id}: unknown question ${c.question}` });
          else if (("is" in c && q.type !== "noul") || (("scoreGte" in c || "scoreLte" in c) && q.type !== "score")) {
            ctx.addIssue({ code: "custom", message: `${rule.id}: ${c.question} has the wrong type for its condition` });
          }
        }
      }
      for (const cap of rule.capabilities) if (!CAPABILITY_BY_ID.has(cap)) ctx.addIssue({ code: "custom", message: `${rule.id}: unknown capability ${cap}` });
      for (const code of rule.relatedRules) if (!ruleCodes.has(code)) ctx.addIssue({ code: "custom", message: `${rule.id}: unknown UX rule ${code}` });
    }
  });

export const FEEDBACK_KNOWLEDGE = feedbackKnowledgeSchema.parse(feedbackKnowledgeJson);
