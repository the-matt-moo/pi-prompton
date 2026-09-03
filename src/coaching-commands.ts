import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { clarifyDraft } from "./clarify.js";
import { coachDraft } from "./coach.js";
import type { EnhancementServices } from "./enhance.js";
import { formatLintWarnings, lintDraft } from "./lint.js";
import { scoreDraft } from "./score.js";
import type { PromptonRuntimeState } from "./state.js";
import { pickTemplate } from "./templates.js";
import { openSelectDialog } from "./ui/select-dialog.js";
import { detectRuntimeSupport } from "./validation.js";

export function runLintCommand(ctx: ExtensionCommandContext): void {
  const draft = requireInteractiveDraft(ctx);
  const warnings = lintDraft(draft);
  ctx.ui.notify(warnings.length === 0 ? "No lint warnings." : formatLintWarnings(warnings));
}

export async function runClarifyCommand(
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState
): Promise<void> {
  const draft = requireInteractiveDraft(ctx);
  const refined = await clarifyDraft(ctx, draft);
  if (refined === undefined) {
    ctx.ui.notify("Clarify cancelled.");
    return;
  }
  if (refined === draft) {
    ctx.ui.notify("Draft is already clear enough to enhance.");
    return;
  }

  runtime.undo.store(draft);
  ctx.ui.setEditorText(refined);
  ctx.ui.notify("Clarification appended. Run /prompton to enhance.");
}

export async function runScoreCommand(
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState,
  services: EnhancementServices
): Promise<void> {
  const result = await scoreDraft(ctx, requireInteractiveDraft(ctx), runtime, services);
  if (!result) {
    ctx.ui.notify("Score cancelled.");
    return;
  }

  const weaknesses = result.weaknesses.length
    ? result.weaknesses.map((weakness) => `  - ${weakness}`).join("\n")
    : "  (none)";
  ctx.ui.notify(`Score: ${result.score}/5\nWeaknesses:\n${weaknesses}\n${result.summary}`);
}

export async function runCoachCommand(
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState,
  services: EnhancementServices
): Promise<void> {
  const draft = requireInteractiveDraft(ctx);
  const annotated = await coachDraft(ctx, draft, runtime, services);
  if (annotated === undefined) {
    ctx.ui.notify("Coach cancelled.");
    return;
  }

  runtime.undo.store(draft);
  ctx.ui.setEditorText(annotated);
  ctx.ui.notify("Coach annotations added. Review the [brackets], then run /prompton.");
}

export async function runTemplateCommand(
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState
): Promise<void> {
  const support = detectRuntimeSupport(ctx);
  if (!support.interactiveTui) throw new Error(support.reason);

  const currentDraft = ctx.ui.getEditorText();
  if (
    currentDraft.trim() &&
    !(await ctx.ui.confirm(
      "Replace current draft?",
      "The current editor text will be saved to undo history."
    ))
  ) {
    return;
  }

  const template = await pickTemplate(ctx);
  if (!template) return;
  if (currentDraft.trim()) runtime.undo.store(currentDraft);
  ctx.ui.setEditorText(template);
  ctx.ui.notify("Template loaded. Fill in the [brackets] and run /prompton.");
}

export async function runInputCommand(
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState
): Promise<void> {
  const support = detectRuntimeSupport(ctx);
  if (!support.interactiveTui) throw new Error(support.reason);

  const currentDraft = ctx.ui.getEditorText();
  if (
    currentDraft.trim() &&
    !(await ctx.ui.confirm(
      "Replace current draft?",
      "The current editor text will be saved to undo history."
    ))
  ) {
    return;
  }

  if (currentDraft.trim()) runtime.undo.store(currentDraft);
  ctx.ui.setEditorText("");
  ctx.ui.notify("Ready for input. Type your prompt and run /prompton.");
}

export async function runHistoryCommand(
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState
): Promise<void> {
  const support = detectRuntimeSupport(ctx);
  if (!support.interactiveTui) throw new Error(support.reason);

  const entries = runtime.undo.getHistory();
  if (entries.length === 0) throw new Error("No prompt history available.");

  const items = entries
    .map((entry, index) => {
      const preview = entry.draft.slice(0, 60).replace(/\n/g, " ");
      return {
        value: String(index),
        label: `${new Date(entry.timestamp).toLocaleTimeString()}: ${preview}${entry.draft.length > 60 ? "..." : ""}`,
      };
    })
    .reverse();
  const choice = await openSelectDialog(ctx, { title: "Prompt history", items, pageSize: 8 });
  if (choice === undefined) return;

  const entry = entries[Number(choice)];
  if (!entry) return;
  const currentDraft = ctx.ui.getEditorText();
  if (currentDraft.trim() && currentDraft !== entry.draft) runtime.undo.store(currentDraft);
  ctx.ui.setEditorText(entry.draft);
  ctx.ui.notify("Restored from history.");
}

function requireInteractiveDraft(ctx: ExtensionCommandContext): string {
  const support = detectRuntimeSupport(ctx);
  if (!support.interactiveTui) throw new Error(support.reason);

  const draft = ctx.ui.getEditorText();
  if (!draft.trim()) throw new Error("Editor is empty.");
  return draft;
}
