import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

// Thursday 15 Oct 2026 in Malaysia: Fri–Sun of this week are in the future.
const NOW = new Date("2026-10-15T04:00:00.000Z");

test("Insights shows MYR tiles, sample-reward disclosure, Group badges and no future bars", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const server = await createServer({
    configFile: false, envFile: false, root, cacheDir: "node_modules/.vite-test-insights",
    resolve: { alias: [{ find: "@/lib/state", replacement: "virtual:jombit-insights-state" }, { find: "@", replacement: root }] },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [react(), {
      name: "isolated-insights-render-fixtures",
      resolveId(id) { if (id === "virtual:jombit-insights-state") return `\0${id}`; },
      load(id) {
        if (id === "\0virtual:jombit-insights-state") return `import { createSeedState } from '/lib/seed.ts'; export const fixture = { state: createSeedState(new Date("${NOW.toISOString()}")) }; export function useAppState() { return { state: fixture.state, setState() { throw new Error('Rendering must not change state'); } }; }`;
      },
    }],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom",
  });
  try {
    const { InsightsScreen } = await server.ssrLoadModule("/app/components/InsightsScreen.tsx");
    const render = (balancesVisible = true) => renderToStaticMarkup(createElement(InsightsScreen, { balancesVisible, now: NOW }));
    const html = render();
    for (const text of ["This week", "12 Oct – 18 Oct", "Money in", "Spend", "Staking rewards", "Top category", "Recent transactions", "Personal", "Group", "Sample records", "illustrative sample records", "demo staking does not earn rewards"]) assert.ok(html.includes(text), text);
    const { fixture } = await server.ssrLoadModule("virtual:jombit-insights-state");
    const personal = fixture.state.walletTransactions;
    fixture.state.walletTransactions = personal.filter((tx) => tx.kind !== "payment");
    assert.match(render(), /class="insight-group-badge">Group<\/b>KL Food Crew · /, "group shares carry a Group badge and keep their category");
    fixture.state.walletTransactions = personal;
    assert.match(html, /aria-label="Next week" disabled=""/, "cannot move into the future");
    // Three mini charts with seven daily slots each; the last three days of the week stay empty.
    assert.equal((html.match(/<span class="is-future"><\/span>/g) ?? []).length, 9);
    assert.doesNotMatch(html, /NaN|Infinity|undefined|Bought|Sell|Trade/);
    assert.match(html, /RM\d/);
    assert.doesNotMatch(render(false), /RM\d/, "balances can be hidden");
  } finally { await server.close(); }
});
