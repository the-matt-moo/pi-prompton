import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
  runClarifyCommand,
  runCoachCommand,
  runHistoryCommand,
  runLintCommand,
  runScoreCommand,
  runTemplateCommand,
} from "./coaching-commands.js";
import { HELP_LINES } from "./constants.js";
import {
  setActiveEnhancerModelMode,
  setFamilyEnhancerModel,
  setFixedEnhancerModel,
} from "./enhancer-settings.js";
import { enhanceEditorDraft, type EnhancementServices } from "./enhance.js";
import { parseModelRef } from "./model-selection.js";
import {
  removeFamilyOverride,
  upsertExactModelOverride,
  upsertFamilyOverride,
} from "./overrides.js";
import type { PromptonRuntimeState } from "./state.js";
import type {
  ParsedPromptonCommand,
  PromptonFamily,
  PromptonRewriteMode,
  PromptonSettings,
} from "./types.js";
import { openSettingsUi, resetGlobalSettings } from "./ui/settings.js";
import { buildStatusReport } from "./ui/status.js";
import { detectRuntimeSupport, parseEnhancementTimeoutSeconds, parseOnOff } from "./validation.js";

type CommandServices = EnhancementServices;

export async function handlePromptonCommand(
  rawArgs: string,
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState,
  services: CommandServices
): Promise<void> {
  const command = parsePromptonCommand(rawArgs);

  try {
    switch (command.name) {
      case "":
        if (detectRuntimeSupport(ctx).interactiveTui && !ctx.ui.getEditorText().trim()) {
          await runTemplateCommand(ctx, runtime);
          return;
        }
        await enhanceEditorDraft(ctx, runtime, services);
        return;
      case "undo":
        handleUndo(ctx, runtime, services);
        return;
      case "status":
        notify(ctx, buildStatusReport(ctx, runtime));
        return;
      case "settings":
        await openSettingsUi(ctx, runtime, services);
        return;
      case "reset-settings":
        resetGlobalSettings(ctx, runtime, services);
        return;
      case "enable":
        persistSettings(
          ctx,
          runtime,
          services,
          { ...runtime.getSettings(), enabled: true },
          "Prompton enabled."
        );
        return;
      case "disable":
        persistSettings(
          ctx,
          runtime,
          services,
          { ...runtime.getSettings(), enabled: false },
          "Prompton disabled."
        );
        return;
      case "family":
        handleFamilyCommand(command, ctx, runtime, services);
        return;
      case "mode":
        handleRewriteModeCommand(command, ctx, runtime, services);
        return;
      case "enhancer-model":
        handleEnhancerModelCommand(command, ctx, runtime, services);
        return;
      case "map":
        handleMapCommand(command, ctx, runtime, services);
        return;
      case "conversation":
        handleBooleanSettingCommand(
          command,
          ctx,
          runtime,
          services,
          "includeRecentConversation",
          "Recent conversation setting updated."
        );
        return;
      case "project-metadata":
        handleBooleanSettingCommand(
          command,
          ctx,
          runtime,
          services,
          "includeProjectMetadata",
          "Project metadata setting updated."
        );
        return;
      case "status-bar":
        handleBooleanSettingCommand(
          command,
          ctx,
          runtime,
          services,
          "statusBarEnabled",
          "Status bar setting updated."
        );
        return;
      case "strength":
        handleStrengthCommand(command, ctx, runtime, services);
        return;
      case "preview":
        handleBooleanSettingCommand(
          command,
          ctx,
          runtime,
          services,
          "previewBeforeReplace",
          "Preview setting updated."
        );
        return;
      case "auto-send":
        handleBooleanSettingCommand(
          command,
          ctx,
          runtime,
          services,
          "autoSendEnhancedPrompt",
          "Auto-send setting updated."
        );
        return;
      case "auto-send-when-busy":
        handleAutoSendBusyBehaviorCommand(command, ctx, runtime, services);
        return;
      case "preserve-code":
        handleBooleanSettingCommand(
          command,
          ctx,
          runtime,
          services,
          "preserveCodeBlocks",
          "Code preservation setting updated."
        );
        return;
      case "timeout":
        handleTimeoutCommand(command, ctx, runtime, services);
        return;
      case "clarify":
        if (command.args.length > 0) {
          handleBooleanSettingCommand(
            command,
            ctx,
            runtime,
            services,
            "clarifyEnabled",
            "Clarify setting updated."
          );
        } else {
          await runClarifyCommand(ctx, runtime);
        }
        return;
      case "clarify-on-shortcut":
        handleBooleanSettingCommand(
          command,
          ctx,
          runtime,
          services,
          "clarifyOnShortcut",
          "Clarify-on-shortcut setting updated."
        );
        return;
      case "lint":
        runLintCommand(ctx);
        return;
      case "score":
        await runScoreCommand(ctx, runtime, services);
        return;
      case "coach":
        await runCoachCommand(ctx, runtime, services);
        return;
      case "template":
        await runTemplateCommand(ctx, runtime);
        return;
      case "history":
        await runHistoryCommand(ctx, runtime);
        return;
      case "help":
      default:
        notify(ctx, HELP_LINES);
        return;
    }
  } catch (error) {
    notify(ctx, formatError(error), "error");
  }
}

