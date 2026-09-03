/**
 * Prompt templates — intent-based skeletons for empty-editor starts.
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { openSelectDialog } from "./ui/select-dialog.js";

interface PromptTemplate {
  value: string;
  label: string;
  description: string;
  skeleton: string;
}

const TEMPLATES: PromptTemplate[] = [
  {
    value: "blank",
    label: "Blank prompt",
    description: "Free-form prompt, no template",
    skeleton: "",
  },
  {
    value: "implement",
    label: "Implement feature",
    description: "Add or build something new",
    skeleton: [
      "Implement: [describe the feature]",
      "",
      "Files: [which files to create or modify]",
      "Constraints: [any requirements or limitations]",
      "Verify: [how to confirm it works]",
    ].join("\n"),
  },
  {
    value: "debug",
    label: "Debug issue",
    description: "Find and fix a bug",
    skeleton: [
      "Debug: [describe the symptom]",
      "",
      "Reproduce: [steps or trigger]",
      "Expected: [what should happen]",
      "Actual: [what happens instead]",
      "Suspect: [files or areas, if known]",
    ].join("\n"),
  },
  {
    value: "refactor",
    label: "Refactor code",
    description: "Restructure without changing behavior",
    skeleton: [
      "Refactor: [what to improve]",
      "",
      "Files: [which files]",
      "Goal: [reduce duplication / improve readability / extract module]",
      "Constraint: no behavior change",
    ].join("\n"),
  },
  {
    value: "review",
    label: "Review code",
    description: "Audit for issues",
    skeleton: [
      "Review: [what to review — file, PR, branch]",
      "",
      "Focus: [correctness / security / performance / all]",
      "Depth: [quick scan / thorough / audit-level]",
    ].join("\n"),
  },
];

/**
 * Show template picker when editor is empty.
 * Returns the chosen skeleton text, or undefined if cancelled.
 */
export async function pickTemplate(ctx: ExtensionContext): Promise<string | undefined> {
  const choice = await openSelectDialog(ctx, {
    title: "Start from a template",
    items: TEMPLATES.map((t) => ({
      value: t.value,
      label: t.label,
      description: t.description,
    })),
    pageSize: 4,
  });

  if (!choice) return undefined;
  return TEMPLATES.find((t) => t.value === choice)?.skeleton;
}
