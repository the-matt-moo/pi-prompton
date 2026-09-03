/**
 * LLM-based prompt scoring — quick feedback without rewriting.
 * Returns a 1-5 score with 2-3 concrete weaknesses.
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { runEnhancerTextTask, type ModelTaskServices } from "./model-task.js";
import {
  buildSentinelReminder,
  isInvalidModelOutputError,
  parseEnhancedPrompt,
} from "./parser.js";
import type { PromptonRuntimeState } from "./state.js";

export interface ScoreResult {
  score: number;
  weaknesses: string[];
  summary: string;
}

const SCORE_SYSTEM_PROMPT = [
  "You are a prompt quality evaluator.",
  "Rate the user's draft prompt on a scale of 1-5:",
  "  1 = unusable (no clear intent, no context)",
  "  2 = weak (vague intent, missing scope or constraints)",
  "  3 = adequate (clear intent but could be sharper)",
  "  4 = strong (clear, scoped, actionable)",
  "  5 = excellent (precise, constrained, verifiable)",
  "Return EXACTLY this format inside sentinel tags:",
  buildSentinelReminder(),
  "Inside the tags, use this format:",
  "Score: N/5",
  "Weaknesses:",
  "- (concrete weakness, max 3)",
  "Summary: (one sentence overall assessment)",
  "Do not rewrite the prompt. Do not add commentary outside the sentinel block.",
].join("\n");

export async function scoreDraft(
  ctx: ExtensionContext,
  draft: string,
  runtime: PromptonRuntimeState,
  services: ModelTaskServices
): Promise<ScoreResult | undefined> {
  const userText = `Rate this prompt draft:\n\n${draft}`;
  const primaryText = await runEnhancerTextTask(ctx, runtime, services, {
    label: "Prompton scoring draft...",
    systemPrompt: SCORE_SYSTEM_PROMPT,
    userText,
    maxTokens: 300,
  });
  if (primaryText === undefined) {
    return undefined;
  }

  try {
    return parseScoreBody(primaryText);
  } catch (error) {
    if (!isInvalidModelOutputError(error)) {
      throw error;
    }

    const retryText = await runEnhancerTextTask(ctx, runtime, services, {
      label: "Prompton scoring draft...",
      systemPrompt: `${SCORE_SYSTEM_PROMPT}\n\nIMPORTANT: Return exactly one sentinel block and no surrounding commentary.`,
      userText: `${userText}\n\nIMPORTANT: Return exactly one sentinel block and no surrounding commentary.`,
      maxTokens: 300,
    });
    if (retryText === undefined) {
      return undefined;
    }

    return parseScoreResponse(retryText);
  }
}

export function parseScoreResponse(text: string): ScoreResult {
  try {
    return parseScoreBody(text);
  } catch (error) {
    throw new Error(
      `Invalid score response: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function parseScoreBody(text: string): ScoreResult {
  const body = parseEnhancedPrompt(text);
  const scoreMatch = body.match(/Score:\s*([1-5])\s*\/\s*5/i);
  const weaknessMatch = body.match(/Weaknesses:\s*([\s\S]*?)(?:Summary:|$)/i);
  const summaryMatch = body.match(/Summary:\s*(.+)/i);
  const scoreText = scoreMatch?.[1];
  const weaknessText = weaknessMatch?.[1];
  const summary = summaryMatch?.[1]?.trim();

  if (!scoreText || weaknessText === undefined || !summary) {
    throw new Error("Invalid score response: expected Score, Weaknesses, and Summary fields.");
  }

  const weaknesses = weaknessText
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  return { score: Number(scoreText), weaknesses, summary };
}
