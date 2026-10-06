import { z } from "zod";
import { kebabIdSchema, stateSchema } from "./vocabulary";

/**
 * PRD §21a Capability vocabulary and component claims. Capabilities are the
 * shared language between UX policy and any design system.
 */

export const CAPABILITY_CATEGORIES = [
  "actions",
  "data",
  "input",
  "navigation",
  "feedback",
  "overlay",
] as const;

/** An entry in knowledge/capabilities.json. */
export const capabilityDefinitionSchema = z.object({
  id: kebabIdSchema,
  name: z.string().min(1),
  category: z.enum(CAPABILITY_CATEGORIES),
  description: z.string().min(1),
  /** What a component must do to claim this capability. */
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  requiredStates: z.array(stateSchema).default([]),
  accessibility: z.array(z.string()).default([]),
});

export const claimSourceSchema = z.enum(["declared", "inferred", "decision-model", "designer"]);

/** A component's claim to provide a capability. */
export const capabilityClaimSchema = z.object({
  capability: kebabIdSchema,
  level: z.enum(["full", "partial"]),
  source: claimSourceSchema,
  confidence: z.number().min(0).max(1),
  /** Acceptance criteria, states or accessibility obligations not met. */
  missing: z.array(z.string()).default([]),
});

/**
 * §21c composition recipe: a capability achievable by combining others,
 * e.g. destructive-confirmation = modal-dialog + destructive-action.
 */
export const compositionRecipeSchema = z.object({
  id: kebabIdSchema,
  provides: kebabIdSchema,
  parts: z.array(kebabIdSchema).min(2),
  notes: z.string().optional(),
});

export type CapabilityDefinition = z.infer<typeof capabilityDefinitionSchema>;
export type ClaimSource = z.infer<typeof claimSourceSchema>;
export type CapabilityClaim = z.infer<typeof capabilityClaimSchema>;
export type CapabilityClaimInput = z.input<typeof capabilityClaimSchema>;
export type CompositionRecipe = z.infer<typeof compositionRecipeSchema>;
