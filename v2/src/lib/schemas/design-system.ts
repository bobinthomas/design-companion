import { z } from "zod";
import { componentSchema } from "./component";
import { kebabIdSchema, semverSchema } from "./vocabulary";

/**
 * PRD §20–21 Design System — the normalized, canonical form every ingest
 * adapter produces (§21d). Tokens carry their tier so the primitive →
 * semantic → component chain is explicit and checkable.
 */

export const TOKEN_CATEGORIES = [
  "color",
  "typography",
  "spacing",
  "radius",
  "elevation",
  "grid",
  "motion",
] as const;

export const designTokenSchema = z.object({
  /** Dotted name, e.g. "color.violet.600", "semantic.primary", "button.background". */
  name: z.string().min(1),
  tier: z.enum(["primitive", "semantic", "component"]),
  category: z.enum(TOKEN_CATEGORIES),
  /** Literal value for primitives; empty when the token is a reference. */
  value: z.string().default(""),
  /** Name of the token this one aliases (semantic → primitive, component → semantic). */
  ref: z.string().optional(),
});

export const designSystemSchema = z.object({
  id: kebabIdSchema,
  name: z.string().min(1),
  version: semverSchema,
  source: z.object({
    kind: z.enum(["bundled", "json", "tokens", "storybook", "repository", "figma"]),
    importedAt: z.iso.datetime().optional(),
  }),
  tokens: z.array(designTokenSchema).default([]),
  components: z.array(componentSchema).min(1),
});

export type DesignToken = z.infer<typeof designTokenSchema>;
export type DesignSystem = z.infer<typeof designSystemSchema>;
export type DesignSystemInput = z.input<typeof designSystemSchema>;
