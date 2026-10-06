import { z } from "zod";
import { designSystemSchema, normalizationReportSchema, pendingMappingSchema, type DesignSystem } from "@/lib/schemas";

/**
 * Imported design systems live only in this browser, like sessions. One of
 * them can be "active": analyses, layouts and evaluations then run against
 * it instead of the bundled default. Reads are defensive.
 */

const LIBRARY_KEY = "design-companion-v2:design-systems";
const ACTIVE_KEY = "design-companion-v2:active-design-system";
const MAX_SYSTEMS = 5;

export const savedDesignSystemSchema = z.object({
  designSystem: designSystemSchema,
  report: normalizationReportSchema,
  /** Inferred claims still awaiting the decision model or the designer. */
  pending: z.array(pendingMappingSchema),
  savedAt: z.iso.datetime(),
});

export type SavedDesignSystem = z.infer<typeof savedDesignSystemSchema>;

export function loadDesignSystems(): SavedDesignSystem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(LIBRARY_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((s) => {
      const r = savedDesignSystemSchema.safeParse(s);
      return r.success ? [r.data] : [];
    });
  } catch {
    return [];
  }
}

/** Saves (replacing any with the same id) as the most recent. */
export function saveDesignSystem(entry: SavedDesignSystem): void {
  if (typeof window === "undefined") return;
  try {
    const rest = loadDesignSystems().filter((s) => s.designSystem.id !== entry.designSystem.id);
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify([entry, ...rest].slice(0, MAX_SYSTEMS)));
  } catch {
    // Storage full or unavailable.
  }
}

export function deleteDesignSystem(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(loadDesignSystems().filter((s) => s.designSystem.id !== id)));
    if (activeDesignSystemId() === id) setActiveDesignSystem(null);
  } catch {
    // ignore
  }
}

export function activeDesignSystemId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

/** null = the bundled default. */
export function setActiveDesignSystem(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // ignore
  }
}

/** The active imported design system, or undefined for the bundled default. */
export function activeDesignSystem(): DesignSystem | undefined {
  const id = activeDesignSystemId();
  return id ? loadDesignSystems().find((s) => s.designSystem.id === id)?.designSystem : undefined;
}
