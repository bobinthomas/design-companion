export const V1_URL = "https://design-companion.bobinthomas.workers.dev";

export interface NavItem {
  href: string;
  label: string;
  description: string;
}

/** Primary V2 surfaces, in user-journey order (§46). */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/analyze",
    label: "UX Analyze",
    description:
      "Describe a UX problem. Get a structured intent, rule-backed decisions you can inspect and override, and decision-guided layout directions.",
  },
  {
    href: "/evaluate",
    label: "UX Evaluate",
    description:
      "Check a described UI or spec against the task, UX rules, accessibility and the design system.",
  },
  {
    href: "/copy",
    label: "UI Copy",
    description: "Context-aware microcopy driven by component, action, risk and tone.",
  },
  {
    href: "/feedback",
    label: "Feedback Summary",
    description: "Turn raw research feedback into UX issues and rule-backed recommended changes.",
  },
  {
    href: "/design-system",
    label: "Design System",
    description: "Import your design system, review its capability mapping, and see what it can and can't build.",
  },
  {
    href: "/knowledge",
    label: "Knowledge",
    description: "Browse the UX rules, patterns and components every decision is built from.",
  },
];
