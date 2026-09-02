/**
 * Single-dialog clarifier — shows lint warnings + intent-based suggestions
 * in one select dialog. User picks what to append, done in one interaction.
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { detectTaskIntent } from "./intent.js";
import { lintDraft } from "./lint.js";
import { openSelectDialog, type SelectDialogItem } from "./ui/select-dialog.js";

/**
 * Show a single clarification dialog based on the draft's lint issues and intent.
 * Returns the draft with chosen clarifications appended, or undefined if cancelled.
 */
export async function clarifyDraft(
  ctx: ExtensionContext,
  draft: string
): Promise<string | undefined> {
  const intent = detectTaskIntent(draft);
  const warnings = lintDraft(draft);

  if (warnings.length === 0) {
    return draft;
  }

  const items: SelectDialogItem[] = [];
  for (const warning of warnings.slice(0, 2)) {
    const fix = lintFix(warning.id);
    if (fix) items.push(fix);
  }

  for (const suggestion of getIntentSuggestions(intent)) {
    if (items.length >= 3) break;
    items.push(suggestion);
  }

  items.push({ value: "__custom__", label: "Type something" });

  const choice = await openSelectDialog(ctx, {
    title: "Clarify before enhancing",
    items,
    pageSize: 4,
  });

  if (choice === undefined) return undefined;

  const inputPrompt = choice.startsWith("__input__:")
    ? choice.slice("__input__:".length)
    : choice === "__custom__"
      ? "Add clarification"
      : undefined;
  const clarification = inputPrompt ? await ctx.ui.input(inputPrompt) : choice;
  return clarification?.trim() ? `${draft}\n\n${clarification.trim()}` : undefined;
}

function lintFix(warningId: string): SelectDialogItem | undefined {
  switch (warningId) {
    case "no-verb":
      return {
        value: "__input__:What should happen?",
        label: "Add an action",
        description: "Draft has no clear action",
      };
    case "vague-subject":
      return {
        value: "__input__:Which file or module?",
        label: "Name the target",
        description: "Vague subject, no file references",
      };
    case "unbounded-scope":
      return {
        value: "__input__:Which files or behaviors are in scope?",
        label: "Narrow the scope",
        description: "Unbounded scope",
      };
    case "too-short":
      return {
        value: "__input__:What context is missing?",
        label: "Add context",
        description: "Draft is very short",
      };
    case "bare-question":
      return {
        value: "__input__:What have you tried or what do you need?",
        label: "Add context",
        description: "Bare question lacks background",
      };
    default:
      return undefined;
  }
}

function getIntentSuggestions(intent: string): SelectDialogItem[] {
  switch (intent) {
    case "implement":
      return [
        { value: "Scope: single file change only.", label: "Single file scope" },
        { value: "Constraint: no new dependencies.", label: "No new deps" },
        { value: "Verify: add tests for the new code.", label: "Add verification" },
      ];
    case "debug":
      return [
        { value: "I can reproduce it consistently.", label: "Reproducible" },
        { value: "Priority: find root cause, don't fix yet.", label: "Root cause only" },
        { value: "Verify: add a regression test.", label: "Add regression test" },
      ];
    case "refactor":
      return [
        { value: "Goal: reduce duplication.", label: "Reduce duplication" },
        { value: "Constraint: no behavior change.", label: "No behavior change" },
        { value: "Verify: all existing tests pass.", label: "Tests must pass" },
      ];
    case "review":
      return [
        { value: "Focus: correctness and edge cases.", label: "Correctness focus" },
        { value: "Depth: thorough review, line-by-line.", label: "Thorough depth" },
        { value: "Focus: security and input validation.", label: "Security focus" },
      ];
    case "research":
      return [
        { value: "Compare approaches and recommend one.", label: "Compare options" },
        { value: "Check feasibility before I commit.", label: "Feasibility check" },
        { value: "Find the canonical way to do this.", label: "Best practice" },
      ];
    default:
      return [
        { value: "I want a concrete implementation.", label: "Build it" },
        { value: "I want an explanation or walkthrough.", label: "Explain it" },
        { value: "Keep it brief and practical.", label: "Keep it brief" },
      ];
  }
}
