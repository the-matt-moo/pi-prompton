# Graph Report - pi-prompton  (2026-10-15)

## Corpus Check
- 59 files · ~244,479 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 5, .jsonl 1)

## Summary
- 667 nodes · 1671 edges · 27 communities (24 shown, 3 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `00839957`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- settings-actions.ts
- enhance.ts
- state.ts
- jev-client.ts
- commands.ts
- helpers.ts
- pi-prompton
- shortcut-key.ts
- Changelog
- constants.ts
- intent.ts
- types.ts
- package.json
- compilerOptions
- CompactSelectDialog
- devDependencies
- status.ts
- release-it
- editor-draft.ts
- scripts
- model-routing.ts
- peerDependencies
- eslint.config.js
- pi
- repository
- bugs
- engines

## God Nodes (most connected - your core abstractions)
1. `PromptonRuntimeState` - 36 edges
2. `runSettingsAction()` - 35 edges
3. `handlePromptonCommand()` - 31 edges
4. `@earendil-works/pi-coding-agent` - 24 edges
5. `enhanceEditorDraft()` - 22 edges
6. `PromptonSettings` - 19 edges
7. `sanitizeSettings()` - 18 edges
8. `formatShortcutKey()` - 17 edges
9. `detectRuntimeSupport()` - 17 edges
10. `CompactSelectDialog` - 16 edges

## Surprising Connections (you probably didn't know these)
- `createRuntimeState()` --calls--> `PromptonRuntimeState`  [EXTRACTED]
  test/helpers.ts → src/state.ts
- `fallbackAction()` --calls--> `runSettingsAction()`  [EXTRACTED]
  test/settings-modal.test.ts → src/ui/settings-actions.ts
- `launchModal()` --calls--> `openSettingsUi()`  [EXTRACTED]
  test/settings-modal.test.ts → src/ui/settings.ts
- `runClarifyCommand()` --calls--> `clarifyDraft()`  [EXTRACTED]
  src/coaching-commands.ts → src/clarify.ts
- `enhanceEditorDraft()` --calls--> `clarifyDraft()`  [EXTRACTED]
  src/enhance.ts → src/clarify.ts

## Import Cycles
- None detected.

## Communities (27 total, 3 thin omitted)

### Community 0 - "settings-actions.ts"
Cohesion: 0.06
Nodes (73): @earendil-works/pi-coding-agent, @earendil-works/pi-tui, DEFAULT_SHORTCUT_KEY, clearFamilyEnhancerModel(), clearFixedEnhancerModel(), setActiveEnhancerModelMode(), setFamilyEnhancerModel(), setFixedEnhancerModel() (+65 more)

### Community 1 - "enhance.ts"
Cohesion: 0.06
Nodes (69): @earendil-works/pi-ai, COACH_SYSTEM_PROMPT, coachDraft(), SENTINEL_CLOSE, SENTINEL_OPEN, buildExecutionContractInstructions(), buildIntentGuidance(), buildPlainRewriteInstructions() (+61 more)

### Community 2 - "state.ts"
Cohesion: 0.07
Nodes (30): dedupeExactOverrides(), dedupeFamilyOverrides(), getGlobalSettingsPath(), getLegacySettingsPath(), isRecord(), PromptonRuntimeState, readAutoSendBusyBehavior(), readBoolean() (+22 more)

### Community 3 - "jev-client.ts"
Cohesion: 0.06
Nodes (31): clarifyDraft(), getIntentSuggestions(), lintFix(), missingContextItems(), showClarificationDialog(), callSystemOne(), CREDENTIAL_SCRIPT, credentialCache (+23 more)

### Community 4 - "commands.ts"
Cohesion: 0.14
Nodes (37): requireInteractiveDraft(), runClarifyCommand(), runCoachCommand(), runHistoryCommand(), runInputCommand(), runLintCommand(), runScoreCommand(), runTemplateCommand() (+29 more)

### Community 5 - "helpers.ts"
Cohesion: 0.13
Nodes (22): SETTINGS_TOGGLE_IDS, openSettingsUi(), createAssistantEntry(), createAssistantResponse(), createCommandContext(), createCompleteResponse(), createMockKeybindings(), createMockPi() (+14 more)

### Community 6 - "pi-prompton"
Cohesion: 0.06
Nodes (31): `auto` (default), Clarify, Coach, Commands, Comparison: pi-promptsmith vs pi-prompton, Context, Development, Enhance or inspect a one-off prompt (+23 more)

### Community 7 - "shortcut-key.ts"
Cohesion: 0.12
Nodes (27): getPromptonArgumentCompletions(), EXTENSION_COMMAND, runEnhancementWithLoader(), createPromptonExtension(), promptonExtension(), DISPLAY_NAMES, EffectiveKeybindings, findShortcutConflictAction() (+19 more)

### Community 8 - "Changelog"
Cohesion: 0.07
Nodes (28): [0.10.0], [0.5.0], [0.5.1], [0.5.2], [0.5.3], [0.6.0], [0.6.1], [0.7.0] (+20 more)

### Community 9 - "constants.ts"
Cohesion: 0.13
Nodes (24): DEFAULT_ENHANCEMENT_TIMEOUT_MS, DEFAULT_OUTPUT_RESERVE_TOKENS, DEFAULT_SETTINGS, ENHANCER_MAX_OUTPUT_TOKENS, ESTIMATED_FIXED_PROMPT_OVERHEAD_TOKENS, EXTENSION_NAME, HELP_LINES, MAX_CONVERSATION_MESSAGES (+16 more)

### Community 10 - "intent.ts"
Cohesion: 0.10
Nodes (24): CODE_SURFACE_PATTERNS, DEBUG_RULE, detectTaskIntent(), DOCS_RULE, DraftIntentAnalysis, EXECUTION_CONTRACT_INTENTS, EXECUTION_VERB_PATTERNS, EXPLAIN_LEAD_PATTERNS (+16 more)

### Community 11 - "types.ts"
Cohesion: 0.12
Nodes (17): MAX_ENHANCEMENT_TIMEOUT_MS, MIN_ENHANCEMENT_TIMEOUT_MS, BuildPromptContextOptions, ConversationExcerpt, EnhancementPreparation, FamilyEnhancerModels, FamilyOverride, ParsedPromptonCommand (+9 more)

### Community 12 - "package.json"
Cohesion: 0.11
Nodes (17): description, files, homepage, keywords, license, main, name, type (+9 more)

### Community 13 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, lib, module, moduleResolution, noEmit, noImplicitAny (+9 more)

### Community 15 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @earendil-works/pi-ai, @earendil-works/pi-coding-agent, @earendil-works/pi-tui, eslint, eslint-config-prettier, prettier, release-it (+7 more)

### Community 16 - "status.ts"
Cohesion: 0.28
Nodes (11): buildEnhancerModeLabel(), analyzeDraftIntent(), resolveEffectiveRewriteMode(), describeResolvedFamily(), buildStatusLine(), buildStatusReport(), createStatusSnapshot(), describeRetryStatus() (+3 more)

### Community 17 - "release-it"
Cohesion: 0.14
Nodes (14): commitMessage, requireCleanWorkingDir, requireUpstream, tagName, release, publish, @release-it/conventional-changelog, release-it (+6 more)

### Community 18 - "editor-draft.ts"
Cohesion: 0.26
Nodes (12): buildClipboardCandidates(), ClipboardCommand, extractPasteMarkers(), getClipboardReadCommands(), isWslEnvironment(), matchesPasteMarker(), normalizeLineEndings(), PasteMarker (+4 more)

### Community 19 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, check, format, format:check, lint, lint:fix, release, release:first (+3 more)

### Community 20 - "model-routing.ts"
Cohesion: 0.53
Nodes (5): globToRegExp(), matchesPattern(), resolveBuiltinFamily(), resolveTargetFamily(), ResolvedTargetFamily

### Community 21 - "peerDependencies"
Cohesion: 0.40
Nodes (5): peerDependencies, @earendil-works/pi-ai, @earendil-works/pi-coding-agent, @earendil-works/pi-tui, typebox

### Community 22 - "eslint.config.js"
Cohesion: 0.50
Nodes (3): eslint-config-prettier, @typescript-eslint/eslint-plugin, @typescript-eslint/parser

### Community 23 - "pi"
Cohesion: 0.67
Nodes (3): pi, extensions, image

### Community 24 - "repository"
Cohesion: 0.67
Nodes (3): repository, type, url

## Knowledge Gaps
- **8 isolated node(s):** `typebox`, `@release-it/conventional-changelog`, `@types/node`, `eslint`, `prettier` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 223 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@earendil-works/pi-coding-agent` connect `settings-actions.ts` to `enhance.ts`, `jev-client.ts`, `commands.ts`, `helpers.ts`, `shortcut-key.ts`, `constants.ts`, `types.ts`, `package.json`, `status.ts`, `editor-draft.ts`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `enhanceEditorDraft()` (e.g. with `.finishEnhancement()` and `.getSettings()`) actually correct?**
  _`enhanceEditorDraft()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `typebox`, `@release-it/conventional-changelog`, `@types/node` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `settings-actions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05854341736694678 - nodes in this community are weakly interconnected._
- **Why does `@earendil-works/pi-ai` connect `enhance.ts` to `settings-actions.ts`, `helpers.ts`, `constants.ts`, `types.ts`, `package.json`, `model-routing.ts`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `enhance.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05583308845136644 - nodes in this community are weakly interconnected._
- **Why does `PromptonRuntimeState` connect `state.ts` to `settings-actions.ts`, `enhance.ts`, `commands.ts`, `helpers.ts`, `shortcut-key.ts`, `types.ts`, `status.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._