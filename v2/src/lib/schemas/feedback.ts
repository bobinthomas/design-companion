import { z } from "zod";
import { decisionResultSchema } from "./decision-result";
import { decisionEvidenceSchema } from "./ux-decision";
import { whenSchema } from "./ux-rule";
import { kebabIdSchema, semverSchema } from "./vocabulary";

/**
 * PRD §25 Feedback Summary V2:
 *   raw feedback → LLM clustering → UX issue model → atomic questions →
 *   decision model → policy (feedback rules) → recommended UX changes.
 * The LLM only groups and quotes; every quote must appear in the input.
 */

export const FEEDBACK_ISSUE_KINDS = [
  "discoverability",
  "efficiency",
  "comprehension",
  "error-recovery",
  "feedback",
  "trust",
  "performance",
  "accessibility",
  "navigation",
  "content",
  "other",
] as const;

export const feedbackIssueKindSchema = z.enum(FEEDBACK_ISSUE_KINDS);

/** A versioned rule from knowledge/feedback-rules.json. */
export const feedbackRuleSchema = z.object({
  id: z.string().regex(/^fb\.[a-z0-9-]+$/),
  code: z.string().regex(/^FB_[A-Z0-9_]+$/),
  /** Only for issues of these kinds; any kind when omitted. */
  kinds: z.array(feedbackIssueKindSchema).optional(),
  when: whenSchema,
  recommend: z.string().min(1),
  capabilities: z.array(kebabIdSchema).default([]),
  /** Codes of UX rules this recommendation echoes. */
  relatedRules: z.array(z.string()).default([]),
});

/** The LLM's (or the draft clusterer's) grouping of raw feedback into issues. */
export const feedbackClusteringSchema = z.object({
  issues: z
    .array(
      z.object({
        id: kebabIdSchema,
        title: z.string().trim().min(1).max(100),
        kind: feedbackIssueKindSchema,
        summary: z.string().trim().min(1).max(400),
        /** Verbatim quotes from the feedback. */
        evidence: z.array(z.string().trim().min(3).max(300)).min(1),
      })
    )
    .max(12),
  positives: z.array(z.object({ title: z.string().min(1), evidence: z.array(z.string().min(3).max(300)).min(1) })).default([]),
  nextQuestions: z.array(z.string().min(1)).max(5).default([]),
});

export const feedbackPrioritySchema = z.enum(["P0", "P1", "P2", "P3"]);

export const feedbackIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: feedbackIssueKindSchema,
  summary: z.string(),
  evidence: z.array(z.string()),
  /** Quotes supporting it — a proxy for frequency in the sample. */
  mentions: z.number().int().nonnegative(),
  judgments: z.array(decisionEvidenceSchema),
  /** 0–3 from the severity question. */
  severity: z.number().min(0).max(3),
  priority: feedbackPrioritySchema,
  /** Why that priority, in words. */
  priorityReason: z.string(),
  recommendations: z.array(
    z.object({ ruleId: z.string(), code: z.string(), text: z.string(), capabilities: z.array(z.string()), relatedRules: z.array(z.string()) })
  ),
});

export const feedbackRunSchema = z.object({
  id: z.string(),
  createdAt: z.iso.datetime(),
  source: z.enum(["llm", "draft"]),
  model: z.string(),
  notices: z.array(z.string()),
  decisionModel: z.object({ provider: z.string(), model: z.string() }),
  /** The raw feedback, kept so quotes can be checked against it. */
  input: z.string(),
  /** Analysis the feedback was read against, if any. */
  context: z.object({ sessionId: z.string(), product: z.string() }).optional(),
  issues: z.array(feedbackIssueSchema),
  positives: feedbackClusteringSchema.shape.positives,
  nextQuestions: z.array(z.string()),
  results: z.array(decisionResultSchema),
  versions: z.object({ feedbackRules: semverSchema, prompts: semverSchema, decisionModel: z.string() }),
});

export type FeedbackIssueKind = z.infer<typeof feedbackIssueKindSchema>;
export type FeedbackRule = z.infer<typeof feedbackRuleSchema>;
export type FeedbackClustering = z.infer<typeof feedbackClusteringSchema>;
export type FeedbackIssue = z.infer<typeof feedbackIssueSchema>;
export type FeedbackRun = z.infer<typeof feedbackRunSchema>;
