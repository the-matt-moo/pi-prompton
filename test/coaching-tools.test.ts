import test from "node:test";
import assert from "node:assert/strict";
import { clarifyDraft } from "../src/clarify.js";
import { lintDraft } from "../src/lint.js";
import { parseScoreResponse } from "../src/score.js";
import { createCommandContext } from "./helpers.js";

void test("clarify skips the dialog for a complete draft", async () => {
  const draft = "Implement authentication in src/auth.ts and verify with existing tests.";
  const ctx = createCommandContext({ editorText: draft });

  assert.equal(await clarifyDraft(ctx, draft), draft);
  assert.deepEqual(ctx.uiState.customTitles, []);
});

void test("clarify accepts custom text from the fourth option", async () => {
  const ctx = createCommandContext({
    editorText: "fix it",
    nextSelectValue: "__custom__",
    nextInputValue: "Only modify src/auth.ts and add a regression test.",
  });

  assert.equal(
    await clarifyDraft(ctx, "fix it"),
    "fix it\n\nOnly modify src/auth.ts and add a regression test."
  );
  assert.equal(ctx.uiState.customOptionsHistory[0]?.at(-1), "Type something");
});

void test("lint catches vague unbounded drafts without calling a model", () => {
  const warnings = lintDraft("fix everything");
  assert.ok(warnings.some((warning) => warning.id === "unbounded-scope"));
});

void test("score parser accepts only a valid 1-5 response", () => {
  assert.deepEqual(
    parseScoreResponse(
      "<prompton-enhanced-prompt>Score: 4/5\nWeaknesses:\n- Missing verification\nSummary: Strong draft.</prompton-enhanced-prompt>"
    ),
    { score: 4, weaknesses: ["Missing verification"], summary: "Strong draft." }
  );

  assert.throws(
    () =>
      parseScoreResponse(
        "<prompton-enhanced-prompt>Score: 9/5\nWeaknesses:\n- None\nSummary: Bad.</prompton-enhanced-prompt>"
      ),
    /invalid score response/i
  );
  assert.throws(() => parseScoreResponse("not structured"), /invalid score response/i);
});
