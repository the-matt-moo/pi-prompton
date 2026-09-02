import type { Api, Model } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import type {
  ModelRef,
  PromptonFamily,
  PromptonRequestAuth,
  PromptonSettings,
  ResolvedEnhancerModel,
} from "./types.js";

export async function resolveEnhancerModel(
  settings: PromptonSettings,
  targetFamily: PromptonFamily,
  activeModel: Model<Api> | undefined,
  modelRegistry: ModelRegistry
): Promise<ResolvedEnhancerModel> {
  switch (settings.enhancerModelMode) {
    case "active": {
      if (!activeModel) {
        throw new Error("Prompton requires an active model when enhancer-model mode is 'active'.");
      }
      const requestAuth = await resolveRequestAuth(modelRegistry, activeModel);
      return {
        mode: "active",
        family: targetFamily,
        model: activeModel,
        requestAuth,
        label: `active (${activeModel.provider}/${activeModel.id})`,
      };
    }

    case "fixed": {
      const fixedRef = settings.fixedEnhancerModel;
      if (!fixedRef) {
        throw new Error(
          "Prompton enhancer-model mode is 'fixed', but no fixed enhancer model is configured."
        );
      }
      return resolveConfiguredModel(modelRegistry, targetFamily, fixedRef, "fixed");
    }

    case "family-linked": {
      const familyRef =
        targetFamily === "gpt"
          ? settings.familyEnhancerModels?.gpt
          : settings.familyEnhancerModels?.claude;
      if (!familyRef) {
        throw new Error(
          `Prompton enhancer-model mode is 'family-linked', but no ${targetFamily} enhancer model is configured.`
        );
      }
      return resolveConfiguredModel(modelRegistry, targetFamily, familyRef, "family-linked");
    }

    default:
      throw new Error(
        `Prompton received unsupported enhancer-model mode: ${String(settings.enhancerModelMode)}.`
      );
  }
}

export function parseModelRef(value: string): ModelRef | undefined {
  const separatorIndex = value.indexOf("/");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    return undefined;
  }

  const provider = value.slice(0, separatorIndex).trim();
  const id = value.slice(separatorIndex + 1).trim();
  if (!provider || !id) {
    return undefined;
  }

  return { provider, id };
}

async function resolveConfiguredModel(
  modelRegistry: ModelRegistry,
  targetFamily: PromptonFamily,
  modelRef: ModelRef,
  mode: ResolvedEnhancerModel["mode"]
): Promise<ResolvedEnhancerModel> {
  const model = modelRegistry.find(modelRef.provider, modelRef.id);
  if (!model) {
    throw new Error(
      `Prompton could not find the configured enhancer model ${modelRef.provider}/${modelRef.id}.`
    );
  }

  const requestAuth = await resolveRequestAuth(modelRegistry, model);
  return {
    mode,
    family: targetFamily,
    model,
    requestAuth,
    label: `${model.provider}/${model.id}`,
  };
}

async function resolveRequestAuth(
  modelRegistry: ModelRegistry,
  model: Model<Api>
): Promise<PromptonRequestAuth> {
  const auth = await modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) {
    throw new Error(
      `Prompton could not resolve request auth for ${model.provider}/${model.id}: ${auth.error}`
    );
  }

  return {
    ...(typeof auth.apiKey === "string" ? { apiKey: auth.apiKey } : {}),
    ...(auth.headers ? { headers: auth.headers } : {}),
  };
}
