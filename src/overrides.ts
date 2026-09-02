import { normalize } from "./model-routing.js";
import type { ModelRef, PromptonFamily, PromptonSettings } from "./types.js";

export function upsertExactModelOverride(
  settings: PromptonSettings,
  modelRef: ModelRef,
  family: PromptonFamily
): PromptonSettings {
  return {
    ...settings,
    exactModelOverrides: [
      ...settings.exactModelOverrides.filter(
        (entry) =>
          !(
            normalize(entry.provider) === normalize(modelRef.provider) &&
            normalize(entry.id) === normalize(modelRef.id)
          )
      ),
      { ...modelRef, family },
    ],
  };
}

export function removeExactModelOverride(
  settings: PromptonSettings,
  modelRef: ModelRef
): PromptonSettings {
  return {
    ...settings,
    exactModelOverrides: settings.exactModelOverrides.filter(
      (entry) =>
        !(
          normalize(entry.provider) === normalize(modelRef.provider) &&
          normalize(entry.id) === normalize(modelRef.id)
        )
    ),
  };
}

export function upsertFamilyOverride(
  settings: PromptonSettings,
  pattern: string,
  family: PromptonFamily
): PromptonSettings {
  return {
    ...settings,
    familyOverrides: [
      ...settings.familyOverrides.filter(
        (entry) => normalize(entry.pattern) !== normalize(pattern)
      ),
      { pattern, family },
    ],
  };
}

export function removeFamilyOverride(
  settings: PromptonSettings,
  pattern: string
): PromptonSettings {
  return {
    ...settings,
    familyOverrides: settings.familyOverrides.filter(
      (entry) => normalize(entry.pattern) !== normalize(pattern)
    ),
  };
}
