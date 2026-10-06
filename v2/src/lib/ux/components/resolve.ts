import type { DesignSystemRegistry } from "@/lib/design-system/registry";
import type { CapabilityResolution, ComponentSelection } from "@/lib/schemas";

/**
 * Component resolver: the components the solution will use, derived only
 * from capability resolutions against the registry — never named by an LLM.
 * Satisfied capabilities use their strongest provider; composites use one
 * provider per recipe part.
 */
export function resolveComponents(
  resolutions: readonly CapabilityResolution[],
  registry: DesignSystemRegistry
): ComponentSelection[] {
  const selections = new Map<string, ComponentSelection>();
  const add = (componentId: string, capability: string, via: "direct" | "composite") => {
    const component = registry.component(componentId);
    if (!component) return;
    const existing = selections.get(componentId) ?? { component: componentId, name: component.name, serves: [], via: [] };
    if (!existing.serves.includes(capability)) existing.serves.push(capability);
    if (!existing.via.includes(via)) existing.via.push(via);
    selections.set(componentId, existing);
  };

  for (const r of resolutions) {
    if (r.outcome === "satisfied" && r.components[0]) add(r.components[0], r.capability, "direct");
    if (r.outcome === "composite") r.components.forEach((c) => add(c, r.capability, "composite"));
  }
  return [...selections.values()];
}
