import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { EnhancementServices } from "./enhance.js";
import { enhanceEditorDraft } from "./enhance.js";
import { pickTemplate } from "./templates.js";
import { detectRuntimeSupport } from "./validation.js";
import type { PromptonRuntimeState } from "./state.js";

type ShortcutServices = EnhancementServices;

export async function handlePromptonShortcut(
  ctx: ExtensionContext,
  runtime: PromptonRuntimeState,
  services: ShortcutServices
): Promise<void> {
  const settings = runtime.getSettings();
  if (!settings.enabled) {
    ctx.ui.notify("Prompton is disabled globally.", "info");
    return;
  }
  if (!settings.shortcutEnabled) {
    ctx.ui.notify("Prompton shortcut is disabled globally.", "info");
    return;
  }

  try {
    const support = detectRuntimeSupport(ctx);
    if (support.interactiveTui && !ctx.ui.getEditorText().trim()) {
      const skeleton = await pickTemplate(ctx);
      if (skeleton) {
        ctx.ui.setEditorText(skeleton);
        ctx.ui.notify(
          "Template loaded. Fill in the [brackets] and press the shortcut again.",
          "info"
        );
      }
      return;
    }

    await enhanceEditorDraft(ctx, runtime, services, {
      clarify: runtime.getSettings().clarifyOnShortcut,
    });
  } catch (error) {
    ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
  }
}
