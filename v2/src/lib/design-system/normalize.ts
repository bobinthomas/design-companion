import { CAPABILITY_BY_ID, NORMALIZATION, type NormalizationTables } from "@/lib/knowledge";
import type {
  CapabilityClaim,
  ComponentProp,
  NormalizationEntry,
  NormalizationFinding,
  RawComponent,
  UIState,
} from "@/lib/schemas";

/** Lowercase alphanumerics only: "Primary_Button" → "primarybutton". */
export function aliasKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** "PrimaryButton" / "primary_button" → "primary-button". */
export function toKebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function indexAliases(table: Record<string, string[]>): Map<string, string> {
  const index = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(table)) {
    for (const alias of aliases) index.set(aliasKey(alias), canonical);
  }
  return index;
}

/** A component after naming/state/variant/prop normalization, before inference. */
export interface ComponentDraft {
  id: string;
  name: string;
  /** Canonical component id the name matched in the alias table, if any. */
  canonical?: string;
  description: string;
  category?: RawComponent["category"];
  states: UIState[];
  variants: string[];
  props: ComponentProp[];
  declared: CapabilityClaim[];
  tokens: string[];
  accessibility: string[];
  usage: { do: string[]; dont: string[] };
}

export interface ComponentNormalization {
  drafts: ComponentDraft[];
  entries: NormalizationEntry[];
  findings: NormalizationFinding[];
}

/**
 * §21d steps 1–3 and 5: canonical names, states and variants, and prop
 * normalization. Every mapping and every unknown is recorded.
 */
export function normalizeComponents(
  raws: readonly RawComponent[],
  tables: NormalizationTables = NORMALIZATION
): ComponentNormalization {
  const componentIndex = indexAliases(
    Object.fromEntries(Object.entries(tables.components).map(([id, c]) => [id, c.aliases]))
  );
  const variantIndex = indexAliases(
    Object.fromEntries(Object.entries(tables.variants).map(([id, v]) => [id, v.aliases]))
  );
  const stateIndex = indexAliases(tables.states);

  const entries: NormalizationEntry[] = [];
  const findings: NormalizationFinding[] = [];
  const usedIds = new Set<string>();
  const drafts: ComponentDraft[] = [];

  for (const raw of raws) {
    const canonical = componentIndex.get(aliasKey(raw.name));
    let id = raw.id ? toKebab(raw.id) : (canonical ?? toKebab(raw.name));
    if (canonical) {
      entries.push({ kind: "component", subject: id, from: raw.name, to: canonical, status: "mapped" });
    } else {
      entries.push({
        kind: "component",
        subject: id,
        from: raw.name,
        to: id,
        status: "unknown",
        note: "not a recognized component; capabilities must be declared or confirmed",
      });
    }
    if (usedIds.has(id)) {
      let n = 2;
      while (usedIds.has(`${id}-${n}`)) n++;
      findings.push({
        kind: "duplicate-component",
        subject: raw.name,
        detail: `id "${id}" already used; renamed to "${id}-${n}"`,
      });
      id = `${id}-${n}`;
    }
    usedIds.add(id);

    const states = new Set<UIState>();
    for (const rawState of raw.states) {
      const state = stateIndex.get(aliasKey(rawState)) as UIState | undefined;
      if (state) {
        states.add(state);
        if (state !== rawState) {
          entries.push({ kind: "state", subject: id, from: rawState, to: state, status: "mapped" });
        }
      } else {
        entries.push({
          kind: "state",
          subject: id,
          from: rawState,
          status: "unknown",
          note: "not a recognized state; not used for state checks",
        });
      }
    }
    if (states.size === 0) {
      states.add("default");
      entries.push({
        kind: "state",
        subject: id,
        from: "(none)",
        to: "default",
        status: "ambiguous",
        note: "no recognizable states declared; assumed default only",
      });
    }

    const variants: string[] = [];
    for (const rawVariant of raw.variants) {
      const variant = variantIndex.get(aliasKey(rawVariant));
      if (variant) {
        variants.push(variant);
        if (variant !== rawVariant) {
          entries.push({ kind: "variant", subject: id, from: rawVariant, to: variant, status: "mapped" });
        }
      } else {
        const kept = toKebab(rawVariant);
        variants.push(kept);
        entries.push({ kind: "variant", subject: id, from: rawVariant, to: kept, status: "unknown" });
      }
    }

    const props: ComponentProp[] = Array.isArray(raw.props)
      ? raw.props.map((p) => ({ name: p.name, type: p.type, values: p.values, required: p.required }))
      : Object.entries(raw.props).map(([name, spec]) =>
          Array.isArray(spec)
            ? { name, type: "enum", values: spec, required: false }
            : { name, type: spec, values: [], required: false }
        );

    const declared: CapabilityClaim[] = [];
    for (const cap of raw.capabilities) {
      const claim = typeof cap === "string" ? { capability: cap, level: "full" as const, missing: [] } : cap;
      if (!CAPABILITY_BY_ID.has(claim.capability)) {
        findings.push({
          kind: "unknown-capability",
          subject: id,
          detail: `declares "${claim.capability}", which is not in the capability vocabulary; ignored`,
        });
        continue;
      }
      declared.push({ ...claim, source: "declared", confidence: 1 });
    }

    drafts.push({
      id,
      name: raw.name,
      canonical,
      description: raw.description,
      category: raw.category,
      states: [...states],
      variants: [...new Set(variants)],
      props,
      declared,
      tokens: raw.tokens,
      accessibility: raw.accessibility,
      usage: { do: raw.usage?.do ?? [], dont: raw.usage?.dont ?? [] },
    });
  }

  return { drafts, entries, findings };
}
