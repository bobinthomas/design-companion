import { CAPABILITY_BY_ID } from "@/lib/knowledge";
import type {
  ComponentUsage,
  DecisionType,
  GapPlaceholder,
  GenerationOutput,
  LayoutRegion,
  LayoutVariant,
  PolicyOutcome,
  UXState,
} from "@/lib/schemas";

/**
 * The deterministic draft composer: layout directions built only from the
 * policy outcome, used when no LLM is configured. It never invents anything
 * — every region holds components policy selected or placeholders for gaps
 * it detected — so it is a faithful (if plain) picture of the valid space.
 * Its output goes through the same per-request schema as an LLM's.
 */

type RegionKind = "overview" | "orientation" | "find" | "work" | "bulk" | "detail" | "actions" | "feedback";
type Entry = ComponentUsage | GapPlaceholder;

const KIND_BY_CAPABILITY: Record<string, RegionKind> = {
  "metric-summary": "overview",
  "data-visualization": "overview",
  "search-input": "find",
  "filter-controls": "find",
  "row-selection": "bulk",
  "bulk-action-bar": "bulk",
  "side-drawer": "detail",
  "primary-action": "actions",
  "secondary-action": "actions",
  "icon-action": "actions",
  "overflow-menu": "actions",
  "destructive-action": "actions",
  "destructive-confirmation": "feedback",
  "undo-action": "feedback",
  "modal-dialog": "feedback",
  tooltip: "work",
  popover: "work",
};

const KIND_BY_CATEGORY: Record<string, RegionKind> = {
  navigation: "orientation",
  data: "work",
  input: "work",
  actions: "actions",
  feedback: "feedback",
  overlay: "feedback",
};

/** States the main work region must represent, when policy requires them. */
const DATA_STATES = new Set(["loading", "empty", "error", "populated", "success"]);

function capabilityName(id: string): string {
  return CAPABILITY_BY_ID.get(id)?.name ?? id;
}

interface Context {
  state: UXState;
  outcome: PolicyOutcome;
  choices: Partial<Record<DecisionType, string>>;
  task: string;
  regions: Map<RegionKind, { entries: Entry[]; capabilities: Set<string> }>;
}

function kindOf(capability: string, choices: Context["choices"]): RegionKind {
  if (capability === "modal-dialog" && choices.detailView === "modal") return "detail";
  return KIND_BY_CAPABILITY[capability] ?? KIND_BY_CATEGORY[CAPABILITY_BY_ID.get(capability)?.category ?? ""] ?? "work";
}

function buildContext(state: UXState, outcome: PolicyOutcome): Context {
  const choices = Object.fromEntries(outcome.decisions.map((d) => [d.decision, d.result.choice])) as Context["choices"];
  const regions: Context["regions"] = new Map();
  const add = (kind: RegionKind, entry: Entry, capabilities: string[]) => {
    const region = regions.get(kind) ?? { entries: [], capabilities: new Set<string>() };
    region.entries.push(entry);
    capabilities.forEach((c) => region.capabilities.add(c));
    regions.set(kind, region);
  };

  // A component that serves capabilities in several regions appears in each
  // of them, described by what it does there (a Button applies filters in
  // one region and confirms a rejection in another).
  for (const c of outcome.components) {
    const byKind = new Map<RegionKind, string[]>();
    for (const capability of c.serves) {
      const kind = kindOf(capability, choices);
      byKind.set(kind, [...(byKind.get(kind) ?? []), capability]);
    }
    for (const [kind, capabilities] of byKind) {
      add(kind, { component: c.component, purpose: capabilities.map(capabilityName).join(", "), states: [] }, capabilities);
    }
  }

  // Every non-blocking gap is shown where its capability would have gone.
  for (const g of outcome.gaps.filter((g) => g.behavior !== "block")) {
    const label = g.behavior === "mark-net-new" ? "Net-new component required" : g.status === "open" ? "Gap" : "Accepted gap";
    const missing = g.missing.length > 0 ? ` (missing ${g.missing.join(", ")})` : "";
    add(kindOf(g.capability, choices), { gap: g.id, purpose: `${label}: ${capabilityName(g.capability)}${missing}` }, [g.capability]);
  }

  // The first work component carries the data states policy requires.
  const work = regions.get("work")?.entries.find((e): e is ComponentUsage => "component" in e);
  if (work) work.states = outcome.requiredStates.filter((s) => DATA_STATES.has(s)) as ComponentUsage["states"];

  const task = state.tasks.find((t) => t.kind === "primary")?.name ?? state.goal.primary;
  return { state, outcome, choices, task, regions };
}

