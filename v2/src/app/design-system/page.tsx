"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { credentials, postJson } from "@/lib/client/api";
import { GAP_BEHAVIOR_LABELS, PROVIDER_LABELS, card, humanize, inputClass, primaryButton, secondaryButton, sectionTitle } from "@/lib/client/format";
import {
  activeDesignSystemId,
  deleteDesignSystem,
  loadDesignSystems,
  saveDesignSystem,
  setActiveDesignSystem,
  type SavedDesignSystem,
} from "@/lib/design-system/client-storage";
import { sessionLabel, type AnalysisSession } from "@/lib/session/session";
import { loadSessions } from "@/lib/session/storage";
import type { CapabilityDefinition, DesignSystem, GapWithBehavior, NormalizationReport, PendingMapping } from "@/lib/schemas";
import capabilitiesJson from "@knowledge/capabilities.json";
import acmeExample from "@knowledge/design-systems/acme-example.json";

const CAPABILITIES = capabilitiesJson as unknown as CapabilityDefinition[];
const CATEGORIES = [...new Set(CAPABILITIES.map((c) => c.category))];

interface ImportResponse {
  designSystem: DesignSystem;
  report: NormalizationReport;
  pending: PendingMapping[];
}

interface MapResponse {
  designSystem: DesignSystem;
  /** subject = component, from = capability; "mapped" means confirmed or rejected, "ambiguous" unsure. */
  entries: NormalizationReport["entries"];
  provider: string;
  model: string;
  notices: string[];
}

const SOURCE_STYLES: Record<string, string> = {
  declared: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  designer: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
  "decision-model": "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  inferred: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
};

