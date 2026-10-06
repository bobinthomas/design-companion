import { z } from "zod";
import { capabilityClaimSchema } from "./component-capability";
import { kebabIdSchema, stateSchema } from "./vocabulary";

/**
 * PRD §20 Component — an entry in a design system's component registry,
 * described by the capabilities it claims rather than by its name.
 */

export const componentPropSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  /** Enumerated values, when the prop is a union. */
  values: z.array(z.string()).default([]),
  required: z.boolean().default(false),
});

export const componentSchema = z.object({
  id: kebabIdSchema,
  name: z.string().min(1),
  description: z.string().default(""),
  category: z.enum(["action", "input", "display", "navigation", "feedback", "overlay", "layout"]),
  capabilities: z.array(capabilityClaimSchema).min(1),
  states: z.array(stateSchema).min(1),
  variants: z.array(kebabIdSchema).default([]),
  props: z.array(componentPropSchema).default([]),
  /** Token names this component consumes (any tier). */
  tokens: z.array(z.string()).default([]),
  accessibility: z.array(z.string()).default([]),
  usage: z
    .object({
      do: z.array(z.string()).default([]),
      dont: z.array(z.string()).default([]),
    })
    .default({ do: [], dont: [] }),
});

export type ComponentProp = z.infer<typeof componentPropSchema>;
export type Component = z.infer<typeof componentSchema>;
export type ComponentInput = z.input<typeof componentSchema>;
