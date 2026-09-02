<p align="center">
  <img src="assets/pi_prompton_social_card.jpg" alt="pi-prompton" width="100%" />
</p>

# pi-prompton

Prompt-rewriting extension for [Pi](https://github.com/earendil-works/pi-mono). Takes a rough draft in the Pi editor and turns it into a cleaner, stronger prompt without leaving the editor.

> **Fork of [ayagmar/pi-promptsmith](https://github.com/ayagmar/pi-promptsmith)** — original work by [@ayagmar](https://github.com/ayagmar). This fork is maintained separately and may diverge.

Two output styles:

- **Plain rewrite** — tighten and clarify the prompt
- **Execution contract** — turn a rough task into a compact, agent-executable spec

## Installation

Run once without installing:

```bash
pi -e npm:pi-prompton
```

Install as a Pi package:

```bash
pi install npm:pi-prompton
```

Install from git:

```bash
pi install git:github.com/the-matt-moo/pi-prompton
```

## Quick start

Write a rough request in the Pi editor, then press `Alt+P` (default) or run `/prompton`.

To undo: `/prompton undo`

## Rewrite modes

Configured in `~/.pi/agent/prompton-settings.json`.

### `auto` (default)

Uses local heuristics to pick the output style. Chooses **execution-contract** for coding tasks (implement, debug, refactor, review, research, docs, tests). Chooses **plain** for explanations, brainstorming, prose cleanup, and open-ended chat.

### `plain`

Always produce a stronger prompt — no execution contract structure.

### `execution-contract`

Always produce a compact task spec. Includes what is useful from: goal, context, constraints, files to inspect, expected change, verification steps, output expectations. Not a fixed template — keeps concrete user details, avoids invented requirements.

## Unified prompt strategy

Prior versions maintained separate GPT and Claude prompt-construction paths. In v0.5.0 these were collapsed into a single unified strategy, co-designed through a Claude (Anthropic) and ChatGPT (OpenAI gpt-5.6-sol) review cycle:

1. **Claude** drafted the unified prompt and implementation.
2. **gpt-5.6-sol** reviewed for regressions, identified five issues (underspecified target-family semantics, dropped guidance lines, conflicting XML rules, implicit setting behavior, and missing test coverage).
3. Both models converged on the final prompt and code.

The result:

- One request builder (`strategies/unified.ts`) replaces the former `strategies/gpt.ts` and `strategies/claude.ts`.
- The best GPT-specific guidance (outcome-first structure, decision rules over step stacks, evidence/tool boundaries for agentic work) was promoted to universal instructions in the shared system prompt.
- The enhancer still sees `resolved_target_family` in the context payload and adapts output structure when it materially improves execution for the target model — but the _enhancer prompt itself_ is model-agnostic.
- `rewrite_strength` and `preserve_code_blocks` now have explicit behavioral semantics in the system prompt rather than relying on implicit interpretation.
- XML-like sections are governed by one consistent rule: use them only when the draft already does or when they materially improve reliable execution or parsing.

## Examples

### Plain rewrite

Input:

```
can you rewrite this prompt so it sounds better and asks for a short explanation of how model routing works
```

Output:

```
Explain how Prompton model routing works. Keep the explanation concise and practical. Focus on how the active model, explicit overrides, and fallback rules determine the final target family.
```

### Execution contract

Input:

```
add rewrite mode support for prompton and make status show what mode it picks
```

Output:

```
Goal
Add rewrite mode support to Prompton and update status reporting so it shows both the configured mode and the resolved mode for the current editor draft.

Constraints
- Preserve current preview, undo, timeout, and cancellation behavior.
- Keep settings persisted globally across Pi sessions.
- Do not add extra model calls.

What to inspect
- command handling and persisted settings
- enhancement request shaping
- status reporting
- settings UI

Verification
- update or add tests for mode persistence, command handling, and status output
- run the relevant project checks
```

## Prompt coaching tools

Prompton includes optional tools beyond the core rewriter. Editor-changing actions save the previous draft for `/prompton undo`.

### Lint

Local, instant, no LLM call. Flags structural weaknesses before enhancement: missing verbs, vague subjects, unbounded scope, bare questions, drafts that are too short or too long.

```
/prompton lint
```

### Score

LLM-based quality rating (1–5) with up to 3 concrete weaknesses. Read-only, cancellable, and governed by the configured enhancement timeout.

```
/prompton score
```

### Coach

Inline annotations on weak spots. The model inserts `[category: suggestion]` brackets directly into your draft without rewriting it. Invalid model output fails closed and leaves the draft unchanged.

```
/prompton coach
```

Annotation categories: `vague`, `missing-context`, `unbounded`, `no-verification`, `missing-constraint`, `ambiguous`.

### Clarify

A single dialog shown only when local lint finds missing information. Choose one of three intent-aware suggestions or **Type something** to add your own clarification.

```
/prompton clarify                  run clarify on the current draft (one-shot)
/prompton clarify on|off           enable/disable clarify before every enhancement
/prompton clarify-on-shortcut on|off   also clarify on keyboard shortcut
```

If local lint finds no issues, Clarify is skipped entirely. Press `Esc` to cancel.

### Templates

When the editor is empty, both `/prompton` and the shortcut (`Alt+P`) open the same template picker. `/prompton template` asks before replacing non-empty editor text.

```
/prompton template
```

### History

Prompton keeps the last 10 drafts changed during the current Pi session. Browse and restore any of them; the replaced editor text remains available to undo.

```
/prompton history
```

### Token estimate

After every enhancement, the success notification includes an approximate token count for the enhanced prompt (e.g. `Prompton enhanced the current draft. (~85 tokens)`). No extra command needed.

## Commands

```
/prompton                    enhance current editor draft
/prompton undo               restore pre-enhancement draft
/prompton status             show configuration and runtime state
/prompton settings           open interactive settings UI
/prompton reset-settings     restore global defaults
/prompton lint               local prompt lint (instant, no LLM)
/prompton score              LLM-based quality rating (1-5)
/prompton coach              inline annotations on weak spots
/prompton clarify            single-step clarification dialog
/prompton clarify on|off     toggle clarify before enhancement
/prompton clarify-on-shortcut on|off   toggle clarify on shortcut
/prompton template           pick a prompt skeleton
/prompton history            browse and restore past drafts
```

Quick config:

```
/prompton enable
/prompton disable
/prompton family auto|gpt|claude
/prompton mode auto|plain|execution-contract
/prompton enhancer-model active
/prompton enhancer-model fixed <provider>/<id>
/prompton enhancer-model family-linked <gpt-provider>/<gpt-id> <claude-provider>/<claude-id>
/prompton map active <gpt|claude>
/prompton map set <provider>/<id> <gpt|claude>
/prompton map add <pattern> <gpt|claude>
/prompton map remove <pattern>
/prompton conversation on|off
/prompton project-metadata on|off
/prompton status-bar on|off
/prompton strength light|balanced|strong
/prompton preview on|off
/prompton auto-send on|off
/prompton auto-send-when-busy steer|follow-up
/prompton preserve-code on|off
/prompton timeout <seconds>
```

### Interactive settings UX

- Lists wrap at top and bottom; large lists are paginated
- Press `/` to search in compact selector; `PageUp`/`PageDown` to page
- Shortcut row: toggle on/off, remap, or reset to `Alt+P`
- Auto-send toggle: submit refined prompt immediately after rewriting
- Auto-send when busy: `steer` or `follow-up`
- Remapping: press new combo directly; `Esc` cancels, `Backspace` resets

## Settings

Stored at `~/.pi/agent/prompton-settings.json`. On first use after upgrading from Promptsmith, Prompton also reads the legacy `promptsmith-settings.json` file as a fallback.

| Setting                  | Default    |
| ------------------------ | ---------- |
| keyboard shortcut        | `Alt+P`    |
| rewrite mode             | `auto`     |
| rewrite strength         | `balanced` |
| status bar               | `off`      |
| recent conversation      | `off`      |
| project metadata         | `off`      |
| preview before replace   | `false`    |
| auto-send                | `false`    |
| auto-send while busy     | `steer`    |
| preserve code blocks     | `true`     |
| enhancement timeout      | `45s`      |
| clarify before enhancing | `off`      |
| clarify on shortcut      | `off`      |

## Context

Always included: current editor draft, rewrite mode, target-family routing, local intent detection.

Optional (off by default):

- **Recent conversation** — recent chat history from the current session branch
- **Project metadata** — working directory and git branch

Does not read repo files, `AGENTS.md`, or README by default.

## Routing

Target-family resolution order:

1. Forced family (when not `auto`)
2. Exact model overrides
3. Pattern overrides
4. Built-in defaults
5. Fallback family

Built-in defaults: OpenAI GPT/o-series → `gpt`, Anthropic Claude → `claude`, Kimi-style → `claude`.

Enhancer model modes: `active`, `fixed`, `family-linked`.

## Safety

- Editor not mutated on failure or cancellation
- Hung requests time out; only one enhancement runs at a time
- Preview mode: review before replace
- Output must contain exactly one sentinel block; bad first response retried once with stricter format reminder before failing closed
- Invalid output reports whether the model missed the sentinel, emitted multiple blocks, added extra text, or returned empty
- GPT calls request concise output where the provider supports verbosity controls
- Collapsed Pi paste markers recovered from clipboard where possible; multi-marker drafts fail closed
- Oversized drafts fail clearly instead of silent truncation
- Intent detection is local and deterministic — no second model call

## Runtime support

| Mode            | Support                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| Interactive TUI | Full                                                                                      |
| RPC             | Status and settings commands only; in-place enhancement blocked (no editor buffer access) |
| print/json      | Editor-dependent actions unsupported                                                      |

## Development

```bash
git clone https://github.com/the-matt-moo/pi-prompton.git
cd pi-prompton
pnpm install
pnpm run check
```

Load local extension in Pi:

```bash
pi -e ./src/index.ts
```
