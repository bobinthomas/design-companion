import { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";
import type { ProviderClientConfig } from "@/lib/ai/providers";
import { noulConfidence } from "@/lib/decision-model/confidence";
import {
  argmax,
  normalizeProbabilities,
  weightedScore,
  type DecisionProvider,
} from "@/lib/decision-model/provider";
import type { DecisionQuestion, DecisionResult, UXState } from "@/lib/schemas";

const SYSTEM_PROMPT = `You are a decision model. You answer typed, atomic questions about a UX problem state.

Rules:
- Judge only from the state given. Do not design anything or explain.
- Answer every question, using only the answer keys defined for it.
- "noul" questions: give the probability (0 to 1) that the statement is true.
- "choice" questions: give a probability for every option id; they should sum to 1.
- "score" questions: give a probability for every level index ("0", "1", …); they should sum to 1.
- Return JSON only, in exactly the requested shape.`;

/**
 * Decision provider backed by the visitor's BYOK LLM. Exists for provider
 * comparison against Jev (PRD §40) and as a fallback when Jev is
 * unavailable. The LLM only returns probabilities; choice, score and
 * confidence are computed here so every provider is scored the same way.
 */
export class LlmDecisionProvider implements DecisionProvider {
  readonly id = "llm" as const;

  constructor(
    private readonly config: ProviderClientConfig,
    private readonly generate: typeof generateStructured = generateStructured
  ) {}

  async evaluate(state: UXState, questions: readonly DecisionQuestion[]): Promise<DecisionResult[]> {
    const { data, model } = await this.generate({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(state, questions),
      schema: buildAnswerSchema(questions),
      clientConfig: this.config,
    });
    const modelId = `${this.config.provider}:${model}`;
    return questions.map((q) => toResult(q, data.answers[q.id], modelId));
  }
}

function answerKeys(q: DecisionQuestion): string[] {
  if (q.type === "noul") return [];
  if (q.type === "choice") return Object.keys(q.criteria);
  return q.criteria.map((_, i) => String(i));
}

function buildAnswerSchema(questions: readonly DecisionQuestion[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const q of questions) {
    if (q.type === "noul") {
      shape[q.id] = z.object({ noul: z.number().min(0).max(1) });
    } else {
      const keys = answerKeys(q);
      shape[q.id] = z.object({
        probabilities: z.object(
          Object.fromEntries(keys.map((k) => [k, z.number().min(0).max(1)]))
        ),
      });
    }
  }
  return z.object({ answers: z.object(shape) }) as z.ZodType<{
    answers: Record<string, { noul?: number; probabilities?: Record<string, number> }>;
  }>;
}

function buildUserPrompt(state: UXState, questions: readonly DecisionQuestion[]): string {
  const described = questions.map((q) => ({
    id: q.id,
    type: q.type,
    instructions: q.instructions,
    criteria: q.criteria,
    answerKeys: q.type === "noul" ? undefined : answerKeys(q),
  }));
  return [
    "STATE:",
    JSON.stringify(state, null, 2),
    "",
    "QUESTIONS:",
    JSON.stringify(described, null, 2),
    "",
    'Return: { "answers": { "<question id>": { "noul": number } | { "probabilities": { "<answer key>": number } } } }',
  ].join("\n");
}

function toResult(
  q: DecisionQuestion,
  answer: { noul?: number; probabilities?: Record<string, number> },
  model: string
): DecisionResult {
  const base = { questionId: q.id, provider: "llm" as const, model };
  if (q.type === "noul") {
    const noul = answer.noul ?? 0.5;
    return { ...base, type: "noul", noul, confidence: noulConfidence(noul) };
  }
  const probabilities = normalizeProbabilities(answer.probabilities ?? {}, answerKeys(q));
  const [top, confidence] = argmax(probabilities);
  if (q.type === "choice") {
    return { ...base, type: "choice", choice: top, probabilities, confidence };
  }
  return {
    ...base,
    type: "score",
    score: weightedScore(probabilities),
    probabilities,
    legend: q.criteria,
    confidence,
  };
}
