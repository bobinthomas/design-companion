import { z } from "zod";
import type { Provider, ProviderClientConfig } from "@/lib/providers";

export type Mode = "layout" | "copy" | "feedback";

export const MODE_LABELS: Record<Mode, string> = {
  layout: "Layout Brainstorm",
  copy: "UI Copy",
  feedback: "Feedback Summary",
};

// ---------- Layout Brainstorm ----------

export const layoutDirectionSchema = z.object({
  title: z.string(),
  recommended: z.boolean().optional(),
  hierarchy: z.array(z.string()).min(1),
  sections: z
    .array(
      z.object({
        name: z.string(),
        purpose: z.string(),
      })
    )
    .min(1),
  interactionPatterns: z.array(z.string()).default([]),
  mobileNotes: z.array(z.string()).default([]),
  desktopNotes: z.array(z.string()).default([]),
});

export const layoutOutputSchema = z.object({
  directions: z.array(layoutDirectionSchema).min(2).max(3),
  assumptions: z.array(z.string()).default([]),
});

export type LayoutDirection = z.infer<typeof layoutDirectionSchema>;
export type LayoutOutput = z.infer<typeof layoutOutputSchema>;

// ---------- UI Copy Generator ----------

export const copyStringSchema = z.object({
  label: z.string(),
  value: z.string(),
  alternatives: z.array(z.string()).default([]),
});

export const copyGroupSchema = z.object({
  group: z.string(),
  items: z.array(copyStringSchema).min(1),
});

export const copyOutputSchema = z.object({
  groups: z.array(copyGroupSchema).min(1),
  toneNotes: z.string().optional(),
});

export type CopyString = z.infer<typeof copyStringSchema>;
export type CopyGroup = z.infer<typeof copyGroupSchema>;
export type CopyOutput = z.infer<typeof copyOutputSchema>;

// ---------- Usability Feedback Summarizer ----------

export const feedbackThemeSchema = z.object({
  name: z.string(),
  strength: z.enum(["strong-positive", "positive", "mixed", "negative", "strong-negative"]),
  evidence: z.array(z.string()).min(1),
});

export const feedbackIssueSchema = z.object({
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  issue: z.string(),
  severity: z.enum(["Low", "Medium", "Medium-High", "High"]),
  recommendation: z.string(),
});

export const feedbackOutputSchema = z.object({
  themes: z.array(feedbackThemeSchema).min(1),
  prioritizedIssues: z.array(feedbackIssueSchema).default([]),
  positiveSignals: z.array(z.string()).default([]),
  nextSteps: z.array(z.string()).default([]),
});

export type FeedbackTheme = z.infer<typeof feedbackThemeSchema>;
export type FeedbackIssue = z.infer<typeof feedbackIssueSchema>;
export type FeedbackOutput = z.infer<typeof feedbackOutputSchema>;

// ---------- API envelope ----------

export interface GenerateRequestBody {
  input: string;
  tone?: string;
  priorOutput?: unknown;
  refinementInstruction?: string;
  clientConfig?: ProviderClientConfig;
}

export interface GenerateResponseBody<T> {
  data: T;
  source: Provider | "mock";
}

export interface GenerateErrorBody {
  error: string;
}
