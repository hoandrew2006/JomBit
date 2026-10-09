import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

test("Website QR cards and direct links open the public full-screen web app", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const server = await createServer({
    configFile: false, envFile: false, root,
    cacheDir: "node_modules/.vite-test-web-qr",
    resolve: { alias: { "@": root } },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [react()],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom",
  });
  try {
    const { MarketingSite } = await server.ssrLoadModule("/src/website/MarketingSite.tsx");
    const { webAppUrl, questions } = await server.ssrLoadModule("/src/website/content.ts");
    assert.equal(webAppUrl, "https://jom-bit-6667.vercel.app/?app=1");
    const html = renderToStaticMarkup(createElement(MarketingSite));
    const section = html.match(/<section class="m-download-section"[\s\S]*?<\/section>/)?.[0];
    assert.ok(section);
    assert.equal(section.match(/class="m-download-card"/g)?.length, 2);
    assert.equal(section.match(/Scan to open JomBit<\/strong>/g)?.length, 2);
    assert.equal(section.match(/href="https:\/\/jom-bit-6667.vercel.app\/\?app=1"/g)?.length, 2);
    // Compare actual QR matrix paths against the renderer for the public URL.
    const expected = renderToStaticMarkup(createElement(QRCodeSVG, {
      value: webAppUrl, size: 154, marginSize: 3, fgColor: "#101a19", bgColor: "#fff",
    }));
    const paths = expected.match(/<path[^>]*>/g);
    assert.ok(paths?.length);
    for (const path of paths) assert.equal(section.split(path).length - 1, 2);
    assert.match(section, /iPhone/);
    assert.match(section, /Android/);
    assert.doesNotMatch(section, /App Store|Google Play|Coming soon|Preview QR|Scan to download/);
    assert.doesNotMatch(html, /App launch coming soon|Store downloads are coming soon/);
    assert.ok(questions.some(({ answer }) => answer.includes("Both codes open the same app.")));
  } finally {
    await server.close();
  }
});
