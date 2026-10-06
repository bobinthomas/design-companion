import { z } from "zod";
import {
  DECISION_OPTIONS,
  decisionOptionSchema,
  decisionTypeSchema,
  dottedIdSchema,
  factPathSchema,
  kebabIdSchema,
  prioritySchema,
  ruleCategorySchema,
  ruleTierSchema,
  stateSchema,
} from "./vocabulary";

/**
 * PRD §11–13 UX Rule — externalized UX policy. Rules live as JSON under
 * knowledge/ux-rules/<category>/ and are never embedded in prompts.
 *
 * Conditions test either a decision-question result (the model's judgment)
 * or a hard-constraint state fact. Rules reference capabilities, never
 * component ids, so they work against any design system (§21a).
 */

const probability = z.number().min(0).max(1);

/** A hard-constraint field of UXState (see FACT_PATHS). */
export const factConditionSchema = z.strictObject({
  fact: factPathSchema,
  op: z.enum(["eq", "neq", "in", "notIn", "gte", "lte"]),
  value: z.union([z.string(), z.array(z.string()).min(1)]),
});

/** Noul result is judged true / false. `min` overrides the policy threshold. */
export const noulConditionSchema = z.strictObject({
  question: dottedIdSchema,
  is: z.enum(["true", "false"]),
  min: probability.optional(),
});

/** Choice result selected this option (optionally with a minimum probability). */
export const choiceConditionSchema = z.strictObject({
  question: dottedIdSchema,
  choice: kebabIdSchema,
  min: probability.optional(),
});

export const scoreConditionSchema = z.union([
  z.strictObject({ question: dottedIdSchema, scoreGte: z.number().min(0) }),
  z.strictObject({ question: dottedIdSchema, scoreLte: z.number().min(0) }),
]);

export const conditionSchema = z.union([
  factConditionSchema,
  noulConditionSchema,
  choiceConditionSchema,
  scoreConditionSchema,
]);

/** All of `all`, at least one of `any` (if present), none of `none`. */
export const whenSchema = z
  .object({
    all: z.array(conditionSchema).optional(),
    any: z.array(conditionSchema).optional(),
    none: z.array(conditionSchema).optional(),
  })
  .refine((w) => (w.all?.length ?? 0) + (w.any?.length ?? 0) + (w.none?.length ?? 0) > 0, {
    message: "when must contain at least one condition",
  });

export const uxRuleSchema = z
  .object({
    id: dottedIdSchema,
    /** Human-facing code shown in the Decision Inspector, e.g. DATA_VOLUME_HIGH. */
    code: z.string().regex(/^[A-Z0-9_]+$/, "code must be UPPER_SNAKE_CASE"),
    category: ruleCategorySchema,
    /** Which consideration the rule represents in the §13 global order. */
    tier: ruleTierSchema,
    /** Strength within its tier. `critical` avoids are vetoes. */
    priority: prioritySchema,
    when: whenSchema,
    decision: decisionTypeSchema.optional(),
    recommend: z.array(decisionOptionSchema).default([]),
    avoid: z.array(decisionOptionSchema).default([]),
    /** Capabilities the solution must provide when this rule applies (§21b). */
    requiresCapabilities: z.array(kebabIdSchema).default([]),
    /** States the solution must represent when this rule applies. */
    requiresStates: z.array(stateSchema).default([]),
    reason: z.string().min(1),
    /** Where the rule comes from, e.g. "WCAG 2.2 SC 2.4.7" or "NN/g: data tables". */
    source: z.string().optional(),
  })
  .superRefine((rule, ctx) => {
    const hasChoiceEffect = rule.recommend.length > 0 || rule.avoid.length > 0;
    const hasRequirement = rule.requiresCapabilities.length > 0 || rule.requiresStates.length > 0;
    if (!hasChoiceEffect && !hasRequirement) {
      ctx.addIssue({ code: "custom", message: "rule must recommend, avoid, or require something" });
    }
    if (hasChoiceEffect && !rule.decision) {
      ctx.addIssue({ code: "custom", message: "recommend/avoid requires a decision slot" });
    }
    if (rule.decision) {
      const allowed = DECISION_OPTIONS[rule.decision] as readonly string[];
      for (const option of [...rule.recommend, ...rule.avoid]) {
        if (!allowed.includes(option)) {
          ctx.addIssue({
            code: "custom",
            message: `"${option}" is not an option for decision "${rule.decision}"`,
          });
        }
      }
    }
  });

export type FactCondition = z.infer<typeof factConditionSchema>;
export type NoulCondition = z.infer<typeof noulConditionSchema>;
export type ChoiceCondition = z.infer<typeof choiceConditionSchema>;
export type ScoreCondition = z.infer<typeof scoreConditionSchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type When = z.infer<typeof whenSchema>;
export type UXRule = z.infer<typeof uxRuleSchema>;
export type UXRuleInput = z.input<typeof uxRuleSchema>;
