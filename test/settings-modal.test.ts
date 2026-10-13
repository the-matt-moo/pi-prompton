import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ExtensionContext, KeybindingsManager } from "@earendil-works/pi-coding-agent";
import {
  visibleWidth,
  type Component,
  type Focusable,
  type OverlayHandle,
  type TUI,
} from "@earendil-works/pi-tui";
import { PromptonRuntimeState } from "../src/state.js";
import { runSettingsAction } from "../src/ui/settings-actions.js";
import {
  buildSettingsMenuOptions,
  SETTINGS_TOGGLE_IDS,
  toggleValue,
} from "../src/ui/settings-menu.js";
import { openSettingsUi } from "../src/ui/settings.js";
import {
  createCommandContext,
  createMockKeybindings,
  createModel,
  createRuntimeState,
} from "./helpers.js";

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function launchModal(runtime = createRuntimeState()) {
  const ctx = createCommandContext({ allModels: [createModel()] });
  const originalCustom = ctx.ui.custom.bind(ctx.ui);
  const terminal = { rows: 30 };
  const visibility: boolean[] = [];
  let hidden = false;
  let focusCount = 0;
  let closeCount = 0;
  let refreshCount = 0;
  let width = 110;
  let component: Component & Partial<Focusable> & { dispose?: () => void };
  const renders: string[][] = [];
  let launchOptions: Parameters<ExtensionContext["ui"]["custom"]>[1];
  const handle: OverlayHandle = {
    hide: () => assert.fail("custom overlays must not call hide()"),
    setHidden: (value) => {
      hidden = value;
      visibility.push(value);
    },
    isHidden: () => hidden,
    focus: () => {
      focusCount++;
    },
    unfocus: () => undefined,
    isFocused: () => !hidden,
    getBounds: () => undefined,
  };
  const tui = {
    terminal,
    requestRender: () => {
      if (component) renders.push(component.render(width));
    },
  } as unknown as TUI;
  ctx.ui.custom = ((factory, options) => {
    if (!options?.overlay) {
      assert.equal(hidden, true, "parent releases focus before a secondary custom UI");
      return originalCustom(factory, options);
    }
    launchOptions = options;
    return new Promise((resolve) => {
      const created = factory(
        tui,
        ctx.ui.theme,
        createMockKeybindings() as unknown as KeybindingsManager,
        (result) => {
          closeCount++;
          component.dispose?.();
          resolve(result);
        }
      );
      assert.ok(!(created instanceof Promise));
      component = created;
      component.focused = true;
      options.onHandle?.(handle);
      renders.push(component.render(width));
    });
  }) as ExtensionContext["ui"]["custom"];
  const opening = openSettingsUi(ctx, runtime, {
    refreshStatus: () => {
      refreshCount++;
    },
  });
  return {
    ctx,
    runtime,
    terminal,
    visibility,
    renders,
    opening,
    get options() {
      return launchOptions;
    },
    get closeCount() {
      return closeCount;
    },
    get refreshCount() {
      return refreshCount;
    },
    get focusCount() {
      return focusCount;
    },
    get hidden() {
      return hidden;
    },
    input: (key: string) => component.handleInput?.(key),
    render: (newWidth = width) => {
      width = newWidth;
      return component.render(width);
    },
    dispose: () => component.dispose?.(),
  };
}

function search(harness: ReturnType<typeof launchModal>, query: string): void {
  harness.input("\x15"); // Ctrl+U clears the search before replacing it.
  for (const character of query) harness.input(character);
}

function selectedRow(harness: ReturnType<typeof launchModal>): string {
  return (
    harness
      .render()
      .filter((line) => /^│> /.test(line))
      .at(-1) ?? ""
  );
}

