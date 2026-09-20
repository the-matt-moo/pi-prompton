/**
 * Jev Noul–based rewrite verification.
 * After the enhancer produces a structurally valid rewrite, checks whether it
 * still preserves the original draft's intent and constraints. Fails open
 * (treats the rewrite as preserved) whenever Jev is unavailable, unconfigured,
 * or errors — this is a quality gate, not a safety guardrail, so it must never
 * block enhancement because a judge call failed.
 */

import { callSystemOne, resolveJevApiKey, type JevClientOptions } from "./jev-client.js";

export interface JevVerifyOptions extends JevClientOptions {
  /** Jev model reference. Default: `jev-latest`. */
  model?: string | undefined;
  /** Noul probability of "dropped intent" at or above this is flagged. Default: 0.6. */
  dropThreshold?: number | undefined;
}

/** Returns false only when Jev is configured and confidently flags dropped intent. */
export async function verifyIntentPreserved(
  originalDraft: string,
  rewrittenPrompt: string,
  options: JevVerifyOptions = {}
): Promise<boolean> {
  if (!originalDraft.trim() || !rewrittenPrompt.trim()) return true;

  try {
    const apiKey = await resolveJevApiKey(options);
    if (!apiKey) return true; // Jev unavailable — fail open

    const data = await callSystemOne(
      {
        state: {
          original_draft: originalDraft.slice(0, 2000),
          rewritten_prompt: rewrittenPrompt.slice(0, 4000),
        },
        model: options.model ?? "jev-latest",
        questions: {
          dropped_intent: {
            type: "noul" as const,
            instructions:
              "`rewritten_prompt` drops, contradicts, or narrows the user's original goal or " +
              "explicit constraints stated in `original_draft`.",
          },
        },
      },
      apiKey,
      options
    );

    const noul = data?.answers?.dropped_intent?.noul;
    if (typeof noul !== "number") return true; // malformed reply — fail open

    return noul < (options.dropThreshold ?? 0.6);
  } catch {
    return true; // Jev unreachable — fail open
  }
}
