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
    let html = render();
    for (const text of ["Your MYR wallet", "Deposit MYR", "Send from MYR", "Top up in MYR only", "not separate balances", "static demo rate", "Send in SGD", "RM1,842.50"]) assert.ok(html.includes(text), text);
    // Flags are inline SVG images (not emoji or letter badges) beside the country name and currency code.
    assert.equal((html.match(/<svg class="country-flag"/g) ?? []).length, 3);
    for (const [country, code] of [["Singapore", "SGD"], ["Thailand", "THB"], ["Indonesia", "IDR"]]) assert.match(html, new RegExp(`<strong>${country}</strong><small>${code} · estimated equivalent`));
    assert.doesNotMatch(html, />(SG|TH|ID)<|🇸🇬|🇹🇭|🇮🇩/);
    assert.doesNotMatch(html, /Balances from the previous demo|Currency balances|Approximate wallet value|NaN|Infinity|\bundefined\b|\bWEY\b/);
    assert.match(html, /aria-pressed="true"/);
    assert.match(render(false), /••••••/);
    assert.doesNotMatch(render(false), /RM1,842\.50/);
    fixture.state.fiatBalances.SGD = 18450;
    html = render();
    assert.match(html, /Balances from the previous demo/);
    assert.match(html, /not included in your MYR balance/);
    assert.match(html, /Review move to MYR/);
    assert.equal(fixture.state.fiatBalances.SGD, 18450, "Rendering must not migrate money automatically");
    assert.match(html, /Live rates unavailable\. Showing static demo rates\./);
    const { fx } = await server.ssrLoadModule("virtual:jombit-fx-rates");
    fx.value = { status: "live", rates: { inMyr: { MYR: 1, SGD: 1 / 0.3047, THB: 1 / 7.71, IDR: 1 / 3801.5 }, source: "live", updatedAt: "2026-10-10T00:02:31.000Z" } };
    html = render();
    assert.match(html, /Rates updated 10 Oct 2026, 08:02 am MYT/);
    assert.match(html, /Rates By Exchange Rate API/);
    assert.match(html, /1 MYR ≈ 0\.3047 SGD · live rate/);
    assert.doesNotMatch(html, /static demo rate/);
    fx.value = { status: "fallback", rates: fx.value.rates };
    fixture.state.fiatBalances.MYR = 0;
    html = render();
    assert.match(html, /RM0\.00/);
    assert.match(html, /S\$0\.00/);
    assert.doesNotMatch(html, /NaN|Infinity/);
  } finally { await server.close(); }
});
