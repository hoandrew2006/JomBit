import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

test("Pay with QR offers camera, image and sample QR codes with a clear preview-only notice", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const server = await createServer({
    configFile: false, envFile: false, root, cacheDir: "node_modules/.vite-test-qr-pay",
    resolve: { alias: [{ find: "@/lib/state", replacement: "virtual:jombit-qr-state" }, { find: "@/lib/crypto-market", replacement: "virtual:jombit-qr-market" }, { find: "@", replacement: root }] },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [react(), {
      name: "isolated-qr-pay-fixtures",
      resolveId(id) { if (id === "virtual:jombit-qr-state" || id === "virtual:jombit-qr-market") return `\0${id}`; },
      load(id) {
        if (id === "\0virtual:jombit-qr-state") return `import { createSeedState } from '/lib/seed.ts'; export function useAppState() { return { state: createSeedState(), payQr() { throw new Error('Rendering must not pay'); } }; }`;
        if (id === "\0virtual:jombit-qr-market") return `export function useCryptoMarket() { return { quotes: null, loading: false, error: '', fresh: false, now: Date.now(), refresh() {} }; }`;
      },
    }],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom",
  });
  try {
    const { QrPayFlow } = await server.ssrLoadModule("/app/components/QrPayFlow.tsx");
    const html = renderToStaticMarkup(createElement(QrPayFlow, { onClose() {}, onDone() {} }));
    for (const text of ["Scan to pay.", "Scan a QR code", "Choose a QR image", "Sample shop QR", "Sample bill QR", "Sample friend QR", "Preview only. JomBit doesn&#x27;t send money to anyone, even when you scan a real DuitNow QR."]) assert.ok(html.includes(text), text);
    assert.match(html, /accept="image\/\*"/);
    assert.doesNotMatch(html, /settle|Settle/, "general QR payments are separate from group settle-ups");
    assert.doesNotMatch(html, /NaN|undefined|Buy|Sell|Luno/);
  } finally { await server.close(); }
});
