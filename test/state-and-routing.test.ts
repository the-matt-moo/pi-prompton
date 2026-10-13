import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setFamilyEnhancerModel } from "../src/enhancer-settings.js";
import { resolveEnhancerModel } from "../src/model-selection.js";
import { matchesPattern, resolveTargetFamily } from "../src/model-routing.js";
import {
  removeExactModelOverride,
  removeFamilyOverride,
  upsertExactModelOverride,
  upsertFamilyOverride,
} from "../src/overrides.js";
import { PromptonRuntimeState, sanitizeSettings } from "../src/state.js";
import { detectRuntimeSupport } from "../src/validation.js";
import { createCommandContext, createModel, createRuntimeState } from "./helpers.js";

void test("target family resolution honors exact overrides and pattern overrides", () => {
  const settings = {
    ...createRuntimeState().getSettings(),
    exactModelOverrides: [{ provider: "OpenAI", id: "GPT-5", family: "claude" as const }],
    familyOverrides: [{ pattern: "moonshot/*", family: "claude" as const }],
  };

  assert.equal(resolveTargetFamily(settings, createModel()).family, "claude");
  assert.equal(
    resolveTargetFamily(settings, createModel({ provider: "moonshot", id: "kimi-k2" })).family,
    "claude"
  );
});

void test("target family resolution falls back to built-in defaults and fallback family", () => {
  const runtime = createRuntimeState();
  const settings = runtime.getSettings();

  assert.equal(
    resolveTargetFamily(settings, createModel({ provider: "openai", id: "o3" })).family,
    "gpt"
  );
  assert.equal(
    resolveTargetFamily(settings, createModel({ provider: "moonshot", id: "kimi-k2" })).family,
    "claude"
  );
  assert.equal(
    resolveTargetFamily(
      { ...settings, fallbackFamily: "claude" },
      createModel({ provider: "custom", id: "x1" })
    ).family,
    "claude"
  );
});

void test("upsertExactModelOverride replaces case-variant duplicates", () => {
  const next = upsertExactModelOverride(
    {
      ...createRuntimeState().getSettings(),
      exactModelOverrides: [{ provider: "OpenAI", id: "GPT-5", family: "gpt" as const }],
    },
    { provider: "openai", id: "gpt-5" },
    "claude"
  );

  assert.deepEqual(next.exactModelOverrides, [
    { provider: "openai", id: "gpt-5", family: "claude" },
  ]);
});

void test("removeExactModelOverride clears case-variant duplicates", () => {
  const next = removeExactModelOverride(
    {
      ...createRuntimeState().getSettings(),
      exactModelOverrides: [
        { provider: "OpenAI", id: "GPT-5", family: "gpt" as const },
        { provider: "openai", id: "gpt-5", family: "claude" as const },
        { provider: "anthropic", id: "claude-3-5-sonnet", family: "claude" as const },
      ],
    },
    { provider: "openai", id: "gpt-5" }
  );

  assert.deepEqual(next.exactModelOverrides, [
    { provider: "anthropic", id: "claude-3-5-sonnet", family: "claude" },
  ]);
});

void test("upsertFamilyOverride replaces case-variant duplicate patterns", () => {
  const next = upsertFamilyOverride(
    {
      ...createRuntimeState().getSettings(),
      familyOverrides: [{ pattern: "OpenAI/*", family: "gpt" as const }],
    },
    "openai/*",
    "claude"
  );

  assert.deepEqual(next.familyOverrides, [{ pattern: "openai/*", family: "claude" }]);
});

void test("removeFamilyOverride clears case-variant duplicate patterns", () => {
  const next = removeFamilyOverride(
    {
      ...createRuntimeState().getSettings(),
      familyOverrides: [
        { pattern: "OpenAI/*", family: "gpt" as const },
        { pattern: "openai/*", family: "claude" as const },
        { pattern: "moonshot/*", family: "claude" as const },
      ],
    },
    "openai/*"
  );

  assert.deepEqual(next.familyOverrides, [{ pattern: "moonshot/*", family: "claude" }]);
});

void test("matchesPattern supports provider and raw model-id globs", () => {
  assert.equal(matchesPattern("openai/*", "openai/gpt-5", "gpt-5"), true);
  assert.equal(matchesPattern("kimi-*", "moonshot/kimi-k2", "kimi-k2"), true);
  assert.equal(matchesPattern("anthropic/*", "openai/gpt-5", "gpt-5"), false);
});

