// Free, keyless ExchangeRate-API "open access" feed. Its terms require visible attribution in the app.
export const FX_URL = "https://open.er-api.com/v6/latest/MYR";
export const FOREIGN = ["SGD", "THB", "IDR"];
// Reference values (foreign units per MYR) used only to reject obviously corrupt provider data.
const REFERENCE_PER_MYR = { SGD: 1 / 3.46, THB: 1 / 0.129, IDR: 1 / 0.000279 };
const CACHE_MS = 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;
const MAX_AGE_MS = 4 * 24 * 60 * 60 * 1000;
const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;
const LOOPBACK_ADDRESSES = ["127.0.0.1", "::1", "::ffff:127.0.0.1"];

export function parseFxRates(data, now = Date.now()) {
  const updated = data?.time_last_update_unix * 1000;
  if (data?.result !== "success" || data.base_code !== "MYR" || !Number.isFinite(updated) || now - updated > MAX_AGE_MS || updated - now > 10 * 60 * 1000) throw new Error("The exchange-rate provider returned incomplete or outdated rates.");
  const inMyr = { MYR: 1 };
  for (const code of FOREIGN) {
    const perMyr = data.rates?.[code];
    const reference = REFERENCE_PER_MYR[code];
    if (!Number.isFinite(perMyr) || perMyr < reference / 3 || perMyr > reference * 3) throw new Error("The exchange-rate provider returned an implausible rate.");
    inMyr[code] = 1 / perMyr;
  }
  return { inMyr, source: "live", updatedAt: new Date(updated).toISOString() };
}

export function createFxRatesApi({ fetchImpl = fetch, now = Date.now, timeoutMs = 10000, hosted = false, env = process.env } = {}) {
  let cached;
  let fetchedAt = 0;
  let retryAt = 0;
  let pending;
  const reply = (res, status, payload) => {
    if (res.destroyed || res.writableEnded) return;
    // Hosted: let Vercel's CDN share one provider response for about an hour.
    const cache = hosted && status === 200 ? "public, max-age=300, s-maxage=3600, stale-while-revalidate=600" : "no-store";
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache, "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(payload));
  };
  const usable = (rates) => rates && now() - Date.parse(rates.updatedAt) <= MAX_AGE_MS;
  return async function fxRatesApi(req, res, next) {
    const path = (req.url ?? "").split("?")[0];
    if (!path.startsWith("/api/fx/")) return next();
    if (path !== "/api/fx/rates") return reply(res, 404, { error: "Not found." });
    if (req.method !== "GET") return reply(res, 405, { error: "Use GET for exchange rates." });
    const host = req.headers.host ?? "";
    const origin = req.headers.origin;
    if (hosted) {
      // Public, keyless data: allow same-site requests from any deployment (production or preview),
      // and the configured production origin. Cross-site browser requests are refused.
      const allowed = [`https://${host}`];
      try { allowed.push(new URL(env.JOMBIT_APP_ORIGIN).origin); } catch { /* Optional for this route. */ }
      if (origin && !allowed.includes(origin)) return reply(res, 403, { error: "Open exchange rates from the JomBit app." });
    } else if (!LOOPBACK_HOST.test(host) || !LOOPBACK_ADDRESSES.includes(req.socket.remoteAddress) || req.headers["x-forwarded-for"] || (origin && !["http://" + host, "https://" + host].includes(origin))) {
      return reply(res, 403, { error: "Open exchange rates from the local JomBit app." });
    }
    const body = () => ({ rates: cached, fetchedAt: new Date(fetchedAt).toISOString() });
    if (cached && now() - fetchedAt < CACHE_MS) return reply(res, 200, body());
    // After a failure, wait before contacting the provider again; keep serving recent rates meanwhile.
    if (now() < retryAt) return usable(cached) ? reply(res, 200, body()) : reply(res, 503, { error: "Live exchange rates are temporarily unavailable." });
    try {
      if (!pending) pending = (async () => {
        const response = await fetchImpl(FX_URL, { headers: { Accept: "application/json", "User-Agent": "JomBit/1.0" }, signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) throw new Error("Exchange-rate provider unavailable.");
        cached = parseFxRates(await response.json(), now());
        fetchedAt = now();
      })().finally(() => { pending = undefined; });
      await pending;
      return reply(res, 200, body());
    } catch {
      retryAt = now() + RETRY_MS;
      return usable(cached) ? reply(res, 200, body()) : reply(res, 503, { error: "Live exchange rates are unavailable. Static demo rates are shown instead." });
    }
  };
}
