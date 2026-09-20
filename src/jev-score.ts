/**
 * Jev Score–based prompt quality rating.
 * Replaces regex-parsed "Score: N/5" text with a typed TypeSafe Score judgment.
 * Falls back to undefined on error or missing API key; caller keeps the
 * regex-parsed score from the enhancer model's free text in that case.
 */

import { callSystemOne, resolveJevApiKey, type JevClientOptions } from "./jev-client.js";

export interface JevScoreOptions extends JevClientOptions {
  /** Jev model reference. Default: `jev-latest`. */
  model?: string | undefined;
}

export interface JevScoreResult {
  /** 1-5, mapped from Jev's 0-4 level scale. */
  score: number;
  confidence: number;
}

const QUALITY_LEVELS = [
  "unusable: no clear intent, no context",
  "weak: vague intent, missing scope or constraints",
  "adequate: clear intent but could be sharper",
  "strong: clear, scoped, actionable",
  "excellent: precise, constrained, verifiable",
];

export async function scoreDraftWithJev(
  draft: string,
  options: JevScoreOptions = {}
): Promise<JevScoreResult | undefined> {
  if (!draft.trim()) return undefined;

  try {
    const apiKey = await resolveJevApiKey(options);
    if (!apiKey) return undefined;

    const data = await callSystemOne(
      {
        state: draft.length > 2000 ? draft.slice(0, 2000) : draft,
        model: options.model ?? "jev-latest",
        questions: {
          quality: {
            type: "score" as const,
            instructions:
              "Rate the overall quality of this draft prompt intended for a coding agent.",
            criteria: QUALITY_LEVELS,
          },
        },
      },
      apiKey,
      options
    );

    const answer = data?.answers?.quality;
    if (typeof answer?.score !== "number" || !Number.isFinite(answer.score)) {
      return undefined;
    }

    return {
      score: Math.min(5, Math.max(1, Math.round(answer.score) + 1)),
      confidence: answer.confidence ?? 0,
    };
  } catch {
    return undefined; // Jev unavailable — silent fallback to regex-parsed score
  }
}