void test("resolveEnhancerModel validates configuration", () => {
  const model = createModel();
  const ctx = createCommandContext({ model, allModels: [model] });
  const settings = createRuntimeState().getSettings();

  const resolved = resolveEnhancerModel(settings, "gpt", model, ctx.modelRegistry);
  assert.equal(resolved.label, "active (openai/gpt-5)");

  assert.throws(
    () =>
      resolveEnhancerModel(
        { ...settings, enhancerModelMode: "fixed" },
        "gpt",
        model,
        ctx.modelRegistry
      ),
    /no fixed enhancer model is configured/i
  );

  assert.throws(
    () =>
      resolveEnhancerModel(
        { ...settings, enhancerModelMode: "bogus" as never },
        "gpt",
        model,
        ctx.modelRegistry
      ),
    /unsupported enhancer-model mode: bogus/i
  );
});

void test("setFamilyEnhancerModel clears orphaned partial family selections", () => {
  const runtime = createRuntimeState();
  const gptModel = { provider: "openai", id: "gpt-5" };
  const claudeModel = { provider: "anthropic", id: "claude-3-5-sonnet" };

  const partial = setFamilyEnhancerModel(
    {
      ...runtime.getSettings(),
      enhancerModelMode: "fixed",
      fixedEnhancerModel: gptModel,
    },
    "gpt",
    gptModel
  );

  assert.equal(partial.enhancerModelMode, "active");
  assert.equal(partial.fixedEnhancerModel, undefined);
  assert.equal(partial.familyEnhancerModels, undefined);

  const linked = setFamilyEnhancerModel(
    {
      ...runtime.getSettings(),
      enhancerModelMode: "family-linked",
      familyEnhancerModels: { gpt: gptModel },
    },
    "claude",
    claudeModel
  );

  assert.equal(linked.enhancerModelMode, "family-linked");
  assert.deepEqual(linked.familyEnhancerModels, {
    gpt: gptModel,
    claude: claudeModel,
  });
});

void test("family-linked enhancer selection still resolves family from active model in auto mode", () => {
  const gptModel = createModel({ provider: "openai", id: "gpt-5" });
  const claudeEnhancer = { provider: "anthropic", id: "claude-sonnet-4-6" };
  const gptEnhancer = { provider: "openai", id: "gpt-5" };
  const ctx = createCommandContext({
    model: gptModel,
    allModels: [gptModel, createModel({ provider: "anthropic", id: "claude-sonnet-4-6" })],
  });
  const settings = {
    ...createRuntimeState().getSettings(),
    enhancerModelMode: "family-linked" as const,
    familyEnhancerModels: { gpt: gptEnhancer, claude: claudeEnhancer },
  };

  // targetFamilyMode is "auto" (default), so output target is universal,
  // but enhancer selection still resolves the active model's family.
  const resolved = resolveTargetFamily(settings, gptModel);
  assert.equal(resolved.family, "gpt");

  const enhancer = resolveEnhancerModel(settings, resolved.family, gptModel, ctx.modelRegistry);
  assert.equal(enhancer.mode, "family-linked");
  assert.equal(enhancer.label, "openai/gpt-5");
});

void test("settings persist across sessions globally", () => {
  const storageDir = mkdtempSync(join(tmpdir(), "prompton-state-"));
  const settingsPath = join(storageDir, "prompton-settings.json");
  const runtime = new PromptonRuntimeState(settingsPath);

  runtime.persistSettings({
    ...runtime.getSettings(),
    enabled: false,
    historyEnabled: true,
    statusBarEnabled: true,
    shortcutKey: "ctrl+alt+p",
    rewriteMode: "plain",
    autoSendEnhancedPrompt: true,
    autoSendBusyBehavior: "followUp",
    fallbackEnhancerModels: [
      { provider: "anthropic", id: "claude-sonnet-4-6" },
      { provider: "openai-codex", id: "gpt-5.6-luna" },
    ],
    enhancementTimeoutMs: 12_000,
  });

  const restoredRuntime = new PromptonRuntimeState(settingsPath);
  restoredRuntime.restoreSettings();

  assert.equal(restoredRuntime.getSettings().enabled, false);
  assert.equal(restoredRuntime.getSettings().historyEnabled, true);
  assert.equal(restoredRuntime.getSettings().statusBarEnabled, true);
  assert.equal(restoredRuntime.getSettings().shortcutKey, "ctrl+alt+p");
  assert.equal(restoredRuntime.getSettings().rewriteMode, "plain");
  assert.equal(restoredRuntime.getSettings().autoSendEnhancedPrompt, true);
  assert.equal(restoredRuntime.getSettings().autoSendBusyBehavior, "followUp");
  assert.deepEqual(restoredRuntime.getSettings().fallbackEnhancerModels, [
    { provider: "anthropic", id: "claude-sonnet-4-6" },
    { provider: "openai-codex", id: "gpt-5.6-luna" },
  ]);
  assert.equal(restoredRuntime.getSettings().enhancementTimeoutMs, 12_000);

  restoredRuntime.undo.store("session-only draft");
  restoredRuntime.persistSettings({
    ...restoredRuntime.getSettings(),
    statusBarEnabled: false,
  });
  assert.doesNotMatch(readFileSync(settingsPath, "utf8"), /session-only draft/);
});

