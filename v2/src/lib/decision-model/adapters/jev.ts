import { z } from "zod";
import { noulConfidence } from "@/lib/decision-model/confidence";
import {
  argmax,
  normalizeProbabilities,
  weightedScore,
  type DecisionProvider,
  type DecisionState,
} from "@/lib/decision-model/provider";
import type { DecisionQuestion, DecisionResult } from "@/lib/schemas";

export const JEV_MODEL_ID = "typesafe/jev";

/** Minimal structural type for the Workers AI binding. */
export interface AiBinding {
  run(model: string, input: unknown): Promise<unknown>;
}

/** How to reach Jev: the Worker's AI binding, or a visitor's own account via REST. */
export type JevTransport =
  | { kind: "binding"; ai: AiBinding }
  | { kind: "rest"; accountId: string; apiToken: string; fetch?: typeof fetch };

interface JevQuestion {
  type: "noul" | "choice" | "score";
  instructions: string;
  criteria: Record<string, string> | string[];
}

const jevAnswerSchema = z.object({
  type: z.enum(["noul", "choice", "score"]),
  noul: z.number().optional(),
  choice: z.string().optional(),
  score: z.number().optional(),
  confidence: z.number().optional(),
  probabilities: z.record(z.string(), z.number()).optional(),
});

const jevOutputSchema = z.object({
  model: z.string().optional(),
  answers: z.record(z.string(), jevAnswerSchema),
});

type JevAnswer = z.infer<typeof jevAnswerSchema>;

/**
 * Jev adapter (PRD §6). A thin mapping between our DecisionQuestion and
 * Jev's native { state, questions } format. Jev's output is still
 * validated and re-normalized here so all providers produce identically
 * shaped, comparable results.
 */
export class JevProvider implements DecisionProvider {
  readonly id = "jev" as const;

  constructor(private readonly transport: JevTransport) {}

  async evaluate(state: DecisionState, questions: readonly DecisionQuestion[]): Promise<DecisionResult[]> {
    const keys = questions.map((q) => jevKey(q.id));
    const input = {
      state,
      questions: Object.fromEntries(questions.map((q, i) => [keys[i], toJevQuestion(q)])),
    };

    const raw = await this.run(input);
    const parsed = jevOutputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Jev returned an unexpected shape: ${parsed.error.message.slice(0, 300)}`);
    }
    const model = parsed.data.model ?? "jev";

    return questions.map((q, i) => {
      const answer = parsed.data.answers[keys[i]];
      if (!answer) throw new Error(`Jev returned no answer for ${q.id}`);
      return toResult(q, answer, model);
    });
  }

  private async run(input: unknown): Promise<unknown> {
    if (this.transport.kind === "binding") {
      return this.transport.ai.run(JEV_MODEL_ID, input);
    }
    const { accountId, apiToken } = this.transport;
    const doFetch = this.transport.fetch ?? fetch;
    const res = await doFetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: JEV_MODEL_ID, input }),
      }
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new Error("That Cloudflare token was rejected. Check it in Settings and try again.");
      }
      throw new Error(`Jev request failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    const body = (await res.json()) as { result?: unknown };
    // The REST API wraps output in a { result } envelope; the binding doesn't.
    return body.result ?? body;
  }
}

/** Jev question names: keep them readable, but identifier-safe. */
export function jevKey(questionId: string): string {
  return questionId.replace(/[^a-zA-Z0-9]+/g, "_");
}

function toJevQuestion(q: DecisionQuestion): JevQuestion {
  return { type: q.type, instructions: q.instructions, criteria: q.criteria };
}

/** Map a score probability key (index or level label) to its level index. */
function levelIndex(key: string, legend: readonly string[]): string | undefined {
  if (/^\d+$/.test(key) && Number(key) < legend.length) return key;
  const i = legend.indexOf(key);
  return i >= 0 ? String(i) : undefined;
}

function toResult(q: DecisionQuestion, a: JevAnswer, model: string): DecisionResult {
  const base = { questionId: q.id, provider: "jev" as const, model };
  if (a.type !== q.type) {
    throw new Error(`Jev answered ${q.id} as ${a.type}, expected ${q.type}`);
  }

  if (q.type === "noul") {
    if (a.noul === undefined) throw new Error(`Jev noul answer for ${q.id} has no value`);
    // A noul value is the yes-probability itself; derive uniform confidence from it.
    return { ...base, type: "noul", noul: a.noul, confidence: noulConfidence(a.noul) };
  }

  if (q.type === "choice") {
    const options = Object.keys(q.criteria);
    const probabilities = normalizeProbabilities(a.probabilities ?? {}, options);
    const choice = a.choice && options.includes(a.choice) ? a.choice : argmax(probabilities)[0];
    return {
      ...base,
      type: "choice",
      choice,
      probabilities,
      confidence: a.confidence ?? probabilities[choice],
    };
  }

  const levels = q.criteria.map((_, i) => String(i));
  const byIndex: Record<string, number> = {};
  for (const [k, p] of Object.entries(a.probabilities ?? {})) {
    const idx = levelIndex(k, q.criteria);
    if (idx !== undefined) byIndex[idx] = p;
  }
  const probabilities = normalizeProbabilities(byIndex, levels);
  return {
    ...base,
    type: "score",
    score: a.score ?? weightedScore(probabilities),
    probabilities,
    legend: q.criteria,
    confidence: a.confidence ?? argmax(probabilities)[1],
  };
}
