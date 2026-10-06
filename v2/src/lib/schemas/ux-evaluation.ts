import { z } from "zod";
import { decisionResultSchema } from "./decision-result";
import { layoutVariantSchema } from "./generation";
import { decisionEvidenceSchema } from "./ux-decision";
import { knowledgeVersionsSchema } from "./versions";

/**
 * PRD §27–28 UX Evaluation. Evaluation is decomposed: atomic evaluation
 * questions go to the decision provider, deterministic checks run in code
 * (required states, capability resolution, critical rules), and code
 * aggregates both into category scores. Every score cites its evidence.
 */

export const EVALUATION_CATEGORIES = [
  "taskEffectiveness",
  "taskClarity",
  "informationArchitecture",
  "interactionQuality",
  "cognitiveLoad",
  "accessibility",
  "errorPrevention",
  "feedback",
  "consistency",
  "designSystemCompliance",
  "requiredStates",
  "responsiveBehavior",
] as const;

export const EVALUATION_CATEGORY_LABELS: Record<EvaluationCategory, string> = {
  taskEffectiveness: "Task effectiveness",
  taskClarity: "Task clarity",
  informationArchitecture: "Information architecture",
  interactionQuality: "Interaction quality",
  cognitiveLoad: "Cognitive load",
  accessibility: "Accessibility",
  errorPrevention: "Error prevention",
  feedback: "Feedback",
  consistency: "Consistency",
  designSystemCompliance: "Design-system compliance",
  requiredStates: "Required states",
  responsiveBehavior: "Responsive behavior",
};

export const evaluationCategorySchema = z.enum(EVALUATION_CATEGORIES);

/** A deterministic check run in code. */
export const evaluationCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: evaluationCategorySchema,
  passed: z.boolean(),
  ruleId: z.string().optional(),
  gapId: z.string().optional(),
  detail: z.string().optional(),
});

export const categoryScoreSchema = z.object({
  score: z.number().min(0).max(100),
  /** Question results that fed this score. */
  evidence: z.array(decisionEvidenceSchema),
  /** Ids of deterministic checks that fed this score. */
  checks: z.array(z.string()),
});

export const evaluationIssueSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low"]),
  category: evaluationCategorySchema,
  issue: z.string().min(1),
  recommendation: z.string().min(1),
  /** Exactly what produced the issue: a question, a check, a rule or a gap. */
  from: z.object({
    questionId: z.string().optional(),
    checkId: z.string().optional(),
    ruleId: z.string().optional(),
    gapId: z.string().optional(),
  }),
  location: z.string().optional(),
});

export const uxEvaluationSchema = z.object({
  /** Id of the variant / spec evaluated. */
  subjectId: z.string(),
  overallScore: z.number().min(0).max(100),
  categories: z.record(evaluationCategorySchema, categoryScoreSchema),
  issues: z.array(evaluationIssueSchema),
  checks: z.array(evaluationCheckSchema),
  versions: knowledgeVersionsSchema,
});

/** What is evaluated: a generated layout direction, or a designer's own description of a UI or spec. */
export const evaluationSubjectInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("direction"),
    variant: layoutVariantSchema,
    /** The Layout Brainstorm run it came from. */
    layoutRunId: z.string().optional(),
  }),
  z.object({
    kind: z.literal("description"),
    title: z.string().trim().min(1).max(80),
    description: z.string().trim().min(20).max(6000),
  }),
]);

export const evaluationSubjectSchema = z.object({
  id: z.string(),
  kind: z.enum(["direction", "description"]),
  label: z.string(),
  layoutRunId: z.string().optional(),
  /** The described UI, for "description" subjects. */
  description: z.string().optional(),
});

/** One evaluation request (one decision-model request for all its subjects), as stored in the trace. */
export const evaluationRunSchema = z.object({
  id: z.string(),
  evaluatedAt: z.iso.datetime(),
  provider: z.string(),
  model: z.string(),
  notices: z.array(z.string()),
  subjects: z.array(evaluationSubjectSchema).min(1),
  evaluations: z.array(uxEvaluationSchema).min(1),
  /** Raw decision-model results, in batch form, for the trace. */
  results: z.array(decisionResultSchema),
  /** The decisions the subjects were evaluated against, to detect staleness. */
  basedOn: z.array(z.object({ decision: z.string(), choice: z.string() })),
});

export type EvaluationSubjectInput = z.infer<typeof evaluationSubjectInputSchema>;
export type EvaluationSubject = z.infer<typeof evaluationSubjectSchema>;
export type EvaluationRun = z.infer<typeof evaluationRunSchema>;
export type EvaluationCategory = z.infer<typeof evaluationCategorySchema>;
export type EvaluationCheck = z.infer<typeof evaluationCheckSchema>;
export type CategoryScore = z.infer<typeof categoryScoreSchema>;
export type EvaluationIssue = z.infer<typeof evaluationIssueSchema>;
export type UXEvaluation = z.infer<typeof uxEvaluationSchema>;
