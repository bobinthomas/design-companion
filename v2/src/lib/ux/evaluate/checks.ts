import { UX_RULES } from "@/lib/knowledge";
import type { DecisionType, EvaluationCategory, EvaluationCheck, PolicyOutcome, UXState } from "@/lib/schemas";
import type { PreparedSubject } from "@/lib/ux/evaluate/batch";

/**
 * PRD §27–28 deterministic checks: what code can verify without judgment.
 * Structural checks need a structured subject (a generated direction);
 * context checks (blocking gaps, overrides that break critical rules)
 * apply to any subject evaluated against the same decisions.
 */

export type Severity = "critical" | "high" | "medium" | "low";

export interface CheckResult extends EvaluationCheck {
  severity: Severity;
  recommendation: string;
  location?: string;
}

/** Where a decision's failure to show up hurts most. */
const DECISION_CATEGORY: Record<DecisionType, EvaluationCategory> = {
  layout: "taskEffectiveness",
  dataPresentation: "taskEffectiveness",
  detailView: "taskEffectiveness",
  navigation: "informationArchitecture",
  search: "interactionQuality",
  filtering: "interactionQuality",
  bulkActions: "interactionQuality",
  pagination: "interactionQuality",
  selection: "interactionQuality",
  formStructure: "interactionQuality",
  actionConfirmation: "errorPrevention",
  statusFeedback: "feedback",
};

/** States a layout can show; component-level states (hover, focus…) belong to the design system. */
const DATA_STATES = ["loading", "empty", "error", "populated", "success"] as const;

const RULE_TIER = new Map(UX_RULES.map((r) => [r.id, r.tier]));

/** Checks that depend only on the decisions, so they apply to every subject. */
function contextChecks(outcome: PolicyOutcome): CheckResult[] {
  const checks: CheckResult[] = [];
  const blocking = outcome.gaps.filter((g) => g.behavior === "block");
  checks.push({
    id: "check.ds.no-blocking-gaps",
    label: "No critical design-system gap is left open",
    category: "designSystemCompliance",
    passed: blocking.length === 0,
    severity: "critical",
    ...(blocking[0] ? { gapId: blocking[0].id, detail: `Blocking: ${blocking.map((g) => g.capability).join(", ")}` } : {}),
    recommendation: "Resolve or accept the blocking gap, or override the decision that needs it.",
  });

  for (const d of outcome.decisions) {
    const veto = d.rulesApplied.find((r) => r.effect === "veto" && r.target === d.result.choice);
    if (!d.rulesApplied.some((r) => r.effect === "veto")) continue;
    const tier = veto ? RULE_TIER.get(veto.id) : undefined;
    checks.push({
      id: `check.critical.${d.decision}`,
      label: `${d.label} respects critical rules`,
      category: tier === "accessibility" ? "accessibility" : DECISION_CATEGORY[d.decision],
      passed: !veto,
      severity: "critical",
      ...(veto ? { ruleId: veto.id, detail: `${d.result.choice} is ruled out by ${veto.code}: ${veto.reason}` } : {}),
      recommendation: veto
        ? `Return ${d.label.toLowerCase()} to an option ${veto.code} allows, or record why the exception is safe.`
        : "",
    });
  }
  return checks;
}

function directionChecks(subject: Extract<PreparedSubject, { kind: "direction" }>, outcome: PolicyOutcome, state: UXState): CheckResult[] {
  const { variant } = subject;
  const checks: CheckResult[] = [];
  const entries = variant.regions.flatMap((r) => r.components.map((c) => ({ region: r.name, entry: c })));
  const serves = new Map(outcome.components.map((c) => [c.component, c.serves]));
  const gapCapability = new Map(outcome.gaps.map((g) => [g.id, g.capability]));
  const regionOf = (capability: string) =>
    entries.find(({ entry }) =>
      "component" in entry ? serves.get(entry.component)?.includes(capability) : gapCapability.get(entry.gap) === capability
    )?.region;

  const foreign = entries.flatMap(({ entry }) => ("component" in entry && !serves.has(entry.component) ? [entry.component] : []));
  checks.push({
    id: "check.ds.registry-only",
    label: "Uses only components selected from the design system",
    category: "designSystemCompliance",
    passed: foreign.length === 0,
    severity: "high",
    ...(foreign.length > 0 ? { detail: `Not selected: ${foreign.join(", ")}` } : {}),
    recommendation: "Replace unselected components with ones the design system provides.",
  });

  const placed = new Set(entries.flatMap(({ entry }) => ("gap" in entry ? [entry.gap] : [])));
  for (const gap of outcome.gaps.filter((g) => g.behavior === "mark-net-new")) {
    checks.push({
      id: `check.ds.net-new.${gap.capability}`,
      label: `Marks ${gap.capability.replace(/-/g, " ")} as a net-new component`,
      category: "designSystemCompliance",
      passed: placed.has(gap.id),
      severity: "high",
      gapId: gap.id,
      recommendation: "Show the missing capability as a placeholder so it isn't built as if it existed.",
    });
  }

  for (const d of outcome.decisions) {
    const missing = d.requiresCapabilities.filter((c) => !regionOf(c));
    const recommending = d.rulesApplied.find((r) => r.effect === "recommend" && r.target === d.result.choice);
    checks.push({
      id: `check.decision.${d.decision}`,
      label: `Shows the ${d.label.toLowerCase()} decision (${d.result.choice.replace(/-/g, " ")})`,
      category: DECISION_CATEGORY[d.decision],
      passed: missing.length === 0,
      severity: d.decision === "actionConfirmation" ? "high" : "medium",
      ...(recommending ? { ruleId: recommending.id } : {}),
      ...(missing.length > 0 ? { detail: `Missing: ${missing.join(", ")}` } : { location: regionOf(d.requiresCapabilities[0] ?? "") }),
      recommendation: `Include ${missing.join(", ").replace(/-/g, " ")} so the direction carries out the ${d.label.toLowerCase()} decision.`,
    });
  }

  const shownStates = new Set(entries.flatMap(({ entry }) => ("states" in entry ? entry.states : [])));
  for (const s of outcome.requiredStates.filter((s): s is (typeof DATA_STATES)[number] => (DATA_STATES as readonly string[]).includes(s))) {
    checks.push({
      id: `check.states.${s}`,
      label: `Represents the ${s} state`,
      category: "requiredStates",
      passed: shownStates.has(s),
      severity: s === "error" || s === "empty" ? "high" : "medium",
      recommendation: `Say what users see in the ${s} state.`,
    });
  }

  if (state.context.device !== "desktop") {
    checks.push({
      id: "check.responsive.phones",
      label: "Says how it works on phones and small screens",
      category: "responsiveBehavior",
      passed: variant.mobileNotes.length > 0,
      severity: state.context.device === "mobile" ? "high" : "medium",
      recommendation: "Describe how the layout adapts to small screens.",
    });
  }
  if (state.context.device !== "mobile") {
    checks.push({
      id: "check.responsive.desktop",
      label: "Says how it uses a large screen",
      category: "responsiveBehavior",
      passed: variant.desktopNotes.length > 0,
      severity: "low",
      recommendation: "Describe how the layout uses the width of a large screen.",
    });
  }
  return checks;
}

export function runChecks(subject: PreparedSubject, outcome: PolicyOutcome, state: UXState): CheckResult[] {
  return [...contextChecks(outcome), ...(subject.kind === "direction" ? directionChecks(subject, outcome, state) : [])];
}
