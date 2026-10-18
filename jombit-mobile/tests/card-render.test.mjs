import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

test("Card screen offers MYR and available crypto sources without implying payment processing", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const server = await createServer({
    configFile: false, envFile: false, root, cacheDir: "node_modules/.vite-test-card",
    resolve: { alias: [{ find: "@/lib/state", replacement: "virtual:jombit-card-state" }, { find: "@", replacement: root }] },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [react(), {
      name: "isolated-card-render-fixture",
      resolveId(id) { if (id === "virtual:jombit-card-state") return `\0${id}`; },
      load(id) {
        if (id === "\0virtual:jombit-card-state") return `import { createSeedState } from '/lib/seed.ts'; export const fixture = { state: createSeedState() }; fixture.state.user.onboarded = true; fixture.state.card.virtualActive = true; fixture.state.card.paymentSource = 'crypto'; fixture.state.card.paymentAsset = 'SOL'; export function useAppState() { return { state: fixture.state, setState() { throw new Error('Rendering must not change card state'); } }; }`;
      },
    }],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom",
  });
  try {
    const { WalletScreen } = await server.ssrLoadModule("/app/components/WalletScreen.tsx");
    const html = renderToStaticMarkup(createElement(WalletScreen, { initialTab: "card" }));
    for (const text of ["Card</button>", "Insights</button>", "SOL CRYPTO SOURCE", "Choose payment source", "MYR wallet", "Crypto wallet", "Crypto asset", "SOL · 1.4 available", "Staked crypto is never used", "does not convert crypto or process card payments"]) assert.ok(html.includes(text), text);
    assert.match(html, /aria-pressed="true"[^>]*><strong>Crypto wallet/);
    assert.doesNotMatch(html, /Fiat only|fiat-only|buy crypto|sell crypto/i);
  } finally { await server.close(); }
});
