import defaultDesignSystemJson from "@knowledge/design-systems/default.json";
import { importDesignSystem } from "@/lib/design-system/import";
import { DesignSystemRegistry } from "@/lib/design-system/registry";

/**
 * The bundled default design system, imported through the same pipeline as
 * a user's own system (§21f) so the import path is exercised on every build.
 */
export const DEFAULT_DESIGN_SYSTEM_IMPORT = importDesignSystem(defaultDesignSystemJson, "bundled");
export const DEFAULT_DESIGN_SYSTEM = DEFAULT_DESIGN_SYSTEM_IMPORT.designSystem;
export const DEFAULT_REGISTRY = new DesignSystemRegistry(DEFAULT_DESIGN_SYSTEM);
