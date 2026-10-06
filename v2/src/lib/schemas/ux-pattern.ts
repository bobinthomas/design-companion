import { z } from "zod";
import { conditionSchema } from "./ux-rule";
import { decisionOptionSchema, decisionTypeSchema, kebabIdSchema, stateSchema } from "./vocabulary";

/**
 * PRD §18–19 UX Pattern — a known UX structure. Patterns declare the
 * capabilities they need, not components (§21b), so the pattern registry
 * stays valid for any design system.
 */

export const uxPatternSchema = z.object({
  id: kebabIdSchema,
  name: z.string().min(1),
  purpose: z.string().min(1),
  // May be empty, e.g. a full-page detail view needs no specific capability.
  requiredCapabilities: z.array(kebabIdSchema).default([]),
  optionalCapabilities: z.array(kebabIdSchema).default([]),
  requiredStates: z.array(stateSchema).min(1),
  /** Evidence that makes this pattern a good fit (same condition grammar as rules). */
  recommendedWhen: z.array(conditionSchema).default([]),
  /** Decisions this pattern is consistent with, e.g. dataPresentation=data-table. */
  fitsDecisions: z
    .array(
      z.object({
        decision: decisionTypeSchema,
        choices: z.array(decisionOptionSchema).min(1),
      })
    )
    .default([]),
  /** Ids of patterns commonly combined with this one. */
  composesWith: z.array(kebabIdSchema).default([]),
  antiPatterns: z.array(z.string()).default([]),
});

export type UXPattern = z.infer<typeof uxPatternSchema>;
export type UXPatternInput = z.input<typeof uxPatternSchema>;
