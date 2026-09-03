import type { PromptonSettings } from "./types.js";

export const EXTENSION_NAME = "pi-prompton";
export const EXTENSION_COMMAND = "prompton";
// Avoid Pi built-ins and common extension collisions.
export const DEFAULT_SHORTCUT_KEY = "alt+p";

export const SETTINGS_VERSION = 1;
export const SENTINEL_OPEN = "<prompton-enhanced-prompt>";
export const SENTINEL_CLOSE = "</prompton-enhanced-prompt>";

export const MAX_STATUS_MODEL_ID_LENGTH = 28;
export const ESTIMATED_FIXED_PROMPT_OVERHEAD_TOKENS = 1_200;
export const MAX_PROJECT_METADATA_TOKENS = 80;
export const MAX_RECENT_CONVERSATION_TOKENS = 800;
export const MAX_CONVERSATION_MESSAGES = 4;
export const DEFAULT_OUTPUT_RESERVE_TOKENS = 1_024;
export const MAX_OUTPUT_RESERVE_TOKENS = 2_048;
export const ENHANCER_MAX_OUTPUT_TOKENS = 1_200;
export const MIN_ENHANCEMENT_TIMEOUT_MS = 5_000;
export const DEFAULT_ENHANCEMENT_TIMEOUT_MS = 45_000;
export const MAX_ENHANCEMENT_TIMEOUT_MS = 300_000;

export const DEFAULT_SETTINGS: PromptonSettings = {
  version: SETTINGS_VERSION,
  enabled: true,
  shortcutEnabled: true,
  shortcutKey: DEFAULT_SHORTCUT_KEY,
  targetFamilyMode: "auto",
  fallbackFamily: "gpt",
  exactModelOverrides: [],
  familyOverrides: [],
  enhancerModelMode: "active",
  includeRecentConversation: false,
  includeProjectMetadata: false,
  statusBarEnabled: false,
  rewriteStrength: "balanced",
  rewriteMode: "auto",
  previewBeforeReplace: false,
  autoSendEnhancedPrompt: false,
  autoSendBusyBehavior: "steer",
  preserveCodeBlocks: true,
  enhancementTimeoutMs: DEFAULT_ENHANCEMENT_TIMEOUT_MS,
  clarifyEnabled: false,
  clarifyOnShortcut: false,
};

export const HELP_LINES = [
  `/${EXTENSION_COMMAND} — enhance the current draft`,
  `/${EXTENSION_COMMAND} undo — restore the previous draft`,
  `/${EXTENSION_COMMAND} status — show config and runtime state`,
  `/${EXTENSION_COMMAND} settings — open the settings UI`,
  `/${EXTENSION_COMMAND} reset-settings — restore global defaults`,
  `/${EXTENSION_COMMAND} enable|disable — toggle Prompton on or off`,
  `/${EXTENSION_COMMAND} family auto|gpt|claude — choose the target family`,
  `/${EXTENSION_COMMAND} mode auto|plain|execution-contract — choose rewrite mode`,
  `/${EXTENSION_COMMAND} enhancer-model active — use the active model (default)`,
  `/${EXTENSION_COMMAND} enhancer-model fixed <provider>/<id> — pin one enhancer model`,
  `/${EXTENSION_COMMAND} conversation on|off — include recent chat context`,
  `/${EXTENSION_COMMAND} project-metadata on|off — include project metadata`,
  `/${EXTENSION_COMMAND} status-bar on|off — show status-bar text`,
  `/${EXTENSION_COMMAND} strength light|balanced|strong — tune rewrite strength`,
  `/${EXTENSION_COMMAND} preview on|off — preview before replacing`,
  `/${EXTENSION_COMMAND} auto-send on|off — auto-send the enhanced prompt`,
  `/${EXTENSION_COMMAND} auto-send-when-busy steer|follow-up — choose busy behavior`,
  `/${EXTENSION_COMMAND} preserve-code on|off — keep code blocks intact`,
  `/${EXTENSION_COMMAND} timeout <seconds> — set the enhancement timeout`,
  `/${EXTENSION_COMMAND} clarify — run one-shot clarification`,
  `/${EXTENSION_COMMAND} clarify on|off — clarify before every enhancement`,
  `/${EXTENSION_COMMAND} clarify-on-shortcut on|off — clarify on shortcut too`,
  `/${EXTENSION_COMMAND} lint — run local prompt lint`,
  `/${EXTENSION_COMMAND} score — rate prompt quality`,
  `/${EXTENSION_COMMAND} coach — annotate weak spots inline`,
  `/${EXTENSION_COMMAND} template — pick a prompt skeleton`,
  `/${EXTENSION_COMMAND} history — browse recent drafts`,
  `/${EXTENSION_COMMAND} help — show this list`,
].join("\n");
