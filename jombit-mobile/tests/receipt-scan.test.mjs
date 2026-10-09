import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { createReceiptApi, validateUpload, DEFAULT_MODEL } from "../server/receipt-api.mjs";
import { validateReceipt, receiptSchema } from "../server/receipt-schema.mjs";
import { receiptReviewError } from "../lib/receipt-review.ts";

const photo = { consent: true, mimeType: "image/jpeg", imageBase64: Buffer.from([255, 216, 255, 224, 0, 16, 1, 2, 255, 217]).toString("base64") };
const extracted = () => ({ isReceipt: true, merchant: "JomBit Test Cafe", date: "2026-10-02", currency: "MYR", items: [{ name: "Shared noodles", quantity: 2, lineTotalCents: 2400 }], taxCents: 144, serviceCents: 240, totalCents: 2784, warnings: [] });
const geminiReply = (receipt = extracted()) => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(receipt) }] } }] });

async function withApi(t, options = {}) {
  const api = createReceiptApi({ env: { GEMINI_API_KEY: "test-private-key", GEMINI_MODEL: DEFAULT_MODEL }, fetchImpl: async () => geminiReply(), ...options });
  const server = createServer((req, res) => { void api(req, res); });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const scan = (body = photo, origin = base) => fetch(`${base}/api/receipt/scan`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-JomBit-Scan": "1" }, body: JSON.stringify(body) });
  return { base, scan };
}

test("Gemini proxy sends image and schema, keeps key in a private header, returns normalized cents", async (t) => {
  let calls = 0;
  const { scan } = await withApi(t, { fetchImpl: async (url, request) => {
    calls++;
    assert.match(url, /generativelanguage\.googleapis\.com/);
    assert.ok(!url.includes("test-private-key"));
    assert.equal(request.headers["x-goog-api-key"], "test-private-key");
    const body = JSON.parse(request.body);
    assert.equal(body.contents[0].parts[1].inlineData.data, photo.imageBase64);
    assert.ok(body.systemInstruction.parts[0].text.includes("untrusted"));
    assert.deepEqual(body.generationConfig.responseFormat, { text: { mimeType: "APPLICATION_JSON", schema: receiptSchema } });
    assert.equal(body.generationConfig.responseJsonSchema, undefined);
    assert.equal(body.generationConfig.responseMimeType, undefined);
    return geminiReply();
  } });
  const response = await scan();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const text = await response.text();
  assert.ok(!text.includes("test-private-key"));
  const { receipt } = JSON.parse(text);
  assert.equal(receipt.items[0].unitCents, 1200);
  assert.equal(receipt.totalCents, 2784);
  assert.equal(calls, 1);
});

test("Missing key is explicit and never calls Gemini or substitutes samples", async (t) => {
  const { base, scan } = await withApi(t, { env: {}, fetchImpl: () => { throw new Error("Must not call"); } });
  assert.equal((await (await fetch(`${base}/api/receipt/status`)).json()).configured, false);
  const response = await scan();
  assert.equal(response.status, 503);
  assert.deepEqual(Object.keys(await response.json()), ["error"]);
});

test("Rejects cross-origin and file-origin requests before calling provider", async (t) => {
  const { scan } = await withApi(t, { fetchImpl: () => { throw new Error("Must not call"); } });
  assert.equal((await scan(photo, "https://unrelated.example")).status, 403);
  assert.equal((await scan(photo, "null")).status, 403);
});

test("Rejects missing consent, non-image data, unsupported MIME, and oversized payloads", () => {
  assert.throws(() => validateUpload({ ...photo, consent: false }), /Confirm/);
  assert.throws(() => validateUpload({ ...photo, imageBase64: Buffer.from("not an image").toString("base64") }), /invalid/);
  assert.throws(() => validateUpload({ ...photo, mimeType: "image/svg+xml" }), /supported/);
  assert.throws(() => validateUpload({ ...photo, imageBase64: "A".repeat(4 * 1024 * 1024 + 4) }), /supported/);
});

test("Enforces body size and method before any provider request", async (t) => {
  const { base } = await withApi(t);
  assert.equal((await fetch(`${base}/api/receipt/scan`)).status, 405);
  const tooBig = await fetch(`${base}/api/receipt/scan`, { method: "POST", headers: { Origin: base, "Content-Type": "application/json", "X-JomBit-Scan": "1" }, body: JSON.stringify({ data: "a".repeat(4 * 1024 * 1024 + 2048) }) });
  assert.equal(tooBig.status, 413);
});

test("Quota errors remain errors and do not retry or switch models", async (t) => {
  let calls = 0;
  const { scan } = await withApi(t, { fetchImpl: async () => { calls++; return Response.json({ error: "Private upstream details" }, { status: 429 }); } });
  const response = await scan();
  assert.equal(response.status, 429);
  const result = await response.json();
  assert.match(result.error, /quota/);
  assert.ok(!JSON.stringify(result).includes("Private upstream"));
  assert.equal(calls, 1);
});

test("Local daily cap stops further requests", async (t) => {
  const { scan } = await withApi(t, { env: { GEMINI_API_KEY: "test-key", JOMBIT_DAILY_SCAN_LIMIT: "1" } });
  assert.equal((await scan()).status, 200);
  assert.equal((await scan()).status, 429);
});

test("Provider timeouts return a recoverable error", async (t) => {
  const { scan } = await withApi(t, { timeoutMs: 15, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })) });
  const response = await scan();
  assert.equal(response.status, 504);
});

