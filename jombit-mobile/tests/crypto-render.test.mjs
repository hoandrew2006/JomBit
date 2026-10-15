import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

test("Crypto screen renders history, price states, privacy and incomplete legacy holdings", async () => {
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
        if (id === "\0virtual:jombit-crypto-state") return `import { createSeedState } from '/lib/seed.ts'; export const fixture = { state: createSeedState() }; export function useAppState() { return { state: fixture.state, stakeCrypto() { throw new Error('Rendering must not execute orders'); } }; }`;
        if (id === "\0virtual:jombit-crypto-market") return `import { DEMO_CRYPTO_PRICES_MYR } from '/lib/mock-services.ts'; export const market = { mode: 'demo', fresh: true, loading: false, error: '', now: Date.now(), quotes: Object.fromEntries(Object.entries(DEMO_CRYPTO_PRICES_MYR).map(([asset, priceMyr]) => [asset, { asset, priceMyr, source: 'demo', updatedAt: null, change24h: null }])), setMode() {}, refresh() {} }; export function useCryptoMarket() { return market; }`;
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
    for (const location of [{ protocol: "file:", hostname: "" }, { protocol: "about:", hostname: "" }, { protocol: "http:", hostname: "static.example" }]) assert.equal(supportsLiveCryptoPrices(location), false, "Offline and insecure non-local hosts must default to labelled demo prices");
    const render = (visible = true) => renderToStaticMarkup(createElement(CryptoDesk, { balancesVisible: visible }));
    let html = render();
    for (const content of ["LINKED LUNO ACCOUNT · DEMO", "Your crypto stays in your Luno account.", "HELD IN YOUR LUNO ACCOUNT", "Held in your Luno account", "Staked via Luno", "Staking rewards received", "Staking activity", "SOL staking reward — Demo", "Unstaked SOL — Demo", "Staked ETH — Demo", "Reward received", "Your Luno account", "JomBit never buys, sells or holds crypto", "Staking simulation only", "Demo stake", "Unstake ETH", "Luno integration is planned, not connected", "BTC", "View-only"]) assert.ok(html.includes(content), content);
    // Business rule: no buy/sell/trade wording or purchase-cost figures anywhere on the staking screen.
    assert.doesNotMatch(html, /\bBought\b|\bBuy\b|\bSell\b|\bTrade\b|Average (purchase|cost)|purchase (price|cost)|First purchase|Latest purchase|profit \/ loss|Execution price|Earlier demo record|earlier activity/i);
    assert.equal([...html.matchAll(/class="crypto-order"/g)].length, 5);
    assert.match(html, /aria-pressed="true"/);
    assert.doesNotMatch(html, />\s*(Buy|Sell) (BTC|ETH|SOL)|MYR to spend|Buy &amp; sell|MYR available to practise/);
    assert.doesNotMatch(html, /NaN|Infinity|\bundefined\b|\bWEY\b/);
    const hidden = render(false);
    assert.match(hidden, /••••••/);
    assert.doesNotMatch(hidden, /0\.00182 BTC/);
    assert.match(hidden, /RM428,500\.00/, "Public market prices stay visible");

    // Even if an old purchase record slipped past the loader, the staking activity never shows it.
    fixture.state.walletTransactions.unshift({ id: "legacy", kind: "crypto-buy", title: "Bought ETH", date: "2026-09-30T00:00:00Z", direction: "out", amountCents: 3000, currency: "MYR", crypto: { asset: "ETH", quantity: 1 } });
    html = render();
    assert.equal([...html.matchAll(/class="crypto-order"/g)].length, 5);
    assert.doesNotMatch(html, /Bought ETH/);

    market.mode = "live";
    market.fresh = false;
    market.quotes = null;
    market.error = "The price feed is unavailable.";
    html = render();
    assert.match(html, /Live prices unavailable/);
    assert.match(html, /The price feed is unavailable/);
    const stakeButton = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find((match) => match[2].includes("Demo stake"));
    assert.ok(stakeButton, "Staking control stays available without a price feed");
    assert.doesNotMatch(stakeButton[1], /disabled/);
    assert.doesNotMatch(html, /NaN|Infinity|\bundefined\b/);

    market.quotes = Object.fromEntries(["BTC", "ETH", "SOL"].map((asset) => [asset, { asset, priceMyr: 100, source: "coingecko", updatedAt: new Date().toISOString(), change24h: -1.5 }]));
    assert.match(render(), /Last known prices · stale/);
    market.fresh = true; market.error = "";
    html = render();
    assert.match(html, /Live reference prices/);
    assert.match(html, /Data provided by CoinGecko/);
    assert.match(html, /-1\.50%/);
    assert.match(html, /Provider updated/);
    assert.match(html, /refreshed every 60s/);
  } finally { await server.close(); }
});