/** PRD §21 Design System Review: import → report → capability matrix → mapping review → gaps → save as a version. */
export default function DesignSystemPage() {
  const [library, setLibrary] = useState<SavedDesignSystem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bundled, setBundled] = useState<SavedDesignSystem | null>(null);
  const [viewing, setViewing] = useState<SavedDesignSystem | null>(null);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount
    setLibrary(loadDesignSystems());
    setActiveId(activeDesignSystemId());
    fetch("/api/design-system/default")
      .then((r) => r.json())
      .then((d: ImportResponse) => {
        const entry = { ...d, savedAt: new Date().toISOString() };
        setBundled(entry);
        setViewing((v) => v ?? entry);
      })
      .catch(() => setError("Couldn't load the bundled design system."));
  }, []);

  async function task(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function refresh() {
    setLibrary(loadDesignSystems());
    setActiveId(activeDesignSystemId());
  }

  function store(entry: SavedDesignSystem) {
    saveDesignSystem(entry);
    refresh();
    setViewing(entry);
  }

  async function runImport(input: unknown) {
    await task("import", async () => {
      const r = await postJson<ImportResponse>("/api/design-system/import", { designSystem: input });
      store({ ...r, savedAt: new Date().toISOString() });
      setNotices([`Imported ${r.designSystem.name} ${r.designSystem.version}: ${r.designSystem.components.length} components, ${r.pending.length} mappings to review.`]);
    });
  }

  const isBundled = viewing?.designSystem.source.kind === "bundled";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Design System Review</h1>
        <p className="max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
          Import your design system, see how it was normalized, review what each component can do, and check it against an
          analysis. The active system is what UX Analyze, layouts and evaluations build with.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}
      {notices.map((n) => (
        <p key={n} role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
          {n}
        </p>
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${card} flex flex-col gap-3`} aria-labelledby="library-title">
          <h2 id="library-title" className={sectionTitle}>
            Your design systems
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {[...(bundled ? [bundled] : []), ...library].map((entry) => {
              const ds = entry.designSystem;
              const id = ds.source.kind === "bundled" ? null : ds.id;
              const active = id === activeId || (id === null && !activeId);
              return (
                <li key={`${ds.id}-${ds.source.kind}`} className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" className="text-left" onClick={() => setViewing(entry)}>
                    <span className={`font-medium ${viewing?.designSystem.id === ds.id ? "text-violet-700 dark:text-violet-300" : "text-zinc-900 dark:text-zinc-50"}`}>
                      {ds.name}
                    </span>{" "}
                    <span className="text-zinc-500">
                      {ds.version} · {ds.components.length} components{ds.source.kind === "bundled" ? " · bundled" : ""}
                    </span>
                  </button>
                  <span className="flex gap-2">
                    {active ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Active
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={secondaryButton}
                        onClick={() => {
                          setActiveDesignSystem(id);
                          refresh();
                        }}
                      >
                        Use for analyses
                      </button>
                    )}
                    {id && (
                      <button
                        type="button"
                        className={secondaryButton}
                        onClick={() => {
                          deleteDesignSystem(id);
                          refresh();
                          if (viewing?.designSystem.id === id) setViewing(bundled);
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Changing the active system changes the components and gaps of your next analysis run. Each result records the
            system and version it used.
          </p>
        </section>

        <section className={`${card} flex flex-col gap-3`} aria-labelledby="import-title">
          <h2 id="import-title" className={sectionTitle}>
            Import (JSON)
          </h2>
          <textarea
            aria-label="Design system JSON"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
            placeholder='{ "name": "Acme DS", "version": "2.4.0", "tokens": { … }, "components": [ { "name": "Btn", "variants": [ … ], "states": [ … ] } ] }'
            className={`${inputClass} font-mono text-xs`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={primaryButton}
              disabled={busy !== null || !raw.trim()}
              onClick={() => {
                let parsed: unknown;
                try {
                  parsed = JSON.parse(raw);
                } catch {
                  setError("That isn't valid JSON.");
                  return;
                }
                runImport(parsed);
              }}
            >
              {busy === "import" ? "Importing…" : "Import"}
            </button>
            <label className={`${secondaryButton} cursor-pointer`}>
              Upload a file
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setRaw(await file.text());
                }}
              />
            </label>
            <button type="button" className={secondaryButton} disabled={busy !== null} onClick={() => runImport(acmeExample)}>
              Try the Acme example
            </button>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Names, states and variants are normalized to the canonical vocabulary, tokens are tiered, and capabilities are
            inferred from names and props. Format: see the README&apos;s &ldquo;Phase 1 import format&rdquo;.
          </p>
        </section>
      </div>

      {viewing && (
        <Review
          key={`${viewing.designSystem.id}-${viewing.designSystem.version}`}
          entry={viewing}
          readOnly={isBundled}
          busy={busy}
          task={task}
          onUpdate={(next, message) => {
            store(next);
            setNotices(message);
          }}
        />
      )}
    </main>
  );
}

function Review({
  entry,
  readOnly,
  busy,
  task,
  onUpdate,
}: {
  entry: SavedDesignSystem;
  readOnly: boolean;
  busy: string | null;
  task: (name: string, fn: () => Promise<void>) => Promise<void>;
  onUpdate: (next: SavedDesignSystem, notices: string[]) => void;
}) {
  const { designSystem: ds, report, pending } = entry;
  const [verdicts, setVerdicts] = useState<Record<string, boolean>>({});
  const name = new Map(ds.components.map((c) => [c.id, c.name]));

  const providers = useMemo(() => {
    const map = new Map<string, { component: string; level: string; source: string; confidence: number }[]>();
    for (const c of ds.components) {
      for (const claim of c.capabilities) {
        map.set(claim.capability, [...(map.get(claim.capability) ?? []), { component: c.id, level: claim.level, source: claim.source, confidence: claim.confidence }]);
      }
    }
    return map;
  }, [ds]);

  const covered = CAPABILITIES.filter((c) => providers.has(c.id)).length;
  const tokenTiers = ["primitive", "semantic", "component"].map((t) => `${ds.tokens.filter((x) => x.tier === t).length} ${t}`);
  const statusCount = (s: string) => report.entries.filter((e) => e.status === s).length;
  const key = (p: PendingMapping) => `${p.component}:${p.capability}`;

  async function applyReview() {
    const reviews = pending.filter((p) => key(p) in verdicts).map((p) => ({ component: p.component, capability: p.capability, accept: verdicts[key(p)] }));
    await task("review", async () => {
      const r = await postJson<{ designSystem: DesignSystem }>("/api/design-system/review", { designSystem: ds, reviews });
      const remaining = pending.filter((p) => !(key(p) in verdicts));
      onUpdate({ ...entry, designSystem: r.designSystem, pending: remaining, savedAt: new Date().toISOString() }, [
        `Recorded ${reviews.length} ${reviews.length === 1 ? "decision" : "decisions"} as version ${r.designSystem.version}.`,
      ]);
      setVerdicts({});
    });
  }

  async function askModel() {
    await task("map", async () => {
      const r = await postJson<MapResponse>("/api/design-system/map", { ...credentials(), designSystem: ds, pending });
      const settled = new Set(r.entries.filter((e) => e.status === "mapped").map((e) => `${e.subject}:${e.from}`));
      onUpdate({ ...entry, designSystem: r.designSystem, pending: pending.filter((p) => !settled.has(key(p))), savedAt: new Date().toISOString() }, [
        `${PROVIDER_LABELS[r.provider] ?? r.provider} (${r.model}) settled ${settled.size} of ${pending.length} mappings.`,
        ...r.notices,
      ]);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={`${card} flex flex-wrap items-baseline justify-between gap-3`}>
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {ds.name} <span className="text-sm font-normal text-zinc-500">{ds.version}</span>
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {ds.components.length} components · {covered} of {CAPABILITIES.length} capabilities covered directly · tokens: {tokenTiers.join(", ")}
          </p>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Normalization: {statusCount("mapped")} mapped · {statusCount("ambiguous")} ambiguous · {statusCount("unknown")} unknown ·{" "}
          {report.findings.length} findings
        </p>
      </section>

      {pending.length > 0 && !readOnly && (
        <section className={`${card} flex flex-col gap-3`} aria-labelledby="pending-title">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 id="pending-title" className={sectionTitle}>
                Mappings to review ({pending.length})
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Inferred from names and props with less than 85% confidence. Confirm or reject them yourself, or ask the decision
                model about all of them in one request. Your decision always wins.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className={secondaryButton} disabled={busy !== null} onClick={askModel}>
                {busy === "map" ? "Asking…" : "Ask the decision model"}
              </button>
              <button type="button" className={primaryButton} disabled={busy !== null || Object.keys(verdicts).length === 0} onClick={applyReview}>
                {busy === "review" ? "Saving…" : `Record ${Object.keys(verdicts).length} ${Object.keys(verdicts).length === 1 ? "decision" : "decisions"}`}
              </button>
            </div>
          </div>
          <ul className="flex flex-col divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {pending.map((p) => (
              <li key={key(p)} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-zinc-900 dark:text-zinc-50">
                    Does <strong className="font-medium">{name.get(p.component) ?? p.component}</strong> provide{" "}
                    <strong className="font-medium">{humanize(p.capability).toLowerCase()}</strong>?
                  </p>
                  <p className="text-xs text-zinc-500">
                    {Math.round(p.confidence * 100)}% · {p.reasons.join(", ")}
                  </p>
                </div>
                <div className="flex gap-1" role="group" aria-label={`${p.component} ${p.capability}`}>
                  {[
                    { v: true, label: "Yes" },
                    { v: false, label: "No" },
                  ].map(({ v, label }) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={verdicts[key(p)] === v}
                      onClick={() => setVerdicts((all) => ({ ...all, [key(p)]: v }))}
                      className={`rounded-full px-3 py-1 text-xs ring-1 ${
                        verdicts[key(p)] === v
                          ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-900"
                          : "text-zinc-700 ring-zinc-200 dark:text-zinc-300 dark:ring-zinc-700"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${card} flex flex-col gap-4`} aria-labelledby="matrix-title">
        <div>
          <h3 id="matrix-title" className={sectionTitle}>
            Capability matrix
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            What each capability is provided by, and how we know: <Badge source="declared" /> <Badge source="inferred" />{" "}
            <Badge source="decision-model" /> <Badge source="designer" />. Capabilities nobody claims may still be composed from
            parts (recipes) when an analysis needs them.
          </p>
        </div>
        {CATEGORIES.map((cat) => (
          <div key={cat}>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">{cat}</p>
            <ul className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
              {CAPABILITIES.filter((c) => c.category === cat).map((c) => {
                const list = providers.get(c.id) ?? [];
                return (
                  <li key={c.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-zinc-100 py-1 dark:border-zinc-800">
                    <span className={list.length > 0 ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-400 line-through decoration-zinc-300"}>{c.name}</span>
                    {list.map((p) => (
                      <span key={p.component} className={`rounded px-1.5 py-0.5 text-[11px] ${SOURCE_STYLES[p.source]}`} title={`${p.source}, ${Math.round(p.confidence * 100)}%`}>
                        {name.get(p.component)}
                        {p.level === "partial" ? " (partial)" : ""}
                      </span>
                    ))}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${card} flex flex-col gap-2`} aria-labelledby="report-title">
          <h3 id="report-title" className={sectionTitle}>
            Normalization report
          </h3>
          {report.findings.length === 0 ? (
            <p className="text-sm text-zinc-500">No problems found.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {report.findings.map((f, i) => (
                <li key={i}>
                  <span className="font-mono text-xs text-rose-700 dark:text-rose-300">{f.kind}</span> <span className="text-zinc-700 dark:text-zinc-300">{f.subject}</span>{" "}
                  <span className="text-zinc-500">— {f.detail}</span>
                </li>
              ))}
            </ul>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer text-zinc-700 dark:text-zinc-300">All {report.entries.length} mappings</summary>
            <ul className="mt-2 flex max-h-80 flex-col gap-0.5 overflow-y-auto font-mono text-xs">
              {report.entries.map((e, i) => (
                <li key={i} className={e.status === "mapped" ? "text-zinc-600 dark:text-zinc-400" : "text-amber-700 dark:text-amber-300"}>
                  {e.kind} · {e.subject}: {e.from} → {e.to ?? "?"} ({e.status}){e.note ? ` — ${e.note}` : ""}
                </li>
              ))}
            </ul>
          </details>
        </section>

        <Coverage designSystem={ds} />
      </div>
    </div>
  );
}

function Badge({ source }: { source: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-[11px] ${SOURCE_STYLES[source]}`}>{source}</span>;
}

/** §21c against a real need: resolve a saved analysis's requirements against this system. */
function Coverage({ designSystem }: { designSystem: DesignSystem }) {
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [result, setResult] = useState<{ gaps: GapWithBehavior[]; blocked: boolean; resolved: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const decided = loadSessions().filter((s) => s.outcome && s.outcome.requirements.length > 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount
    setSessions(decided);
    setSessionId(decided[0]?.id ?? "");
  }, []);

  async function check() {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session?.outcome) return;
    setError(null);
    try {
      const r = await postJson<{ gaps: GapWithBehavior[]; blocked: boolean; resolutions: unknown[] }>("/api/design-system/gaps", {
        requirements: session.outcome.requirements,
        designSystem,
      });
      setResult({ gaps: r.gaps, blocked: r.blocked, resolved: r.resolutions.length - r.gaps.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check failed.");
    }
  }

  return (
    <section className={`${card} flex flex-col gap-3`} aria-labelledby="coverage-title">
      <h3 id="coverage-title" className={sectionTitle}>
        Check against an analysis
      </h3>
      {sessions.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No analyses yet. <Link href="/analyze" className="text-violet-700 underline dark:text-violet-300">Run one</Link> to see
          what this system can and can&apos;t build for it.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Analysis" value={sessionId} onChange={(e) => setSessionId(e.target.value)} className={`${inputClass} flex-1`}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {sessionLabel(s)}
                </option>
              ))}
            </select>
            <button type="button" className={secondaryButton} onClick={check}>
              Check
            </button>
          </div>
          {error && <p className="text-sm text-rose-700">{error}</p>}
          {result && (
            <div className="flex flex-col gap-2 text-sm">
              <p className={result.blocked ? "text-rose-700 dark:text-rose-300" : "text-zinc-700 dark:text-zinc-300"}>
                {result.resolved} requirements met · {result.gaps.length} gaps{result.blocked ? " · generation would be blocked" : ""}
              </p>
              <ul className="flex flex-col gap-1">
                {result.gaps.map((g) => (
                  <li key={g.id}>
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{humanize(g.capability)}</span>{" "}
                    <span className="text-zinc-500">
                      · {g.kind} · {g.severity} · {GAP_BEHAVIOR_LABELS[g.behavior]}
                      {g.missing.length > 0 ? ` · missing ${g.missing.join(", ")}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
