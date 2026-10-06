import { CAPABILITY_BY_ID, POLICY } from "@/lib/knowledge";
import { inferClaims, inferenceReasons } from "@/lib/design-system/capabilities";
import { normalizeComponents, toKebab } from "@/lib/design-system/normalize";
import { normalizeTokens } from "@/lib/design-system/tokens";
import {
  designSystemSchema,
  rawDesignSystemSchema,
  type Component,
  type DesignSystem,
  type NormalizationReport,
  type PendingMapping,
} from "@/lib/schemas";

const CAPABILITY_TO_COMPONENT_CATEGORY: Record<string, Component["category"]> = {
  actions: "action",
  data: "display",
  input: "input",
  navigation: "navigation",
  feedback: "feedback",
  overlay: "overlay",
};

export interface DesignSystemImport {
  designSystem: DesignSystem;
  report: NormalizationReport;
  /** Inferred claims below the proceed threshold, for decision-model / designer confirmation. */
  pending: PendingMapping[];
}

/**
 * The §21d–e import pipeline: ingest (JSON) → normalize names, states,
 * variants, props and tokens → infer capabilities → validate the canonical
 * DesignSystem. The bundled default runs through this same path.
 *
 * Throws a ZodError if the input isn't a valid Phase 1 import document.
 */
export function importDesignSystem(
  input: unknown,
  source: DesignSystem["source"]["kind"] = "json"
): DesignSystemImport {
  const raw = rawDesignSystemSchema.parse(input);
  const { drafts, entries, findings } = normalizeComponents(raw.components);
  const componentIds = new Set(drafts.map((d) => d.id));
  const tokens = normalizeTokens(raw.tokens as Record<string, unknown>, componentIds);
  const tokenTier = new Map(tokens.tokens.map((t) => [t.name, t.tier]));

  const pending: PendingMapping[] = [];
  const components: Component[] = drafts.map((draft) => {
    const inferred = inferClaims(draft);
    for (const claim of inferred) {
      if (claim.confidence < POLICY.confidence.proceed) {
        pending.push({
          component: draft.id,
          capability: claim.capability,
          confidence: claim.confidence,
          reasons: inferenceReasons(draft, claim.capability),
        });
      }
    }
    const capabilities = [...draft.declared, ...inferred];
    if (capabilities.length === 0) {
      entries.push({
        kind: "capability",
        subject: draft.id,
        from: draft.name,
        status: "unknown",
        note: "no capabilities declared or inferred; this component can't satisfy requirements until reviewed",
      });
    }
    for (const tokenName of draft.tokens) {
      if (!tokenTier.has(tokenName)) {
        findings.push({ kind: "unresolved-ref", subject: draft.id, detail: `uses unknown token "${tokenName}"` });
      } else if (tokenTier.get(tokenName) === "primitive") {
        findings.push({
          kind: "primitive-in-component",
          subject: draft.id,
          detail: `consumes primitive token "${tokenName}" directly`,
        });
      }
    }
    const firstCategory = capabilities
      .map((c) => CAPABILITY_BY_ID.get(c.capability)?.category)
      .find(Boolean);
    return {
      id: draft.id,
      name: draft.name,
      description: draft.description,
      category: draft.category ?? (firstCategory ? CAPABILITY_TO_COMPONENT_CATEGORY[firstCategory] : "display"),
      capabilities,
      states: draft.states,
      variants: draft.variants,
      props: draft.props,
      tokens: draft.tokens,
      accessibility: draft.accessibility,
      usage: draft.usage,
    };
  });

  let version = raw.version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    findings.push({ kind: "invalid-version", subject: raw.name, detail: `"${version}" is not semver; using 1.0.0` });
    version = "1.0.0";
  }

  const designSystem = designSystemSchema.parse({
    id: raw.id ? toKebab(raw.id) : toKebab(raw.name),
    name: raw.name,
    version,
    source: { kind: source, importedAt: source === "bundled" ? undefined : new Date().toISOString() },
    tokens: tokens.tokens,
    components,
  });

  return {
    designSystem,
    report: { entries: [...entries, ...tokens.entries], findings: [...findings, ...tokens.findings] },
    pending,
  };
}
