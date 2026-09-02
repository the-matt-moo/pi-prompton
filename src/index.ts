import { complete } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CompleteFn } from "./enhance.js";
import { DEFAULT_SHORTCUT_KEY, EXTENSION_COMMAND } from "./constants.js";
import { getPromptonArgumentCompletions, handlePromptonCommand } from "./commands.js";
import { runEnhancementWithLoader } from "./enhance.js";
import { formatShortcutKey, getCustomShortcutKey } from "./shortcut-key.js";
import { PromptonRuntimeState } from "./state.js";
import { handlePromptonShortcut } from "./shortcut.js";
import { attachPromptonShortcut, createBasePromptonEditor } from "./ui/prompton-editor.js";
import { refreshStatusLine } from "./ui/status.js";

export default function promptonExtension(pi: ExtensionAPI): void {
  createPromptonExtension(pi);
}

export function createPromptonExtension(
  pi: ExtensionAPI,
  options?: { completeFn?: CompleteFn; runtime?: PromptonRuntimeState }
): void {
  const runtime = options?.runtime ?? new PromptonRuntimeState();
  let ownsEditorComponent = false;
  let previousEditorFactory: ReturnType<ExtensionContext["ui"]["getEditorComponent"]>;
  let installedCustomShortcutKey: string | undefined;
  let activeCustomShortcutKey: string | undefined;

  const clearEditorComponent = (ctx: ExtensionContext): void => {
    installedCustomShortcutKey = undefined;
    activeCustomShortcutKey = undefined;
    if (!ctx.hasUI || !ownsEditorComponent) {
      return;
    }

    ctx.ui.setEditorComponent(previousEditorFactory);
    previousEditorFactory = undefined;
    ownsEditorComponent = false;
  };

  const applyEditorComponent = (ctx: ExtensionContext): void => {
    if (!ctx.hasUI) {
      return;
    }

    const shortcutKey = getCustomShortcutKey(runtime.getSettings());
    if (!shortcutKey) {
      clearEditorComponent(ctx);
      return;
    }

    if (ownsEditorComponent && installedCustomShortcutKey === shortcutKey) {
      return;
    }

    const baseEditorFactory = ownsEditorComponent
      ? previousEditorFactory
      : ctx.ui.getEditorComponent();

    installedCustomShortcutKey = shortcutKey;
    activeCustomShortcutKey = undefined;
    previousEditorFactory = baseEditorFactory;
    ownsEditorComponent = true;
    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      activeCustomShortcutKey = getCustomShortcutKey(
        runtime.getSettings(),
        keybindings.getEffectiveConfig()
      );

      const baseEditor =
        baseEditorFactory?.(tui, theme, keybindings) ??
        createBasePromptonEditor(tui, theme, keybindings);

      return attachPromptonShortcut(
        baseEditor,
        keybindings,
        () => runtime.getSettings(),
        () => {
          void handlePromptonShortcut(ctx, runtime, {
            completeFn: options?.completeFn ?? complete,
            exec: pi.exec.bind(pi),
            sendUserMessage: pi.sendUserMessage.bind(pi),
            refreshStatus,
            runCancellableTask: runEnhancementWithLoader,
          });
        }
      );
    });
  };

  const refreshStatus = (ctx: ExtensionContext): void => {
    applyEditorComponent(ctx);
    refreshStatusLine(ctx, runtime);
  };

  const triggerDefaultShortcut = async (ctx: ExtensionContext): Promise<void> => {
    const settings = runtime.getSettings();
    const shortcutServices = {
      completeFn: options?.completeFn ?? complete,
      exec: pi.exec.bind(pi),
      sendUserMessage: pi.sendUserMessage.bind(pi),
      refreshStatus,
      runCancellableTask: runEnhancementWithLoader,
    };

    if (!settings.enabled) {
      await handlePromptonShortcut(ctx, runtime, shortcutServices);
      return;
    }

    if (!settings.shortcutEnabled) {
      ctx.ui.notify("Prompton shortcut is disabled globally.", "info");
      return;
    }

    if (activeCustomShortcutKey && activeCustomShortcutKey !== DEFAULT_SHORTCUT_KEY) {
      ctx.ui.notify(
        `Prompton shortcut is now ${formatShortcutKey(activeCustomShortcutKey)}.`,
        "info"
      );
      return;
    }

    await handlePromptonShortcut(ctx, runtime, shortcutServices);
  };

  const restorePersistedSettings = (ctx: ExtensionContext): void => {
    runtime.restoreSettings();
    refreshStatus(ctx);
  };

  pi.on("session_start", (_event, ctx) => {
    restorePersistedSettings(ctx);
  });
  pi.on("session_tree", (_event, ctx) => {
    restorePersistedSettings(ctx);
  });
  pi.on("model_select", (_event, ctx) => {
    refreshStatus(ctx);
  });
  pi.on("session_shutdown", (_event, ctx) => {
    clearEditorComponent(ctx);
  });

  pi.registerCommand(EXTENSION_COMMAND, {
    description: "Enhance the current editor prompt in-place",
    getArgumentCompletions: getPromptonArgumentCompletions,
    handler: async (args, ctx) => {
      await handlePromptonCommand(args, ctx, runtime, {
        completeFn: options?.completeFn ?? complete,
        exec: pi.exec.bind(pi),
        sendUserMessage: pi.sendUserMessage.bind(pi),
        refreshStatus,
        runCancellableTask: runEnhancementWithLoader,
      });
    },
  });

  pi.registerShortcut(DEFAULT_SHORTCUT_KEY, {
    description: "Enhance the current editor prompt",
    handler: async (ctx) => {
      await triggerDefaultShortcut(ctx);
    },
  });
}
