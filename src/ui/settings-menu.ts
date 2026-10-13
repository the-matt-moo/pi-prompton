import type { SettingItem } from "@earendil-works/pi-tui";
import { formatShortcutKey } from "../shortcut-key.js";
import type { ModelRef, PromptonAutoSendBusyBehavior, PromptonSettings } from "../types.js";

export type SettingsMenuOptionId =
  | "enabled"
  | "shortcutEnabled"
  | "shortcutKey"
  | "statusBarEnabled"
  | "historyEnabled"
  | "targetFamilyMode"
  | "fallbackFamily"
  | "enhancerModelMode"
  | "fixedEnhancerModel"
  | "gptEnhancerModel"
  | "claudeEnhancerModel"
  | "fallbackEnhancerModels"
  | "includeRecentConversation"
  | "includeProjectMetadata"
  | "enhancementTimeoutMs"
  | "rewriteStrength"
  | "rewriteMode"
  | "previewBeforeReplace"
  | "autoSendEnhancedPrompt"
  | "autoSendBusyBehavior"
  | "preserveCodeBlocks"
  | "exactModelOverrides"
  | "familyOverrides"
  | "clarifyEnabled"
  | "clarifyOnShortcut"
  | "jevScoringEnabled"
  | "jevVerificationEnabled"
  | "reset"
  | "done";

export type SettingsMenuItem = SettingItem & { id: SettingsMenuOptionId };

export const SETTINGS_TOGGLE_IDS = [
  "enabled",
  "shortcutEnabled",
  "statusBarEnabled",
  "historyEnabled",
  "includeRecentConversation",
  "includeProjectMetadata",
  "previewBeforeReplace",
  "autoSendEnhancedPrompt",
  "preserveCodeBlocks",
  "clarifyEnabled",
  "clarifyOnShortcut",
  "jevScoringEnabled",
  "jevVerificationEnabled",
] as const;

export const TARGET_FAMILY_OPTIONS = [
  "auto — universal model-agnostic rewrite",
  "gpt — always rewrite in GPT-style",
  "claude — always rewrite in Claude-style",
] as const;

export const ENHANCER_MODEL_OPTIONS = [
  "active — use the currently selected Pi model",
  "fixed — always use one specific model",
  "family-linked — use one model for GPT-style and another for Claude-style",
] as const;

export const REWRITE_STRENGTH_OPTIONS = [
  "light — small cleanup, fastest",
  "balanced — default trade-off",
  "strong — more restructuring",
] as const;

export const REWRITE_MODE_OPTIONS = [
  "auto — infer task vs plain rewrite",
  "plain — plain prompt rewrite",
  "execution-contract — execution contract",
] as const;

export const AUTO_SEND_BUSY_BEHAVIOR_OPTIONS = [
  "steer — send after the current tool batch",
  "follow-up — wait until Pi becomes idle",
] as const;

export const FAMILY_OPTIONS = [
  "gpt — direct, concise, sectioned",
  "claude — explicit, strongly structured, XML-friendly",
] as const;