for (const id of SETTINGS_TOGGLE_IDS) {
  void test(`modal toggles ${id} inline, persists and reopens with the saved value`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "prompton-modal-"));
    const path = join(directory, "settings.json");
    const runtime = new PromptonRuntimeState(path);
    const before = runtime.getSettings();
    const harness = launchModal(runtime);
    search(harness, id);
    const label = buildSettingsMenuOptions(before)[id].label;
    assert.match(selectedRow(harness), new RegExp(label));
    assert.ok(selectedRow(harness).includes(toggleValue(before[id])));
    harness.input("\r");
    await tick();
    assert.deepEqual(runtime.getSettings(), { ...before, [id]: !before[id] });
    const saved = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    assert.equal(saved[id], !before[id]);
    assert.ok(selectedRow(harness).includes(toggleValue(!before[id])));
    assert.equal(harness.closeCount, 0);
    assert.deepEqual(harness.visibility, []);
    assert.equal(harness.refreshCount, 1);
    harness.input("\x1b");
    await harness.opening;
    const reopenedRuntime = new PromptonRuntimeState(path);
    reopenedRuntime.restoreSettings();
    const reopened = launchModal(reopenedRuntime);
    search(reopened, id);
    assert.ok(selectedRow(reopened).includes(toggleValue(!before[id])));
    reopened.input("\x1b");
    await reopened.opening;
  });
}

void test("modal launch is centered and dismissal/search/navigation save nothing", async () => {
  const runtime = createRuntimeState();
  const before = runtime.getSettings();
  let writes = 0;
  runtime.persistSettings = () => {
    writes++;
  };
  const harness = launchModal(runtime);
  assert.deepEqual(harness.options?.overlayOptions, {
    anchor: "center",
    width: "90%",
    minWidth: 36,
    maxHeight: "95%",
    margin: 1,
  });
  assert.equal(harness.options?.overlay, true);
  assert.ok(harness.render().join("\n").includes("saved immediately"));
  assert.ok(harness.render().join("\n").includes("Esc/Done close"));
  harness.input("\x1b[A"); // wraps to Done
  assert.match(selectedRow(harness), /Done/);
  harness.input("\x1b[B");
  assert.match(selectedRow(harness), /Prompt enhancement/);
  search(harness, "not a matching row 999");
  assert.match(harness.render().join("\n"), /No matching settings/);
  search(harness, "done");
  harness.input("\r");
  await harness.opening;
  assert.equal(harness.closeCount, 1);
  assert.equal(writes, 0);
  assert.deepEqual(runtime.getSettings(), before);
});

void test("Escape before a queued secondary action cancels without opening or saving", async () => {
  const harness = launchModal();
  const before = harness.runtime.getSettings();
  search(harness, "enhancementTimeoutMs");
  harness.input("\r");
  harness.input("\x1b");
  await harness.opening;
  await tick();
  assert.deepEqual(harness.runtime.getSettings(), before);
  assert.deepEqual(harness.visibility, []);
  assert.equal(harness.refreshCount, 0);
});

void test("modal shows persisted truth after save failure and refuses duplicate input while saving", async () => {
  const directory = mkdtempSync(join(tmpdir(), "prompton-modal-failure-"));
  const blocker = join(directory, "file");
  writeFileSync(blocker, "not a directory");
  const runtime = new PromptonRuntimeState(join(blocker, "settings.json"));
  const before = runtime.getSettings();
  const harness = launchModal(runtime);
  search(harness, "historyEnabled");
  harness.input("\r");
  harness.input("\r");
  harness.input("\x1b");
  await tick();
  assert.deepEqual(runtime.getSettings(), before);
  assert.ok(selectedRow(harness).includes("[ ] Off"));
  assert.equal(harness.refreshCount, 1);
  assert.equal(harness.closeCount, 0);
  assert.equal(harness.ctx.uiState.notifications.length, 1);
  assert.match(harness.ctx.uiState.notifications[0]?.message ?? "", /Failed to save/);
  assert.ok(
    harness.renders.every((lines) => !lines.some((line) => /history.*\[x\] On/i.test(line)))
  );
  harness.input("\x1b");
  await harness.opening;
});

void test("modal supports Space only with empty search and retains selection after inline changes", async () => {
  const harness = launchModal();
  harness.input(" ");
  await tick();
  assert.equal(harness.runtime.getSettings().enabled, false);
  assert.match(selectedRow(harness), /Prompt enhancement/);
  search(harness, "history");
  harness.input(" ");
  assert.equal(harness.runtime.getSettings().historyEnabled, false);
  assert.match(harness.render().join("\n"), /history /);
  harness.input("\x7f");
  harness.input("\r");
  await tick();
  assert.equal(harness.runtime.getSettings().historyEnabled, true);
  assert.match(selectedRow(harness), /Prompt history and undo/);
  harness.input("\x1b");
  await harness.opening;
});

