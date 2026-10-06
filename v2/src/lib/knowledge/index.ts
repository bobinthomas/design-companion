import { z } from "zod";
import manifestJson from "@knowledge/manifest.json";
import policyJson from "@knowledge/policy.json";
import analysisQuestionsJson from "@knowledge/questions/analysis.json";
import { decisionQuestionSchema, semverSchema, type DecisionQuestion } from "@/lib/schemas";

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
  evaluator: semverSchema,
  prompts: semverSchema,
});

const probability = z.number().min(0).max(1);

export const policyConfigSchema = z
  .object({
    confidence: z.object({ proceed: probability, review: probability }),
    noulTrueThreshold: probability,
    quota: z.object({ jevRequestsPerIpPerDay: z.number().int().min(0) }),
  })
  .refine((p) => p.confidence.proceed > p.confidence.review, {
    message: "proceed threshold must be above review threshold",
  });

export type PolicyConfig = z.infer<typeof policyConfigSchema>;

export const KNOWLEDGE_VERSIONS = manifestSchema.parse(manifestJson);
export const POLICY = policyConfigSchema.parse(policyJson);

export const ANALYSIS_QUESTIONS: readonly DecisionQuestion[] = z
  .array(decisionQuestionSchema)
  .parse(analysisQuestionsJson);