export function buildSettingsMenuOptions(
  settings: PromptonSettings
): Record<SettingsMenuOptionId, SettingsMenuItem> {
  return {
    enabled: createSettingsMenuItem(
      "enabled",
      "Prompt enhancement",
      toggleValue(settings.enabled),
      "Master switch for /prompton and the keyboard shortcut."
    ),
    shortcutEnabled: createSettingsMenuItem(
      "shortcutEnabled",
      "Keyboard shortcut",
      toggleValue(settings.shortcutEnabled),
      "Run Prompton directly from the editor."
    ),
    shortcutKey: createSettingsMenuItem(
      "shortcutKey",
      "Shortcut keybinding",
      formatShortcutKey(settings.shortcutKey),
      "Change the key combo or reset to Alt+P."
    ),
    statusBarEnabled: createSettingsMenuItem(
      "statusBarEnabled",
      "Footer status bar",
      toggleValue(settings.statusBarEnabled),
      "Show compact live Prompton status in the footer."
    ),
    historyEnabled: createSettingsMenuItem(
      "historyEnabled",
      "Prompt history and undo",
      toggleValue(settings.historyEnabled),
      "Off by default. Without history, Prompton cannot undo replacements. Turning off clears the 10-draft session buffer."
    ),
    targetFamilyMode: createSettingsMenuItem(
      "targetFamilyMode",
      "Prompt style target",
      describeTargetFamilyMode(settings),
      "Choose GPT-style versus Claude-style output."
    ),
    fallbackFamily: createSettingsMenuItem(
      "fallbackFamily",
      "Unknown-model default style",
      settings.fallbackFamily.toUpperCase(),
      "Used when auto routing has no matching model rule."
    ),
    enhancerModelMode: createSettingsMenuItem(
      "enhancerModelMode",
      "Enhancer model choice",
      describeEnhancerMode(settings),
      "Choose which model performs the rewrite."
    ),
    fixedEnhancerModel: createSettingsMenuItem(
      "fixedEnhancerModel",
      "Fixed enhancer model",
      formatModelRef(settings.fixedEnhancerModel),
      "Used only when enhancer model choice is set to fixed."
    ),
    gptEnhancerModel: createSettingsMenuItem(
      "gptEnhancerModel",
      "GPT-style enhancer model",
      formatModelRef(settings.familyEnhancerModels?.gpt),
      "Used only when enhancer model choice is family-linked."
    ),
    claudeEnhancerModel: createSettingsMenuItem(
      "claudeEnhancerModel",
      "Claude-style enhancer model",
      formatModelRef(settings.familyEnhancerModels?.claude),
      "Used only when enhancer model choice is family-linked."
    ),
    fallbackEnhancerModels: createSettingsMenuItem(
      "fallbackEnhancerModels",
      "Enhancer fallback chain",
      settings.fallbackEnhancerModels?.map(formatModelRef).join(" → ") || "Off",
      "Models tried in order after primary format or provider failures. Add, remove, reorder, or clear."
    ),
    includeRecentConversation: createSettingsMenuItem(
      "includeRecentConversation",
      "Recent chat context",
      toggleValue(settings.includeRecentConversation),
      "More thread-aware rewrites, but usually slower."
    ),
    includeProjectMetadata: createSettingsMenuItem(
      "includeProjectMetadata",
      "Project metadata",
      toggleValue(settings.includeProjectMetadata),
      "Include cwd and git branch when available."
    ),
    enhancementTimeoutMs: createSettingsMenuItem(
      "enhancementTimeoutMs",
      "Enhancement timeout",
      formatTimeoutSeconds(settings.enhancementTimeoutMs),
      "Abort slow rewrites automatically."
    ),
    rewriteStrength: createSettingsMenuItem(
      "rewriteStrength",
      "Rewrite strength",
      capitalize(settings.rewriteStrength),
      "How aggressively Prompton rewrites the draft."
    ),
    rewriteMode: createSettingsMenuItem(
      "rewriteMode",
      "Rewrite mode",
      describeRewriteMode(settings),
      "Choose plain rewrite versus execution-contract output."
    ),
    previewBeforeReplace: createSettingsMenuItem(
      "previewBeforeReplace",
      "Review before replacing editor",
      toggleValue(settings.previewBeforeReplace),
      "Open a review step before overwriting the current draft."
    ),
    autoSendEnhancedPrompt: createSettingsMenuItem(
      "autoSendEnhancedPrompt",
      "Auto-send refined prompt",
      toggleValue(settings.autoSendEnhancedPrompt),
      "After refinement, submit the final prompt immediately instead of leaving it in the editor."
    ),
    autoSendBusyBehavior: createSettingsMenuItem(
      "autoSendBusyBehavior",
      "Auto-send while busy",
      describeAutoSendBusyBehavior(settings.autoSendBusyBehavior),
      "Used only when auto-send is on. Steer after the current tool batch or wait as a follow-up."
    ),
    preserveCodeBlocks: createSettingsMenuItem(
      "preserveCodeBlocks",
      "Keep code blocks unchanged",
      toggleValue(settings.preserveCodeBlocks),
      "Preserve fenced code blocks when possible."
    ),
    exactModelOverrides: createSettingsMenuItem(
      "exactModelOverrides",
      "Exact model style rules",
      String(settings.exactModelOverrides.length),
      "Route specific models to GPT or Claude style."
    ),
    familyOverrides: createSettingsMenuItem(
      "familyOverrides",
      "Pattern style rules",
      String(settings.familyOverrides.length),
      "Route model patterns like openai/* or kimi-*."
    ),
    clarifyEnabled: createSettingsMenuItem(
      "clarifyEnabled",
      "Clarify before enhancing",
      toggleValue(settings.clarifyEnabled),
      "Show a single clarification dialog (lint + intent suggestions) before enhancing."
    ),
    clarifyOnShortcut: createSettingsMenuItem(
      "clarifyOnShortcut",
      "Clarify on shortcut",
      toggleValue(settings.clarifyOnShortcut),
      "Also show clarification dialog when triggered via the keyboard shortcut."
    ),
    jevScoringEnabled: createSettingsMenuItem(
      "jevScoringEnabled",
      "Jev quality scoring",
      toggleValue(settings.jevScoringEnabled),
      "Opt in to external TypeSafe Jev scoring. Requires a configured credential; otherwise uses existing scoring."
    ),
    jevVerificationEnabled: createSettingsMenuItem(
      "jevVerificationEnabled",
      "Jev intent verification",
      toggleValue(settings.jevVerificationEnabled),
      "Opt in to external TypeSafe Jev intent checks. Unavailable or uncertain checks do not block rewrites."
    ),
    reset: {
      id: "reset",
      label: "Reset saved settings",
      currentValue: "Reset…",
      description: "Restore Prompton settings to defaults.",
    },
    done: {
      id: "done",
      label: "Done",
      currentValue: "Close",
      description: "Close Prompton settings.",
    },
  };
}

