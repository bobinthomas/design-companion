import { z } from "zod";
import { decisionTypeSchema, kebabIdSchema, stateSchema } from "./vocabulary";

/**
 * PRD §22–23 Generation — layout directions produced by the constrained
 * LLM generator. The base schema accepts any ids; `buildGenerationSchema`
 * narrows pattern, component, rule and gap ids at request time to what the
 * registries and gap detection actually produced, so an invented component
 * is a validation failure, never a rendering surprise. Where a capability
 * is missing, the generator must emit a typed gap placeholder (§21c).
 */

export interface GenerationVocabulary {
  patternIds: readonly string[];
  componentIds: readonly string[];
  ruleIds: readonly string[];
  /** Ids of open, non-blocking gaps the generator may reference. */
  gapIds: readonly string[];
}

function idEnum(ids: readonly string[] | undefined, fallback: z.ZodString) {
  return ids && ids.length > 0 ? z.enum(ids as [string, ...string[]]) : fallback;
}

function makeSchemas(vocab?: GenerationVocabulary) {
  const patternId = idEnum(vocab?.patternIds, kebabIdSchema);
  const componentId = idEnum(vocab?.componentIds, kebabIdSchema);
  const ruleId = idEnum(vocab?.ruleIds, z.string());
  // With a vocabulary but no gaps, no placeholder is valid at all.
  const gapId =
    vocab && vocab.gapIds.length === 0 ? z.never() : idEnum(vocab?.gapIds, z.string());

  const componentUsage = z.object({
    component: componentId,
    variant: z.string().optional(),
    purpose: z.string().min(1),
    states: z.array(stateSchema).default([]),
  });

  const gapPlaceholder = z.object({
    gap: gapId,
    purpose: z.string().min(1),
  });

  const region = z.object({
    name: z.string().min(1),
    purpose: z.string().min(1),
    components: z.array(z.union([componentUsage, gapPlaceholder])).min(1),
  });

  const variant = z.object({
    id: kebabIdSchema,
    title: z.string().min(1),
    /** The organizing idea, e.g. "Task first", "Exception first". */
    strategy: z.string().min(1),
    summary: z.string().min(1),
    rationale: z.string().min(1),
    pattern: patternId,
    supportingDecisions: z.array(decisionTypeSchema).default([]),
    regions: z.array(region).min(1),
    advantages: z.array(z.string()).min(1),
    tradeoffs: z.array(z.string()).min(1),
    rulesApplied: z.array(ruleId).default([]),
    mobileNotes: z.array(z.string()).default([]),
    desktopNotes: z.array(z.string()).default([]),
  });

  const output = z.object({
    variants: z.array(variant).min(2).max(3),
    assumptions: z.array(z.string()).default([]),
  });

  return { componentUsage, gapPlaceholder, region, variant, output };
}

const base = makeSchemas();

export const componentUsageSchema = base.componentUsage;
export const gapPlaceholderSchema = base.gapPlaceholder;
export const layoutRegionSchema = base.region;
export const layoutVariantSchema = base.variant;
export const generationOutputSchema = base.output;

export function buildGenerationSchema(vocab: GenerationVocabulary) {
  return makeSchemas(vocab).output;
}

export type ComponentUsage = z.infer<typeof componentUsageSchema>;
export type GapPlaceholder = z.infer<typeof gapPlaceholderSchema>;
export type LayoutRegion = z.infer<typeof layoutRegionSchema>;
export type LayoutVariant = z.infer<typeof layoutVariantSchema>;
export type GenerationOutput = z.infer<typeof generationOutputSchema>;
