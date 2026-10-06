import { CAPABILITY_BY_ID, CAPABILITIES } from "@/lib/knowledge";
import type {
  CapabilityClaim,
  CapabilityDefinition,
  Component,
  DesignSystem,
  DesignToken,
} from "@/lib/schemas";

export interface CapabilityProvider {
  component: Component;
  claim: CapabilityClaim;
}

/**
 * Read-only query API over a normalized design system (PRD Sprint 3
 * "registry query APIs"). Everything downstream — gap detection, component
 * resolution, the generation vocabulary — asks the registry rather than
 * reading the raw object.
 */
export class DesignSystemRegistry {
  private readonly byId: ReadonlyMap<string, Component>;
  private readonly byCapability: ReadonlyMap<string, CapabilityProvider[]>;

  constructor(readonly designSystem: DesignSystem) {
    this.byId = new Map(designSystem.components.map((c) => [c.id, c]));
    const byCapability = new Map<string, CapabilityProvider[]>();
    for (const component of designSystem.components) {
      for (const claim of component.capabilities) {
        byCapability.set(claim.capability, [...(byCapability.get(claim.capability) ?? []), { component, claim }]);
      }
    }
    // Strongest claims first: full before partial, then by confidence.
    for (const providers of byCapability.values()) {
      providers.sort(
        (a, b) =>
          Number(b.claim.level === "full") - Number(a.claim.level === "full") ||
          b.claim.confidence - a.claim.confidence
      );
    }
    this.byCapability = byCapability;
  }

  get componentIds(): string[] {
    return [...this.byId.keys()];
  }

  component(id: string): Component | undefined {
    return this.byId.get(id);
  }

  /** Components claiming a capability, strongest claim first. */
  providersOf(capability: string): CapabilityProvider[] {
    return this.byCapability.get(capability) ?? [];
  }

  capability(id: string): CapabilityDefinition | undefined {
    return CAPABILITY_BY_ID.get(id);
  }

  /** Capability ids at least one component claims. */
  coveredCapabilities(): string[] {
    return CAPABILITIES.map((c) => c.id).filter((id) => this.providersOf(id).length > 0);
  }

  tokens(tier?: DesignToken["tier"]): DesignToken[] {
    return tier ? this.designSystem.tokens.filter((t) => t.tier === tier) : this.designSystem.tokens;
  }
}
