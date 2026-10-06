import { z } from "zod";
import { decisionResultSchema } from "./decision-result";
import { decisionEvidenceSchema } from "./ux-decision";
import { semverSchema } from "./vocabulary";

/**
 * PRD §24 UI Copy V2. Policy decides what copy each action needs (does it
 * need a confirmation? an undo? a count?); the LLM only writes the words,
 * slot by slot, and code lints them against versioned guidelines.
 */

export const COPY_SLOT_KINDS = [
  "button",
  "dialog-title",
  "dialog-body",
  "dialog-confirm",
  "dialog-cancel",
  "inline-confirm",
  "undo-message",
  "undo-action",
  "success",
  "error",
  "screen-title",
  "empty-heading",
  "empty-body",
  "empty-action",
  "error-state-heading",
  "error-state-body",
  "error-state-action",
  "loading",
] as const;

export const copySlotKindSchema = z.enum(COPY_SLOT_KINDS);

export const copyRiskSchema = z.object({
  destructive: z.boolean(),
  reversible: z.boolean(),
  notifiesOthers: z.boolean(),
  costsMoney: z.boolean(),
  /** The decision-model answers behind the flags. */
  evidence: z.array(decisionEvidenceSchema),
});

/** Something that needs copy: one of the state's actions, or the screen itself. */
export const copyTargetSchema = z.object({
  id: z.string(),
  kind: z.enum(["action", "screen"]),
  name: z.string(),
  description: z.string().default(""),
  risk: copyRiskSchema.optional(),
  /** How the interaction protects the user, decided by policy (§24: "policy determines interaction requirements"). */
  interaction: z.enum(["confirm-dialog", "undo-toast", "inline-confirm", "none"]).default("none"),
  /** Applies to several selected items at once (bulk actions decided). */
  bulk: z.boolean().default(false),
  /** Plain-language reasons for the interaction and slots. */
  requirements: z.array(z.string()),
});

export const copySlotSchema = z.object({
  /** "<target>.<kind>", e.g. "reject.dialog-confirm". */
  id: z.string(),
  target: z.string(),
  kind: copySlotKindSchema,
  label: z.string(),
  maxChars: z.number().int().positive(),
  /** Guideline texts that apply, sent to the writer. */
  guidance: z.array(z.string()),
});

export const copyTextSchema = z.object({
  text: z.string().trim().min(1),
  alternatives: z.array(z.string().trim().min(1)).max(2).default([]),
});

export const copyLintSchema = z.object({
  slotId: z.string(),
  guidelineId: z.string(),
  code: z.string(),
  severity: z.enum(["error", "warning"]),
  message: z.string(),
});

export const copyRunSchema = z.object({
  id: z.string(),
  generatedAt: z.iso.datetime(),
  tone: z.string(),
  source: z.enum(["llm", "draft"]),
  model: z.string(),
  notices: z.array(z.string()),
  decisionModel: z.object({ provider: z.string(), model: z.string() }),
  targets: z.array(copyTargetSchema),
  slots: z.array(copySlotSchema),
  copy: z.record(z.string(), copyTextSchema),
  toneNotes: z.string().optional(),
  lint: z.array(copyLintSchema),
  /** Raw decision-model results for the action-risk questions. */
  results: z.array(decisionResultSchema),
  basedOn: z.array(z.object({ decision: z.string(), choice: z.string() })),
  versions: z.object({ copyGuidelines: semverSchema, prompts: semverSchema, decisionModel: z.string() }),
});

export type CopySlotKind = z.infer<typeof copySlotKindSchema>;
export type CopyRisk = z.infer<typeof copyRiskSchema>;
export type CopyTarget = z.infer<typeof copyTargetSchema>;
export type CopySlot = z.infer<typeof copySlotSchema>;
export type CopyText = z.infer<typeof copyTextSchema>;
export type CopyLint = z.infer<typeof copyLintSchema>;
export type CopyRun = z.infer<typeof copyRunSchema>;
