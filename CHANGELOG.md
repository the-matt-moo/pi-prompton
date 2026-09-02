# Changelog

## [0.5.0] (Unreleased)

### Features

* **prompton:** add clarify mode — single-dialog lint + intent suggestions before enhancement (replaces multi-step grill)
* **prompton:** `/prompton clarify` one-shot command, `clarify on|off` and `clarify-on-shortcut on|off` settings
* **prompton:** clarify offers three suggestions plus custom text and skips drafts without lint issues
* **prompton:** `/prompton lint` — local, instant prompt linting (no LLM call)
* **prompton:** `/prompton score` — LLM-based quality rating (1-5) with concrete weaknesses
* **prompton:** `/prompton coach` — inline `[category: suggestion]` annotations without rewriting
* **prompton:** `/prompton template` — intent-based prompt skeletons for empty-editor starts
* **prompton:** `/prompton history` — browse and restore last 10 pre-enhancement drafts
* **prompton:** token estimate shown in enhancement success notification
* **prompton:** empty `/prompton` and shortcut invocations now use the same template picker
* **prompton:** history ring replaces single-entry undo (still backward-compatible via `/prompton undo`)
* **prompton:** unify GPT/Claude strategy into single request builder; fold best GPT guidance into shared prompt
* **prompton:** add value completions for common slash-command arguments
* **readme:** add social card

### Bug Fixes

* **prompton:** restore clarify settings from disk and read legacy Promptsmith settings as fallback
* **prompton:** prevent duplicate clarification dialogs from shortcut enhancement
* **prompton:** make Score and Coach cancellable and enforce enhancement timeout
* **prompton:** reject malformed Score and Coach model output without changing the draft
* **prompton:** preserve editor text when loading templates or restoring history