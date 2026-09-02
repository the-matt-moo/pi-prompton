import { clearTimeout, setTimeout } from "node:timers";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CompleteFn } from "./enhance.js";
import { resolveEnhancerModel } from "./model-selection.js";
import { resolveTargetFamily } from "./model-routing.js";
import type { PromptonRuntimeState } from "./state.js";

export interface ModelTaskServices {
  completeFn: CompleteFn;
  runCancellableTask: (
    ctx: ExtensionContext,
    message: string,
    task: (signal: AbortSignal) => Promise<string | null>
  ) => Promise<string | null>;
  refreshStatus: (ctx: ExtensionContext) => void;
}

interface ModelTaskOptions {
  label: string;
  systemPrompt: string;
  userText: string;
  maxTokens: number;
}

export async function runEnhancerTextTask(
  ctx: ExtensionContext,
  runtime: PromptonRuntimeState,
  services: ModelTaskServices,
  options: ModelTaskOptions
): Promise<string | undefined> {
  if (!runtime.tryStartEnhancement()) {
    throw new Error("Prompton is already running a model task.");
  }
  services.refreshStatus(ctx);

  try {
    const settings = runtime.getSettings();
    const targetFamily = resolveTargetFamily(settings, ctx.model).family;
    const enhancer = await resolveEnhancerModel(
      settings,
      targetFamily,
      ctx.model,
      ctx.modelRegistry
    );
    const { apiKey, headers } = enhancer.requestAuth;

    const result = await services.runCancellableTask(ctx, options.label, async (signal) => {
      const timeout = new AbortController();
      const timeoutId = setTimeout(() => timeout.abort(), settings.enhancementTimeoutMs);
      const requestSignal = AbortSignal.any([signal, timeout.signal]);

      try {
        const response = await Promise.race([
          services.completeFn(
            enhancer.model,
            {
              systemPrompt: options.systemPrompt,
              messages: [
                {
                  role: "user",
                  timestamp: Date.now(),
                  content: [{ type: "text", text: options.userText }],
                },
              ],
            },
            {
              ...(typeof apiKey === "string" ? { apiKey } : {}),
              ...(headers ? { headers } : {}),
              signal: requestSignal,
              maxTokens: Math.min(enhancer.model.maxTokens, options.maxTokens),
            }
          ),
          waitForAbort(signal),
          waitForTimeout(timeout.signal, settings.enhancementTimeoutMs),
        ]);

        if (response === null || signal.aborted) return null;
        if (response.stopReason === "aborted") {
          if (timeout.signal.aborted) throw createTimeoutError(settings.enhancementTimeoutMs);
          return null;
        }

        const text = response.content
          .filter((part): part is { type: "text"; text: string } => part.type === "text")
          .map((part) => part.text)
          .join("\n")
          .trim();
        if (!text) throw new Error("Enhancer model returned an empty response.");
        return text;
      } catch (error) {
        if (signal.aborted) return null;
        if (timeout.signal.aborted) throw createTimeoutError(settings.enhancementTimeoutMs);
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    });

    return result ?? undefined;
  } finally {
    runtime.finishEnhancement();
    services.refreshStatus(ctx);
  }
}

function waitForAbort(signal: AbortSignal): Promise<null> {
  if (signal.aborted) return Promise.resolve(null);
  return new Promise((resolve) =>
    signal.addEventListener("abort", () => resolve(null), { once: true })
  );
}

function waitForTimeout(signal: AbortSignal, timeoutMs: number): Promise<never> {
  if (signal.aborted) return Promise.reject(createTimeoutError(timeoutMs));
  return new Promise((_resolve, reject) =>
    signal.addEventListener("abort", () => reject(createTimeoutError(timeoutMs)), { once: true })
  );
}

function createTimeoutError(timeoutMs: number): Error {
  return new Error(`Prompton model task timed out after ${Math.floor(timeoutMs / 1_000)} seconds.`);
}