export function parsePromptonCommand(rawArgs: string): ParsedPromptonCommand {
  const trimmed = rawArgs.trim();
  if (!trimmed) {
    return { name: "", args: [] };
  }

  const args = trimmed.split(/\s+/);
  return {
    name: args[0]?.toLowerCase() ?? "",
    args: args.slice(1),
  };
}

export function getPromptonArgumentCompletions(
  prefix: string
): { value: string; label: string }[] | null {
  const options = [
    "status",
    "settings",
    "undo",
    "reset-settings",
    "enable",
    "disable",
    "family",
    "mode",
    "enhancer-model",
    "map",
    "conversation",
    "project-metadata",
    "status-bar",
    "strength",
    "preview",
    "auto-send",
    "auto-send-when-busy",
    "preserve-code",
    "timeout",
    "clarify",
    "clarify-on-shortcut",
    "lint",
    "score",
    "coach",
    "template",
    "history",
    "help",
  ];
  const loweredPrefix = prefix.toLowerCase();
  const valueOptions: Record<string, string[]> = {
    family: ["auto", "gpt", "claude"],
    mode: ["auto", "plain", "execution-contract"],
    "enhancer-model": ["active", "fixed", "family-linked"],
    map: ["active", "set", "add", "remove"],
    conversation: ["on", "off"],
    "project-metadata": ["on", "off"],
    "status-bar": ["on", "off"],
    strength: ["light", "balanced", "strong"],
    preview: ["on", "off"],
    "auto-send": ["on", "off"],
    "auto-send-when-busy": ["steer", "follow-up"],
    "preserve-code": ["on", "off"],
    clarify: ["on", "off"],
    "clarify-on-shortcut": ["on", "off"],
  };
  const [command] = loweredPrefix.trimStart().split(/\s+/, 1);
  const candidates = prefix.includes(" ")
    ? (valueOptions[command ?? ""] ?? []).map((value) => `${command} ${value}`)
    : options;
  const matches = candidates.filter((option) => option.startsWith(loweredPrefix));
  return matches.length > 0 ? matches.map((value) => ({ value, label: value })) : null;
}

function handleUndo(
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState,
  services: Pick<CommandServices, "refreshStatus">
): void {
  const support = detectRuntimeSupport(ctx);
  if (!support.interactiveTui) {
    throw new Error(support.reason);
  }

  const previousDraft = runtime.undo.consume();
  if (!previousDraft) {
    throw new Error("Prompton undo is not available.");
  }

  ctx.ui.setEditorText(previousDraft);
  services.refreshStatus(ctx);
  notify(ctx, "Prompton restored the previous draft.");
}

function handleFamilyCommand(
  command: ParsedPromptonCommand,
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState,
  services: CommandServices
): void {
  const family = command.args[0];
  if (family !== "auto" && family !== "gpt" && family !== "claude") {
    throw new Error("Usage: /prompton family auto|gpt|claude");
  }

  persistSettings(
    ctx,
    runtime,
    services,
    { ...runtime.getSettings(), targetFamilyMode: family },
    `Target family mode set to ${family}.`
  );
}

