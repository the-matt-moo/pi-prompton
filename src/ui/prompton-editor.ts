import { CustomEditor, type KeybindingsManager } from "@earendil-works/pi-coding-agent";
import type { EditorComponent, EditorTheme, TUI } from "@earendil-works/pi-tui";
import { matchesCustomShortcut } from "../shortcut-key.js";
import type { PromptonSettings } from "../types.js";

export function createBasePromptonEditor(
  tui: TUI,
  theme: EditorTheme,
  keybindings: KeybindingsManager
): EditorComponent {
  return new CustomEditor(tui, theme, keybindings);
}

export function attachPromptonShortcut(
  editor: EditorComponent,
  keybindings: KeybindingsManager,
  getSettings: () => PromptonSettings,
  onPromptonShortcut: () => void
): EditorComponent {
  const handleBaseInput = editor.handleInput.bind(editor);

  editor.handleInput = (data: string): void => {
    if (matchesCustomShortcut(data, getSettings(), keybindings.getEffectiveConfig())) {
      onPromptonShortcut();
      return;
    }

    handleBaseInput(data);
  };

  return editor;
}
