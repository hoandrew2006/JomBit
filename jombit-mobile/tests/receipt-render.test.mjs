import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

test("Receipt entry prioritises real photos and manual entry without demo/provider clutter", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const server = await createServer({
    configFile: false, envFile: false, root, cacheDir: "node_modules/.vite-test-receipt-ui",
    resolve: { alias: [ { find: "@/lib/state", replacement: "virtual:receipt-state" }, { find: "@", replacement: root } ] },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [react(), { name: "receipt-state", resolveId(id) { if (id === "virtual:receipt-state") return "\0receipt-state"; },
      load(id) { if (id === "\0receipt-state") return `import { createSeedState } from '/lib/seed.ts'; export function useAppState() { return { state: createSeedState(), setState() {} }; }`; } }],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom",
  });
  try {
    const { ExpenseFlow } = await server.ssrLoadModule("/app/components/ExpenseFlow.tsx");
    const html = renderToStaticMarkup(createElement(ExpenseFlow, { onClose() {}, onSaved() {} }));
    for (const text of ["Start with a receipt.", "Take a photo", "Choose a photo", "Enter manually", "Review", "Assign"]) assert.ok(html.includes(text), text);
    assert.doesNotMatch(html, /Try the demo receipt|Gemini|API_KEY|local app|demo-paper/);
    assert.match(html, /type="file" accept="image\/\*" aria-label="Choose a receipt image"/);
  } finally { await server.close(); }
});
