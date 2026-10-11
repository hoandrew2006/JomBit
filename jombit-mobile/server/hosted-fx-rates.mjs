import { createFxRatesApi } from "./fx-rates.mjs";

// One in-memory cache per warm Vercel function instance; CDN headers share rates more broadly.
export const hostedFxRatesApi = createFxRatesApi({ hosted: true });
