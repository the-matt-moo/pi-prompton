/**
 * Local, deterministic prompt linting — no LLM call.
 * Runs instantly before enhancement to flag structural weaknesses.
 */

export interface LintWarning {
  id: string;
  message: string;
}

const MIN_WORD_COUNT = 3;
const MAX_WORD_COUNT = 500;
const FILE_REF_PATTERN =
  /(?:\.\/|\.\.\/|\/[\w]|[\w]+\.(?:ts|tsx|js|jsx|py|go|rs|rb|java|kt|swift|sql|json|yaml|yml|md|toml|xml|html|css|sh))\b/;
const VAGUE_SUBJECT_PATTERNS = [/\b(?:it|this|that|the thing|the stuff|the code|the file)\b/i];
const HAS_VERB_PATTERN =
  /\b(?:add|build|create|implement|fix|debug|refactor|review|update|change|modify|remove|delete|replace|move|rename|explain|describe|research|investigate|compare|test|check|verify|lint|deploy|migrate|configure|set up|write|read|parse|format|convert|generate|optimize|improve|clean|simplify|extract|split|merge|combine|integrate|wire|connect|send|fetch|call|run|install|enable|disable)\b/i;
const QUESTION_ONLY_PATTERN = /^[^.!]*\?$/;

export function lintDraft(draft: string): LintWarning[] {
  const warnings: LintWarning[] = [];
  const trimmed = draft.trim();
  if (!trimmed) return warnings;

  const words = trimmed.split(/\s+/);
  const wordCount = words.length;

  if (wordCount < MIN_WORD_COUNT) {
    warnings.push({ id: "too-short", message: "Draft is very short — add context or intent." });
  }

  if (wordCount > MAX_WORD_COUNT) {
    warnings.push({
      id: "too-long",
      message: `Draft is ${wordCount} words — consider splitting into focused tasks.`,
    });
  }

  if (!HAS_VERB_PATTERN.test(trimmed)) {
    warnings.push({ id: "no-verb", message: "No action verb found — what should happen?" });
  }

  if (QUESTION_ONLY_PATTERN.test(trimmed) && wordCount < 8) {
    warnings.push({
      id: "bare-question",
      message: "Bare question — add context about what you've tried or what you need.",
    });
  }

  const vagueCount = VAGUE_SUBJECT_PATTERNS.filter((p) => p.test(trimmed)).length;
  if (vagueCount > 0 && !FILE_REF_PATTERN.test(trimmed) && wordCount < 20) {
    warnings.push({
      id: "vague-subject",
      message: "Vague subject without file references — name the specific files or modules.",
    });
  }

  if (/\b(?:everything|all of it|the whole thing|all files)\b/i.test(trimmed) && wordCount < 15) {
    warnings.push({
      id: "unbounded-scope",
      message: "Unbounded scope — narrow to specific files, modules, or behaviors.",
    });
  }

  return warnings;
}

export function formatLintWarnings(warnings: LintWarning[]): string {
  if (warnings.length === 0) return "No lint warnings.";
  return warnings.map((w) => `- ${w.message}`).join("\n");
}
