import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN_SYSTEM, DEFAULT_DESIGN_SYSTEM_IMPORT, DEFAULT_REGISTRY } from "@/lib/design-system/default";
import { resolveCapability } from "@/lib/design-system/gaps";
import {
  CAPABILITIES,
  CAPABILITY_BY_ID,
  COMPOSITIONS,
  DECISION_CAPABILITIES,
  NORMALIZATION,
} from "@/lib/knowledge";
import { STATES } from "@/lib/schemas";

/** Knowledge lint for the capability vocabulary and design-system knowledge. */

describe("capability vocabulary", () => {
  it("has ~40+ unique capabilities across all six categories", () => {
    const ids = CAPABILITIES.map((c) => c.id);
    expect(ids.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(CAPABILITIES.map((c) => c.category)).size).toBe(6);
  });

  it("composition recipes only reference known capabilities", () => {
    for (const recipe of COMPOSITIONS) {
      expect(CAPABILITY_BY_ID.has(recipe.provides), recipe.id).toBe(true);
      for (const part of recipe.parts) expect(CAPABILITY_BY_ID.has(part), `${recipe.id}: ${part}`).toBe(true);
      expect(recipe.parts, `${recipe.id} must not contain itself`).not.toContain(recipe.provides);
    }
  });

  it("decision options only require known capabilities", () => {
    for (const [decision, options] of Object.entries(DECISION_CAPABILITIES)) {
      for (const [option, caps] of Object.entries(options)) {
        for (const cap of caps) expect(CAPABILITY_BY_ID.has(cap), `${decision}.${option}: ${cap}`).toBe(true);
      }
    }
  });

  it("normalization tables only reference known capabilities and states", () => {
    for (const [id, c] of Object.entries(NORMALIZATION.components)) {
      for (const cap of c.capabilities) expect(CAPABILITY_BY_ID.has(cap), `${id}: ${cap}`).toBe(true);
    }
    for (const cap of Object.keys(NORMALIZATION.props)) expect(CAPABILITY_BY_ID.has(cap), cap).toBe(true);
    for (const state of Object.keys(NORMALIZATION.states)) {
      expect(STATES as readonly string[]).toContain(state);
    }
  });

  it("aliases are unambiguous", () => {
    const seen = new Map<string, string>();
    for (const [id, c] of Object.entries(NORMALIZATION.components)) {
      for (const alias of c.aliases) {
        expect(seen.get(alias), `"${alias}" maps to both ${seen.get(alias)} and ${id}`).toBeUndefined();
        seen.set(alias, id);
      }
    }
  });
});

describe("default design system", () => {
  it("imports cleanly through the same pipeline as user systems", () => {
    const { report, pending } = DEFAULT_DESIGN_SYSTEM_IMPORT;
    expect(DEFAULT_DESIGN_SYSTEM.source.kind).toBe("bundled");
    expect(report.findings).toEqual([]);
    expect(report.entries.filter((e) => e.status !== "mapped")).toEqual([]);
    expect(pending).toEqual([]);
  });

  it("classifies tokens into primitive, semantic and component tiers", () => {
    const tier = (name: string) => DEFAULT_DESIGN_SYSTEM.tokens.find((t) => t.name === name)?.tier;
    expect(tier("color.violet.600")).toBe("primitive");
    expect(tier("semantic.primary")).toBe("semantic");
    expect(tier("button.background")).toBe("component");
    const category = (name: string) => DEFAULT_DESIGN_SYSTEM.tokens.find((t) => t.name === name)?.category;
    expect(category("semantic.text")).toBe("color");
    expect(category("button.radius")).toBe("radius");
    expect(category("motion.easing-standard")).toBe("motion");
  });

  it("satisfies the expense dashboard's capabilities directly or by composition", () => {
    const expected: Record<string, "satisfied" | "composite"> = {
      "tabular-display": "satisfied",
      sorting: "satisfied",
      "row-selection": "satisfied",
      pagination: "satisfied",
      "search-input": "satisfied",
      "filter-controls": "composite",
      "bulk-action-bar": "composite",
      "destructive-confirmation": "composite",
      "undo-action": "composite",
      "side-drawer": "satisfied",
      "toast-notification": "satisfied",
    };
    for (const [capability, outcome] of Object.entries(expected)) {
      expect(resolveCapability(DEFAULT_REGISTRY, capability).outcome, capability).toBe(outcome);
    }
  });
});
