import { UX_PATTERNS } from "@/lib/knowledge";
import type { DecideOutput } from "@/lib/ux/policy/engine";
import type { FiringRule } from "@/lib/ux/rules/evaluate";
import type { CapabilityRequirement, PatternMatch, UIState, UXDecision } from "@/lib/schemas";

/**
 * §21b capability requirements, from three sources:
 * - each decision's chosen option (priority inherited from the rules behind it),
 * - fired rules' own `requiresCapabilities`,
 * - required capabilities of the selected patterns.
 * Duplicates are kept; gap detection merges them, taking the strongest.
 */
export function buildRequirements(
  decisions: readonly UXDecision[],
  requirementPriority: DecideOutput["requirementPriority"],
  fired: readonly FiringRule[],
  patterns: readonly PatternMatch[]
): { requirements: CapabilityRequirement[]; requiredStates: UIState[] } {
  const requirements: CapabilityRequirement[] = [];
  const requiredStates = new Set<UIState>();

  for (const d of decisions) {
    const inherited = requirementPriority[d.decision] ?? { priority: "medium" as const, tier: "task" as const };
    for (const capability of d.requiresCapabilities) {
      requirements.push({ capability, ...inherited, requiredBy: { decision: d.decision }, states: [] });
    }
  }

  for (const { rule } of fired) {
    // A rule's required states apply to the solution as a whole (the list
    // must have loading/empty/error states), not to each capability it names.
    for (const capability of rule.requiresCapabilities) {
      requirements.push({
        capability,
        priority: rule.priority,
        tier: rule.tier,
        requiredBy: { rule: rule.id },
        states: [],
      });
    }
    rule.requiresStates.forEach((s) => requiredStates.add(s));
  }

  const byId = new Map(UX_PATTERNS.map((p) => [p.id, p]));
  for (const match of patterns) {
    const pattern = byId.get(match.pattern);
    if (!pattern) continue;
    for (const capability of pattern.requiredCapabilities) {
      requirements.push({
        capability,
        priority: match.role === "primary" ? "high" : "medium",
        tier: "task",
        requiredBy: { pattern: pattern.id },
        states: [],
      });
    }
    pattern.requiredStates.forEach((s) => requiredStates.add(s));
  }

  return { requirements, requiredStates: [...requiredStates] };
}
