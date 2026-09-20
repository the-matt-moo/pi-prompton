import { clearTimeout, setTimeout } from "node:timers";
import type {
  Api,
  AssistantMessage,
  Context,
  Model,
  ProviderStreamOptions,
} from "@earendil-works/pi-ai";
import { ENHANCER_MAX_OUTPUT_TOKENS } from "./constants.js";
import type {
  ExtensionAPI,
  ExtensionContext,
  ModelRegistry,
} from "@earendil-works/pi-coding-agent";
import { BorderedLoader } from "@earendil-works/pi-coding-agent";
import { buildPromptContext, estimateTextTokens } from "./context.js";
import { resolveEditorDraft } from "./editor-draft.js";
import { clarifyDraft } from "./clarify.js";
import { resolveEnhancerModel, resolveFallbackEnhancerModel } from "./model-selection.js";
import { resolveTargetFamily } from "./model-routing.js";
import {
  buildSentinelReminder,
  describeInvalidModelOutputReason,
  isInvalidModelOutputError,
  type PromptonInvalidModelOutputError,
  parseEnhancedPrompt,
} from "./parser.js";
import type { PromptonRuntimeState } from "./state.js";
import { buildStrategyRequest } from "./strategies/unified.js";
import type {
  EnhancementPreparation,
  ModelRef,
  PromptonEnhancementAttempt,
  PromptonSettings,
  ResolvedEnhancerModel,
} from "./types.js";
import {
  detectRuntimeSupport,
  ensureEnhancementEnabled,
  requireNonEmptyDraft,
} from "./validation.js";

export type CompleteOptions = ProviderStreamOptions;

export type CompleteFn = (
  model: Model<Api>,
  context: Context,
  options?: CompleteOptions
) => Promise<AssistantMessage>;

export interface EnhancementServices {
  completeFn: CompleteFn;
  exec: ExtensionAPI["exec"];
  sendUserMessage: ExtensionAPI["sendUserMessage"];
  refreshStatus: (ctx: ExtensionContext) => void;
  enhancementTimeoutMs?: number;
  runCancellableTask: (
    ctx: ExtensionContext,
    message: string,
    task: (signal: AbortSignal) => Promise<string | null>
  ) => Promise<string | null>;
}

interface EnhancementAttemptTracker {
  retryUsed: boolean;
  recoveredAfterRetry: boolean;
  fallbackUsed: boolean;
  recoveredAfterFallback: boolean;
  fallbackModel?: ModelRef;
  failureDetail?: string;
}

type CompletionAttempt =
  | { outcome: "success"; prompt: string }
  | { outcome: "cancelled" }
  | {
      outcome: "invalid";
      error: PromptonInvalidModelOutputError;
      text: string;
    }
  | { outcome: "provider-error"; error: Error };

interface CompletionFailure {
  name: string;
  modelLabel: string;
  attempt: Exclude<CompletionAttempt, { outcome: "success" } | { outcome: "cancelled" }>;
}

