import { z } from "zod";
import { decisionTypeSchema, kebabIdSchema, prioritySchema } from "./vocabulary";

/**
 * PRD §21c Capability resolution and Design System Gap. Every capability
 * requirement resolves to one outcome; anything short of satisfied or
 * composite becomes a gap with a severity inherited from the requirement.
 */

export const capabilityResolutionSchema = z.object({
  capability: kebabIdSchema,
  outcome: z.enum(["satisfied", "composite", "partial", "unconfirmed", "missing"]),
  /** Components that (fully or partly) provide it. */
  components: z.array(kebabIdSchema).default([]),
  /** Composition recipe used, when outcome is composite. */
  recipe: kebabIdSchema.optional(),
  missing: z.array(z.string()).default([]),
});

export const gapResolutionKindSchema = z.enum([
  "use-composite",
  "extend-component",
  "add-component",
  "override-decision",
  "accept-risk",
]);

export const designSystemGapSchema = z
  .object({
    /** "gap.row-selection" */
    id: z.string().regex(/^gap\.[a-z0-9-]+$/),
    capability: kebabIdSchema,
    kind: z.enum([
      "missing",
      "partial",
      "missing-state",
      "missing-variant",
      "accessibility",
      "unconfirmed",
      "token",
    ]),
    severity: prioritySchema,
    affectedDecisions: z.array(decisionTypeSchema).default([]),
    missing: z.array(z.string()).default([]),
    suggestedResolutions: z.array(gapResolutionKindSchema).min(1),
    status: z.enum(["open", "accepted", "resolved"]),
    /** Set when the designer accepts or resolves the gap. */
    resolution: z
      .object({
        kind: gapResolutionKindSchema,
        reason: z.string().min(1),
        timestamp: z.iso.datetime(),
      })
      .optional(),
  })
  .refine((g) => g.status === "open" || g.resolution, {
    message: "accepted or resolved gaps must record a resolution",
  });

export type CapabilityResolution = z.infer<typeof capabilityResolutionSchema>;
export type GapResolutionKind = z.infer<typeof gapResolutionKindSchema>;
export type DesignSystemGap = z.infer<typeof designSystemGapSchema>;
