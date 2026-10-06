import { z } from "zod";
import {
  decisionResultSchema,
  decisionTypeSchema,
  gapResolutionKindSchema,
  policyOutcomeSchema,
  uxStateSchema,
  type DecisionType,
} from "@/lib/schemas";

/**
 * PRD §29 / §50 audit trail for one analysis: brief → state → decision-model
 * results → policy outcome → designer actions, with an event log. Lives in
 * the browser (localStorage) and exports as JSON. Every update is a pure
 * function so the trace is easy to test and replay.
 */

export const SESSION_VERSION = 1;

const timestamp = z.iso.datetime();

export const sessionEventSchema = z.object({
  at: timestamp,
  type: z.enum([
    "created",
    "state-extracted",
    "state-edited",
    "decided",
    "accepted",
    "overridden",
    "override-removed",
    "gap-settled",
    "gap-reopened",
  ]),
  detail: z.string(),
});

export const sessionOverrideSchema = z.object({
  decision: decisionTypeSchema,
  choice: z.string(),
  reason: z.string().min(1),
  timestamp,
});

export const sessionGapSettlementSchema = z.object({
  gapId: z.string(),
  kind: gapResolutionKindSchema,
  reason: z.string().min(1),
  timestamp,
});

export const analysisSessionSchema = z.object({
  version: z.literal(SESSION_VERSION),
  id: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
  brief: z.string(),
  state: uxStateSchema.nullable(),
  stateSource: z
    .object({ kind: z.enum(["llm", "demo", "edited"]), model: z.string(), notices: z.array(z.string()) })
    .nullable(),
  results: z.array(decisionResultSchema).nullable(),
  decisionModel: z
    .object({ provider: z.string(), model: z.string(), notices: z.array(z.string()) })
    .nullable(),
  outcome: policyOutcomeSchema.nullable(),
  overrides: z.array(sessionOverrideSchema),
  /** Accepted decisions, tied to the choice that was accepted. */
  accepted: z.array(z.object({ decision: decisionTypeSchema, choice: z.string(), at: timestamp })),
  gapSettlements: z.array(sessionGapSettlementSchema),
  events: z.array(sessionEventSchema),
});

export type AnalysisSession = z.infer<typeof analysisSessionSchema>;
export type SessionOverride = z.infer<typeof sessionOverrideSchema>;
export type SessionGapSettlement = z.infer<typeof sessionGapSettlementSchema>;
type Outcome = NonNullable<AnalysisSession["outcome"]>;

const now = () => new Date().toISOString();

function touch(session: AnalysisSession, type: AnalysisSession["events"][number]["type"], detail: string, at = now()) {
  return { ...session, updatedAt: at, events: [...session.events, { at, type, detail }] };
}

export function createSession(brief: string, id: string = crypto.randomUUID(), at = now()): AnalysisSession {
  return {
    version: SESSION_VERSION,
    id,
    createdAt: at,
    updatedAt: at,
    brief,
    state: null,
    stateSource: null,
    results: null,
    decisionModel: null,
    outcome: null,
    overrides: [],
    accepted: [],
    gapSettlements: [],
    events: [{ at, type: "created", detail: brief }],
  };
}

/** A new state invalidates everything derived from the old one. */
export function withState(
  session: AnalysisSession,
  state: NonNullable<AnalysisSession["state"]>,
  source: NonNullable<AnalysisSession["stateSource"]>
): AnalysisSession {
  const next: AnalysisSession = {
    ...session,
    state,
    stateSource: source,
    results: null,
    decisionModel: null,
    outcome: null,
    overrides: [],
    accepted: [],
    gapSettlements: [],
  };
  return source.kind === "edited"
    ? touch(next, "state-edited", "Designer edited the UX state; earlier decisions were cleared.")
    : touch(next, "state-extracted", `${source.kind === "demo" ? "Demo state" : `Extracted by ${source.model}`}`);
}

export function withAnalysis(
  session: AnalysisSession,
  analysis: { results: AnalysisSession["results"]; decisionModel: NonNullable<AnalysisSession["decisionModel"]>; outcome: Outcome }
): AnalysisSession {
  // Acceptances only stand while the decision still has the accepted choice.
  const accepted = session.accepted.filter((a) =>
    analysis.outcome.decisions.some((d) => d.decision === a.decision && d.result.choice === a.choice)
  );
  return touch(
    { ...session, results: analysis.results, decisionModel: analysis.decisionModel, outcome: analysis.outcome, accepted },
    "decided",
    `${analysis.outcome.decisions.length} decisions via ${analysis.decisionModel.provider} (${analysis.decisionModel.model}); ${analysis.outcome.gaps.length} gaps${analysis.outcome.blocked ? ", blocked" : ""}`
  );
}

export function acceptDecision(session: AnalysisSession, decision: DecisionType, choice: string): AnalysisSession {
  const accepted = [...session.accepted.filter((a) => a.decision !== decision), { decision, choice, at: now() }];
  return touch({ ...session, accepted }, "accepted", `${decision} = ${choice}`);
}

export function isAccepted(session: AnalysisSession, decision: DecisionType, choice: string): boolean {
  return session.accepted.some((a) => a.decision === decision && a.choice === choice);
}

export function addOverride(session: AnalysisSession, override: Omit<SessionOverride, "timestamp">): AnalysisSession {
  const entry = { ...override, timestamp: now() };
  return touch(
    { ...session, overrides: [...session.overrides.filter((o) => o.decision !== override.decision), entry] },
    "overridden",
    `${override.decision} → ${override.choice}: ${override.reason}`
  );
}

export function removeOverride(session: AnalysisSession, decision: DecisionType): AnalysisSession {
  return touch(
    { ...session, overrides: session.overrides.filter((o) => o.decision !== decision) },
    "override-removed",
    `${decision} returned to the system recommendation`
  );
}

export function settleGap(session: AnalysisSession, settlement: Omit<SessionGapSettlement, "timestamp">): AnalysisSession {
  const entry = { ...settlement, timestamp: now() };
  return touch(
    { ...session, gapSettlements: [...session.gapSettlements.filter((g) => g.gapId !== settlement.gapId), entry] },
    "gap-settled",
    `${settlement.gapId} (${settlement.kind}): ${settlement.reason}`
  );
}

export function reopenGap(session: AnalysisSession, gapId: string): AnalysisSession {
  return touch(
    { ...session, gapSettlements: session.gapSettlements.filter((g) => g.gapId !== gapId) },
    "gap-reopened",
    gapId
  );
}

/** A short label for session lists. */
export function sessionTitle(session: AnalysisSession): string {
  const text = session.state?.product || session.brief;
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}
