import { z } from "zod";
import { kebabIdSchema } from "./vocabulary";

/**
 * PRD §37 Phase 1 import format and §21d normalization report.
 *
 * The raw format is deliberately permissive — real design systems name
 * things their own way — and the normalizer turns it into the strict
 * `DesignSystem`. Nothing is dropped silently: every mapping, guess and
 * problem is recorded in the report.
 */

type RawTokenNode = string | number | { $value: string | number; $type?: string } | RawTokenTree;
interface RawTokenTree {
  [key: string]: RawTokenNode;
}

const rawTokenLeafSchema = z.union([
  z.string(),
  z.number(),
  z.object({ $value: z.union([z.string(), z.number()]), $type: z.string().optional() }),
]);

export const rawTokenTreeSchema: z.ZodType<RawTokenTree> = z.lazy(() =>
  z.record(z.string(), z.union([rawTokenLeafSchema, rawTokenTreeSchema]))
);

const rawPropSchema = z.object({
  name: z.string().min(1),
  type: z.string().default("unknown"),
  values: z.array(z.string()).default([]),
  required: z.boolean().default(false),
});

export const rawComponentSchema = z.object({
  name: z.string().min(1),
  id: z.string().optional(),
  description: z.string().default(""),
  category: z
    .enum(["action", "input", "display", "navigation", "feedback", "overlay", "layout"])
    .optional(),
  variants: z.array(z.string()).default([]),
  states: z.array(z.string()).default([]),
  /** Either a list of prop objects, or a { propName: type | values[] } map. */
  props: z
    .union([
      z.array(rawPropSchema),
      z.record(z.string(), z.union([z.string(), z.array(z.string())])),
    ])
    .default([]),
  /** Declared capabilities: ids, or claims with level / missing criteria. */
  capabilities: z
    .array(
      z.union([
        z.string(),
        z.object({
          capability: z.string(),
          level: z.enum(["full", "partial"]).default("full"),
          missing: z.array(z.string()).default([]),
        }),
      ])
    )
    .default([]),
  tokens: z.array(z.string()).default([]),
  accessibility: z.array(z.string()).default([]),
  usage: z
    .object({ do: z.array(z.string()).default([]), dont: z.array(z.string()).default([]) })
    .optional(),
});

export const rawDesignSystemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  version: z.string().default("1.0.0"),
  tokens: rawTokenTreeSchema.default({}),
  components: z.array(rawComponentSchema).min(1),
});

export const normalizationEntrySchema = z.object({
  kind: z.enum(["component", "state", "variant", "prop", "token", "capability"]),
  /** What it belongs to, e.g. the component id. */
  subject: z.string(),
  from: z.string(),
  to: z.string().optional(),
  status: z.enum(["mapped", "ambiguous", "unknown"]),
  note: z.string().optional(),
});

export const normalizationFindingSchema = z.object({
  kind: z.enum([
    "primitive-in-component",
    "unresolved-ref",
    "ref-cycle",
    "duplicate-component",
    "unknown-capability",
    "invalid-version",
  ]),
  subject: z.string(),
  detail: z.string(),
});

export const normalizationReportSchema = z.object({
  entries: z.array(normalizationEntrySchema),
  findings: z.array(normalizationFindingSchema),
});

/** An inferred claim that the decision model or designer should confirm (§21e). */
export const pendingMappingSchema = z.object({
  component: kebabIdSchema,
  capability: kebabIdSchema,
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).min(1),
});

export type RawDesignSystem = z.input<typeof rawDesignSystemSchema>;
export type RawComponent = z.infer<typeof rawComponentSchema>;
export type NormalizationEntry = z.infer<typeof normalizationEntrySchema>;
export type NormalizationFinding = z.infer<typeof normalizationFindingSchema>;
export type NormalizationReport = z.infer<typeof normalizationReportSchema>;
export type PendingMapping = z.infer<typeof pendingMappingSchema>;
