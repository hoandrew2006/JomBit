import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { demoCryptoPaymentPayload } from "../lib/mock-services.ts";

test("Crypto settlement payload is local, explicit and keeps the group balance", () => {
  assert.equal(
    demoCryptoPaymentPayload("member id", "ETH", 0.00423, 4230, "MYR"),
    "jombit-demo://crypto-pay?to=member%20id&asset=ETH&amount=0.00423000&fiatAmount=42.30&fiatCurrency=MYR",
  );
});

test("Settlement screen offers a live-priced crypto QR without requiring DuitNow", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const server = await createServer({
    configFile: false, envFile: false, root, cacheDir: "node_modules/.vite-test-settlement",
    resolve: { alias: [
      { find: "@/lib/state", replacement: "virtual:jombit-settlement-state" },
      { find: "@/lib/crypto-market", replacement: "virtual:jombit-settlement-market" },
      { find: "@/lib/fx-rates", replacement: "virtual:jombit-settlement-fx" },
      { find: "@", replacement: root },
    ] },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [react(), {
      name: "isolated-settlement-render-fixtures",
      resolveId(id) { if (id.startsWith("virtual:jombit-settlement-")) return `\0${id}`; },
      load(id) {
        if (id === "\0virtual:jombit-settlement-state") return `import { createSeedState } from '/lib/seed.ts'; export const fixture = { state: createSeedState() }; fixture.state.members.maya.hasDuitNowQr = false; export function useAppState() { return { state: fixture.state, setState() { throw new Error('Rendering must not record a settlement'); } }; }`;
        if (id === "\0virtual:jombit-settlement-market") return `export function useCryptoMarket() { return { fresh: true, loading: false, error: '', quotes: { ETH: { asset: 'ETH', priceMyr: 10000, source: 'coingecko', updatedAt: '2026-10-19T00:00:00.000Z', change24h: 0 } }, refresh() {} }; }`;
        if (id === "\0virtual:jombit-settlement-fx") return `import { DEMO_FX_RATES } from '/lib/fiat-ledger.ts'; export function useFxRates() { return { rates: DEMO_FX_RATES, status: 'fallback' }; }`;
      },
    }],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom",
  });
  try {
    const { SettlementScreen } = await server.ssrLoadModule("/app/components/SettlementScreen.tsx");
    const { fixture } = await server.ssrLoadModule("virtual:jombit-settlement-state");
    const html = renderToStaticMarkup(createElement(SettlementScreen, {
      group: fixture.state.groups[0], fromId: "me", toId: "maya", amountCents: 4230,
      initialPaymentMethod: "crypto", initialCryptoAsset: "ETH", onClose() {}, onDone() {},
    }));
    for (const text of ["Pay with", "Fiat QR", "Crypto QR", "Crypto asset", "0.00423 ETH", "RM42.30 at live reference price", "Generate ETH QR", "No crypto is transferred"]) assert.ok(html.includes(text), text);
    assert.doesNotMatch(html, /hasn.t added a DuitNow QR/);
    assert.doesNotMatch(html, /Sample prices|Demo prices/);
  } finally { await server.close(); }
});
