import {
  CAPABILITY_BY_ID,
  NORMALIZATION,
  POLICY,
  type NormalizationTables,
  type PolicyConfig,
} from "@/lib/knowledge";
import { aliasKey, type ComponentDraft } from "@/lib/design-system/normalize";
import type {
  CapabilityClaim,
  DecisionQuestion,
  DecisionResult,
  DesignSystem,
  NormalizationEntry,
  PendingMapping,
} from "@/lib/schemas";

interface Evidence {
  fromName: string[];
  fromProps: string[];
}

/**
 * §21e step 2: deterministic capability inference from the component's
 * canonical name, its variants, and its props. Declared capabilities are
 * never overridden by inference.
 */
export function inferClaims(
  draft: ComponentDraft,
  tables: NormalizationTables = NORMALIZATION,
  policy: PolicyConfig["capabilityMapping"] = POLICY.capabilityMapping
): CapabilityClaim[] {
  const evidence = new Map<string, Evidence>();
  const note = (capability: string, kind: keyof Evidence, reason: string) => {
    const e = evidence.get(capability) ?? { fromName: [], fromProps: [] };
    e[kind].push(reason);
    evidence.set(capability, e);
  };

  if (draft.canonical) {
    for (const cap of tables.components[draft.canonical]?.capabilities ?? []) {
      note(cap, "fromName", `name "${draft.name}" matches ${draft.canonical}`);
    }
  }
  for (const variant of draft.variants) {
    for (const cap of tables.variants[variant]?.capabilities ?? []) {
      note(cap, "fromName", `has a ${variant} variant`);
    }
  }
  const propIndex = new Map<string, string[]>();
  for (const [cap, propNames] of Object.entries(tables.props)) {
    for (const p of propNames) propIndex.set(p, [...(propIndex.get(p) ?? []), cap]);
  }
  for (const prop of draft.props) {
    for (const cap of propIndex.get(aliasKey(prop.name)) ?? []) {
      note(cap, "fromProps", `prop "${prop.name}"`);
    }
  }

  const declared = new Set(draft.declared.map((c) => c.capability));
  const claims: CapabilityClaim[] = [];
  for (const [capability, e] of evidence) {
    if (declared.has(capability) || !CAPABILITY_BY_ID.has(capability)) continue;
    const confidence =
      e.fromName.length && e.fromProps.length
        ? policy.inferredFromNameAndProps
        : e.fromName.length
          ? policy.inferredFromName
          : policy.inferredFromProps;
    claims.push({ capability, level: "full", source: "inferred", confidence, missing: [] });
  }
  return claims;
}

/** Inference reasons, for pending-mapping explanations. */
export function inferenceReasons(draft: ComponentDraft, capability: string): string[] {
  const reasons: string[] = [];
  if (draft.canonical && NORMALIZATION.components[draft.canonical]?.capabilities.includes(capability)) {
    reasons.push(`name "${draft.name}" matches ${draft.canonical}`);
  }
  for (const v of draft.variants) {
    if (NORMALIZATION.variants[v]?.capabilities.includes(capability)) reasons.push(`has a ${v} variant`);
  }
  for (const p of draft.props) {
    if (NORMALIZATION.props[capability]?.includes(aliasKey(p.name))) reasons.push(`prop "${p.name}"`);
  }
  return reasons.length ? reasons : ["inferred"];
}

// ---------- §21e step 3: decision-model confirmation of ambiguous pairs ----------

export interface MappingBatch {
  /** State sent to the decision provider: the components and capabilities in question. */
  state: Record<string, unknown>;
  questions: DecisionQuestion[];
  pairs: PendingMapping[];
}

export function mappingQuestionId(component: string, capability: string): string {
  return `mapping.${component}.${capability}`;
}

/**
 * Builds one bounded batch of Noul questions — one per ambiguous
 * component/capability pair — evaluated against a state describing just
 * those components. One batch means one decision-model request.
 */
