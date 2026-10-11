import assert from "node:assert/strict";
import test from "node:test";
import { createServer, request } from "node:http";
import { once } from "node:events";
import { createFxRatesApi, parseFxRates, FX_URL } from "../server/fx-rates.mjs";
import { parseFxRatesResponse } from "../lib/fx-rates.ts";

const NOW = Date.parse("2026-10-10T08:00:00Z");
const HOUR = 60 * 60 * 1000;
const feed = (patch = {}) => ({ result: "success", base_code: "MYR", time_last_update_unix: (NOW - 2 * HOUR) / 1000, rates: { MYR: 1, SGD: 0.3047, THB: 7.71, IDR: 3801.5, USD: 0.2367 }, ...patch });
async function withApi(t, options = {}) {
  const api = createFxRatesApi({ fetchImpl: async () => Response.json(feed()), now: () => NOW, ...options });
  const server = createServer((req, res) => { void api(req, res, () => { res.writeHead(404); res.end("Other route"); }); });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, get: (headers = {}) => fetch(`${base}/api/fx/rates`, { headers }) };
}

test("Rates route requests the fixed MYR feed and returns MYR value per currency with the provider time", async (t) => {
  let calls = 0;
  const { get } = await withApi(t, { fetchImpl: async (url, request) => {
    calls++;
    assert.equal(url, FX_URL);
    assert.deepEqual(request.headers, { Accept: "application/json", "User-Agent": "JomBit/1.0" });
    assert.ok(request.signal instanceof AbortSignal);
    return Response.json(feed());
  } });
  const response = await get();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const { rates } = await response.json();
  assert.equal(rates.source, "live");
  assert.equal(rates.updatedAt, new Date(NOW - 2 * HOUR).toISOString());
  assert.deepEqual(Object.keys(rates.inMyr), ["MYR", "SGD", "THB", "IDR"]);
  assert.equal(rates.inMyr.MYR, 1);
  assert.equal(rates.inMyr.SGD, 1 / 0.3047);
  assert.equal(rates.inMyr.IDR, 1 / 3801.5);
  assert.equal(calls, 1);
});

test("Provider data is validated: wrong base, failure, missing/implausible rates and stale times are rejected", () => {
  assert.equal(parseFxRates(feed(), NOW).source, "live");
  for (const patch of [{ result: "error" }, { base_code: "USD" }, { time_last_update_unix: null }, { time_last_update_unix: (NOW - 5 * 24 * HOUR) / 1000 }, { time_last_update_unix: (NOW + HOUR) / 1000 }]) {
    assert.throws(() => parseFxRates(feed(patch), NOW), /incomplete or outdated/);
  }
  for (const value of [undefined, null, 0, -1, NaN, Infinity, "0.3", 0.05, 2]) {
    const data = feed(); data.rates.SGD = value;
    assert.throws(() => parseFxRates(data, NOW), /implausible/);
  }
  assert.throws(() => parseFxRates(null, NOW));
});

test("Rates are cached for an hour, then refreshed", async (t) => {
  let time = NOW, calls = 0;
  const { get } = await withApi(t, { now: () => time, fetchImpl: async () => { calls++; return Response.json(feed()); } });
  assert.equal((await get()).status, 200);
  time += HOUR - 1000;
  assert.equal((await get()).status, 200);
  assert.equal(calls, 1);
  time += 2000;
  assert.equal((await get()).status, 200);
  assert.equal(calls, 2);
});

test("When the provider fails, recent rates are kept; with none, the route reports 503 and backs off", async (t) => {
  let time = NOW, calls = 0, fail = false;
  const { get } = await withApi(t, { now: () => time, fetchImpl: async () => { calls++; if (fail) throw new Error("offline"); return Response.json(feed()); } });
  assert.equal((await get()).status, 200);
  fail = true; time += HOUR + 1;
  const stale = await get();
  assert.equal(stale.status, 200);
  assert.equal((await stale.json()).rates.source, "live");
  assert.equal(calls, 2);
  time += 60000;
  assert.equal((await get()).status, 200);
  assert.equal(calls, 2, "No provider retry during the back-off window");

  const empty = await withApi(t, { fetchImpl: async () => new Response("down", { status: 500 }) });
  const response = await empty.get();
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Static demo rates/);
});

test("Local route is loopback-only, GET-only and same-origin; other paths pass through", async (t) => {
  const { base, get } = await withApi(t);
  assert.equal((await get({ Origin: "https://evil.example" })).status, 403);
  assert.equal((await get({ "X-Forwarded-For": "203.0.113.1" })).status, 403);
  assert.equal((await fetch(`${base}/api/fx/rates`, { method: "POST" })).status, 405);
  assert.equal((await fetch(`${base}/api/fx/other`)).status, 404);
  assert.equal(await (await fetch(`${base}/somewhere`)).text(), "Other route");
});

test("Hosted route works on any deployment for same-site requests, refuses cross-site ones and is CDN-cacheable", async (t) => {
  const call = async (headers, env = {}) => {
    const api = createFxRatesApi({ hosted: true, env, now: () => NOW, fetchImpl: async () => Response.json(feed()) });
    const server = createServer((req, res) => { void api(req, res, () => {}); });
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    t.after(() => { server.closeAllConnections(); server.close(); });
    // fetch() cannot set Host, so use http.request to mimic a Vercel deployment's hostname.
    return new Promise((resolve, reject) => {
      request({ host: "127.0.0.1", port: server.address().port, path: "/api/fx/rates", headers: { "X-Forwarded-For": "203.0.113.1", ...headers } }, (res) => {
        res.resume(); res.on("end", () => resolve({ status: res.statusCode, headers: { get: (name) => res.headers[name] } }));
      }).on("error", reject).end();
    });
  };
  const preview = await call({ Host: "jombit-git-branch.vercel.app" });
  assert.equal(preview.status, 200, "Same-site GETs carry no Origin header");
  assert.match(preview.headers.get("cache-control"), /s-maxage=3600/);
  assert.equal((await call({ Host: "jombit-git-branch.vercel.app", Origin: "https://jombit-git-branch.vercel.app" })).status, 200);
  assert.equal((await call({ Host: "x.vercel.app", Origin: "https://jom-bit-6667.vercel.app" }, { JOMBIT_APP_ORIGIN: "https://jom-bit-6667.vercel.app" })).status, 200);
  assert.equal((await call({ Host: "jom-bit-6667.vercel.app", Origin: "https://evil.example" })).status, 403);
});

test("Browser accepts only complete live rates from the server", () => {
  const rates = parseFxRates(feed(), NOW);
  assert.deepEqual(parseFxRatesResponse({ rates }), rates);
  assert.throws(() => parseFxRatesResponse({}), /invalid/);
  assert.throws(() => parseFxRatesResponse({ rates: { ...rates, source: "demo" } }), /invalid/);
  assert.throws(() => parseFxRatesResponse({ rates: { ...rates, updatedAt: null } }), /invalid/);
  assert.throws(() => parseFxRatesResponse({ rates: { ...rates, inMyr: { ...rates.inMyr, THB: 99 } } }), /invalid/);
});