const REGION_TEXT: Record<RegionKind, (ctx: Context) => { name: string; purpose: string }> = {
  overview: () => ({ name: "Overview", purpose: "A summary of the whole before the details" }),
  orientation: (ctx) =>
    ctx.regions.get("orientation")?.capabilities.has("step-indicator")
      ? { name: "Progress", purpose: "Where the user is and what comes next" }
      : { name: "Navigation", purpose: "Moving between sections" },
  find: () => ({ name: "Search and filters", purpose: "Narrowing to the right items" }),
  work: (ctx) => ({ name: ctx.task, purpose: `The primary task, built on ${humanizeChoice(ctx.choices.dataPresentation ?? ctx.choices.formStructure ?? ctx.choices.layout)}` }),
  bulk: () => ({ name: "Bulk actions", purpose: "Acting on several items at once" }),
  detail: () => ({ name: "Detail", purpose: "One item in full, without losing the list" }),
  actions: () => ({ name: "Actions", purpose: "What the user can do here" }),
  feedback: () => ({ name: "Feedback and confirmation", purpose: "Outcomes, errors and protection for risky actions" }),
};

function humanizeChoice(choice: string | undefined): string {
  return choice ? choice.replace(/-/g, " ") : "the decided structure";
}

interface Strategy {
  id: string;
  title: string;
  applies: (ctx: Context) => boolean;
  order: RegionKind[];
  /** Region name and purpose overrides that carry the strategy's idea. */
  rename?: Partial<Record<RegionKind, (ctx: Context) => { name: string; purpose: string }>>;
  summary: (ctx: Context) => string;
  rationale: (ctx: Context) => string;
  advantages: (ctx: Context) => string[];
  tradeoffs: (ctx: Context) => string[];
}

const frequent = (ctx: Context) => ["weekly", "daily", "continuous"].includes(ctx.state.context.frequency);
const has = (ctx: Context, ...kinds: RegionKind[]) => kinds.every((k) => ctx.regions.has(k));

const STRATEGIES: Strategy[] = [
  {
    id: "task-first",
    title: "Task first",
    applies: (ctx) => has(ctx, "work"),
    order: ["orientation", "find", "work", "bulk", "detail", "overview", "actions", "feedback"],
    summary: (ctx) => `Opens straight into "${ctx.task}", with everything else in support of it.`,
    rationale: (ctx) =>
      frequent(ctx)
        ? `"${ctx.task}" is ${ctx.state.context.frequency} work, so the fastest path to it comes first.`
        : "Users come here seldom and with one purpose, so nothing stands between them and the task.",
    advantages: (ctx) => [
      "Fewest steps to the primary task",
      frequent(ctx) ? "Familiar and fast for frequent, returning users" : "No detours for first-time or occasional users",
    ],
    tradeoffs: () => ["Little summary or context before the work starts"],
  },
  {
    id: "exception-first",
    title: "Exception first",
    applies: (ctx) => has(ctx, "find", "work") && Boolean(ctx.choices.dataPresentation),
    order: ["find", "work", "detail", "bulk", "orientation", "overview", "actions", "feedback"],
    rename: {
      find: () => ({ name: "Needs attention", purpose: "Filters start preset to unusual or problem items; clearing them shows everything" }),
    },
    summary: () => "Leads with the items that need attention, using preset filters, before routine ones.",
    rationale: (ctx) =>
      `Unusual ${ctx.state.data.entity}s carry most of the risk, so surfacing them first protects the decisions that matter.`,
    advantages: () => ["Problems are seen first, not hunted for", "Routine items can be handled in bulk afterwards"],
    tradeoffs: () => ["Routine items are one filter change away", "Preset filters must be visible and easy to clear"],
  },
  {
    id: "overview-first",
    title: "Overview first",
    applies: (ctx) => has(ctx, "overview", "work"),
    order: ["overview", "orientation", "find", "work", "bulk", "detail", "actions", "feedback"],
    summary: () => "Starts with a summary of the whole, then drills into the detail.",
    rationale: () => "A quick read of status and trends helps users decide where to spend their time.",
    advantages: () => ["Status at a glance", "Good for occasional or managerial use"],
    tradeoffs: () => ["An extra step before the primary task"],
  },
  {
    id: "focus-first",
    title: "Focus first",
    applies: (ctx) => has(ctx, "detail", "work"),
    order: ["detail", "work", "find", "bulk", "orientation", "overview", "actions", "feedback"],
    rename: {
      detail: () => ({ name: "Open item", purpose: "One item in full, kept open while moving through the list" }),
      work: (ctx) => ({ name: ctx.task, purpose: "A compact list beside the open item, for moving to the next one" }),
    },
    summary: () => "Keeps one item open in full, with a compact list beside it for moving to the next.",
    rationale: () => "Careful review of each item matters more than scanning many at once.",
    advantages: () => ["Deep review without losing your place", "Next and previous are always one step away"],
    tradeoffs: () => ["Less of the list is visible at once", "Slower when scanning many items"],
  },
  {
    id: "guidance-first",
    title: "Guidance first",
    applies: (ctx) => has(ctx, "work") && (has(ctx, "orientation") || has(ctx, "feedback")),
    order: ["orientation", "feedback", "work", "actions", "find", "bulk", "detail", "overview"],
    rename: {
      feedback: () => ({ name: "Guidance", purpose: "What this step is for, and messages next to the fields they concern" }),
    },
    summary: () => "Leads with progress and guidance, then the next step.",
    rationale: () => "Knowing where they are and what comes next helps users finish without getting lost.",
    advantages: () => ["Clear position and next step", "Help and errors sit next to the step they belong to"],
    tradeoffs: () => ["Slower for expert, returning users"],
  },
];

