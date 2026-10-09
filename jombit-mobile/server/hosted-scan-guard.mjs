import { createHash, timingSafeEqual } from "node:crypto";
import { ScanError } from "./receipt-schema.mjs";

export function hostedScanConfigured(env) {
  try {
    const origin = new URL(env.JOMBIT_APP_ORIGIN);
    return origin.protocol === "https:" && origin.origin === env.JOMBIT_APP_ORIGIN
      && (env.JOMBIT_SCAN_ACCESS_CODE?.length ?? 0) >= 32;
  } catch { return false; }
}

export function authorizeHostedScan(req, env) {
  if (req.headers.origin !== env.JOMBIT_APP_ORIGIN || req.headers["x-jombit-scan"] !== "1") {
    throw new ScanError(403, "Open JomBit from its official website to scan.");
  }
  const supplied = req.headers["x-jombit-access-code"];
  const hash = (value) => createHash("sha256").update(value).digest();
  if (typeof supplied !== "string" || supplied.length > 256 || !timingSafeEqual(hash(supplied), hash(env.JOMBIT_SCAN_ACCESS_CODE))) {
    throw new ScanError(401, "Enter a valid scan access code.");
  }
}
