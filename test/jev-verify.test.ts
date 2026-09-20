import test from "node:test";
import assert from "node:assert/strict";
import { verifyIntentPreserved, type JevVerifyOptions } from "../src/jev-verify.js";

function mockFetch(noul: number): JevVerifyOptions["fetch"] {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify({ answers: { dropped_intent: { noul } } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
}

const noCredential: JevVerifyOptions["readCredential"] = () => Promise.resolve(undefined);
const fakeCredential: JevVerifyOptions["readCredential"] = () => Promise.resolve("test-key");

void test("flags dropped intent when noul is at or above the threshold", async () => {
  const preserved = await verifyIntentPreserved("original", "rewritten", {
    fetch: mockFetch(0.75),
    readCredential: fakeCredential,
  });
  assert.equal(preserved, false);
});

void test("treats intent as preserved below the threshold", async () => {
  const preserved = await verifyIntentPreserved("original", "rewritten", {
    fetch: mockFetch(0.2),
    readCredential: fakeCredential,
  });
  assert.equal(preserved, true);
});

void test("fails open when no API key is available", async () => {
  const preserved = await verifyIntentPreserved("original", "rewritten", {
    readCredential: noCredential,
  });
  assert.equal(preserved, true);
});

void test("fails open on network error", async () => {
  const preserved = await verifyIntentPreserved("original", "rewritten", {
    fetch: () => Promise.reject(new Error("network down")),
    readCredential: fakeCredential,
  });
  assert.equal(preserved, true);
});

void test("fails open on malformed reply", async () => {
  const preserved = await verifyIntentPreserved("original", "rewritten", {
    fetch: () => Promise.resolve(new Response(JSON.stringify({ answers: {} }), { status: 200 })),
    readCredential: fakeCredential,
  });
  assert.equal(preserved, true);
});

void test("skips the call and returns true for an empty draft or rewrite", async () => {
  let called = false;
  const fetchFn: JevVerifyOptions["fetch"] = () => {
    called = true;
    return Promise.resolve(new Response("{}", { status: 200 }));
  };
  assert.equal(
    await verifyIntentPreserved("", "rewritten", {
      fetch: fetchFn,
      readCredential: fakeCredential,
    }),
    true
  );
  assert.equal(
    await verifyIntentPreserved("original", "  ", {
      fetch: fetchFn,
      readCredential: fakeCredential,
    }),
    true
  );
  assert.equal(called, false);
});