void test("failed global settings writes do not claim success or corrupt runtime state", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "prompton-state-"));
  const filePath = join(tempDir, "not-a-directory");
  writeFileSync(filePath, "x", "utf8");
  const runtime = new PromptonRuntimeState(join(filePath, "prompton-settings.json"));
  const previousSettings = runtime.getSettings();

  assert.throws(() => {
    runtime.persistSettings({
      ...previousSettings,
      enabled: false,
      statusBarEnabled: true,
    });
  });

  assert.deepEqual(runtime.getSettings(), previousSettings);
});

void test("sanitizeSettings rejects unknown schema versions", () => {
  assert.equal(sanitizeSettings({ version: 2 }), undefined);
});

void test("sanitizeSettings restores opt-in settings and defaults missing or invalid values", () => {
  const enabled = sanitizeSettings({
    version: 1,
    clarifyEnabled: true,
    clarifyOnShortcut: true,
    historyEnabled: true,
  });

  assert.equal(enabled?.clarifyEnabled, true);
  assert.equal(enabled?.clarifyOnShortcut, true);
  assert.equal(enabled?.historyEnabled, true);
  assert.equal(sanitizeSettings({ version: 1 })?.clarifyEnabled, false);
  assert.equal(sanitizeSettings({ version: 1 })?.clarifyOnShortcut, false);
  assert.equal(sanitizeSettings({ version: 1 })?.historyEnabled, false);
  assert.equal(sanitizeSettings({ version: 1, historyEnabled: "yes" })?.historyEnabled, false);
});

void test("sanitizeSettings migrates the legacy single fallback model", () => {
  assert.deepEqual(
    sanitizeSettings({
      version: 1,
      fallbackEnhancerModel: { provider: "anthropic", id: "claude-sonnet-4-6" },
    })?.fallbackEnhancerModels,
    [{ provider: "anthropic", id: "claude-sonnet-4-6" }]
  );
});

void test("sanitizeSettings normalizes shortcut keys and falls back on unsafe values", () => {
  const normalized = sanitizeSettings({ version: 1, shortcutKey: "Alt + Shift + P" });
  const invalidFormatFallback = sanitizeSettings({ version: 1, shortcutKey: "plain-p" });
  const unsafeTypingFallback = sanitizeSettings({ version: 1, shortcutKey: "shift+p" });

  assert.equal(normalized?.shortcutKey, "shift+alt+p");
  assert.equal(invalidFormatFallback?.shortcutKey, "alt+p");
  assert.equal(unsafeTypingFallback?.shortcutKey, "alt+p");
});

void test("sanitizeSettings dedupes exact and pattern overrides by normalized key", () => {
  const sanitized = sanitizeSettings({
    version: 1,
    exactModelOverrides: [
      { provider: "OpenAI", id: "GPT-5", family: "gpt" },
      { provider: "openai", id: "gpt-5", family: "claude" },
      { provider: "anthropic", id: "claude-3-5-sonnet", family: "claude" },
    ],
    familyOverrides: [
      { pattern: "OpenAI/*", family: "gpt" },
      { pattern: "moonshot/*", family: "claude" },
      { pattern: "openai/*", family: "claude" },
    ],
  });

  assert.ok(sanitized);
  assert.deepEqual(sanitized.exactModelOverrides, [
    { provider: "openai", id: "gpt-5", family: "claude" },
    { provider: "anthropic", id: "claude-3-5-sonnet", family: "claude" },
  ]);
  assert.deepEqual(sanitized.familyOverrides, [
    { pattern: "moonshot/*", family: "claude" },
    { pattern: "openai/*", family: "claude" },
  ]);
});

