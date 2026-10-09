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
    resolve: { alias: [{ find: "@/lib/state", replacement: "virtual:jombit-fiat-state" }, { find: "@", replacement: root }] },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [react(), {
      name: "isolated-fiat-render-fixtures",
      resolveId(id) { if (id === "virtual:jombit-fiat-state") return `\0${id}`; },
      load(id) { if (id === "\0virtual:jombit-fiat-state") return `import { createSeedState } from '/lib/seed.ts'; export const fixture = { state: createSeedState() }; export function useAppState() { return { state: fixture.state, transactFiat() { throw new Error('Rendering must not move money'); } }; }`; },
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
    fixture.state.fiatBalances.MYR = 0;
    html = render();
    assert.match(html, /RM0\.00/);
    assert.match(html, /S\$0\.00/);
    assert.doesNotMatch(html, /NaN|Infinity/);
  } finally { await server.close(); }
});
