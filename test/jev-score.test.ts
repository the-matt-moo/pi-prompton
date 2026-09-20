import test from "node:test";
import assert from "node:assert/strict";
import { scoreDraftWithJev, type JevScoreOptions } from "../src/jev-score.js";

function mockFetch(score: number, confidence: number): JevScoreOptions["fetch"] {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify({ answers: { quality: { score, confidence } } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
}

const noCredential: JevScoreOptions["readCredential"] = () => Promise.resolve(undefined);
const fakeCredential: JevScoreOptions["readCredential"] = () => Promise.resolve("test-key");

void test("maps Jev's 0-4 score scale to a 1-5 rating", async () => {
  const result = await scoreDraftWithJev("Fix the login bug in src/auth.ts", {
    fetch: mockFetch(3.2, 0.7),
    readCredential: fakeCredential,
  });
  assert.deepEqual(result, { score: 4, confidence: 0.7 });
});

void test("clamps out-of-range scores into 1-5", async () => {
  const result = await scoreDraftWithJev("draft", {
    fetch: mockFetch(-0.2, 0.9),
    readCredential: fakeCredential,
  });
  assert.equal(result?.score, 1);
});

void test("falls back to undefined when no API key is available", async () => {
  const result = await scoreDraftWithJev("draft", { readCredential: noCredential });
  assert.equal(result, undefined);
});

void test("falls back to undefined on a non-2xx response", async () => {
  const result = await scoreDraftWithJev("draft", {
    fetch: () => Promise.resolve(new Response("error", { status: 500 })),
    readCredential: fakeCredential,
  });
  assert.equal(result, undefined);
});

void test("falls back to undefined on network error", async () => {
  const result = await scoreDraftWithJev("draft", {
    fetch: () => Promise.reject(new Error("network down")),
    readCredential: fakeCredential,
  });
  assert.equal(result, undefined);
});

void test("returns undefined for an empty draft without calling Jev", async () => {
  let called = false;
  const result = await scoreDraftWithJev("   ", {
    fetch: () => {
      called = true;
      return Promise.resolve(new Response("{}", { status: 200 }));
    },
    readCredential: fakeCredential,
  });
  assert.equal(result, undefined);
  assert.equal(called, false);
});