export async function enhanceEditorDraft(
  ctx: ExtensionContext,
  runtime: PromptonRuntimeState,
  services: EnhancementServices,
  options: { clarify?: boolean } = {}
): Promise<void> {
  const support = detectRuntimeSupport(ctx);
  if (!support.interactiveTui) {
    throw new Error(support.reason);
  }

  const settings = runtime.getSettings();
  ensureEnhancementEnabled(settings);

  if (runtime.isBusy()) {
    throw new Error("Prompton is already enhancing the editor draft.");
  }

  let draft = await resolveEditorDraft(ctx, services.exec);
  requireNonEmptyDraft(draft);

  if (options.clarify ?? settings.clarifyEnabled) {
    const refined = await clarifyDraft(ctx, draft);
    if (refined === undefined) {
      ctx.ui.notify("Clarify cancelled.", "info");
      return;
    }
    if (refined !== draft) runtime.undo.store(draft);
    draft = refined;
    ctx.ui.setEditorText(draft);
  }

  if (!runtime.tryStartEnhancement()) {
    throw new Error("Prompton is already enhancing the editor draft.");
  }

  services.refreshStatus(ctx);

  let attempt: PromptonEnhancementAttempt | undefined;
  let preparation: EnhancementPreparation | undefined;
  const tracker: EnhancementAttemptTracker = {
    retryUsed: false,
    recoveredAfterRetry: false,
    fallbackUsed: false,
    recoveredAfterFallback: false,
  };

  try {
    preparation = await prepareEnhancement(ctx, settings, draft, services);
    const prepared = preparation;

    runtime.rememberDraftResolution({
      intent: prepared.promptContext.intent,
      effectiveRewriteMode: prepared.promptContext.effectiveRewriteMode,
    });

    const outcome = await services.runCancellableTask(
      ctx,
      `Prompton enhancing for ${prepared.resolvedTargetFamily.family} (${prepared.promptContext.effectiveRewriteMode})...`,
      (signal) =>
        generateEnhancedPrompt(
          prepared,
          services.completeFn,
          signal,
          services.enhancementTimeoutMs ?? settings.enhancementTimeoutMs,
          tracker,
          settings.fallbackEnhancerModels ?? [],
          ctx.modelRegistry
        )
    );

    if (outcome === null) {
      attempt = buildEnhancementAttempt(prepared, tracker, "cancelled");
      ctx.ui.notify("Prompton enhancement cancelled.", "info");
      return;
    }

    const finalText = settings.previewBeforeReplace
      ? await previewEnhancedPrompt(ctx, outcome)
      : outcome;

    if (finalText === undefined) {
      attempt = buildEnhancementAttempt(prepared, tracker, "cancelled");
      ctx.ui.notify("Prompton preview cancelled. Editor left unchanged.", "info");
      return;
    }

    attempt = buildEnhancementAttempt(prepared, tracker, "success");
    runtime.undo.store(draft);

    const autoSendResult = sendEnhancedPromptIfConfigured(ctx, settings, finalText, services);
    if (!autoSendResult.sent) {
      ctx.ui.setEditorText(finalText);
    }

    ctx.ui.notify(buildSuccessMessage(tracker, autoSendResult.sent, finalText), "info");
    if (autoSendResult.error) {
      ctx.ui.notify(autoSendResult.error, "warning");
    }
  } catch (error) {
    const detail =
      tracker.failureDetail ?? (error instanceof Error ? error.message : String(error));

    if (preparation) {
      attempt = {
        ...buildEnhancementAttempt(preparation, tracker, "failed"),
        detail,
      };
    } else if (typeof attempt === "undefined") {
      attempt = {
        outcome: "failed",
        retryUsed: false,
        recoveredAfterRetry: false,
        detail,
      };
    } else if (attempt.outcome !== "cancelled") {
      attempt = {
        ...attempt,
        outcome: "failed",
        detail,
      };
    }

    throw error;
  } finally {
    if (attempt) {
      runtime.rememberEnhancementAttempt(attempt);
    }
    runtime.finishEnhancement();
    services.refreshStatus(ctx);
  }
}

async function prepareEnhancement(
  ctx: ExtensionContext,
  settings: PromptonSettings,
  draft: string,
  services: Pick<EnhancementServices, "exec">
): Promise<EnhancementPreparation> {
  const resolvedTargetFamily = resolveTargetFamily(settings, ctx.model);
  const enhancerModel = await resolveEnhancerModel(
    settings,
    resolvedTargetFamily.family,
    ctx.model,
    ctx.modelRegistry
  );
  const promptContext = await buildPromptContext({
    ctx,
    draft,
    settings,
    activeModel: ctx.model,
    targetFamily: resolvedTargetFamily.family,
    enhancerModel: enhancerModel.model,
    exec: (command, args) => services.exec(command, args, { cwd: ctx.cwd }),
  });
  const request = buildStrategyRequest(promptContext);

  return {
    resolvedTargetFamily,
    enhancerModel,
    promptContext,
    request,
  };
}

