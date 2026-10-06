import { CAPABILITY_BY_ID, COMPOSITIONS, POLICY, type GapBehavior } from "@/lib/knowledge";
import type { CapabilityProvider, DesignSystemRegistry } from "@/lib/design-system/registry";
import {
  PRIORITIES,
  RULE_TIERS,
  type CapabilityRequirement,
  type CapabilityResolution,
  type CompositionRecipe,
  type DecisionType,
  type DesignSystemGap,
  type GapResolutionKind,
  type Priority,
  type UIState,
} from "@/lib/schemas";

/** A requirement after merging every source that asked for the same capability. */
export interface MergedRequirement {
  capability: string;
  priority: Priority;
  tier: CapabilityRequirement["tier"];
  states: UIState[];
  decisions: DecisionType[];
  requiredBy: CapabilityRequirement["requiredBy"][];
}

/** Highest priority / tier wins; states and sources accumulate. */
export function mergeRequirements(requirements: readonly CapabilityRequirement[]): MergedRequirement[] {
  const merged = new Map<string, MergedRequirement>();
  for (const r of requirements) {
    const existing = merged.get(r.capability);
    if (!existing) {
      merged.set(r.capability, {
        capability: r.capability,
        priority: r.priority,
        tier: r.tier,
        states: [...r.states],
        decisions: r.requiredBy.decision ? [r.requiredBy.decision] : [],
        requiredBy: [r.requiredBy],
      });
      continue;
    }
    if (PRIORITIES.indexOf(r.priority) < PRIORITIES.indexOf(existing.priority)) existing.priority = r.priority;
    if (RULE_TIERS.indexOf(r.tier) < RULE_TIERS.indexOf(existing.tier)) existing.tier = r.tier;
    existing.states = [...new Set([...existing.states, ...r.states])];
    if (r.requiredBy.decision && !existing.decisions.includes(r.requiredBy.decision)) {
      existing.decisions.push(r.requiredBy.decision);
    }
    existing.requiredBy.push(r.requiredBy);
  }
  return [...merged.values()];
}

interface ProviderCheck {
  provider: CapabilityProvider;
  usable: boolean;
  missing: string[];
  missingStates: string[];
}

function checkProvider(
  provider: CapabilityProvider,
  requiredStates: readonly UIState[],
  reviewThreshold: number
): ProviderCheck {
  const missingStates = requiredStates.filter((s) => !provider.component.states.includes(s));
  return {
    provider,
    usable: provider.claim.confidence >= reviewThreshold,
    missing: provider.claim.missing,
    missingStates,
  };
}

const isSatisfying = (c: ProviderCheck) =>
  c.usable && c.provider.claim.level === "full" && c.missing.length === 0 && c.missingStates.length === 0;

/** States a capability needs: its own definition plus what the requirement adds. */
function statesFor(capability: string, extra: readonly UIState[] = []): UIState[] {
  return [...new Set([...(CAPABILITY_BY_ID.get(capability)?.requiredStates ?? []), ...extra])];
}

function satisfiedBy(
  registry: DesignSystemRegistry,
  capability: string,
  states: readonly UIState[],
  reviewThreshold: number
): CapabilityProvider[] {
  return registry
    .providersOf(capability)
    .map((p) => checkProvider(p, states, reviewThreshold))
    .filter(isSatisfying)
    .map((c) => c.provider);
}

