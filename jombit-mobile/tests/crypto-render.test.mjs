import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

test("Crypto screen shows only account-created wallet and staking history", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const server = await createServer({
    configFile: false, envFile: false, root, cacheDir: "node_modules/.vite-test-crypto",
    resolve: { alias: [
      { find: "@/lib/state", replacement: "virtual:jombit-crypto-state" },
      { find: "@/lib/crypto-market", replacement: "virtual:jombit-crypto-market" },
      { find: "@", replacement: root },
    ] },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [react(), {
      name: "isolated-crypto-render-fixtures",
      resolveId(id) { if (id.startsWith("virtual:jombit-crypto-")) return `\0${id}`; },
      load(id) {
        if (id === "\0virtual:jombit-crypto-state") return `import { createSeedState } from '/lib/seed.ts'; export const fixture = { state: createSeedState() }; export function useAppState() { return { state: fixture.state, stakeCrypto() { throw new Error('Rendering must not execute orders'); }, receiveCrypto() { throw new Error('Rendering must not execute transfers'); } }; }`;
        if (id === "\0virtual:jombit-crypto-market") return `import { DEMO_CRYPTO_PRICES_MYR } from '/lib/mock-services.ts'; export const market = { fresh: true, loading: false, error: '', now: Date.now(), quotes: Object.fromEntries(Object.entries(DEMO_CRYPTO_PRICES_MYR).map(([asset, priceMyr]) => [asset, { asset, priceMyr, source: 'coingecko', updatedAt: new Date().toISOString(), change24h: null }])), refresh() {} }; export function useCryptoMarket() { return market; }`;
      },
    }],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom",
  });
  try {
    const { CryptoDesk } = await server.ssrLoadModule("/app/components/CryptoDesk.tsx");
    const { fixture } = await server.ssrLoadModule("virtual:jombit-crypto-state");
    const { market } = await server.ssrLoadModule("virtual:jombit-crypto-market");
    const { supportsLiveCryptoPrices } = await server.ssrLoadModule("/lib/crypto-market.ts");
    for (const hostname of ["localhost", "127.0.0.1", "[::1]"]) assert.equal(supportsLiveCryptoPrices({ protocol: "http:", hostname }), true);
    assert.equal(supportsLiveCryptoPrices({ protocol: "https:", hostname: "jom-bit-6667.vercel.app" }), true);
    for (const location of [{ protocol: "file:", hostname: "" }, { protocol: "about:", hostname: "" }, { protocol: "http:", hostname: "static.example" }]) assert.equal(supportsLiveCryptoPrices(location), false, "Offline and insecure non-local hosts cannot request live prices");
    const render = (visible = true) => renderToStaticMarkup(createElement(CryptoDesk, { balancesVisible: visible }));
    let html = render();
    for (const content of ["CRYPTO PORTFOLIO", "Available balance", "Currently staked", "Average purchase price", "First purchase", "Latest purchase", "Unrealized profit / loss", "Crypto activity", "No crypto activity yet", "Crypto wallet preview only", "Receive ETH", "Transfer ETH", "Stake ETH", "Unstake ETH", "Holding value", "Luno integration is planned, not connected", "BTC", "Hold only", "Cardano", "Cosmos", "Avalanche", "Polkadot", "NEAR Protocol"]) assert.ok(html.includes(content), content);
    for (const asset of ["btc", "eth", "sol", "ada", "atom", "avax", "dot", "near"]) assert.match(html, new RegExp(`asset-${asset}[^>]*><svg`), `${asset.toUpperCase()} uses its asset symbol`);
    assert.equal([...html.matchAll(/class="crypto-order"/g)].length, 0);
    assert.match(html, /aria-pressed="true"/);
    assert.doesNotMatch(html, />\s*(Buy|Sell) (BTC|ETH|SOL)|MYR to spend|Buy &amp; sell|MYR available to practise/);
    assert.doesNotMatch(html, /Sample prices|Static sample prices|Demo prices/);
    assert.doesNotMatch(html, /NaN|Infinity|\bundefined\b|\bWEY\b/);
    const hidden = render(false);
    assert.match(hidden, /••••••/);
    assert.doesNotMatch(hidden, /0\.00182 BTC/);
    assert.match(hidden, /RM14,250\.00/, "The selected asset's public unit price stays visible");

    fixture.state.crypto.ETH.costBasisCents = null;
    fixture.state.crypto.ETH.firstBoughtAt = null;
    fixture.state.crypto.ETH.lastBoughtAt = null;
    fixture.state.walletTransactions.unshift(
      { id: "legacy", kind: "crypto-buy", title: "Old purchase", date: "2026-09-30T00:00:00Z", direction: "out", amountCents: 3000, currency: "MYR" },
      { id: "seeded", kind: "stake", title: "Shared starting activity", date: "2026-09-30T01:00:00Z", direction: "neutral", crypto: { asset: "ETH", quantity: 0.01, feeCents: 0, priceMyr: null, priceSource: null, priceUpdatedAt: null, seeded: true } },
      { id: "received", kind: "crypto-receive", title: "Received ETH", date: "2026-10-01T01:00:00Z", direction: "in", crypto: { asset: "ETH", quantity: 0.02, feeCents: 0, priceMyr: null, priceSource: null, priceUpdatedAt: null } },
      { id: "sent", kind: "crypto-transfer", title: "Transferred ETH", date: "2026-10-02T01:00:00Z", direction: "out", crypto: { asset: "ETH", quantity: 0.01, recipient: "Travel wallet", feeCents: 0, priceMyr: null, priceSource: null, priceUpdatedAt: null } },
      { id: "staked", kind: "stake", title: "Staked ETH", date: "2026-10-03T01:00:00Z", direction: "neutral", crypto: { asset: "ETH", quantity: 0.01, feeCents: 0, priceMyr: null, priceSource: null, priceUpdatedAt: null } },
    );
    html = render();
    assert.match(html, /History incomplete/);
    assert.match(html, /Purchase cost is incomplete/);
    assert.equal([...html.matchAll(/class="crypto-order"/g)].length, 3);
    assert.match(html, /Received ETH/);
    assert.match(html, /Transferred ETH/);
    assert.match(html, /Staked ETH/);
    assert.doesNotMatch(html, /Old purchase|Shared starting activity|Earlier record/);

    market.fresh = false;
    market.quotes = null;
    market.error = "The price feed is unavailable.";
    html = render();
    assert.match(html, /Live prices unavailable/);
    assert.match(html, /The price feed is unavailable/);
    const stakeButton = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find((match) => match[2].includes("Stake ETH"));
    assert.ok(stakeButton, "Staking control stays available without a price feed");
    assert.doesNotMatch(stakeButton[1], /disabled/);
    assert.doesNotMatch(html, /NaN|Infinity|\bundefined\b/);

    market.quotes = Object.fromEntries(["BTC", "ETH", "SOL", "ADA", "ATOM", "AVAX", "DOT", "NEAR"].map((asset) => [asset, { asset, priceMyr: 100, source: "coingecko", updatedAt: new Date().toISOString(), change24h: -1.5 }]));
    assert.match(render(), /Last known prices · stale/);
    market.fresh = true; market.error = "";
    html = render();
    assert.match(html, /Live reference prices/);
    assert.match(html, /Data provided by CoinGecko/);
    assert.doesNotMatch(html, /-1\.50%/, "Asset rows show holding value instead of repeating the 24-hour market change");
    assert.match(html, /Live reference price[\s\S]*RM100\.00/, "The selected asset still shows its unit price");
    assert.match(html, /Provider updated/);
    assert.match(html, /refreshed every 60s/);
  } finally { await server.close(); }
});