export function describeSelectedTargetFamilyMode(
  value: PromptonSettings["targetFamilyMode"]
): string | undefined {
  switch (value) {
    case "auto":
      return TARGET_FAMILY_OPTIONS[0];
    case "gpt":
      return TARGET_FAMILY_OPTIONS[1];
    case "claude":
      return TARGET_FAMILY_OPTIONS[2];
  }
}

export function describeSelectedEnhancerMode(
  value: PromptonSettings["enhancerModelMode"]
): string | undefined {
  switch (value) {
    case "active":
      return ENHANCER_MODEL_OPTIONS[0];
    case "fixed":
      return ENHANCER_MODEL_OPTIONS[1];
    case "family-linked":
      return ENHANCER_MODEL_OPTIONS[2];
  }
}

export function describeSelectedStrength(
  value: PromptonSettings["rewriteStrength"]
): string | undefined {
  switch (value) {
    case "light":
      return REWRITE_STRENGTH_OPTIONS[0];
    case "balanced":
      return REWRITE_STRENGTH_OPTIONS[1];
    case "strong":
      return REWRITE_STRENGTH_OPTIONS[2];
  }
}

export function describeSelectedRewriteMode(
  value: PromptonSettings["rewriteMode"]
): string | undefined {
  switch (value) {
    case "auto":
      return REWRITE_MODE_OPTIONS[0];
    case "plain":
      return REWRITE_MODE_OPTIONS[1];
    case "execution-contract":
      return REWRITE_MODE_OPTIONS[2];
  }
}

export function describeSelectedAutoSendBusyBehavior(
  value: PromptonAutoSendBusyBehavior
): string | undefined {
  switch (value) {
    case "steer":
      return AUTO_SEND_BUSY_BEHAVIOR_OPTIONS[0];
    case "followUp":
      return AUTO_SEND_BUSY_BEHAVIOR_OPTIONS[1];
  }
}

export function parseLabeledTargetFamilyMode(
  value: string | undefined
): PromptonSettings["targetFamilyMode"] | undefined {
  if (value?.startsWith("auto")) return "auto";
  if (value?.startsWith("gpt")) return "gpt";
  if (value?.startsWith("claude")) return "claude";
  return undefined;
}

export function parseLabeledEnhancerMode(
  value: string | undefined
): PromptonSettings["enhancerModelMode"] | undefined {
  if (value?.startsWith("active")) return "active";
  if (value?.startsWith("fixed")) return "fixed";
  if (value?.startsWith("family-linked")) return "family-linked";
  return undefined;
}

export function parseLabeledStrength(
  value: string | undefined
): PromptonSettings["rewriteStrength"] | undefined {
  if (value?.startsWith("light")) return "light";
  if (value?.startsWith("balanced")) return "balanced";
  if (value?.startsWith("strong")) return "strong";
  return undefined;
}

export function parseLabeledRewriteMode(
  value: string | undefined
): PromptonSettings["rewriteMode"] | undefined {
  if (value?.startsWith("auto")) return "auto";
  if (value?.startsWith("plain")) return "plain";
  if (value?.startsWith("execution-contract")) return "execution-contract";
  return undefined;
}

export function parseLabeledAutoSendBusyBehavior(
  value: string | undefined
): PromptonAutoSendBusyBehavior | undefined {
  if (value?.startsWith("steer")) return "steer";
  if (value?.startsWith("follow-up")) return "followUp";
  return undefined;
}

function createSettingsMenuItem(
  value: SettingsMenuOptionId,
  label: string,
  currentValue: string,
  description: string
): SettingsMenuItem {
  return {
    id: value,
    label,
    currentValue,
    description,
    ...(SETTINGS_TOGGLE_IDS.some((id) => id === value)
      ? { values: [toggleValue(false), toggleValue(true)] }
      : {}),
  };
}

function formatModelRef(modelRef: ModelRef | undefined): string {
  return modelRef ? `${modelRef.provider}/${modelRef.id}` : "Unset";
}

export function toggleValue(value: boolean): string {
  return value ? "[x] On" : "[ ] Off";
}

function capitalize(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

export function formatTimeoutSeconds(timeoutMs: number): string {
  return `${Math.floor(timeoutMs / 1_000)}s`;
}

function describeTargetFamilyMode(settings: PromptonSettings): string {
  switch (settings.targetFamilyMode) {
    case "auto":
      return "Auto (universal)";
    case "gpt":
      return "Force GPT-style";
    case "claude":
      return "Force Claude-style";
  }
}

function describeEnhancerMode(settings: PromptonSettings): string {
  switch (settings.enhancerModelMode) {
    case "active":
      return "Active model";
    case "fixed":
      return "Fixed model";
    case "family-linked":
      return "Family-linked models";
  }
}

function describeRewriteMode(settings: PromptonSettings): string {
  switch (settings.rewriteMode) {
    case "auto":
      return "Auto (infer task vs plain rewrite)";
    case "plain":
      return "Plain prompt rewrite";
    case "execution-contract":
      return "Execution contract";
  }
}

function describeAutoSendBusyBehavior(value: PromptonAutoSendBusyBehavior): string {
  return value === "followUp" ? "Follow-up" : "Steer";
}
