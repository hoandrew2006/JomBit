import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

test("Marketing page renders with valid section and accessibility targets", async () => {
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.vite-test-website",
    envFile: false,
    root: fileURLToPath(new URL("../", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [react()],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom",
  });
  try {
    const { MarketingSite } = await server.ssrLoadModule("/src/website/MarketingSite.tsx");
    const html = renderToStaticMarkup(createElement(MarketingSite));
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(ids.length, new Set(ids).size, "IDs must be unique");
    for (const match of html.matchAll(/\b(?:href="#|aria-controls="|aria-labelledby=")([^"\s]+)"/g)) {
      assert.ok(ids.includes(match[1]), `Missing target ${match[1]}`);
    }
    assert.match(html, /Split the bill/);
    assert.match(html, /href="\?view=demo"[^>]*>[\s\S]*?Try the demo/);
    assert.match(html, /Play walkthrough/);
    assert.match(html, /THE JOMBIT CRYPTO VISION/);
    assert.match(html, /No real crypto is held/);
    assert.match(html, /No buying or selling in JomBit/);
    assert.match(html, /Luno integration is planned/);
    assert.match(html, /no confirmed partnership or account connection is claimed/);
    assert.doesNotMatch(html, /Buy &amp; sell|Buy with fiat|Sell back to fiat|fiat or crypto as the payment source/);
    for (const label of ["Average purchase price", "Reference price (demo)", "First purchase", "Latest purchase", "Unrealized profit / loss", "Static sample prices, not a live market feed."]) assert.ok(html.includes(label), label);
    assert.match(html, /Choose a sample crypto holding/);
    assert.match(html, /App component with sample receipt data/);
    assert.doesNotMatch(html, /m-asset-orbit|m-art-disc|<iframe/);
    assert.match(html, /RM88\.16/);
    assert.doesNotMatch(html, /\bWEY\b|receipt scanner is simulated|prototype uses a simulated receipt scanner/i);
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
    assert.equal([...html.matchAll(/role="tablist"/g)].length, 3);
    assert.equal([...html.matchAll(/role="tabpanel"/g)].length, 3);
    assert.ok(html.indexOf('id="how-it-works"') < html.indexOf('id="products"'));
    assert.ok(html.indexOf('id="crypto"') < html.indexOf('id="wallet"'));
  } finally {
    await server.close();
  }
});

test("Shared position preview shows truthful sample values and protects hidden balances", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const server = await createServer({ configFile: false, envFile: false, root, cacheDir: "node_modules/.vite-test-position",
    resolve: { alias: { "@": root } }, optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [react()], server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom" });
  try {
    const { CryptoHoldingFacts } = await server.ssrLoadModule("/app/components/CryptoHoldingFacts.tsx");
    const { createSeedState } = await server.ssrLoadModule("/lib/seed.ts");
    const { DEMO_CRYPTO_PRICES_MYR } = await server.ssrLoadModule("/lib/mock-services.ts");
    const state = createSeedState();
    for (const asset of ["BTC", "ETH", "SOL"]) {
      const props = { asset, holding: state.crypto[asset], referencePrice: DEMO_CRYPTO_PRICES_MYR[asset], priceLabel: "Reference price (demo)" };
      const html = renderToStaticMarkup(createElement(CryptoHoldingFacts, props));
      assert.match(html, /First purchase/);
      assert.ok(html.includes(asset));
      assert.doesNotMatch(html, /NaN|Infinity|undefined|Unknown/);
      const hidden = renderToStaticMarkup(createElement(CryptoHoldingFacts, { ...props, balancesVisible: false }));
      assert.ok(hidden.includes("••••••"));
      assert.ok(!hidden.includes(` ${asset}</dd>`));
    }
    const unknown = renderToStaticMarkup(createElement(CryptoHoldingFacts, { asset: "BTC", holding: { ...state.crypto.BTC, costBasisCents: null, firstBoughtAt: null }, priceLabel: "Reference price (demo)" }));
    assert.match(unknown, /Unavailable/);
    assert.match(unknown, /Unknown/);
  } finally { await server.close(); }
});
