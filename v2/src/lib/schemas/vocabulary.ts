import { z } from "zod";

/**
 * Closed vocabularies shared across contracts. Kept deliberately small:
 * judgments ("is data volume high?") are *not* encoded here — those are
 * answered by the decision model against the UX state (PRD §8–10). Only
 * hard constraints that policy reads directly are enumerated.
 */

// ---------- Ordinal scales (fact conditions can compare with gte/lte) ----------

export const EXPERTISE = ["novice", "intermediate", "expert"] as const;
export const FREQUENCIES = ["rare", "occasional", "weekly", "daily", "continuous"] as const;
export const ACCESSIBILITY_LEVELS = ["WCAG-A", "WCAG-AA", "WCAG-AAA"] as const;

/** Ordered scales, lowest first. Used by the rule evaluator for gte/lte. */
export const ORDINAL_SCALES: readonly (readonly string[])[] = [
  EXPERTISE,
  FREQUENCIES,
  ACCESSIBILITY_LEVELS,
];

// ---------- Nominal values ----------

export const AUDIENCES = ["internal", "professional", "consumer"] as const;
export const DEVICES = ["desktop", "mobile", "tablet", "multi"] as const;

export const STATES = [
  "default",
  "loading",
  "empty",
  "error",
  "disabled",
  "success",
  "partial",
  "permission-restricted",
  "populated",
  "hover",
  "focus",
  "active",
  "selected",
  "read-only",
  "validating",
] as const;

// ---------- Rule priority (PRD §13) ----------

export const PRIORITIES = ["critical", "high", "medium", "low"] as const;

/**
 * Global priority order, highest first. A rule's tier decides which
 * consideration it represents; the policy engine compares tiers
 * lexicographically so a lower tier can never outvote a higher one.
 */
export const RULE_TIERS = [
  "accessibility",
  "task",
  "business",
  "technical",
  "design-system",
  "visual",
] as const;

export const RULE_CATEGORIES = [
  "layout",
  "selection",
  "navigation",
  "forms",
  "tables",
  "search",
  "filtering",
  "dialogs",
  "feedback",
  "content",
  "responsive",
  "accessibility",
  "error-prevention",
] as const;

// ---------- Decision slots and the options each may choose from ----------

/**
 * Each decision type is a slot the policy fills with exactly one option.
 * Option ids are deliberately self-describing: decision models follow the
 * option *name* more than the rubric text bound to it.
 */
export const DECISION_OPTIONS = {
  layout: ["single-page", "multi-step", "split-view", "dashboard", "detail-view"],
  navigation: ["sidebar", "top-nav", "tabs", "breadcrumb", "stepper", "bottom-nav", "none"],
  dataPresentation: ["data-table", "card-grid", "list", "timeline", "kanban", "chart"],
  detailView: ["side-panel", "full-page", "modal", "inline-expand"],
  selection: ["checkbox", "radio", "select", "combobox", "segmented-control", "toggle"],
  search: ["visible-search", "global-search", "none"],
  filtering: ["persistent-filter-bar", "filter-panel", "saved-views", "none"],
  bulkActions: ["bulk-action-bar", "none"],
  pagination: ["paginated", "infinite-scroll", "virtualized", "none"],
  actionConfirmation: ["confirm-dialog", "undo-toast", "inline-confirm", "none"],
  statusFeedback: ["toast", "inline-message", "alert-banner"],
  formStructure: ["single-page-form", "wizard", "inline-edit", "none"],
} as const;

export type DecisionType = keyof typeof DECISION_OPTIONS;
export const DECISION_TYPES = Object.keys(DECISION_OPTIONS) as DecisionType[];

export const DECISION_LABELS: Record<DecisionType, string> = {
  layout: "Layout",
  navigation: "Navigation",
  dataPresentation: "Data presentation",
  detailView: "Detail view",
  selection: "Selection control",
  search: "Search",
  filtering: "Filtering",
  bulkActions: "Bulk actions",
  pagination: "Pagination",
  actionConfirmation: "Action confirmation",
  statusFeedback: "Status feedback",
  formStructure: "Form structure",
};

/** Every option across every slot, for schema-level validation. */
export const ALL_DECISION_OPTIONS = [
  ...new Set(Object.values(DECISION_OPTIONS).flat()),
] as [string, ...string[]];

// ---------- State facts rules may test directly ----------

/**
 * Hard-constraint fields of UXState that policy may read without asking the
 * decision model. Everything else must come through a decision question.
 */
export const FACT_PATHS = [
  "user.expertise",
  "user.audience",
  "context.device",
  "context.frequency",
  "constraints.accessibility",
] as const;

// ---------- Zod enums ----------

export const expertiseSchema = z.enum(EXPERTISE);
export const frequencySchema = z.enum(FREQUENCIES);
export const accessibilityLevelSchema = z.enum(ACCESSIBILITY_LEVELS);
export const audienceSchema = z.enum(AUDIENCES);
export const deviceSchema = z.enum(DEVICES);
export const stateSchema = z.enum(STATES);
export const prioritySchema = z.enum(PRIORITIES);
export const ruleTierSchema = z.enum(RULE_TIERS);
export const ruleCategorySchema = z.enum(RULE_CATEGORIES);
export const decisionTypeSchema = z.enum(DECISION_TYPES as [DecisionType, ...DecisionType[]]);
export const decisionOptionSchema = z.enum(ALL_DECISION_OPTIONS);
export const factPathSchema = z.enum(FACT_PATHS);

/** kebab-case ids for patterns, components, capabilities, options. */
export const kebabIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case");

/** dotted kebab-case ids for rules and questions: "data.volume.high". */
export const dottedIdSchema = z
  .string()
  .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "must be dotted kebab-case");

export const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/, "must be semver");

export type UIState = z.infer<typeof stateSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type RuleTier = z.infer<typeof ruleTierSchema>;
export type RuleCategory = z.infer<typeof ruleCategorySchema>;
export type FactPath = z.infer<typeof factPathSchema>;
