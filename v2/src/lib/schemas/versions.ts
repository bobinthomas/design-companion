import { z } from "zod";
import { semverSchema } from "./vocabulary";

/**
 * PRD §30 Versioning. Recorded on every decision set, generation and
 * evaluation so a result can be reproduced against the exact knowledge,
 * policy and models it was derived from.
 */
export const knowledgeVersionsSchema = z.object({
  /** Provider-reported, e.g. "jev-1.13.0", "mock-1.0.0". */
  decisionModel: z.string(),
  questionSet: semverSchema,
  rules: semverSchema,
  policy: semverSchema,
  patterns: semverSchema,
  capabilities: semverSchema,
  compositions: semverSchema,
  normalization: semverSchema,
  designSystem: z.object({ id: z.string(), version: semverSchema }),
  evaluator: semverSchema,
  prompts: semverSchema,
});

export type KnowledgeVersions = z.infer<typeof knowledgeVersionsSchema>;
