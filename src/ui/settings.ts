import type { ExtensionContext, KeybindingsManager } from "@earendil-works/pi-coding-agent";
import {
  fuzzyFilter,
  Input,
  SettingsList,
  truncateToWidth,
  type Component,
  type Focusable,
  type OverlayHandle,
  type SettingsListTheme,
} from "@earendil-works/pi-tui";
import type { PromptonRuntimeState } from "../state.js";
import {
  runSettingsAction,
  type SettingsUiServices,
  resetGlobalSettings,
} from "./settings-actions.js";
import {
  buildSettingsMenuOptions,
  type SettingsMenuItem,
  type SettingsMenuOptionId,
} from "./settings-menu.js";

type DialogTheme = Pick<ExtensionContext["ui"]["theme"], "fg" | "bg" | "bold">;

export async function openSettingsUi(
  ctx: ExtensionContext,
  runtime: PromptonRuntimeState,
  services: SettingsUiServices
): Promise<void> {
  if (!ctx.hasUI || ctx.mode !== "tui") {
    throw new Error("Prompton settings modal requires Pi interactive TUI mode.");
  }

  let handle: OverlayHandle | undefined;
  await ctx.ui.custom<void>(
    (tui, theme, keybindings, done) =>
      new PromptonSettingsModal(ctx, runtime, services, theme, keybindings, {
        onDone: () => done(),
        requestRender: () => tui.requestRender(),
        getHeight: () =>
          Math.max(1, Math.min(Math.floor(tui.terminal.rows * 0.95), tui.terminal.rows - 2)),
        setHidden: (hidden) => {
          handle?.setHidden(hidden);
          if (!hidden) handle?.focus();
        },
      }),
    {
      overlay: true,
      overlayOptions: { anchor: "center", width: "90%", minWidth: 36, maxHeight: "95%", margin: 1 },
      onHandle: (overlayHandle) => {
        handle = overlayHandle;
      },
    }
  );
}

class PromptonSettingsModal implements Component, Focusable {
  private readonly title = "Prompton settings";
  private readonly search = new Input();
  private readonly onDone: () => void;
  private allItems: SettingsMenuItem[];
  private selectedId = "enabled";
  private list?: SettingsList;
  private busy = false;
  private closed = false;
  private width = 80;

  constructor(
    private readonly ctx: ExtensionContext,
    private readonly runtime: PromptonRuntimeState,
    private readonly services: SettingsUiServices,
    private readonly theme: DialogTheme,
    private readonly keybindings: KeybindingsManager,
    private readonly callbacks: {
      onDone: () => void;
      requestRender: () => void;
      getHeight: () => number;
      setHidden: (hidden: boolean) => void;
    }
  ) {
    this.allItems = Object.values(buildSettingsMenuOptions(runtime.getSettings()));
    this.onDone = () => {
      if (this.closed) return;
      this.closed = true;
      callbacks.onDone();
    };
  }

  get focused(): boolean {
    return this.search.focused;
  }
  set focused(value: boolean) {
    this.search.focused = value;
  }

  invalidate(): void {
    this.search.invalidate();
    this.list?.invalidate();
  }

  dispose(): void {
    this.closed = true;
  }

  private getFilteredItems(): SettingsMenuItem[] {
    this.allItems = Object.values(buildSettingsMenuOptions(this.runtime.getSettings()));
    const query = this.search.getValue();
    const matches = fuzzyFilter(
      this.allItems,
      query,
      (item) => `${item.label} ${item.id} ${item.description ?? ""}`
    );
    const exact = matches.find((item) => item.id.toLowerCase() === query.trim().toLowerCase());
    return exact ? [exact, ...matches.filter((item) => item !== exact)] : matches;
  }

