import { describe, expect, it } from "vitest";
import acmeJson from "../fixtures/acme-design-system.json";
import {
  applyDesignerReview,
  applyMappingResults,
  buildMappingBatch,
} from "@/lib/design-system/capabilities";
import { blockingGaps, detectGaps, gapBehavior, settleGap } from "@/lib/design-system/gaps";
import { importDesignSystem } from "@/lib/design-system/import";
import { DesignSystemRegistry } from "@/lib/design-system/registry";
import { MockDecisionProvider } from "@/lib/decision-model/adapters/mock";
import type { CapabilityRequirement } from "@/lib/schemas";

const acme = importDesignSystem(acmeJson);
const component = (id: string) => acme.designSystem.components.find((c) => c.id === id)!;
const claim = (componentId: string, capability: string) =>
  component(componentId).capabilities.find((c) => c.capability === capability);

describe("normalizer (§21d)", () => {
  it("maps component names to canonical ids", () => {
    expect(acme.designSystem.components.map((c) => c.id)).toEqual([
      "button",
      "data-table",
      "toast",
      "text-field",
      "select",
      "badge",
      "magic-panel",
    ]);
    expect(acme.designSystem.id).toBe("acme-ds");
    expect(acme.designSystem.version).toBe("2.4.0");
  });

  it("normalizes state and variant aliases and reports unknowns", () => {
    expect(component("button").states).toEqual(["default", "hover", "focus", "disabled", "loading"]);
    expect(component("button").variants).toEqual(["primary", "destructive", "ghost", "sparkle"]);
    const unknown = acme.report.entries.filter((e) => e.status === "unknown").map((e) => `${e.kind}:${e.from}`);
    expect(unknown).toEqual(
      expect.arrayContaining(["state:wiggling", "variant:sparkle", "component:MagicPanel"])
    );
  });

  it("resolves token references and flags problems", () => {
    const token = (name: string) => acme.designSystem.tokens.find((t) => t.name === name)!;
    expect(token("sys.primary")).toMatchObject({ tier: "semantic", category: "color", ref: "color.blue.500" });
    expect(token("button.bg").tier).toBe("component");
    expect(token("space.md")).toMatchObject({ tier: "primitive", category: "spacing" });

    const findings = acme.report.findings.map((f) => `${f.kind}:${f.subject}`);
    expect(findings).toEqual(
      expect.arrayContaining([
        "unresolved-ref:sys.missing",
        // Component token skips the semantic layer…
        "primitive-in-component:button.bg",
        // …and the component consumes a primitive directly.
        "primitive-in-component:button",
        "unknown-capability:magic-panel",
      ])
    );
    // A component token that aliases a semantic token is fine.
    expect(findings).not.toContain("primitive-in-component:button.danger-bg");
  });
});

describe("capability mapping (§21e)", () => {
  it("trusts declared claims and infers the rest from names, variants and props", () => {
    expect(claim("data-table", "row-selection")).toMatchObject({ source: "declared", level: "partial" });
    expect(claim("data-table", "tabular-display")).toMatchObject({ source: "inferred", confidence: 0.75 });
    expect(claim("data-table", "sorting")).toMatchObject({ source: "inferred", confidence: 0.7 });
    expect(claim("button", "destructive-action")).toMatchObject({ source: "inferred", confidence: 0.75 });
    expect(component("magic-panel").capabilities).toEqual([]);
  });

  it("queues low-confidence inferences for confirmation and confirms them via the decision model", async () => {
    expect(acme.pending.map((p) => `${p.component}:${p.capability}`)).toContain("data-table:sorting");

    const batch = buildMappingBatch(acme.designSystem, acme.pending);
    expect(batch.questions.length).toBe(acme.pending.length);
    expect(batch.questions.every((q) => q.type === "noul" && q.purpose === "capability-mapping")).toBe(true);

    const results = await new MockDecisionProvider().evaluate(batch.state, batch.questions);
    const { designSystem } = applyMappingResults(acme.designSystem, batch, results);
    const sorting = designSystem.components
      .find((c) => c.id === "data-table")!
      .capabilities.find((c) => c.capability === "sorting");
    expect(sorting).toMatchObject({ source: "decision-model" });
  });

  it("removes claims the decision model rejects", () => {
    const batch = buildMappingBatch(acme.designSystem, acme.pending);
    const results = batch.questions.map((q) => ({
      questionId: q.id,
      type: "noul" as const,
      noul: 0.05,
      confidence: 0.95,
      provider: "jev" as const,
      model: "jev-test",
    }));
    const { designSystem, entries } = applyMappingResults(acme.designSystem, batch, results);
    expect(designSystem.components.find((c) => c.id === "data-table")!.capabilities.map((c) => c.capability)).toEqual([
      "row-selection",
    ]);
    expect(entries.every((e) => e.to === "rejected")).toBe(true);
  });

  it("records designer review as a new patch version", () => {
    const reviewed = applyDesignerReview(acme.designSystem, [
      { component: "magic-panel", capability: "side-drawer", accept: true },
    ]);
    expect(reviewed.version).toBe("2.4.1");
    expect(reviewed.components.find((c) => c.id === "magic-panel")!.capabilities).toEqual([
      { capability: "side-drawer", level: "full", source: "designer", confidence: 1, missing: [] },
    ]);
  });
});

