import { createCryptoMarketApi } from "./crypto-market.mjs";

// Keep one cache per warm Vercel function instance; CDN headers share successful quotes more broadly.
export const hostedCryptoMarketApi = createCryptoMarketApi({ hosted: true });
