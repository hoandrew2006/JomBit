import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { createCryptoMarketApi, parseMarketQuotes, MARKET_URL } from "../server/crypto-market.mjs";

const NOW = Date.parse("2026-10-05T08:00:00Z");
const feed = (now = NOW) => Object.fromEntries([["bitcoin", 400000], ["ethereum", 10000], ["solana", 600]].map(([coin, myr]) => [coin, { myr, myr_24h_change: -1.75, last_updated_at: now / 1000 - 10 }]));
async function withApi(t, options = {}) {
  const api = createCryptoMarketApi({ fetchImpl: async () => Response.json(feed()), now: () => NOW, ...options });
  const server = createServer((req, res) => { void api(req, res, () => { res.writeHead(404); res.end("Other route"); }); });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, get: (options) => fetch(`${base}/api/crypto/quotes`, options) };
}

test("Market proxy requests only fixed public MYR prices and returns timestamps and 24h changes", async (t) => {
  let calls = 0;
  const { get } = await withApi(t, { fetchImpl: async (url, request) => {
    calls++;
    assert.equal(url, MARKET_URL);
    assert.deepEqual(request.headers, { Accept: "application/json" });
    assert.equal(request.body, undefined);
    assert.equal(request.method, undefined);
    assert.ok(request.signal instanceof AbortSignal);
    return Response.json(feed());
  } });
  const response = await get();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.deepEqual(Object.keys(body.quotes), ["BTC", "ETH", "SOL"]);
  assert.deepEqual(body.quotes.BTC, { asset: "BTC", priceMyr: 400000, change24h: -1.75, updatedAt: new Date(NOW - 10000).toISOString(), source: "coingecko" });
  assert.equal(body.refreshAfterSeconds, 60);
  assert.equal(calls, 1);
});

test("Market response validates every price and timestamp; missing 24h change is not invented", () => {
  for (const myr of [0, -1, NaN, Infinity, "42", null, 1e10]) {
    const data = feed(); data.ethereum.myr = myr;
    assert.throws(() => parseMarketQuotes(data, NOW), /incomplete or outdated/);
  }
  for (const last_updated_at of [(NOW - 180001) / 1000, (NOW + 30001) / 1000, null, undefined, "invalid"]) {
    const data = feed(); data.bitcoin.last_updated_at = last_updated_at;
    assert.throws(() => parseMarketQuotes(data, NOW), /incomplete or outdated/);
  }
  const missing = feed(); delete missing.solana;
  assert.throws(() => parseMarketQuotes(missing, NOW), /incomplete or outdated/);
  const change = feed(); change.solana.myr_24h_change = null;
  assert.equal(parseMarketQuotes(change, NOW).SOL.change24h, null);
});

test("Provider responses are cached for 60 seconds and refreshed after expiry", async (t) => {
  let time = NOW, calls = 0;
  const { get } = await withApi(t, { now: () => time, fetchImpl: async () => { calls++; return Response.json(feed(time)); } });
  assert.equal((await get()).status, 200);
  time += 59000;
  assert.equal((await get()).status, 200);
  assert.equal(calls, 1);
  time += 1001;
  assert.equal((await get()).status, 200);
  assert.equal(calls, 2);
});

test("Concurrent refreshes share one provider request", { timeout: 3000 }, async (t) => {
  let calls = 0;
  const started = Promise.withResolvers();
  const release = Promise.withResolvers();
  const { get } = await withApi(t, { fetchImpl: async () => { calls++; started.resolve(); await release.promise; return Response.json(feed()); } });
  const first = get(); await started.promise;
  const second = get();
  release.resolve();
  assert.equal((await first).status, 200);
  assert.equal((await second).status, 200);
  assert.equal(calls, 1);
});

test("Failures return no prices, hide upstream details and back off before retrying", async (t) => {
  let calls = 0, time = NOW;
  const { get } = await withApi(t, { now: () => time, fetchImpl: async () => { calls++; return Response.json({ error: "private provider error" }, { status: 429 }); } });
  const response = await get();
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ["error"]);
  assert.match(body.error, /No demo price has been substituted/);
  assert.doesNotMatch(body.error, /private provider/);
  assert.equal((await get()).status, 503);
  assert.equal(calls, 1);
  time += 60001;
  assert.equal((await get()).status, 503);
  assert.equal(calls, 2);
});

test("An expired successful quote is never reused as live after an upstream failure", async (t) => {
  let time = NOW, calls = 0;
  const { get } = await withApi(t, { now: () => time, fetchImpl: async () => ++calls === 1 ? Response.json(feed()) : Response.json({}, { status: 503 }) });
  assert.equal((await get()).status, 200);
  time += 180001;
  const response = await get();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).quotes, undefined);
});

test("Malformed responses and provider timeouts fail explicitly", async (t) => {
  const malformed = await withApi(t, { fetchImpl: async () => Response.json({ bitcoin: { myr: 1 } }) });
  assert.equal((await malformed.get()).status, 503);
  const timeout = await withApi(t, { timeoutMs: 15, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })) });
  assert.equal((await timeout.get()).status, 503);
});

test("Only loopback same-origin GET quotes are accepted; unrelated routes pass through", async (t) => {
  let calls = 0;
  const { get, base } = await withApi(t, { fetchImpl: async () => { calls++; return Response.json(feed()); } });
  assert.equal((await get({ method: "POST" })).status, 405);
  assert.equal((await get({ headers: { Origin: "https://unrelated.example" } })).status, 403);
  assert.equal((await get({ headers: { Origin: "null" } })).status, 403);
  assert.equal((await get({ headers: { "X-Forwarded-For": "127.0.0.1" } })).status, 403);
  assert.equal((await fetch(`${base}/api/crypto/trade`)).status, 404);
  assert.equal(await (await fetch(`${base}/unrelated`)).text(), "Other route");
  assert.equal(calls, 0);
  assert.equal((await get({ headers: { Origin: base } })).status, 200);
});
