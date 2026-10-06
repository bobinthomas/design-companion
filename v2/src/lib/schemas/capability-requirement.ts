import { z } from "zod";
import { decisionTypeSchema, kebabIdSchema, prioritySchema, ruleTierSchema, stateSchema } from "./vocabulary";

/**
 * PRD §21b Capability Requirement — what the UX needs from the design
 * system, emitted by the policy engine alongside decisions. Inherits the
 * priority of whatever produced it, so accessibility needs stay critical.
 */
export const capabilityRequirementSchema = z
  .object({
    capability: kebabIdSchema,
    priority: prioritySchema,
    tier: ruleTierSchema,
    requiredBy: z.object({
      decision: decisionTypeSchema.optional(),
      rule: z.string().optional(),
      pattern: kebabIdSchema.optional(),
    }),
    states: z.array(stateSchema).default([]),
  })
  .refine((r) => r.requiredBy.decision || r.requiredBy.rule || r.requiredBy.pattern, {
    message: "requirement must say what required it",
  });

export type CapabilityRequirement = z.infer<typeof capabilityRequirementSchema>;