test("Cancelling a client scan aborts the provider request", { timeout: 3000 }, async (t) => {
  const started = Promise.withResolvers();
  const stopped = Promise.withResolvers();
  const { base } = await withApi(t, { fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => { stopped.resolve(); reject(signal.reason); }, { once: true });
    started.resolve();
  }) });
  const controller = new AbortController();
  const request = fetch(`${base}/api/receipt/scan`, { method: "POST", signal: controller.signal, headers: { Origin: base, "Content-Type": "application/json", "X-JomBit-Scan": "1" }, body: JSON.stringify(photo) });
  const rejection = assert.rejects(request, { name: "AbortError" });
  await started.promise;
  controller.abort();
  await rejection;
  await stopped.promise;
});

test("Concurrent scans are rejected while a provider request is running", { timeout: 3000 }, async (t) => {
  const started = Promise.withResolvers();
  const complete = Promise.withResolvers();
  const { scan } = await withApi(t, { fetchImpl: async () => { started.resolve(); await complete.promise; return geminiReply(); } });
  const first = scan();
  await started.promise;
  assert.equal((await scan()).status, 429);
  complete.resolve();
  assert.equal((await first).status, 200);
});

test("Rejects malformed or blocked Gemini replies", async (t) => {
  const bad = await withApi(t, { fetchImpl: async () => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "not JSON" }] } }] }) });
  assert.equal((await bad.scan()).status, 502);
  const blocked = await withApi(t, { fetchImpl: async () => Response.json({ candidates: [{ finishReason: "SAFETY" }] }) });
  assert.equal((await blocked.scan()).status, 422);
});

test("Rejects non-receipts, fractional cents and invalid quantities", () => {
  assert.throws(() => validateReceipt({ ...extracted(), isReceipt: false }), /readable receipt/);
  assert.throws(() => validateReceipt({ ...extracted(), totalCents: 5.2 }), /incomplete/);
  assert.throws(() => validateReceipt({ ...extracted(), items: [{ name: "Drink", quantity: 0, lineTotalCents: 100 }] }), /incomplete/);
});

test("Compact provider schema still enforces all receipt limits on the server", () => {
  for (const field of ["taxCents", "serviceCents", "totalCents"]) {
    for (const amount of [-1, 100_000_001]) {
      assert.throws(() => validateReceipt({ ...extracted(), [field]: amount }), /incomplete/);
    }
  }
  for (const item of [
    { name: "Tea", quantity: 1, lineTotalCents: -1 },
    { name: "Tea", quantity: 1, lineTotalCents: 100_000_001 },
    { name: "Tea", quantity: 10001, lineTotalCents: 100 },
  ]) {
    assert.throws(() => validateReceipt({ ...extracted(), items: [item] }), /incomplete/);
  }
  assert.throws(() => validateReceipt({ ...extracted(), items: Array(101).fill(extracted().items[0]) }), /incomplete/);
  assert.throws(() => validateReceipt({ ...extracted(), warnings: Array(11).fill("Check this") }), /incomplete/);
  assert.equal(validateReceipt({ ...extracted(), unexpectedField: "untrusted" }).unexpectedField, undefined);
});

test("Preserves exact line totals when quantity division would lose cents", () => {
  const result = validateReceipt({ ...extracted(), items: [{ name: "Shared dish", quantity: 3, lineTotalCents: 1000 }], taxCents: 0, serviceCents: 0, totalCents: 1000 });
  assert.equal(result.items[0].quantity, 1);
  assert.equal(result.items[0].unitCents, 1000);
  assert.match(result.items[0].name, /3 units/);
});

test("Unknown dates, currencies, money and mismatches remain visible for manual review", () => {
  const result = validateReceipt({ ...extracted(), date: "2026-02-30", currency: null, serviceCents: null, totalCents: 9999 });
  assert.equal(result.date, ""); assert.equal(result.currency, "");
  assert.equal(result.totalCents, 9999);
  assert.ok(result.warnings.length >= 4);
});

test("Review blocks mismatched totals/currency, unchecked AI data and invalid numbers", () => {
  const receipt = validateReceipt(extracted());
  const input = { ...receipt, aiScan: true, receiptCurrency: "MYR", groupCurrency: "MYR", printedTotalCents: 2784, reviewed: true };
  assert.equal(receiptReviewError(input), "");
  assert.match(receiptReviewError({ ...input, receiptCurrency: "SGD" }), /currency/);
  assert.match(receiptReviewError({ ...input, printedTotalCents: 999 }), /match/);
  assert.match(receiptReviewError({ ...input, printedTotalCents: null }), /printed/);
  assert.match(receiptReviewError({ ...input, reviewed: false }), /Confirm/);
  assert.match(receiptReviewError({ ...input, taxCents: NaN }), /tax/);
  assert.match(receiptReviewError({ ...input, items: [{ ...input.items[0], quantity: 1.1 }] }), /quantity/);
});