/** Used only when fewer than two strategies apply, so there is always a choice. */
const COMPACT: Strategy = {
  id: "compact",
  title: "Compact",
  applies: () => true,
  order: ["work", "find", "detail", "bulk", "orientation", "overview", "actions", "feedback"],
  summary: () => "Everything on one screen in a single column, primary task first.",
  rationale: () => "A single, uninterrupted column suits small screens and short tasks.",
  advantages: () => ["Simple to build and to learn"],
  tradeoffs: () => ["Long pages when there is a lot of content"],
};

function compose(ctx: Context, strategy: Strategy): LayoutVariant {
  const regions: LayoutRegion[] = strategy.order.flatMap((kind) => {
    const region = ctx.regions.get(kind);
    if (!region) return [];
    const text = (strategy.rename?.[kind] ?? REGION_TEXT[kind])(ctx);
    return [{ ...text, components: region.entries.map((e) => ({ ...e })) }];
  });
  // Any region kind the order doesn't mention still has to appear.
  for (const [kind, region] of ctx.regions) {
    if (!strategy.order.includes(kind)) regions.push({ ...REGION_TEXT[kind](ctx), components: [...region.entries] });
  }

  const shown = new Set([...ctx.regions.values()].flatMap((r) => [...r.capabilities]));
  const supportingDecisions = ctx.outcome.decisions
    .filter((d) => d.requiresCapabilities.every((c) => shown.has(c)))
    .map((d) => d.decision);
  const rulesApplied = [
    ...new Set(
      ctx.outcome.rulesFired.filter((r) => !r.decision || supportingDecisions.includes(r.decision)).map((r) => r.ruleId)
    ),
  ];

  return {
    id: strategy.id,
    title: strategy.title,
    strategy: strategy.title,
    summary: strategy.summary(ctx),
    rationale: strategy.rationale(ctx),
    pattern: ctx.outcome.patterns.find((p) => p.role === "primary")?.pattern,
    supportingDecisions,
    regions,
    advantages: strategy.advantages(ctx),
    tradeoffs: strategy.tradeoffs(ctx),
    rulesApplied,
    mobileNotes: mobileNotes(ctx, regions),
    desktopNotes: desktopNotes(ctx),
  };
}

function mobileNotes(ctx: Context, regions: LayoutRegion[]): string[] {
  if (ctx.state.context.device === "desktop") return [];
  const notes = [`Regions stack in the order shown; keep "${regions[0].name}" above the fold.`];
  if (ctx.regions.has("detail")) notes.push("The detail opens full screen on phones, with a clear way back to the list.");
  if (ctx.choices.navigation === "bottom-nav") notes.push("Primary navigation sits in a bottom bar within thumb reach.");
  return notes;
}

function desktopNotes(ctx: Context): string[] {
  if (ctx.state.context.device === "mobile") return [];
  const notes: string[] = [];
  if (ctx.choices.layout === "split-view") notes.push("List and detail sit side by side, so the list keeps its place.");
  if (ctx.regions.has("bulk")) notes.push("The bulk action bar appears above the list once items are selected.");
  if (notes.length === 0) notes.push("Content is constrained to a readable width, with actions aligned to it.");
  return notes;
}

export function composeDirections(state: UXState, outcome: PolicyOutcome): GenerationOutput {
  const ctx = buildContext(state, outcome);
  if (ctx.regions.size === 0) throw new Error("Nothing to lay out: policy selected no components.");
  const chosen = STRATEGIES.filter((s) => s.applies(ctx)).slice(0, 3);
  if (chosen.length < 2) chosen.push(COMPACT);
  return {
    variants: chosen.map((s) => compose(ctx, s)),
    assumptions: [
      "Drafted deterministically from the UX decisions, patterns and components, without an LLM. Region wording is generic.",
      ...state.ambiguities.map((a) => a.assumption),
    ],
  };
}