function handleRewriteModeCommand(
  command: ParsedPromptonCommand,
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState,
  services: CommandServices
): void {
  const rewriteMode = parseRewriteMode(command.args[0]);
  if (!rewriteMode) {
    throw new Error("Usage: /prompton mode auto|plain|execution-contract");
  }

  persistSettings(
    ctx,
    runtime,
    services,
    { ...runtime.getSettings(), rewriteMode },
    `Rewrite mode set to ${rewriteMode}.`
  );
}

function handleEnhancerModelCommand(
  command: ParsedPromptonCommand,
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState,
  services: CommandServices
): void {
  const mode = command.args[0];
  const settings = runtime.getSettings();

  switch (mode) {
    case "active":
      persistSettings(
        ctx,
        runtime,
        services,
        setActiveEnhancerModelMode(settings),
        "Enhancer model mode set to active."
      );
      return;
    case "fixed": {
      const modelRef = parseModelRef(command.args[1] ?? "");
      if (!modelRef) {
        throw new Error("Usage: /prompton enhancer-model fixed <provider>/<id>");
      }
      persistSettings(
        ctx,
        runtime,
        services,
        setFixedEnhancerModel(settings, modelRef),
        `Fixed enhancer model set to ${modelRef.provider}/${modelRef.id}.`
      );
      return;
    }
    case "family-linked": {
      const gptModel = parseModelRef(command.args[1] ?? "");
      const claudeModel = parseModelRef(command.args[2] ?? "");
      if (!gptModel || !claudeModel) {
        throw new Error(
          "Usage: /prompton enhancer-model family-linked <gpt-provider>/<gpt-id> <claude-provider>/<claude-id>"
        );
      }
      const next = setFamilyEnhancerModel(
        setFamilyEnhancerModel(settings, "gpt", gptModel),
        "claude",
        claudeModel
      );
      persistSettings(ctx, runtime, services, next, "Family-linked enhancer models updated.");
      return;
    }
    default:
      throw new Error(
        "Usage: /prompton enhancer-model active|fixed <provider>/<id>|family-linked <gpt-provider>/<gpt-id> <claude-provider>/<claude-id>"
      );
  }
}

function handleMapCommand(
  command: ParsedPromptonCommand,
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState,
  services: CommandServices
): void {
  const action = command.args[0];
  const settings = runtime.getSettings();

  switch (action) {
    case "active": {
      const family = parseFamily(command.args[1]);
      if (!family) {
        throw new Error("Usage: /prompton map active <gpt|claude>");
      }
      if (!ctx.model) {
        throw new Error("Prompton needs an active model for /prompton map active <family>.");
      }
      const next = upsertExactModelOverride(
        settings,
        { provider: ctx.model.provider, id: ctx.model.id },
        family
      );
      persistSettings(
        ctx,
        runtime,
        services,
        next,
        `Mapped ${ctx.model.provider}/${ctx.model.id} to ${family}.`
      );
      return;
    }
    case "set": {
      const modelRef = parseModelRef(command.args[1] ?? "");
      const family = parseFamily(command.args[2]);
      if (!modelRef || !family) {
        throw new Error("Usage: /prompton map set <provider>/<id> <gpt|claude>");
      }
      const next = upsertExactModelOverride(settings, modelRef, family);
      persistSettings(
        ctx,
        runtime,
        services,
        next,
        `Mapped ${modelRef.provider}/${modelRef.id} to ${family}.`
      );
      return;
    }
    case "add": {
      const pattern = command.args[1]?.trim();
      const family = parseFamily(command.args[2]);
      if (!pattern || !family) {
        throw new Error("Usage: /prompton map add <pattern> <gpt|claude>");
      }
      const next = upsertFamilyOverride(settings, pattern, family);
      persistSettings(ctx, runtime, services, next, `Pattern ${pattern} now routes to ${family}.`);
      return;
    }
    case "remove": {
      const pattern = command.args[1]?.trim();
      if (!pattern) {
        throw new Error("Usage: /prompton map remove <pattern>");
      }
      const next = removeFamilyOverride(settings, pattern);
      persistSettings(ctx, runtime, services, next, `Removed pattern override ${pattern}.`);
      return;
    }
    default:
      throw new Error(
        "Usage: /prompton map active <family> | set <provider>/<id> <family> | add <pattern> <family> | remove <pattern>"
      );
  }
}