export function buildMappingBatch(
  ds: DesignSystem,
  pending: readonly PendingMapping[],
  limit: number = POLICY.capabilityMapping.maxQuestionsPerImport
): MappingBatch {
  const pairs = [...pending].sort((a, b) => a.confidence - b.confidence).slice(0, limit);
  const componentIds = new Set(pairs.map((p) => p.component));
  const capabilityIds = new Set(pairs.map((p) => p.capability));

  const state = {
    designSystem: { id: ds.id, name: ds.name, version: ds.version },
    components: ds.components
      .filter((c) => componentIds.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        states: c.states,
        variants: c.variants,
        props: c.props,
        accessibility: c.accessibility,
      })),
    capabilities: [...capabilityIds].map((id) => CAPABILITY_BY_ID.get(id)!),
  };

  const questions: DecisionQuestion[] = pairs.map((p) => {
    const cap = CAPABILITY_BY_ID.get(p.capability)!;
    const component = ds.components.find((c) => c.id === p.component)!;
    return {
      id: mappingQuestionId(p.component, p.capability),
      purpose: "capability-mapping",
      category: "design-system",
      type: "noul",
      question: `Does ${component.name} provide ${cap.name.toLowerCase()}?`,
      instructions: `Using the "${component.name}" component (id "${component.id}") described in the state, judge whether it meets all acceptance criteria for the "${cap.id}" capability: ${cap.acceptanceCriteria.join("; ")}.`,
      criteria: {
        true: `${component.name} meets all acceptance criteria for ${cap.id}`,
        false: `${component.name} does not fully provide ${cap.id}`,
      },
      // Demo mode keeps medium-confidence inferences and rejects weak ones.
      mock: { keywords: {}, default: p.confidence >= 0.7 ? "true" : "false" },
    };
  });

  return { state, questions, pairs };
}

/**
 * Applies decision-model answers: confirmed pairs become decision-model
 * claims, rejected pairs are removed, uncertain ones stay inferred.
 */
export function applyMappingResults(
  ds: DesignSystem,
  batch: MappingBatch,
  results: readonly DecisionResult[],
  threshold: number = POLICY.noulTrueThreshold
): { designSystem: DesignSystem; entries: NormalizationEntry[] } {
  const entries: NormalizationEntry[] = [];
  const verdicts = new Map<string, number>();
  results.forEach((r) => {
    if (r.type === "noul") verdicts.set(r.questionId, r.noul);
  });

  const components = ds.components.map((c) => ({
    ...c,
    capabilities: c.capabilities.flatMap((claim) => {
      const noul = verdicts.get(mappingQuestionId(c.id, claim.capability));
      if (noul === undefined || claim.source !== "inferred") return [claim];
      const base = { kind: "capability" as const, subject: c.id, from: claim.capability };
      if (noul >= threshold) {
        entries.push({ ...base, to: "confirmed", status: "mapped", note: `decision model: ${noul.toFixed(2)}` });
        return [{ ...claim, source: "decision-model" as const, confidence: noul }];
      }
      if (noul <= 1 - threshold) {
        entries.push({ ...base, to: "rejected", status: "mapped", note: `decision model: ${noul.toFixed(2)}` });
        return [];
      }
      entries.push({ ...base, status: "ambiguous", note: `decision model unsure (${noul.toFixed(2)})` });
      return [claim];
    }),
  }));

  return { designSystem: { ...ds, components }, entries };
}

// ---------- §21e step 4: designer review ----------

export interface ClaimReview {
  component: string;
  capability: string;
  accept: boolean;
  level?: CapabilityClaim["level"];
  missing?: string[];
}

/**
 * Applies the designer's confirmations and rejections, producing a new
 * patch version of the design system so earlier traces stay reproducible.
 */
export function applyDesignerReview(ds: DesignSystem, reviews: readonly ClaimReview[]): DesignSystem {
  const components = ds.components.map((c) => {
    let capabilities = [...c.capabilities];
    for (const r of reviews.filter((r) => r.component === c.id)) {
      capabilities = capabilities.filter((claim) => claim.capability !== r.capability);
      if (r.accept) {
        capabilities.push({
          capability: r.capability,
          level: r.level ?? "full",
          source: "designer",
          confidence: 1,
          missing: r.missing ?? [],
        });
      }
    }
    return { ...c, capabilities };
  });
  return { ...ds, version: bumpPatch(ds.version), components };
}

function bumpPatch(version: string): string {
  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}
