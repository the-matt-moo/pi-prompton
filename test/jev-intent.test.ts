import test from "node:test";
import assert from "node:assert/strict";
import { detectTaskIntentSmart, type JevIntentOptions } from "../src/jev-intent.js";

// ---------- helpers ----------

function mockFetch(choice: string, confidence: number): JevIntentOptions["fetch"] {
  return (_url, _init) =>
    Promise.resolve(
      new Response(JSON.stringify({ answers: { intent: { choice, confidence } } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
}

function failingFetch(): JevIntentOptions["fetch"] {
  return () => Promise.resolve(new Response("server error", { status: 500 }));
}

function throwingFetch(): JevIntentOptions["fetch"] {
  return () => Promise.reject(new Error("network down"));
}

const noCredential: JevIntentOptions["readCredential"] = () => Promise.resolve(undefined);
const fakeCredential: JevIntentOptions["readCredential"] = () => Promise.resolve("test-key");

// ---------- Jev happy path ----------

void test("returns Jev choice when API responds with high confidence", async () => {
  const result = await detectTaskIntentSmart("Fix the login bug", {
    fetch: mockFetch("debug", 0.92),
    readCredential: fakeCredential,
  });
  assert.equal(result.intent, "debug");
  assert.equal(result.source, "jev");
  assert.equal(result.confidence, 0.92);
});

void test("returns Jev choice for implement intent", async () => {
  const result = await detectTaskIntentSmart("Add dark mode support to the settings page", {
    fetch: mockFetch("implement", 0.85),
    readCredential: fakeCredential,
  });
  assert.equal(result.intent, "implement");
  assert.equal(result.source, "jev");
});

void test("returns Jev choice for research intent", async () => {
  const result = await detectTaskIntentSmart("Compare React vs Vue for this project", {
    fetch: mockFetch("research", 0.78),
    readCredential: fakeCredential,
  });
  assert.equal(result.intent, "research");
  assert.equal(result.source, "jev");
});

// ---------- fallback to regex ----------

void test("falls back to regex when no API key is available", async () => {
  const result = await detectTaskIntentSmart("Fix the crash on startup", {
    readCredential: noCredential,
  });
  assert.equal(result.intent, "debug");
  assert.equal(result.source, "regex");
  assert.equal(result.confidence, undefined);
});

void test("falls back to regex when API returns 500", async () => {
  const result = await detectTaskIntentSmart("Refactor the parser module", {
    fetch: failingFetch(),
    readCredential: fakeCredential,
  });
  assert.equal(result.intent, "refactor");
  assert.equal(result.source, "regex");
});

void test("falls back to regex on network error", async () => {
  const result = await detectTaskIntentSmart("Review the auth implementation", {
    fetch: throwingFetch(),
    readCredential: fakeCredential,
  });
  assert.equal(result.intent, "review");
  assert.equal(result.source, "regex");
});

void test("falls back to regex when Jev confidence is below threshold", async () => {
  const result = await detectTaskIntentSmart("Do the thing with the code", {
    fetch: mockFetch("implement", 0.2),
    readCredential: fakeCredential,
    confidenceThreshold: 0.4,
  });
  // Low confidence → regex fallback, which returns "general" for vague drafts
  assert.equal(result.source, "regex");
});

void test("falls back to regex when Jev returns unknown intent label", async () => {
  const result = await detectTaskIntentSmart("Fix the tests", {
    fetch: mockFetch("banana", 0.99),
    readCredential: fakeCredential,
  });
  assert.equal(result.source, "regex");
});

// ---------- edge cases ----------

void test("returns general for empty draft", async () => {
  const result = await detectTaskIntentSmart("", {
    fetch: mockFetch("implement", 0.99),
    readCredential: fakeCredential,
  });
  assert.equal(result.intent, "general");
  assert.equal(result.source, "regex");
});

void test("truncates very long drafts to 2000 chars for Jev", async () => {
  let capturedBody = "";
  const captureFetch: JevIntentOptions["fetch"] = (_url, init) => {
    capturedBody = typeof init?.body === "string" ? init.body : "";
    return Promise.resolve(
      new Response(
        JSON.stringify({ answers: { intent: { choice: "implement", confidence: 0.8 } } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
  };

  const longDraft = "a".repeat(5000);
  await detectTaskIntentSmart(longDraft, {
    fetch: captureFetch,
    readCredential: fakeCredential,
  });

  const parsed = JSON.parse(capturedBody) as { state: string };
  assert.equal(parsed.state.length, 2000);
});

void test("explicit apiKey bypasses credential reader", async () => {
  let credentialCalled = false;
  const result = await detectTaskIntentSmart("Explain how hooks work", {
    apiKey: "direct-key",
    fetch: mockFetch("explain", 0.88),
    readCredential: () => {
      credentialCalled = true;
      return Promise.resolve("should-not-be-used");
    },
  });
  assert.equal(result.intent, "explain");
  assert.equal(result.source, "jev");
  assert.equal(credentialCalled, false);
});
