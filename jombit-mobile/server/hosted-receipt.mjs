import { createReceiptApi } from "./receipt-api.mjs";

export const hostedReceiptApi = createReceiptApi({ hosted: true, timeoutMs: 45000 });