  render(width: number): string[] {
    this.width = width;
    if (width < 1) return [];
    const height = this.callbacks.getHeight();
    const innerWidth = Math.max(1, width - 2);
    const items = this.getFilteredItems();
    const selected = items.find((item) => item.id === this.selectedId) ?? items[0];
    if (selected) this.selectedId = selected.id;
    const listTheme: SettingsListTheme = {
      label: (text, active) =>
        active ? this.theme.fg("accent", this.theme.bold(text)) : this.theme.fg("text", text),
      value: (text, active) => this.theme.fg(active ? "accent" : "muted", text),
      description: (text) => this.theme.fg("muted", text),
      cursor: this.theme.fg("accent", "> "),
      hint: (text) => this.theme.fg("dim", text),
    };
    // SettingsList has no resize or focus API; keep search/selection here, and let it render/activate rows.
    this.list = new SettingsList(
      items.map((item) => {
        const row = { ...item };
        delete row.description;
        return {
          ...row,
          label: truncateToWidth(item.label, Math.max(1, innerWidth - 13), ""),
          ...(!item.values
            ? {
                submenu: (_value: string, close: () => void): Component => {
                  queueMicrotask(() => {
                    void this.runAction(item.id, false).finally(close);
                  });
                  return { render: () => [], invalidate: () => undefined };
                },
              }
            : {}),
        };
      }),
      Math.max(1, height - 6),
      listTheme,
      (id) => {
        const item = items.find((entry) => entry.id === id);
        if (item) void this.runAction(item.id, true);
      },
      this.onDone
    );
    this.list.selectItem(this.selectedId);
    const renderedRows = items.length
      ? this.list.render(innerWidth).slice(0, -2)
      : ["No matching settings"];
    const rowLines = height < 7 ? renderedRows.slice(0, 1) : renderedRows;
    const help = this.busy
      ? "Saving… input paused"
      : "↑↓ move · Enter/Space change · type to search · Esc/Done close";
    const content = [
      ...(height >= 5 ? this.search.render(innerWidth) : []),
      ...rowLines,
      ...(height >= 7 && selected?.description
        ? [this.theme.fg("muted", selected.description)]
        : []),
      ...(height >= 4 ? [this.theme.fg("dim", help)] : []),
    ];
    if (width < 4 || height < 3) {
      return rowLines.slice(0, height).map((line) => truncateToWidth(line, width, ""));
    }
    const border = (text: string) => this.theme.fg("border", text);
    const title = truncateToWidth(` ${this.title} · saved immediately `, innerWidth, "");
    return [
      border("╭") +
        this.theme.fg("accent", title) +
        border("─".repeat(Math.max(0, innerWidth - title.length)) + "╮"),
      ...content
        .slice(0, height - 2)
        .map((line) => border("│") + truncateToWidth(line, innerWidth, "", true) + border("│")),
      border(`╰${"─".repeat(innerWidth)}╯`),
    ].map((line) => truncateToWidth(line, width, ""));
  }

  handleInput(data: string): void {
    if (this.closed || this.busy) return;
    if (this.keybindings.matches(data, "tui.select.cancel")) {
      this.onDone();
      return;
    }
    const items = this.getFilteredItems();
    let index = Math.max(
      0,
      items.findIndex((item) => item.id === this.selectedId)
    );
    if (
      this.keybindings.matches(data, "tui.select.up") ||
      this.keybindings.matches(data, "tui.select.down")
    ) {
      const delta = this.keybindings.matches(data, "tui.select.up") ? -1 : 1;
      if (items.length) {
        index = (index + delta + items.length) % items.length;
        const next = items[index];
        if (next) this.selectedId = next.id;
      }
    } else if (
      this.keybindings.matches(data, "tui.select.confirm") ||
      (data === " " && !this.search.getValue())
    ) {
      this.render(this.width);
      this.list?.handleInput(data);
    } else {
      this.search.handleInput(data);
      const filtered = this.getFilteredItems();
      if (filtered[0]) this.selectedId = filtered[0].id;
    }
    this.callbacks.requestRender();
  }

  private async runAction(id: SettingsMenuOptionId, inline: boolean): Promise<void> {
    if (this.closed || this.busy) return;
    if (id === "done") {
      this.onDone();
      return;
    }
    this.busy = true;
    try {
      if (!inline) this.callbacks.setHidden(true);
      await runSettingsAction(id, {
        ctx: this.ctx,
        runtime: this.runtime,
        services: this.services,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.ctx.ui.notify(`Could not update Prompton settings. ${detail}`, "error");
    } finally {
      this.busy = false;
      if (!this.closed) {
        if (!inline) this.callbacks.setHidden(false);
        this.callbacks.requestRender();
      }
    }
  }
}

export { resetGlobalSettings };
export type { SettingsUiServices };
