import { z } from "zod";
import {
  accessibilityLevelSchema,
  audienceSchema,
  deviceSchema,
  expertiseSchema,
  frequencySchema,
} from "./vocabulary";

/**
 * PRD §7 UX State — the structured representation of the UX problem that
 * every decision question is evaluated against. Built by the LLM from the
 * brief, reviewed and editable by the designer.
 *
 * The LLM *describes* here; it does not *judge*. Fields like `dataVolume`
 * are descriptions ("~200 reports per manager per week"), and the decision
 * model answers "is data volume high?" against them. Only hard constraints
 * policy reads directly are enums.
 */

export const UX_STATE_SCHEMA_VERSION = "1.0.0";

export const uxTaskSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["primary", "supporting"]),
  frequency: frequencySchema,
  description: z.string().optional(),
});

export const uxActionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

export const uxAmbiguitySchema = z.object({
  /** Which state field the uncertainty affects, e.g. "context.device". */
  field: z.string(),
  question: z.string(),
  /** What was assumed in the meantime, so the designer can confirm it. */
  assumption: z.string(),
});

export const uxStateSchema = z.object({
  /** The designer's original words, kept so the trace starts at the source. */
  brief: z.string().min(1),
  product: z.string().min(1),
  summary: z.string().min(1),
  user: z.object({
    role: z.string().min(1),
    expertise: expertiseSchema,
    audience: audienceSchema,
    description: z.string().optional(),
  }),
  goal: z.object({
    primary: z.string().min(1),
    secondary: z.array(z.string()).default([]),
    successCriteria: z.array(z.string()).default([]),
  }),
  tasks: z
    .array(uxTaskSchema)
    .min(1)
    .refine((tasks) => tasks.some((t) => t.kind === "primary"), {
      message: "at least one task must be primary",
    }),
  /** Things users do to records: approve, reject, export… */
  actions: z.array(uxActionSchema).default([]),
  context: z.object({
    device: deviceSchema,
    frequency: frequencySchema,
    environment: z.string().default(""),
    dataVolume: z.string().default(""),
    timePressure: z.string().default(""),
    notes: z.array(z.string()).default([]),
  }),
  data: z.object({
    /** The main thing being worked on, e.g. "expense report". */
    entity: z.string().min(1),
    description: z.string().default(""),
    attributes: z.array(z.string()).default([]),
  }),
  constraints: z.object({
    accessibility: accessibilityLevelSchema.default("WCAG-AA"),
    designSystem: z.string().default("default"),
    business: z.array(z.string()).default([]),
    technical: z.array(z.string()).default([]),
    brand: z.string().optional(),
  }),
  ambiguities: z.array(uxAmbiguitySchema).default([]),
});

export type UXTask = z.infer<typeof uxTaskSchema>;
export type UXAction = z.infer<typeof uxActionSchema>;
export type UXAmbiguity = z.infer<typeof uxAmbiguitySchema>;
export type UXState = z.infer<typeof uxStateSchema>;
/** Input shape before defaults are applied (what the LLM / editor may send). */
export type UXStateInput = z.input<typeof uxStateSchema>;
