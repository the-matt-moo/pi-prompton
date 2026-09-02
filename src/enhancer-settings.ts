import type { ModelRef, PromptonFamily, PromptonSettings } from "./types.js";

export function setActiveEnhancerModelMode(settings: PromptonSettings): PromptonSettings {
  const next = { ...settings, enhancerModelMode: "active" as const };
  delete next.fixedEnhancerModel;
  delete next.familyEnhancerModels;
  return next;
}

export function setFixedEnhancerModel(
  settings: PromptonSettings,
  modelRef: ModelRef
): PromptonSettings {
  return {
    ...setActiveEnhancerModelMode(settings),
    enhancerModelMode: "fixed",
    fixedEnhancerModel: modelRef,
  };
}

export function clearFixedEnhancerModel(settings: PromptonSettings): PromptonSettings {
  if (settings.enhancerModelMode === "fixed") {
    return setActiveEnhancerModelMode(settings);
  }

  const next = { ...settings };
  delete next.fixedEnhancerModel;
  return next;
}

export function setFamilyEnhancerModel(
  settings: PromptonSettings,
  family: PromptonFamily,
  modelRef: ModelRef
): PromptonSettings {
  const familyEnhancerModels = {
    ...(settings.familyEnhancerModels ?? {}),
    [family]: modelRef,
  };
  const enhancerModelMode =
    familyEnhancerModels.gpt && familyEnhancerModels.claude
      ? ("family-linked" as const)
      : settings.enhancerModelMode === "fixed"
        ? ("active" as const)
        : settings.enhancerModelMode;
  const next: PromptonSettings = {
    ...settings,
    enhancerModelMode,
    familyEnhancerModels,
  };
  delete next.fixedEnhancerModel;
  if (next.enhancerModelMode !== "family-linked") {
    delete next.familyEnhancerModels;
  }
  return next;
}

export function clearFamilyEnhancerModel(
  settings: PromptonSettings,
  family: PromptonFamily
): PromptonSettings {
  if (settings.enhancerModelMode === "family-linked") {
    return setActiveEnhancerModelMode(settings);
  }

  const nextFamilyModels = { ...(settings.familyEnhancerModels ?? {}) };
  delete nextFamilyModels[family];

  if (Object.keys(nextFamilyModels).length === 0) {
    const next = { ...settings };
    delete next.familyEnhancerModels;
    return next;
  }

  return { ...settings, familyEnhancerModels: nextFamilyModels };
}
