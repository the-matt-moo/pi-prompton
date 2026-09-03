import type { Api, Context, Model } from "@earendil-works/pi-ai";
import type { ExtensionContext, ModelRegistry } from "@earendil-works/pi-coding-agent";

export type PromptonFamily = "gpt" | "claude";
export type PromptonTargetFamilyMode = "auto" | PromptonFamily;
export type PromptonEnhancerModelMode = "active" | "fixed" | "family-linked";
export type PromptonRewriteStrength = "light" | "balanced" | "strong";
export type PromptonRewriteMode = "auto" | "plain" | "execution-contract";
export type PromptonEffectiveRewriteMode = Exclude<PromptonRewriteMode, "auto">;
export type PromptonAutoSendBusyBehavior = "steer" | "followUp";
export type PromptonTaskIntent =
  | "implement"
  | "debug"
  | "refactor"
  | "review"
  | "research"
  | "docs"
  | "test-fix"
  | "explain"
  | "general";

export interface ModelRef {
  provider: string;
  id: string;
}

export interface ExactModelOverride extends ModelRef {
  family: PromptonFamily;
}

export interface FamilyOverride {
  pattern: string;
  family: PromptonFamily;
}

export interface FamilyEnhancerModels {
  gpt?: ModelRef;
  claude?: ModelRef;
}

export interface PromptonSettings {
  version: 1;
  enabled: boolean;
  shortcutEnabled: boolean;
  shortcutKey: string;
  targetFamilyMode: PromptonTargetFamilyMode;
  fallbackFamily: PromptonFamily;
  exactModelOverrides: ExactModelOverride[];
  familyOverrides: FamilyOverride[];
  enhancerModelMode: PromptonEnhancerModelMode;
  fixedEnhancerModel?: ModelRef;
  familyEnhancerModels?: FamilyEnhancerModels;
  includeRecentConversation: boolean;
  includeProjectMetadata: boolean;
  statusBarEnabled: boolean;
  rewriteStrength: PromptonRewriteStrength;
  rewriteMode: PromptonRewriteMode;
  previewBeforeReplace: boolean;
  autoSendEnhancedPrompt: boolean;
  autoSendBusyBehavior: PromptonAutoSendBusyBehavior;
  preserveCodeBlocks: boolean;
  enhancementTimeoutMs: number;
  clarifyEnabled: boolean;
  clarifyOnShortcut: boolean;
}

export interface ResolvedTargetFamily {
  family: PromptonFamily;
  source: "forced" | "exact-override" | "pattern-override" | "builtin" | "fallback";
  matchedRule?: string;
}

export type PromptonRequestAuth = Pick<
  Extract<Awaited<ReturnType<ModelRegistry["getApiKeyAndHeaders"]>>, { ok: true }>,
  "apiKey" | "headers"
>;

export interface ResolvedEnhancerModel {
  mode: PromptonEnhancerModelMode;
  family: PromptonFamily;
  model: Model<Api>;
  requestAuth: PromptonRequestAuth;
  label: string;
}

export interface ConversationExcerpt {
  role: "user" | "assistant";
  text: string;
  tokens: number;
  timestamp: number;
}

export interface ProjectMetadata {
  cwd: string;
  gitBranch?: string;
}

export interface PromptonContextPayload {
  draft: string;
  activeModel?: ModelRef;
  targetFamily: PromptonFamily;
  rewriteStrength: PromptonRewriteStrength;
  configuredRewriteMode: PromptonRewriteMode;
  effectiveRewriteMode: PromptonEffectiveRewriteMode;
  intent: PromptonTaskIntent;
  preserveCodeBlocks: boolean;
  recentConversation: ConversationExcerpt[];
  projectMetadata?: ProjectMetadata;
  droppedContext: string[];
}

export interface EnhancementPreparation {
  resolvedTargetFamily: ResolvedTargetFamily;
  enhancerModel: ResolvedEnhancerModel;
  promptContext: PromptonContextPayload;
  request: Context;
}

export interface PromptonDraftResolution {
  intent: PromptonTaskIntent;
  effectiveRewriteMode: PromptonEffectiveRewriteMode;
}

export interface PromptonEnhancementAttempt {
  outcome: "success" | "cancelled" | "failed";
  enhancerModel?: ModelRef;
  retryUsed: boolean;
  recoveredAfterRetry: boolean;
  detail?: string;
}

export interface PromptonStatusSnapshot {
  settings: PromptonSettings;
  activeModel?: ModelRef;
  resolvedTargetFamily?: ResolvedTargetFamily;
  enhancerModeLabel: string;
  busy: boolean;
  undoAvailable: boolean;
  currentDraftResolution?: PromptonDraftResolution;
  lastDraftResolution?: PromptonDraftResolution;
  lastEnhancementAttempt?: PromptonEnhancementAttempt;
}

export interface PromptonRuntimeSupport {
  interactiveTui: boolean;
  reason?: string;
}

export interface ParsedPromptonCommand {
  name: string;
  args: string[];
  inlineDraft?: string;
}

export interface BuildPromptContextOptions {
  ctx: ExtensionContext;
  draft: string;
  settings: PromptonSettings;
  activeModel: Model<Api> | undefined;
  targetFamily: PromptonFamily;
  enhancerModel: Model<Api>;
  exec: (
    command: string,
    args: string[]
  ) => Promise<{ stdout: string; stderr: string; code: number }>;
}
