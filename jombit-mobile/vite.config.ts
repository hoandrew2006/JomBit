import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { createReceiptApi } from "./server/receipt-api.mjs";
import { createCryptoMarketApi } from "./server/crypto-market.mjs";
import { createFxRatesApi } from "./server/fx-rates.mjs";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [react(), {
    name: "jombit-private-receipt-api",
    configureServer(server) {
      server.middlewares.use(createCryptoMarketApi());
      server.middlewares.use(createFxRatesApi());
      server.middlewares.use(createReceiptApi({ env: { ...loadEnv(server.config.mode, projectRoot, ""), ...process.env } }));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createCryptoMarketApi());
      server.middlewares.use(createFxRatesApi());
      server.middlewares.use(createReceiptApi({ env: { ...loadEnv(server.config.mode, projectRoot, ""), ...process.env } }));
    },
  }, {
    name: "jombit-social-preview",
    transformIndexHtml() {
      const siteUrl = process.env.JOMBIT_SITE_URL;
      if (!siteUrl) return [];
      const base = new URL(siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`);
      if (!["https:", "http:"].includes(base.protocol)) throw new Error("JOMBIT_SITE_URL must be an HTTP(S) website URL.");
      const preview = new URL("og.png", base).href;
      return [
        { tag: "meta", attrs: { property: "og:url", content: base.href } },
        { tag: "meta", attrs: { property: "og:image", content: preview } },
        { tag: "meta", attrs: { property: "og:image:alt", content: "JomBit — Life’s shared. Money should be simple." } },
        { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
        { tag: "meta", attrs: { name: "twitter:image", content: preview } },
      ];
    },
  }],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