function handleBooleanSettingCommand<K extends BooleanSettingKey>(
  command: ParsedPromptonCommand,
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState,
  services: CommandServices,
  key: K,
  message: string
): void {
  const boolValue = parseOnOff(command.args[0] ?? "");
  if (boolValue === undefined) {
    throw new Error(`Usage: /prompton ${command.name} on|off`);
  }

  persistSettings(ctx, runtime, services, { ...runtime.getSettings(), [key]: boolValue }, message);
}

function handleStrengthCommand(
  command: ParsedPromptonCommand,
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState,
  services: CommandServices
): void {
  const strength = command.args[0];
  if (strength !== "light" && strength !== "balanced" && strength !== "strong") {
    throw new Error("Usage: /prompton strength light|balanced|strong");
  }

  persistSettings(
    ctx,
    runtime,
    services,
    { ...runtime.getSettings(), rewriteStrength: strength },
    `Rewrite strength set to ${strength}.`
  );
}

function handleAutoSendBusyBehaviorCommand(
  command: ParsedPromptonCommand,
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState,
  services: CommandServices
): void {
  const behavior = parseAutoSendBusyBehavior(command.args[0]);
  if (!behavior) {
    throw new Error("Usage: /prompton auto-send-when-busy steer|follow-up");
  }

  persistSettings(
    ctx,
    runtime,
    services,
    { ...runtime.getSettings(), autoSendBusyBehavior: behavior },
    `Auto-send while busy now uses ${behavior === "followUp" ? "follow-up" : "steer"}.`
  );
}

function handleTimeoutCommand(
  command: ParsedPromptonCommand,
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState,
  services: CommandServices
): void {
  const timeoutMs = parseEnhancementTimeoutSeconds(command.args[0] ?? "");
  if (timeoutMs === undefined) {
    throw new Error("Usage: /prompton timeout <seconds> (5-300)");
  }

  persistSettings(
    ctx,
    runtime,
    services,
    { ...runtime.getSettings(), enhancementTimeoutMs: timeoutMs },
    `Enhancement timeout set to ${formatTimeoutSeconds(timeoutMs)}.`
  );
}

function parseFamily(value: string | undefined): PromptonFamily | undefined {
  return value === "gpt" || value === "claude" ? value : undefined;
}

function parseRewriteMode(value: string | undefined): PromptonRewriteMode | undefined {
  return value === "auto" || value === "plain" || value === "execution-contract"
    ? value
    : undefined;
}

function parseAutoSendBusyBehavior(
  value: string | undefined
): PromptonSettings["autoSendBusyBehavior"] | undefined {
  return value === "steer" || value === "followUp" || value === "follow-up"
    ? value === "follow-up"
      ? "followUp"
      : value
    : undefined;
}

function formatTimeoutSeconds(timeoutMs: number): string {
  return `${Math.floor(timeoutMs / 1_000)} seconds`;
}

function persistSettings(
  ctx: ExtensionCommandContext,
  runtime: PromptonRuntimeState,
  services: Pick<CommandServices, "refreshStatus">,
  settings: PromptonSettings,
  successMessage: string
): void {
  runtime.persistSettings(settings);
  services.refreshStatus(ctx);
  notify(ctx, successMessage);
}

type BooleanSettingKey =
  | "includeRecentConversation"
  | "includeProjectMetadata"
  | "statusBarEnabled"
  | "previewBeforeReplace"
  | "autoSendEnhancedPrompt"
  | "preserveCodeBlocks"
  | "clarifyEnabled"
  | "clarifyOnShortcut";

function notify(
  ctx: { hasUI: boolean; ui: { notify: (message: string, type?: "info" | "error") => void } },
  message: string,
  type: "info" | "error" = "info"
): void {
  if (ctx.hasUI) {
    ctx.ui.notify(message, type);
    return;
  }

  const writer = type === "error" ? console.error : console.log;
  writer(message);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
