/**
 * Coach mode — inline annotations on weak spots, no rewrite.
 * Uses the enhancer model to mark up the draft with [suggestions].
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { runEnhancerTextTask, type ModelTaskServices } from "./model-task.js";
import { buildSentinelReminder, parseEnhancedPrompt } from "./parser.js";
import type { PromptonRuntimeState } from "./state.js";

const COACH_SYSTEM_PROMPT = [
  "You are a prompt coach.",
  "Annotate the user's draft with inline suggestions. Do NOT rewrite the draft.",
  "Insert short bracketed annotations directly after weak spots, like:",
  '  "fix the bug" [vague: which bug? name the file and symptom]',
  '  "update everything" [unbounded: specify which files or modules]',
  '  "make it better" [vague: better how? faster? more readable? fewer bugs?]',
  "Rules:",
  "- Keep the original draft text intact.",
  "- Add at most 5 annotations.",
  "- Each annotation is [category: concrete suggestion].",
  "- Categories: vague, missing-context, unbounded, no-verification, missing-constraint, ambiguous.",
  "- If the draft is already strong, return it unchanged with no annotations.",
  "Return the annotated draft inside sentinel tags.",
  buildSentinelReminder(),
  "Do not add commentary outside the sentinel block.",
].join("\n");

export async function coachDraft(
  ctx: ExtensionContext,
  draft: string,
  runtime: PromptonRuntimeState,
  services: ModelTaskServices
): Promise<string | undefined> {
  const text = await runEnhancerTextTask(ctx, runtime, services, {
    label: "Prompton coaching draft...",
    systemPrompt: COACH_SYSTEM_PROMPT,
    userText: `Annotate this draft:\n\n${draft}`,
    maxTokens: 800,
  });
  return text === undefined ? undefined : parseEnhancedPrompt(text);
}