void test("secondary selectors cancel without saving and restore search, selection and focus", async () => {
  const harness = launchModal();
  const before = harness.runtime.getSettings();
  search(harness, "rewriteStrength");
  harness.input("\r");
  await tick();
  assert.deepEqual(harness.visibility, [true, false]);
  assert.equal(harness.focusCount, 1);
  assert.match(selectedRow(harness), /Rewrite strength/);
  assert.match(harness.render().join("\n"), /rewriteStrength/);
  assert.deepEqual(harness.runtime.getSettings(), before);
  harness.ctx.uiState.nextSelectValue = "strong — more restructuring";
  harness.input("\r");
  await tick();
  assert.equal(harness.runtime.getSettings().rewriteStrength, "strong");
  assert.match(selectedRow(harness), /Strong/);
  assert.equal(harness.closeCount, 0);
  harness.input("\x1b");
  await harness.opening;
});

void test("secondary inputs restore focus on cancellation, invalid input, save failure and thrown UI errors", async () => {
  const harness = launchModal();
  search(harness, "enhancementTimeoutMs");
  const before = harness.runtime.getSettings();
  let finishInput: ((value: string | undefined) => void) | undefined;
  harness.ctx.ui.input = () => {
    assert.equal(harness.hidden, true);
    return new Promise((resolve) => {
      finishInput = resolve;
    });
  };
  for (const value of [undefined, "invalid", "60"]) {
    if (value === "60")
      harness.runtime.persistSettings = () => {
        throw new Error("save failure");
      };
    harness.input("\r");
    await tick();
    assert.equal(harness.hidden, true);
    harness.input("\r"); // blocked while input owns focus
    assert.ok(finishInput);
    finishInput(value);
    await tick();
    assert.equal(harness.hidden, false);
    assert.deepEqual(harness.runtime.getSettings(), before);
    assert.match(selectedRow(harness), /Enhancement timeout/);
  }
  harness.ctx.ui.input = () => Promise.reject(new Error("input failed"));
  harness.input("\r");
  await tick();
  assert.equal(harness.hidden, false);
  assert.equal(harness.focusCount, 4);
  assert.match(harness.ctx.uiState.notifications.at(-1)?.message ?? "", /input failed/);
  harness.input("\x1b");
  await harness.opening;
});

void test("disposed modal does not restore its overlay after a pending secondary interaction", async () => {
  const harness = launchModal();
  search(harness, "enhancementTimeoutMs");
  let finishInput: ((value: string | undefined) => void) | undefined;
  harness.ctx.ui.input = () =>
    new Promise((resolve) => {
      finishInput = resolve;
    });
  harness.input("\r");
  await tick();
  harness.dispose();
  finishInput?.(undefined);
  await tick();
  assert.deepEqual(harness.visibility, [true]);
  assert.equal(harness.focusCount, 0);
});

void test("modal rejects every non-TUI mode before constructing custom UI", async () => {
  for (const mode of ["rpc", "json", "print"] as const) {
    const ctx = createCommandContext({ mode });
    await assert.rejects(
      openSettingsUi(ctx, createRuntimeState(), { refreshStatus: () => undefined }),
      /TUI mode/
    );
    assert.deepEqual(ctx.uiState.customRenderHistory, []);
  }
  const ctx = createCommandContext({ hasUI: false });
  await assert.rejects(
    openSettingsUi(ctx, createRuntimeState(), { refreshStatus: () => undefined }),
    /TUI mode/
  );
});

void test("modal fits narrow/short viewports and preserves selected row on resize", async () => {
  const harness = launchModal();
  search(harness, "historyEnabled");
  for (const rows of [40, 12, 8, 6, 4, 2, 1]) {
    harness.terminal.rows = rows;
    for (const width of [110, 36, 24, 14, 5, 3, 1, 0]) {
      const lines = harness.render(width);
      const maxHeight = Math.max(1, Math.min(Math.floor(rows * 0.95), rows - 2));
      assert.ok(lines.length <= maxHeight, `${width}x${rows} height`);
      assert.ok(
        lines.every((line) => visibleWidth(line) <= width),
        `${width}x${rows} width`
      );
      if (width >= 24) assert.ok(lines.some((line) => line.includes("[ ] Off")));
    }
  }
  harness.terminal.rows = 40;
  harness.render(110);
  assert.match(selectedRow(harness), /Prompt history and undo/);
  assert.equal(harness.runtime.getSettings().historyEnabled, false);
  harness.input("\x1b");
  await harness.opening;
});