void test("sanitizeSettings rejects array-backed objects in record slots", () => {
  const arrayBackedOverride = Object.assign([], {
    provider: "openai",
    id: "gpt-5",
    family: "claude",
  });
  const arrayBackedRef = Object.assign([], {
    provider: "openai",
    id: "gpt-5",
  });
  const arrayBackedFamilyModels = Object.assign([], {
    gpt: { provider: "openai", id: "gpt-5" },
  });

  const sanitized = sanitizeSettings({
    version: 1,
    exactModelOverrides: [arrayBackedOverride],
    fixedEnhancerModel: arrayBackedRef,
    familyEnhancerModels: arrayBackedFamilyModels,
    fallbackEnhancerModels: [arrayBackedRef],
  });

  assert.ok(sanitized);
  assert.deepEqual(sanitized.exactModelOverrides, []);
  assert.equal(sanitized.fixedEnhancerModel, undefined);
  assert.equal(sanitized.familyEnhancerModels, undefined);
  assert.equal(sanitized.fallbackEnhancerModels, undefined);
});

void test("runtime support relies on hasUI instead of theme enumeration", () => {
  const interactiveCtx = createCommandContext({ hasUI: true, themeCount: 0 });
  const headlessCtx = createCommandContext({ hasUI: false, themeCount: 1 });

  assert.equal(detectRuntimeSupport(interactiveCtx).interactiveTui, true);
  assert.equal(detectRuntimeSupport(headlessCtx).interactiveTui, false);
  assert.match(detectRuntimeSupport(headlessCtx).reason ?? "", /interactive mode/i);
});

void test("replacing settings clears stale draft analysis", () => {
  const runtime = createRuntimeState();
  runtime.rememberDraftResolution({
    intent: "implement",
    effectiveRewriteMode: "execution-contract",
  });

  runtime.replaceSettings({ ...runtime.getSettings(), rewriteMode: "plain" });

  assert.equal(runtime.getLastDraftResolution(), undefined);
});

void test("undo manager bypasses all history APIs while disabled and clears entries on disable", () => {
  const runtime = createRuntimeState();
  const originalDateNow = Date.now;
  let dateCalls = 0;
  Date.now = () => {
    dateCalls += 1;
    return 123;
  };

  try {
    runtime.undo.store("disabled draft");
  } finally {
    Date.now = originalDateNow;
  }

  assert.equal(dateCalls, 0);
  assert.equal(runtime.undo.hasUndo(), false);
  assert.deepEqual(runtime.undo.getHistory(), []);
  assert.equal(runtime.undo.consume(), undefined);

  runtime.replaceSettings({ ...runtime.getSettings(), historyEnabled: true });
  runtime.undo.store("enabled draft");
  assert.equal(runtime.undo.hasUndo(), true);
  assert.deepEqual(
    runtime.undo.getHistory().map((entry) => entry.draft),
    ["enabled draft"]
  );

  runtime.replaceSettings({ ...runtime.getSettings(), historyEnabled: false });
  assert.equal(runtime.undo.hasUndo(), false);
  assert.deepEqual(runtime.undo.getHistory(), []);
  assert.equal(runtime.undo.consume(), undefined);

  runtime.replaceSettings({ ...runtime.getSettings(), historyEnabled: true });
  assert.deepEqual(runtime.undo.getHistory(), []);
});

void test("runtime restore clears transient undo state", () => {
  const runtime = createRuntimeState();
  runtime.replaceSettings({ ...runtime.getSettings(), historyEnabled: true });
  runtime.undo.store("draft");
  runtime.rememberDraftResolution({
    intent: "implement",
    effectiveRewriteMode: "execution-contract",
  });
  runtime.rememberEnhancementAttempt({
    outcome: "failed",
    enhancerModel: { provider: "openai", id: "gpt-5" },
    retryUsed: true,
    recoveredAfterRetry: false,
    detail: "primary: missing sentinel block; retry: unexpected text outside the sentinel block",
  });

  runtime.restoreSettings();

  assert.equal(runtime.undo.hasUndo(), false);
  assert.equal(runtime.getLastDraftResolution(), undefined);
  assert.equal(runtime.getLastEnhancementAttempt(), undefined);
});
