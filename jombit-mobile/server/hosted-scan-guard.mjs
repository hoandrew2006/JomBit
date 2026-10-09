import { ScanError } from "./receipt-schema.mjs";

export function hostedScanConfigured(env) {
  try {
    const origin = new URL(env.JOMBIT_APP_ORIGIN);
    return origin.protocol === "https:" && origin.origin === env.JOMBIT_APP_ORIGIN;
  } catch { return false; }
}

export function authorizeHostedScan(req, env) {
  if (req.headers.origin !== env.JOMBIT_APP_ORIGIN || req.headers["x-jombit-scan"] !== "1") {
    throw new ScanError(403, "Open JomBit from its official website to scan.");
  }
}