async function fallbackAction(
  runtime: PromptonRuntimeState,
  selections: (string | undefined)[],
  input?: string
) {
  const ctx = createCommandContext({
    allModels: [createModel()],
    ...(input !== undefined ? { nextInputValue: input } : {}),
  });
  const custom = ctx.ui.custom.bind(ctx.ui);
  const menus: string[][] = [];
  ctx.ui.custom = ((factory, options) => {
    ctx.uiState.nextSelectValue = selections.shift();
    return custom(factory, options).then((value) => {
      menus.push(ctx.uiState.customOptionsHistory.at(-1) ?? []);
      return value;
    });
  }) as ExtensionContext["ui"]["custom"];
  await runSettingsAction("fallbackEnhancerModels", {
    ctx,
    runtime,
    services: { refreshStatus: () => undefined },
  });
  assert.equal(selections.length, 0);
  return { ctx, menus };
}

void test("fallback chain supports add/manual entry, remove, ordering, clear, cancellation and duplicates", async () => {
  const runtime = createRuntimeState();
  const first = { provider: "openai", id: "gpt-5" };
  const second = { provider: "custom", id: "nested/model" };
  await fallbackAction(runtime, ["add", "openai/gpt-5", "back"]);
  await fallbackAction(runtime, ["add", "Manual entry", "back"], "custom/nested/model");
  assert.deepEqual(runtime.getSettings().fallbackEnhancerModels, [first, second]);
  await fallbackAction(runtime, ["1", "Move up", "back"]);
  assert.deepEqual(runtime.getSettings().fallbackEnhancerModels, [second, first]);
  await fallbackAction(runtime, ["0", "Move down", "back"]);
  assert.deepEqual(runtime.getSettings().fallbackEnhancerModels, [first, second]);
  const duplicate = await fallbackAction(runtime, ["add", "Manual entry", "back"], "OPENAI/GPT-5");
  assert.match(duplicate.ctx.uiState.notifications.at(-1)?.message ?? "", /already in/);
  assert.deepEqual(runtime.getSettings().fallbackEnhancerModels, [first, second]);
  await fallbackAction(runtime, ["0", undefined, "add", undefined, undefined]);
  assert.deepEqual(runtime.getSettings().fallbackEnhancerModels, [first, second]);
  await fallbackAction(runtime, ["0", "Remove", "back"]);
  assert.deepEqual(runtime.getSettings().fallbackEnhancerModels, [second]);
  const boundary = await fallbackAction(runtime, ["0", "Back", "back"]);
  assert.ok(boundary.menus[1]?.includes("Remove"));
  assert.ok(!boundary.menus[1]?.includes("Move up"));
  assert.ok(!boundary.menus[1]?.includes("Move down"));
  await fallbackAction(runtime, ["clear", "back"]);
  assert.equal(runtime.getSettings().fallbackEnhancerModels, undefined);
});

void test("fallback chain has no UI length limit, preserves primary/history settings and reports failures", async () => {
  const runtime = createRuntimeState();
  const chain = Array.from({ length: 15 }, (_, index) => ({
    provider: "custom",
    id: String(index),
  }));
  runtime.replaceSettings({
    ...runtime.getSettings(),
    enhancerModelMode: "fixed",
    fixedEnhancerModel: createModel(),
    historyEnabled: true,
    fallbackEnhancerModels: chain,
  });
  await fallbackAction(runtime, ["add", "openai/gpt-5", "back"]);
  assert.equal(runtime.getSettings().fallbackEnhancerModels?.length, 16);
  assert.equal(runtime.getSettings().enhancerModelMode, "fixed");
  assert.equal(runtime.getSettings().historyEnabled, true);
  const before = runtime.getSettings();
  runtime.persistSettings = () => {
    throw new Error("disk failure");
  };
  const failed = await fallbackAction(runtime, ["clear", "back"]);
  assert.deepEqual(runtime.getSettings(), before);
  assert.match(failed.ctx.uiState.notifications.at(-1)?.message ?? "", /Failed to save/);
});