export async function runEnhancementWithLoader(
  ctx: ExtensionContext,
  message: string,
  task: (signal: AbortSignal) => Promise<string | null>
): Promise<string | null> {
  let taskError: Error | undefined;

  return ctx.ui
    .custom<string | null>((tui, theme, _keybindings, done) => {
      const loader = new BorderedLoader(tui, theme, message, { cancellable: true });
      loader.onAbort = () => done(null);

      void task(loader.signal)
        .then((result) => {
          if (!loader.signal.aborted) {
            done(result);
          }
        })
        .catch((error: unknown) => {
          if (loader.signal.aborted) {
            done(null);
            return;
          }

          taskError = error instanceof Error ? error : new Error("Prompton enhancement failed.");
          done(null);
        });

      return loader;
    })
    .then((result) => {
      if (taskError !== undefined) {
        throw taskError;
      }
      return result;
    });
}

async function generateEnhancedPrompt(
  preparation: EnhancementPreparation,
  completeFn: CompleteFn,
  signal: AbortSignal,
  timeoutMs: number,
  tracker: EnhancementAttemptTracker,
  fallbackModelRefs: ModelRef[],
  modelRegistry: ModelRegistry
): Promise<string | null> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const requestSignal = AbortSignal.any([signal, timeoutController.signal]);
  const failures: CompletionFailure[] = [];
  const strictRequest = buildRetryRequest(preparation.request);

  try {
    const primary = await runParsedCompletion(
      completeFn,
      preparation,
      preparation.request,
      requestSignal,
      signal,
      timeoutController.signal,
      timeoutMs
    );
    if (primary.outcome === "success") return primary.prompt;
    if (primary.outcome === "cancelled") return null;
    failures.push({
      name: "Primary",
      modelLabel: preparation.enhancerModel.label,
      attempt: primary,
    });

    if (primary.outcome === "invalid") {
      tracker.retryUsed = true;
      const retry = await runParsedCompletion(
        completeFn,
        preparation,
        strictRequest,
        requestSignal,
        signal,
        timeoutController.signal,
        timeoutMs
      );
      if (retry.outcome === "success") {
        tracker.recoveredAfterRetry = true;
        return retry.prompt;
      }
      if (retry.outcome === "cancelled") return null;
      failures.push({ name: "Retry", modelLabel: preparation.enhancerModel.label, attempt: retry });
    }

    const primaryModel = preparation.enhancerModel.model;
    const seen = new Set([`${primaryModel.provider}/${primaryModel.id}`.toLowerCase()]);
    let fallbackNumber = 0;

    for (const fallbackModelRef of fallbackModelRefs) {
      const key = `${fallbackModelRef.provider}/${fallbackModelRef.id}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      fallbackNumber += 1;
      tracker.fallbackUsed = true;

      let fallbackModel: ResolvedEnhancerModel;
      try {
        fallbackModel = await resolveFallbackEnhancerModel(
          modelRegistry,
          preparation.resolvedTargetFamily.family,
          fallbackModelRef
        );
      } catch (error) {
        failures.push({
          name: `Fallback ${fallbackNumber}`,
          modelLabel: `${fallbackModelRef.provider}/${fallbackModelRef.id}`,
          attempt: {
            outcome: "provider-error",
            error: error instanceof Error ? error : new Error(String(error)),
          },
        });
        continue;
      }

      const fallbackPreparation = { ...preparation, enhancerModel: fallbackModel };
      tracker.fallbackModel = {
        provider: fallbackModel.model.provider,
        id: fallbackModel.model.id,
      };
      const fallback = await runParsedCompletion(
        completeFn,
        fallbackPreparation,
        strictRequest,
        requestSignal,
        signal,
        timeoutController.signal,
        timeoutMs
      );
      if (fallback.outcome === "success") {
        tracker.recoveredAfterFallback = true;
        return fallback.prompt;
      }
      if (fallback.outcome === "cancelled") return null;
      failures.push({
        name: `Fallback ${fallbackNumber}`,
        modelLabel: fallbackModel.label,
        attempt: fallback,
      });
    }

    tracker.failureDetail = buildCompletionFailureSummary(failures);
    throw new Error(buildCompletionFailureMessage(preparation.enhancerModel.label, failures));
  } catch (error) {
    if (signal.aborted) return null;
    if (timeoutController.signal.aborted) throw createTimeoutError(timeoutMs);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runParsedCompletion(
  completeFn: CompleteFn,
  preparation: EnhancementPreparation,
  request: Context,
  requestSignal: AbortSignal,
  signal: AbortSignal,
  timeoutSignal: AbortSignal,
  timeoutMs: number
): Promise<CompletionAttempt> {
  let response: AssistantMessage | null;
  try {
    response = await runCompletion(
      completeFn,
      preparation,
      request,
      requestSignal,
      signal,
      timeoutSignal,
      timeoutMs
    );
  } catch (error) {
    if (signal.aborted) return { outcome: "cancelled" };
    if (timeoutSignal.aborted) throw error;
    return {
      outcome: "provider-error",
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  if (response === null) return { outcome: "cancelled" };
  const text = extractTextResponse(response);
  try {
    return { outcome: "success", prompt: parseEnhancedPrompt(text) };
  } catch (error) {
    if (!isInvalidModelOutputError(error)) throw error;
    return { outcome: "invalid", error, text };
  }
}

async function runCompletion(
  completeFn: CompleteFn,
  preparation: EnhancementPreparation,
  request: Context,
  requestSignal: AbortSignal,
  signal: AbortSignal,
  timeoutSignal: AbortSignal,
  timeoutMs: number
): Promise<AssistantMessage | null> {
  const response = await Promise.race<AssistantMessage | null>([
    completeFn(
      preparation.enhancerModel.model,
      request,
      buildCompletionOptions(preparation, requestSignal)
    ),
    waitForAbort(signal, null),
    waitForTimeout(timeoutSignal, timeoutMs),
  ]);

  if (response === null) {
    return null;
  }

  if (response.stopReason === "aborted") {
    if (signal.aborted) {
      return null;
    }
    if (timeoutSignal.aborted) {
      throw createTimeoutError(timeoutMs);
    }
    return null;
  }

  if (response.stopReason === "length" && extractTextResponse(response) === "") {
    throw new Error(
      `Prompton enhancer model ${preparation.enhancerModel.label} ran out of output tokens before producing a response (likely spent on reasoning). Try /prompton status or pick a less reasoning-heavy model.`
    );
  }

  if (response.stopReason === "error") {
    throw new Error(
      response.errorMessage ??
        `Prompton enhancer model ${preparation.enhancerModel.label} failed without an error message.`
    );
  }

  return response;
}

function buildCompletionOptions(
  preparation: EnhancementPreparation,
  requestSignal: AbortSignal
): CompleteOptions {
  const { apiKey, headers } = preparation.enhancerModel.requestAuth;

  const model = preparation.enhancerModel.model;

  return {
    ...(typeof apiKey === "string" ? { apiKey } : {}),
    ...(headers ? { headers } : {}),
    ...buildGptCompletionOptions(model),
    ...buildReasoningCompletionOptions(model),
    signal: requestSignal,
    maxTokens: Math.min(model.maxTokens, buildOutputTokenBudget(model)),
  };
}

function buildGptCompletionOptions(model: Model<Api>): CompleteOptions {
  if (!isGptModel(model)) {
    return {};
  }

  return model.api === "openai-codex-responses" ? { textVerbosity: "low" } : {};
}

function buildReasoningCompletionOptions(model: Model<Api>): CompleteOptions {
  if (!model.reasoning) return {};
  if (model.api === "antigravity-api") return { reasoning: "low" };
  if (model.api === "google-generative-ai" || model.api === "google-vertex") {
    return { thinking: { enabled: true, level: "LOW" } };
  }
  return {};
}

function buildOutputTokenBudget(model: Model<Api>): number {
  // Antigravity maps low reasoning for Gemini 3.1 Pro to a 1,001-token budget.
  return model.api === "antigravity-api" && model.id.startsWith("gemini-3.1-pro")
    ? ENHANCER_MAX_OUTPUT_TOKENS + 1_001
    : ENHANCER_MAX_OUTPUT_TOKENS;
}

function isGptModel(model: Model<Api>): boolean {
  const provider = model.provider.toLowerCase();
  const id = model.id.toLowerCase();
  return (
    provider === "openai" ||
    provider === "openai-codex" ||
    id.startsWith("gpt") ||
    /^o[1-9]/.test(id)
  );
}

function buildRetryRequest(request: Context): Context {
  const messages = request.messages.slice();
  const lastMessage = messages.at(-1);

  if (lastMessage) {
    const nextContent = Array.isArray(lastMessage.content)
      ? lastMessage.content.map((part) =>
          part.type === "text"
            ? {
                ...part,
                text: `${part.text}\n\nIMPORTANT: ${buildSentinelReminder()}`,
              }
            : part
        )
      : lastMessage.content;

    messages[messages.length - 1] = {
      ...lastMessage,
      content: nextContent,
    } as (typeof messages)[number];
  }

  return {
    ...request,
    systemPrompt: `${request.systemPrompt}\n${buildSentinelReminder()} Do not add markdown fences, explanations, or any text before or after the sentinel block.`,
    messages,
  };
}

function buildEnhancementAttempt(
  preparation: EnhancementPreparation,
  tracker: EnhancementAttemptTracker,
  outcome: PromptonEnhancementAttempt["outcome"]
): PromptonEnhancementAttempt {
  return {
    outcome,
    enhancerModel: {
      provider: preparation.enhancerModel.model.provider,
      id: preparation.enhancerModel.model.id,
    },
    retryUsed: tracker.retryUsed,
    recoveredAfterRetry: tracker.recoveredAfterRetry,
    fallbackUsed: tracker.fallbackUsed,
    recoveredAfterFallback: tracker.recoveredAfterFallback,
    ...(tracker.fallbackModel ? { fallbackModel: tracker.fallbackModel } : {}),
    ...(tracker.failureDetail ? { detail: tracker.failureDetail } : {}),
  };
}

function buildSuccessMessage(
  tracker: EnhancementAttemptTracker,
  autoSent: boolean,
  finalText?: string
): string {
  const action = autoSent ? "enhanced and sent the refined prompt" : "enhanced the current draft";
  const tokenSuffix = finalText ? ` (~${estimateTextTokens(finalText)} tokens)` : "";

  if (tracker.recoveredAfterFallback) {
    return `Prompton ${action} with the configured fallback model.${tokenSuffix}`;
  }
  return tracker.recoveredAfterRetry
    ? `Prompton ${action} after retrying the model output format once.${tokenSuffix}`
    : `Prompton ${action}.${tokenSuffix}`;
}

function sendEnhancedPromptIfConfigured(
  ctx: ExtensionContext,
  settings: PromptonSettings,
  finalText: string,
  services: Pick<EnhancementServices, "sendUserMessage">
): { sent: boolean; error?: string } {
  if (!settings.autoSendEnhancedPrompt) {
    return { sent: false };
  }

  if (!finalText.trim()) {
    return {
      sent: false,
      error: "Prompton left the refined prompt in the editor because the final prompt is empty.",
    };
  }

  try {
    if (ctx.isIdle()) {
      services.sendUserMessage(finalText);
    } else {
      services.sendUserMessage(finalText, { deliverAs: settings.autoSendBusyBehavior });
    }

    ctx.ui.setEditorText("");
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error: `Prompton refined the draft, but auto-send failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function buildCompletionFailureSummary(failures: CompletionFailure[]): string {
  return failures
    .map(({ name, modelLabel, attempt }) =>
      attempt.outcome === "invalid"
        ? `${name.toLowerCase()} ${modelLabel}: ${describeInvalidModelOutputReason(attempt.error.reason)}`
        : `${name.toLowerCase()} ${modelLabel}: ${attempt.error.message}`
    )
    .join("; ");
}

function buildCompletionFailureMessage(
  enhancerModelLabel: string,
  failures: CompletionFailure[]
): string {
  const primaryInvalidTwice =
    failures[0]?.name === "Primary" &&
    failures[0].attempt.outcome === "invalid" &&
    failures[1]?.name === "Retry" &&
    failures[1].attempt.outcome === "invalid";
  const fallbackFailures = failures.some((failure) => failure.name.startsWith("Fallback"));

  return [
    primaryInvalidTwice
      ? `Prompton enhancer model ${enhancerModelLabel} returned invalid output twice${fallbackFailures ? ", and all configured fallbacks failed." : "."}`
      : `Prompton enhancer model ${enhancerModelLabel} failed${fallbackFailures ? ", and all configured fallbacks failed." : "."}`,
    ...failures.map(({ name, modelLabel, attempt }) =>
      attempt.outcome === "invalid"
        ? `${name} failure${name.startsWith("Fallback") ? ` (${modelLabel})` : ""}: ${describeInvalidModelOutputReason(attempt.error.reason)}.`
        : `${name} provider failure (${modelLabel}): ${attempt.error.message}`
    ),
    ...(failures.some((failure) => failure.attempt.outcome === "invalid")
      ? [`Expected exactly one sentinel block: ${buildSentinelReminder()}`]
      : []),
    ...failures.flatMap(({ name, attempt }) =>
      attempt.outcome === "invalid"
        ? [`${name} response preview: ${formatModelOutputPreview(attempt.text)}`]
        : []
    ),
    "Try /prompton status to inspect the current enhancer configuration.",
  ].join("\n");
}

function formatModelOutputPreview(text: string, maxLength = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "<empty response>";
  }

  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}…`;
}

async function previewEnhancedPrompt(
  ctx: ExtensionContext,
  enhancedPrompt: string
): Promise<string | undefined> {
  return ctx.ui.editor("Review enhanced prompt", enhancedPrompt);
}

function extractTextResponse(response: AssistantMessage): string {
  return response.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function waitForAbort<T>(signal: AbortSignal, value: T): Promise<T> {
  if (signal.aborted) {
    return Promise.resolve(value);
  }

  return new Promise<T>((resolve) => {
    signal.addEventListener("abort", () => resolve(value), { once: true });
  });
}

function waitForTimeout(signal: AbortSignal, timeoutMs: number): Promise<never> {
  if (signal.aborted) {
    return Promise.reject(createTimeoutError(timeoutMs));
  }

  return new Promise<never>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(createTimeoutError(timeoutMs)), { once: true });
  });
}

function createTimeoutError(timeoutMs: number): Error {
  const seconds = Math.floor(timeoutMs / 1_000);
  return new Error(
    `Prompton enhancement timed out after ${seconds} seconds. Try again or choose a faster enhancer model.`
  );
}

export function buildEnhancerModeLabel(
  settings: PromptonSettings,
  activeModel: Model<Api> | undefined
): string {
  switch (settings.enhancerModelMode) {
    case "active":
      return activeModel
        ? `active (${activeModel.provider}/${activeModel.id})`
        : "active (no model)";
    case "fixed":
      return settings.fixedEnhancerModel
        ? `${settings.fixedEnhancerModel.provider}/${settings.fixedEnhancerModel.id}`
        : "fixed (unconfigured)";
    case "family-linked": {
      const gpt = settings.familyEnhancerModels?.gpt;
      const claude = settings.familyEnhancerModels?.claude;
      return `family-linked (${gpt ? `${gpt.provider}/${gpt.id}` : "gpt:unset"}; ${claude ? `${claude.provider}/${claude.id}` : "claude:unset"})`;
    }
  }
}
