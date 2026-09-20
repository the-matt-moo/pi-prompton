/**
 * Jev Choice–based intent classification.
 * Replaces regex keyword matching with semantic classification via TypeSafe System One.
 * Falls back to regex `detectTaskIntent` on error or missing API key.
 * Speculative fan-out: asks intent + clarification needs in one call with zero added latency.
 */

import type { PromptonTaskIntent } from "./types.js";
import { detectTaskIntent } from "./intent.js";
import { callSystemOne, DEFAULT_MODEL, resolveJevApiKey } from "./jev-client.js";

const DEFAULT_CONFIDENCE_THRESHOLD = 0.4;

/**
 * Jev Choice criteria: each intent label mapped to a human-readable description
 * that tells the model what kind of draft belongs in that category.
 */
const INTENT_CRITERIA: Record<PromptonTaskIntent, string> = {
  implement:
    "The user wants to build, add, create, wire up, integrate, update, change, or modify code, features, or functionality.",
  debug:
    "The user wants to debug, fix a bug, investigate a failure, find a root cause, or resolve an error, crash, or hang.",
  refactor:
    "The user wants to refactor, clean up, simplify, deduplicate, restructure, or reorganize existing code without changing behavior.",
  review: "The user wants a code review, audit, or inspection to find issues and report findings.",
  research:
    "The user wants to research, investigate options, compare approaches, evaluate alternatives, or spike on a topic.",
  docs: "The user wants to write, update, or improve documentation, READMEs, usage guides, or doc comments.",
  "test-fix":
    "The user wants to fix failing tests, update test expectations, add regression tests, or resolve test-specific issues.",
  explain:
    "The user wants an explanation, walkthrough, or help understanding how something works or why something behaves a certain way.",
  general:
    "The request does not clearly fit any of the above categories, or is a general conversation or question.",
};

export interface JevIntentOptions {
  /** API key for TypeSafe. If omitted, reads from Windows Credential Manager. */
  apiKey?: string | undefined;
  /** Credential Manager target. Default: `pi-bifrost/jev-api-key`. */
  credentialTarget?: string | undefined;
  /** Jev model reference. Default: `jev-latest`. */
  model?: string | undefined;
  /** Request timeout in ms. Default: 5000. */
  timeoutMs?: number | undefined;
  /** Minimum confidence to accept Jev's answer. Default: 0.4. */
  confidenceThreshold?: number | undefined;
  /** Custom fetch for testing. */
  fetch?: typeof globalThis.fetch | undefined;
  /** Custom credential reader for testing. */
  readCredential?: ((target: string) => Promise<string | undefined>) | undefined;
}

export interface JevIntentResult {
  intent: PromptonTaskIntent;
  source: "jev" | "regex";
  confidence?: number | undefined;
  /** Jev Noul probability that prompt is too vague/ambiguous (0-1). Only set when source is "jev". */
  needsClarification?: number | undefined;
  /** Most critically missing context element. Only set when source is "jev" and not "none". */
  missingContext?: "files" | "repro" | "acceptance" | "scope" | undefined;
}

/**
 * Classify a prompt draft's task intent using Jev Choice, falling back to regex.
 *
 * Zero config when the `pi-bifrost/jev-api-key` credential exists in Windows Credential Manager.
 */
export async function detectTaskIntentSmart(
  draft: string,
  options: JevIntentOptions = {}
): Promise<JevIntentResult> {
  if (!draft.trim()) {
    return { intent: "general", source: "regex" };
  }

  try {
    const apiKey = await resolveJevApiKey(options);

    if (!apiKey) {
      return { intent: detectTaskIntent(draft), source: "regex" };
    }

    const result = await classifyWithJev(draft, apiKey, options);
    if (result) return result;
  } catch {
    // Jev unavailable — silent fallback
  }

  return { intent: detectTaskIntent(draft), source: "regex" };
}

async function classifyWithJev(
  draft: string,
  apiKey: string,
  options: JevIntentOptions
): Promise<JevIntentResult | undefined> {
  const model = options.model ?? DEFAULT_MODEL;
  const threshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  const body = {
    state: draft.length > 2000 ? draft.slice(0, 2000) : draft,
    model,
    questions: {
      intent: {
        type: "choice" as const,
        instructions:
          "Classify the user's coding-agent prompt draft into the single best-fitting task intent category.",
        criteria: INTENT_CRITERIA,
      },
      needsClarification: {
        type: "noul" as const,
        instructions:
          "The prompt is too vague, ambiguous, or lacks essential context (files, error output, acceptance criteria) to execute immediately.",
      },
      missingContext: {
        type: "choice" as const,
        instructions: "Which element is most critically missing from the prompt?",
        criteria: {
          none: "Prompt has sufficient context to proceed",
          files: "Missing file paths or target locations",
          repro: "Missing error output, stack traces, or reproduction steps",
          acceptance: "Missing desired behavior, expected outcome, or acceptance criteria",
          scope: "Missing scope boundaries (single file? all files? specific module?)",
        },
      },
    },
  };

  const data = await callSystemOne(body, apiKey, options);
  if (!data) return undefined;

  const answer = data.answers?.intent;
  if (!answer?.choice) return undefined;

  const intent = answer.choice as PromptonTaskIntent;
  if (!(intent in INTENT_CRITERIA)) return undefined;

  if (answer.confidence !== undefined && answer.confidence < threshold) {
    return undefined; // Low confidence → fall back to regex
  }

  const clarificationNoul = data.answers?.needsClarification?.noul;
  const missingContext = data.answers?.missingContext?.choice as
    | "none"
    | "files"
    | "repro"
    | "acceptance"
    | "scope"
    | undefined;

  return {
    intent,
    source: "jev" as const,
    ...(answer.confidence !== undefined ? { confidence: answer.confidence } : {}),
    ...(clarificationNoul !== undefined ? { needsClarification: clarificationNoul } : {}),
    ...(missingContext && missingContext !== "none" ? { missingContext } : {}),
  };
}
