import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { createReceiptApi } from "../server/receipt-api.mjs";
import { hostedScanConfigured } from "../server/hosted-scan-guard.mjs";

const env = {
  GEMINI_API_KEY: "test-provider-secret", JOMBIT_APP_ORIGIN: "https://jom-bit-6667.vercel.app",
};
const photo = { consent: true, mimeType: "image/jpeg", imageBase64: Buffer.from([255, 216, 255, 224, 1]).toString("base64") };
const extracted = { isReceipt: true, merchant: "Test cafe", date: "2026-10-09", currency: "MYR", items: [{ name: "Tea", quantity: 1, lineTotalCents: 500 }], taxCents: 0, serviceCents: 0, totalCents: 500, warnings: [] };
async function setup(t, options = {}, parsedBody = false) {
  let providerCalls = 0;
  const api = createReceiptApi({ hosted: true, env,
    fetchImpl: async () => { providerCalls++; return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(extracted) }] } }] }); }, ...options });
  const server = createServer(async (req, res) => {
    if (parsedBody && req.method === "POST") { const chunks = []; for await (const chunk of req) chunks.push(chunk); req.body = JSON.parse(Buffer.concat(chunks).toString()); }
    await api(req, res);
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const scan = (headers = {}, body = photo) => fetch(`${base}/api/receipt/scan`, { method: "POST", headers: {
    "Content-Type": "application/json", Origin: env.JOMBIT_APP_ORIGIN, "X-JomBit-Scan": "1",
    ...headers,
  }, body: JSON.stringify(body) });
  return { scan, base, calls: () => providerCalls };
}

test("Hosted scanning handles Vercel-parsed JSON and keeps secrets server-side", async (t) => {
  const { scan, base, calls } = await setup(t, {}, true);
  const status = await (await fetch(`${base}/api/receipt/status`)).json();
  assert.deepEqual(status, { configured: true, accessRequired: false });
  const response = await scan();
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.equal(JSON.parse(text).receipt.totalCents, 500);
  assert.ok(!text.includes(env.GEMINI_API_KEY));
  assert.equal(calls(), 1);
});

test("Hosted scanner accepts same-origin requests and denies cross/null origins", async (t) => {
  const { scan, calls } = await setup(t);
  assert.equal((await scan()).status, 200);
  assert.equal((await scan({ Origin: "https://other.example" })).status, 403);
  assert.equal((await scan({ Origin: "null" })).status, 403);
  assert.equal((await scan({ "X-JomBit-Scan": "" })).status, 403);
  assert.equal(calls(), 1);
});

test("Hosted configuration fails closed without all safeguards", async (t) => {
  for (const key of Object.keys(env)) {
    const { scan, base, calls } = await setup(t, { env: { ...env, [key]: "" } });
    assert.equal((await (await fetch(`${base}/api/receipt/status`)).json()).configured, false);
    assert.equal((await scan()).status, 503);
    assert.equal(calls(), 0);
  }
  assert.equal(hostedScanConfigured({ ...env, JOMBIT_APP_ORIGIN: "http://example.com" }), false);
});

test("Consent and upload validation run before contacting Gemini", async (t) => {
  const { scan, calls } = await setup(t);
  assert.equal((await scan({}, { ...photo, consent: false })).status, 400);
  assert.equal((await scan({}, { ...photo, imageBase64: "invalid" })).status, 400);
  assert.equal(calls(), 0);
});

test("Provider failure stays a failure, with no sample data or secret error details", async (t) => {
  const { scan } = await setup(t, { fetchImpl: async () => Response.json({ error: "private provider details" }, { status: 403 }) });
  const response = await scan();
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ["error"]);
  assert.doesNotMatch(body.error, /Gemini|private|key/);
});