describe("gap detection — PRD §21f worked example", () => {
  const registry = new DesignSystemRegistry(acme.designSystem);
  const req = (
    capability: string,
    priority: CapabilityRequirement["priority"],
    decision?: CapabilityRequirement["requiredBy"]["decision"]
  ): CapabilityRequirement => ({
    capability,
    priority,
    tier: priority === "critical" ? "accessibility" : "task",
    requiredBy: decision ? { decision } : { rule: "test.rule" },
    states: [],
  });

  const requirements = [
    req("tabular-display", "high", "dataPresentation"),
    req("sorting", "high", "dataPresentation"),
    req("row-selection", "high", "bulkActions"),
    req("bulk-action-bar", "high", "bulkActions"),
    req("filter-controls", "high", "filtering"),
    req("pagination", "medium", "pagination"),
    req("destructive-confirmation", "critical", "actionConfirmation"),
  ];
  const { resolutions, gaps } = detectGaps(requirements, registry);
  const outcome = (cap: string) => resolutions.find((r) => r.capability === cap)?.outcome;
  const gap = (cap: string) => gaps.find((g) => g.capability === cap);

  it("resolves what the imported system can build", () => {
    expect(outcome("tabular-display")).toBe("satisfied");
    expect(outcome("sorting")).toBe("satisfied");
    // Dropdown + Btn compose into filter controls.
    expect(resolutions.find((r) => r.capability === "filter-controls")).toMatchObject({
      outcome: "composite",
      recipe: "dropdown-filters",
      components: ["select", "button"],
    });
  });

  it("reports the partial row selection as a high gap", () => {
    expect(gap("row-selection")).toMatchObject({
      kind: "partial",
      severity: "high",
      affectedDecisions: ["bulkActions"],
      // The declared gap plus the selection states Acme's Table lacks.
      missing: ["select-all with indeterminate state", "state: selected", "state: disabled", "state: partial"],
      status: "open",
    });
    expect(gapBehavior(gap("row-selection")!)).toBe("mark-net-new");
  });

  it("blocks generation on the missing destructive confirmation", () => {
    expect(gap("destructive-confirmation")).toMatchObject({ kind: "missing", severity: "critical" });
    expect(blockingGaps(gaps).map((g) => g.id)).toEqual(["gap.destructive-confirmation"]);
    expect(gap("pagination")).toMatchObject({ severity: "medium" });
    expect(gapBehavior(gap("pagination")!)).toBe("warn");
  });

  it("unblocks when the designer overrides to undo-toast, which Toast + Btn can compose", () => {
    const afterOverride = detectGaps(
      [
        ...requirements.filter((r) => r.capability !== "destructive-confirmation"),
        req("undo-action", "critical", "actionConfirmation"),
      ],
      registry
    );
    expect(afterOverride.resolutions.find((r) => r.capability === "undo-action")).toMatchObject({
      outcome: "composite",
      recipe: "undo-in-toast",
    });
    expect(blockingGaps(afterOverride.gaps)).toEqual([]);
  });

  it("stops blocking once the designer accepts the risk with a reason", () => {
    const accepted = settleGap(gap("destructive-confirmation")!, "accept-risk", "Rejections are reversible in v1");
    expect(accepted.status).toBe("accepted");
    expect(blockingGaps([accepted])).toEqual([]);
  });

  it("reports missing states as missing-state gaps", () => {
    const { gaps: stateGaps } = detectGaps([{ ...req("toast-notification", "low"), states: ["loading"] }], registry);
    expect(stateGaps[0]).toMatchObject({ kind: "missing-state", missing: ["state: loading"] });
  });
});
