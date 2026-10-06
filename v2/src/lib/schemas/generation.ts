import { z } from "zod";
import { confidenceBandSchema } from "./ux-decision";
import { decisionTypeSchema, kebabIdSchema, semverSchema, stateSchema } from "./vocabulary";

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
  /** Decision slots policy actually decided; directions may only cite these. */
  decisionSlots?: readonly string[];
  /** "Net-new component required" gaps every direction must show as a placeholder. */
  requiredGapIds?: readonly string[];
}

/** With a vocabulary, an empty list means nothing is allowed — not anything. */
function idEnum(ids: readonly string[] | undefined, fallback: z.ZodType<string>): z.ZodType<string> {
  if (!ids) return fallback;
  return ids.length > 0 ? z.enum(ids as [string, ...string[]]) : z.never();
}

function makeSchemas(vocab?: GenerationVocabulary) {
  const patternId = idEnum(vocab?.patternIds, kebabIdSchema);
  const componentId = idEnum(vocab?.componentIds, kebabIdSchema);
  const ruleId = idEnum(vocab?.ruleIds, z.string());
  const gapId = idEnum(vocab?.gapIds, z.string());
  const slot = vocab?.decisionSlots
    ? decisionTypeSchema.refine((s) => vocab.decisionSlots!.includes(s), {
        message: `Only decided slots may be cited: ${vocab.decisionSlots.join(", ")}`,
      })
    : decisionTypeSchema;

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

  const variant = z
    .object({
      id: kebabIdSchema,
      title: z.string().min(1),
      /** The organizing idea, e.g. "Task first", "Exception first". */
      strategy: z.string().min(1),
      summary: z.string().min(1),
      rationale: z.string().min(1),
      /** The registry pattern this direction is built on, when one applies. */
      pattern: patternId.optional(),
      supportingDecisions: z.array(slot).default([]),
      regions: z.array(region).min(1),
      advantages: z.array(z.string()).min(1),
      tradeoffs: z.array(z.string()).min(1),
      rulesApplied: z.array(ruleId).default([]),
      mobileNotes: z.array(z.string()).default([]),
      desktopNotes: z.array(z.string()).default([]),
    })
    .superRefine((v, ctx) => {
      if (!vocab?.requiredGapIds?.length) return;
      const placed = new Set(v.regions.flatMap((r) => r.components.flatMap((c) => ("gap" in c ? [c.gap] : []))));
      for (const id of vocab.requiredGapIds) {
        if (!placed.has(id)) {
          ctx.addIssue({
            code: "custom",
            path: ["regions"],
            message: `Direction "${v.id}" must show gap ${id} as a placeholder ("net-new component required")`,
          });
        }
      }
    });

  const output = z
    .object({
      variants: z.array(variant).min(2).max(3),
      assumptions: z.array(z.string()).default([]),
    })
    .superRefine((o, ctx) => {
      const ids = o.variants.map((v) => v.id);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({ code: "custom", path: ["variants"], message: "Direction ids must be unique" });
      }
      const strategies = o.variants.map((v) => v.strategy.trim().toLowerCase());
      if (new Set(strategies).size !== strategies.length) {
        ctx.addIssue({ code: "custom", path: ["variants"], message: "Each direction needs a different strategy" });
      }
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

/** One direction, held to the same per-request vocabulary (e.g. before evaluating it). */
export function buildVariantSchema(vocab: GenerationVocabulary) {
  return makeSchemas(vocab).variant;
}

/**
 * Deterministic checks computed in code for each direction — never by the
 * generator — so they mean the same thing whichever model wrote it.
 */
export const directionCheckSchema = z.object({
  variantId: kebabIdSchema,
  /** Mean confidence of the decisions the direction builds on. */
  confidence: z.number().min(0).max(1),
  band: confidenceBandSchema,
  /** Decided slots whose required capabilities the direction doesn't show. */
  uncoveredDecisions: z.array(decisionTypeSchema),
  /** Selected components the direction leaves out. */
  unusedComponents: z.array(kebabIdSchema),
  /** Gap placeholders it shows. */
  gapPlaceholders: z.array(z.string()),
});

/** One Layout Brainstorm run, as stored in the session trace (§29). */
export const layoutBrainstormSchema = z.object({
  id: z.string(),
  generatedAt: z.iso.datetime(),
  /** "draft" = the deterministic composer used when no LLM is configured. */
  source: z.enum(["llm", "draft"]),
  model: z.string(),
  instruction: z.string().optional(),
  notices: z.array(z.string()),
  /** The decisions the directions were generated from, to detect staleness. */
  basedOn: z.array(z.object({ decision: decisionTypeSchema, choice: z.string() })),
  designSystem: z.object({ id: z.string(), version: semverSchema }),
  prompts: semverSchema,
  output: generationOutputSchema,
  checks: z.array(directionCheckSchema),
});

export type ComponentUsage = z.infer<typeof componentUsageSchema>;
export type GapPlaceholder = z.infer<typeof gapPlaceholderSchema>;
export type LayoutRegion = z.infer<typeof layoutRegionSchema>;
export type LayoutVariant = z.infer<typeof layoutVariantSchema>;
export type GenerationOutput = z.infer<typeof generationOutputSchema>;
export type DirectionCheck = z.infer<typeof directionCheckSchema>;
export type LayoutBrainstorm = z.infer<typeof layoutBrainstormSchema>;
