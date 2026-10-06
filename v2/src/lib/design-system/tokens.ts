import type {
  DesignToken,
  NormalizationEntry,
  NormalizationFinding,
} from "@/lib/schemas";
import { TOKEN_CATEGORIES } from "@/lib/schemas";

type TokenCategory = (typeof TOKEN_CATEGORIES)[number];

interface FlatToken {
  name: string;
  raw: string;
  type?: string;
}

const REF = /^\{([^{}]+)\}$/;

/** Top-level groups that conventionally hold semantic (alias) tokens. */
const SEMANTIC_GROUPS = new Set(["semantic", "sys", "alias", "theme", "role"]);

const CATEGORY_KEYWORDS: [TokenCategory, RegExp][] = [
  ["color", /^(color|colour|colors|palette|bg|background|foreground|fg)$/],
  ["typography", /^(typography|font|fonts|lineheight|letterspacing|fontsize|fontweight)$/],
  ["spacing", /^(space|spacing|gap|inset|padding|margin)$/],
  ["radius", /^(radius|radii|rounded|corner|borderradius)$/],
  ["elevation", /^(elevation|shadow|shadows|depth)$/],
  ["grid", /^(grid|breakpoint|breakpoints|column|columns|container)$/],
  ["motion", /^(motion|duration|easing|transition|animation)$/],
];

const TYPE_TO_CATEGORY: Record<string, TokenCategory> = {
  color: "color",
  dimension: "spacing",
  fontfamily: "typography",
  fontweight: "typography",
  fontsize: "typography",
  typography: "typography",
  shadow: "elevation",
  duration: "motion",
  cubicbezier: "motion",
  transition: "motion",
};

function flatten(tree: Record<string, unknown>, prefix = ""): FlatToken[] {
  const out: FlatToken[] = [];
  for (const [key, node] of Object.entries(tree)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof node === "string" || typeof node === "number") {
      out.push({ name, raw: String(node) });
    } else if (node && typeof node === "object" && "$value" in node) {
      const leaf = node as { $value: string | number; $type?: string };
      out.push({ name, raw: String(leaf.$value), type: leaf.$type });
    } else if (node && typeof node === "object") {
      out.push(...flatten(node as Record<string, unknown>, name));
    }
  }
  return out;
}

function categoryFromName(name: string): TokenCategory | undefined {
  for (const segment of name.toLowerCase().split(".")) {
    const key = segment.replace(/[^a-z]/g, "");
    for (const [category, pattern] of CATEGORY_KEYWORDS) {
      if (pattern.test(key)) return category;
    }
  }
  return undefined;
}

function categoryFromValue(value: string): TokenCategory | undefined {
  const v = value.trim().toLowerCase();
  if (/^#([0-9a-f]{3,8})$/.test(v) || /^(rgb|rgba|hsl|hsla|oklch|color)\(/.test(v)) return "color";
  if (/cubic-bezier\(|^\d+(\.\d+)?m?s$/.test(v)) return "motion";
  if (/\d+px\s+\d+px/.test(v)) return "elevation";
  return undefined;
}

export interface TokenNormalization {
  tokens: DesignToken[];
  entries: NormalizationEntry[];
  findings: NormalizationFinding[];
}

/**
 * Flattens a nested token tree, resolves `{references}`, and classifies each
 * token's tier (§21: primitive → semantic → component) and category.
 * `componentIds` lets tokens grouped under a component name be recognized
 * as component tokens.
 */
export function normalizeTokens(
  tree: Record<string, unknown>,
  componentIds: ReadonlySet<string>
): TokenNormalization {
  const flat = flatten(tree);
  const byName = new Map(flat.map((t) => [t.name, t]));
  const entries: NormalizationEntry[] = [];
  const findings: NormalizationFinding[] = [];

  // Resolve every token to its final literal, detecting cycles and dangling refs.
  const resolved = new Map<string, FlatToken | undefined>();
  function resolve(name: string, seen: Set<string>): FlatToken | undefined {
    if (resolved.has(name)) return resolved.get(name);
    const token = byName.get(name);
    if (!token) return undefined;
    const ref = token.raw.match(REF)?.[1];
    if (!ref) {
      resolved.set(name, token);
      return token;
    }
    if (seen.has(ref)) {
      findings.push({ kind: "ref-cycle", subject: name, detail: `reference cycle through "${ref}"` });
      resolved.set(name, undefined);
      return undefined;
    }
    const target = byName.has(ref) ? resolve(ref, new Set([...seen, ref])) : undefined;
    if (!byName.has(ref)) {
      findings.push({ kind: "unresolved-ref", subject: name, detail: `references missing token "${ref}"` });
    }
    resolved.set(name, target);
    return target;
  }

  const tierOf = (t: FlatToken): DesignToken["tier"] => {
    const top = t.name.split(".")[0].toLowerCase();
    if (componentIds.has(top)) return "component";
    if (REF.test(t.raw) || SEMANTIC_GROUPS.has(top)) return "semantic";
    return "primitive";
  };

  const tokens: DesignToken[] = flat.map((t) => {
    const ref = t.raw.match(REF)?.[1];
    const literal = resolve(t.name, new Set([t.name]));
    // An alias takes the category of what it resolves to ("semantic.text" →
    // a color), so names like "text" or "surface" can't mislead.
    const fromTarget =
      ref && literal ? (categoryFromName(literal.name) ?? categoryFromValue(literal.raw)) : undefined;
    let category =
      (t.type ? TYPE_TO_CATEGORY[t.type.toLowerCase().replace(/[^a-z]/g, "")] : undefined) ??
      fromTarget ??
      categoryFromName(t.name) ??
      categoryFromValue(t.raw);
    if (!category) {
      entries.push({
        kind: "token",
        subject: t.name,
        from: t.raw,
        to: "spacing",
        status: "ambiguous",
        note: "category could not be determined; assumed spacing",
      });
      category = "spacing";
    }
    return {
      name: t.name,
      tier: tierOf(t),
      category,
      value: ref ? "" : t.raw,
      ...(ref ? { ref } : {}),
    };
  });

  // §21: component tokens should alias semantic tokens, not skip to primitives,
  // wherever the system defines a semantic layer for that category.
  const tokenByName = new Map(tokens.map((t) => [t.name, t]));
  const semanticCategories = new Set(tokens.filter((t) => t.tier === "semantic").map((t) => t.category));
  for (const t of tokens) {
    if (t.tier !== "component" || !semanticCategories.has(t.category)) continue;
    const target = t.ref ? tokenByName.get(t.ref) : undefined;
    if (!t.ref || target?.tier === "primitive") {
      findings.push({
        kind: "primitive-in-component",
        subject: t.name,
        detail: t.ref
          ? `aliases primitive "${t.ref}" directly instead of a semantic ${t.category} token`
          : `uses a literal ${t.category} value instead of a semantic token`,
      });
    }
  }

  return { tokens, entries, findings };
}
