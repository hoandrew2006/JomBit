import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

test("Fiat screen presents one MYR wallet, equivalent values, privacy and preserved older balances", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const server = await createServer({
    configFile: false, envFile: false, root, cacheDir: "node_modules/.vite-test-fiat",
    resolve: { alias: [{ find: "@/lib/state", replacement: "virtual:jombit-fiat-state" }, { find: "@/lib/fx-rates", replacement: "virtual:jombit-fx-rates" }, { find: "@", replacement: root }] },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [react(), {
      name: "isolated-fiat-render-fixtures",
      resolveId(id) { if (id === "virtual:jombit-fiat-state" || id === "virtual:jombit-fx-rates") return `\0${id}`; },
      load(id) {
        if (id === "\0virtual:jombit-fx-rates") return `import { DEMO_FX_RATES } from '/lib/fiat-ledger.ts'; export const fx = { value: { rates: DEMO_FX_RATES, status: 'fallback' } }; export function useFxRates() { return fx.value; }`;
        if (id === "\0virtual:jombit-fiat-state") return `import { createSeedState } from '/lib/seed.ts'; export const fixture = { state: createSeedState() }; export function useAppState() { return { state: fixture.state, transactFiat() { throw new Error('Rendering must not move money'); } }; }`;
      },
    }],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom",
  });
  try {
    const { FiatWallet } = await server.ssrLoadModule("/app/components/FiatWallet.tsx");
    const { fixture } = await server.ssrLoadModule("virtual:jombit-fiat-state");
    assert.deepEqual([fixture.state.fiatBalances.SGD, fixture.state.fiatBalances.THB, fixture.state.fiatBalances.IDR], [0, 0, 0]);
    const render = (balancesVisible = true) => renderToStaticMarkup(createElement(FiatWallet, { balancesVisible }));
    fixture.state.walletTransactions.unshift({
      id: "legacy-crypto-purchase",
      kind: "crypto-buy",
      title: "Bought ETH",
      subtitle: "Earlier crypto purchase",
      amountCents: 72000,
      currency: "MYR",
      date: "2026-10-02T00:00:00.000Z",
      direction: "out",
    });
    // Keep the original starter records at the top of the list; generated Insights activity is tested separately.
    const generated = fixture.state.walletTransactions.filter((tx) => tx.id.startsWith("seed-"));
    fixture.state.walletTransactions = fixture.state.walletTransactions.filter((tx) => !tx.id.startsWith("seed-"));
    let html = render();
    for (const text of ["Your MYR wallet", "Deposit MYR", "Send from MYR", "Top up in MYR", "not separate balances", "fallback rate", "Send in SGD", "RM1,842.50"]) assert.ok(html.includes(text), text);
    // Flags are inline SVG images (not emoji or letter badges) beside the country name and currency code.
    assert.equal((html.match(/<svg class="country-flag"/g) ?? []).length, 3);
    for (const [country, code] of [["Singapore", "SGD"], ["Thailand", "THB"], ["Indonesia", "IDR"]]) assert.match(html, new RegExp(`<strong>${country}</strong><small>${code} · estimated equivalent`));
    assert.doesNotMatch(html, />(SG|TH|ID)<|🇸🇬|🇹🇭|🇮🇩/);
    assert.doesNotMatch(html, /Balances from the previous demo|Currency balances|Approximate wallet value|NaN|Infinity|\bundefined\b|\bWEY\b/);
    assert.doesNotMatch(html, /Bought ETH|Earlier crypto purchase/);
    assert.match(html, /MYR wallet deposit/);
    assert.match(html, /aria-pressed="true"/);
    fixture.state.walletTransactions.push(...generated);
    fixture.state.walletTransactions.unshift({ id: "paid-with-eth", kind: "crypto-payment", title: "Crypto café", subtitle: "Crypto payment preview", amountCents: 4500, currency: "MYR", date: new Date().toISOString(), direction: "out", crypto: { asset: "ETH", quantity: 0.0046, priceMyr: 9955, priceSource: "demo", priceUpdatedAt: null, feeCents: 90 } });
    html = render();
    assert.doesNotMatch(html, /Crypto café/, "crypto payments are paid from crypto, never shown as MYR wallet debits");
    assert.doesNotMatch(html, /Sample staking reward/, "Crypto reward records never appear in the MYR wallet history");
    assert.match(html, /MYR wallet payment · preview|JomBit Card · preview/);
    assert.match(render(false), /••••••/);
    assert.doesNotMatch(render(false), /RM1,842\.50/);
    fixture.state.fiatBalances.SGD = 18450;
    html = render();
    assert.match(html, /Earlier currency balances/);
    assert.match(html, /remain separate from the estimates above/);
    assert.match(html, /Review move to MYR/);
    assert.equal(fixture.state.fiatBalances.SGD, 18450, "Rendering must not migrate money automatically");
    assert.match(html, /Live rates are unavailable\. Fallback rates are shown\./);
    const { fx } = await server.ssrLoadModule("virtual:jombit-fx-rates");
    fx.value = { status: "live", rates: { inMyr: { MYR: 1, SGD: 1 / 0.3047, THB: 1 / 7.71, IDR: 1 / 3801.5 }, source: "live", updatedAt: "2026-10-10T00:02:31.000Z" } };
    html = render();
    assert.match(html, /Rates updated 10 Oct 2026, 08:02 am MYT/);
    assert.match(html, /Rates by Exchange Rate API/);
    assert.match(html, /1 MYR ≈ 0\.3047 SGD · live reference rate/);
    assert.doesNotMatch(html, /fallback rate/);
    fx.value = { status: "fallback", rates: fx.value.rates };
    fixture.state.fiatBalances.MYR = 0;
    html = render();
    assert.match(html, /RM0\.00/);
    assert.match(html, /S\$0\.00/);
    assert.doesNotMatch(html, /NaN|Infinity/);
  } finally { await server.close(); }
});
