export const MARKET_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=myr&include_24hr_change=true&include_last_updated_at=true";
const COINS = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana" };
const MAX_AGE = 180000;

export function parseMarketQuotes(data, now = Date.now()) {
  return Object.fromEntries(Object.entries(COINS).map(([asset, id]) => {
    const coin = data?.[id];
    const updated = coin?.last_updated_at * 1000;
    if (!coin || !Number.isFinite(coin.myr) || coin.myr <= 0 || coin.myr > 1e9 || !Number.isFinite(updated) || now - updated > MAX_AGE || updated - now > 30000) throw new Error("The price provider returned incomplete or outdated quotes.");
    return [asset, { asset, priceMyr: coin.myr, change24h: Number.isFinite(coin.myr_24h_change) ? coin.myr_24h_change : null, updatedAt: new Date(updated).toISOString(), source: "coingecko" }];
  }));
}

export function createCryptoMarketApi({ fetchImpl = fetch, now = Date.now, timeoutMs = 10000 } = {}) {
  let cached;
  let fetchedAt = 0;
  let retryAt = 0;
  let pending;
  const reply = (res, status, payload) => { if (res.destroyed || res.writableEnded) return; res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(JSON.stringify(payload)); };
  return async function cryptoMarketApi(req, res, next) {
    const path = (req.url ?? "").split("?")[0];
    if (!path.startsWith("/api/crypto/")) return next();
    if (path !== "/api/crypto/quotes") return reply(res, 404, { error: "Not found." });
    if (req.method !== "GET") return reply(res, 405, { error: "Use GET for market quotes." });
    const host = req.headers.host ?? "";
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) || !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress) || req.headers["x-forwarded-for"] || (req.headers.origin && !["http://" + host, "https://" + host].includes(req.headers.origin))) return reply(res, 403, { error: "Open market quotes from the local JomBit app." });
    if (cached && now() - fetchedAt < 60000 && Object.values(cached).every((q) => now() - Date.parse(q.updatedAt) <= MAX_AGE)) return reply(res, 200, { quotes: cached, fetchedAt: new Date(fetchedAt).toISOString(), refreshAfterSeconds: 60 });
    if (now() < retryAt) return reply(res, 503, { error: "Market prices are temporarily unavailable. Wait a minute before refreshing, or explicitly switch to demo prices." });
    try {
      if (!pending) pending = (async () => {
        const response = await fetchImpl(MARKET_URL, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) throw new Error("Market provider unavailable.");
        const data = await response.json();
        cached = parseMarketQuotes(data, now());
        fetchedAt = now();
        return { quotes: cached, fetchedAt: new Date(fetchedAt).toISOString(), refreshAfterSeconds: 60 };
      })().finally(() => { pending = undefined; });
      return reply(res, 200, await pending);
    } catch {
      retryAt = now() + 60000;
      return reply(res, 503, { error: "Live prices are unavailable or outdated. No demo price has been substituted. Wait a minute and retry, or choose Demo prices." });
    }
  };
}
