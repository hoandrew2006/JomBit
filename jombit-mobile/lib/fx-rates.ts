import { useEffect, useState } from "react";
import { checkedRates, DEMO_FX_RATES, type FxRateSnapshot } from "./fiat-ledger.ts";

export type FxRatesStatus = "loading" | "live" | "fallback";
const REFRESH_MS = 60 * 60 * 1000;
// Same rule as live crypto prices: the hosted site or the local dev server, not a standalone file.
const hasRatesServer = ({ protocol, hostname }: Location) => protocol === "https:" || (protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(hostname));

// Validates the server's answer; anything unexpected keeps the static demo rates.
export function parseFxRatesResponse(body: unknown): FxRateSnapshot {
  const rates = (body as { rates?: FxRateSnapshot } | null)?.rates;
  if (!rates || rates.source !== "live" || !rates.updatedAt) throw new Error("The exchange-rate service returned invalid rates.");
  return checkedRates({ inMyr: { ...rates.inMyr }, source: "live", updatedAt: rates.updatedAt });
}

export function useFxRates(): { rates: FxRateSnapshot; status: FxRatesStatus } {
  const [rates, setRates] = useState<FxRateSnapshot>(DEMO_FX_RATES);
  const [status, setStatus] = useState<FxRatesStatus>(() => typeof window !== "undefined" && hasRatesServer(window.location) ? "loading" : "fallback");
  useEffect(() => {
    // The standalone HTML file has no server, so it always uses the static demo rates.
    if (!hasRatesServer(window.location)) { setStatus("fallback"); return; }
    let active = true;
    let controller: AbortController | undefined;
    const refresh = async () => {
      controller = new AbortController();
      const timer = window.setTimeout(() => controller?.abort(), 12000);
      try {
        const response = await fetch("/api/fx/rates", { signal: controller.signal });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Live exchange rates are unavailable.");
        const live = parseFxRatesResponse(await response.json());
        if (active) { setRates(live); setStatus("live"); }
      } catch {
        // Keep the last good live rates if a later refresh fails; otherwise use the static rates.
        if (active) setStatus((current) => current === "live" ? "live" : "fallback");
      } finally { window.clearTimeout(timer); }
    };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, REFRESH_MS);
    return () => { active = false; controller?.abort(); window.clearInterval(interval); };
  }, []);
  return { rates, status };
}