/** Resolves one capability against the design system (§21c resolution table). */
export function resolveCapability(
  registry: DesignSystemRegistry,
  capability: string,
  extraStates: readonly UIState[] = [],
  options: { reviewThreshold?: number; recipes?: readonly CompositionRecipe[] } = {}
): CapabilityResolution {
  const reviewThreshold = options.reviewThreshold ?? POLICY.confidence.review;
  const recipes = options.recipes ?? COMPOSITIONS;
  const states = statesFor(capability, extraStates);

  const direct = satisfiedBy(registry, capability, states, reviewThreshold);
  if (direct.length > 0) {
    return { capability, outcome: "satisfied", components: direct.map((p) => p.component.id), missing: [] };
  }

  // Composites: every part must be directly satisfied (one level deep, by design).
  for (const recipe of recipes.filter((r) => r.provides === capability)) {
    const parts = recipe.parts.map((part) => satisfiedBy(registry, part, statesFor(part), reviewThreshold));
    if (parts.every((p) => p.length > 0)) {
      return {
        capability,
        outcome: "composite",
        components: [...new Set(parts.map((p) => p[0].component.id))],
        recipe: recipe.id,
        missing: [],
      };
    }
  }

  const checks = registry.providersOf(capability).map((p) => checkProvider(p, states, reviewThreshold));
  const usable = checks.filter((c) => c.usable);
  if (usable.length > 0) {
    // Best partial: fewest missing items.
    const best = [...usable].sort(
      (a, b) => a.missing.length + a.missingStates.length - (b.missing.length + b.missingStates.length)
    )[0];
    return {
      capability,
      outcome: "partial",
      components: [best.provider.component.id],
      missing: [...best.missing, ...best.missingStates.map((s) => `state: ${s}`)],
    };
  }
  if (checks.length > 0) {
    return {
      capability,
      outcome: "unconfirmed",
      components: checks.map((c) => c.provider.component.id),
      missing: ["claim not confirmed"],
    };
  }
  return { capability, outcome: "missing", components: [], missing: [] };
}

const RESOLUTIONS_BY_KIND: Record<DesignSystemGap["kind"], GapResolutionKind[]> = {
  missing: ["add-component", "override-decision", "accept-risk"],
  partial: ["extend-component", "override-decision", "accept-risk"],
  "missing-state": ["extend-component", "override-decision", "accept-risk"],
  "missing-variant": ["extend-component", "override-decision", "accept-risk"],
  accessibility: ["extend-component", "override-decision", "accept-risk"],
  unconfirmed: ["extend-component", "accept-risk"],
  token: ["extend-component", "accept-risk"],
};

function gapKind(resolution: CapabilityResolution): DesignSystemGap["kind"] {
  if (resolution.outcome === "missing") return "missing";
  if (resolution.outcome === "unconfirmed") return "unconfirmed";
  const accessibility = CAPABILITY_BY_ID.get(resolution.capability)?.accessibility ?? [];
  if (resolution.missing.some((m) => accessibility.includes(m))) return "accessibility";
  if (resolution.missing.length > 0 && resolution.missing.every((m) => m.startsWith("state: "))) {
    return "missing-state";
  }
  return "partial";
}

export interface GapAnalysis {
  resolutions: CapabilityResolution[];
  gaps: DesignSystemGap[];
}

/**
 * §21c: resolves every capability requirement against the design system.
 * Anything short of satisfied or composite becomes a gap whose severity is
 * inherited from the requirement's priority.
 */
export function detectGaps(
  requirements: readonly CapabilityRequirement[],
  registry: DesignSystemRegistry
): GapAnalysis {
  const resolutions: CapabilityResolution[] = [];
  const gaps: DesignSystemGap[] = [];
  for (const req of mergeRequirements(requirements)) {
    const resolution = resolveCapability(registry, req.capability, req.states);
    resolutions.push(resolution);
    if (resolution.outcome === "satisfied" || resolution.outcome === "composite") continue;
    const kind = gapKind(resolution);
    gaps.push({
      id: `gap.${req.capability}`,
      capability: req.capability,
      kind,
      severity: req.priority,
      affectedDecisions: req.decisions,
      missing: resolution.missing,
      suggestedResolutions: RESOLUTIONS_BY_KIND[kind],
      status: "open",
    });
  }
  return { resolutions, gaps };
}

/** §21c gap policy: what an open gap does to generation. Settled gaps do nothing. */
export function gapBehavior(gap: DesignSystemGap): GapBehavior | "none" {
  return gap.status === "open" ? POLICY.gaps[gap.severity] : "none";
}

export function blockingGaps(gaps: readonly DesignSystemGap[]): DesignSystemGap[] {
  return gaps.filter((g) => gapBehavior(g) === "block");
}

/** Records the designer's decision on a gap (accept the risk, or mark it resolved). */
export function settleGap(
  gap: DesignSystemGap,
  kind: GapResolutionKind,
  reason: string,
  now = new Date()
): DesignSystemGap {
  return {
    ...gap,
    status: kind === "accept-risk" ? "accepted" : "resolved",
    resolution: { kind, reason, timestamp: now.toISOString() },
  };
}
