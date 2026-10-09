import { useEffect, useRef, useState } from "react";
import type { CryptoAsset, CryptoQuote } from "./models";
import { DEMO_CRYPTO_PRICES_MYR } from "./mock-services";
import { CRYPTO_ASSETS, validQuote } from "./crypto-ledger";

const demoQuotes = Object.fromEntries(CRYPTO_ASSETS.map((asset) => [asset, { asset, priceMyr: DEMO_CRYPTO_PRICES_MYR[asset], source: "demo", change24h: null, updatedAt: null }])) as Record<CryptoAsset, CryptoQuote>;

export function supportsLiveCryptoPrices(location: { protocol: string; hostname: string }) {
  return ["http:", "https:"].includes(location.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
}

export function useCryptoMarket() {
  const [mode, setMode] = useState<"live" | "demo">(() => typeof window !== "undefined" && supportsLiveCryptoPrices(window.location) ? "live" : "demo");
  const [quotes, setQuotes] = useState<Record<CryptoAsset, CryptoQuote> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (mode === "demo") { setError(""); setLoading(false); refreshRef.current = () => {}; return; }
    let active = true;
    let busy = false;
    let lastAttempt = 0;
    let controller: AbortController | undefined;
    const refresh = async () => {
      if (busy || document.hidden || Date.now() - lastAttempt < 15000) return;
      if (!supportsLiveCryptoPrices(window.location)) { setError("Live prices require the local JomBit server. Open the app through its localhost link, or choose Demo prices."); return; }
      lastAttempt = Date.now(); busy = true; setLoading(true);
      controller = new AbortController();
      const timer = window.setTimeout(() => controller?.abort(), 12000);
      try {
        const response = await fetch("/api/crypto/quotes", { signal: controller.signal, cache: "no-store" });
        if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("The market service is not available here. Run the local JomBit server.");
        const body = await response.json();
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Live prices are unavailable.");
        if (!CRYPTO_ASSETS.every((asset) => body.quotes?.[asset]?.source === "coingecko" && body.quotes[asset].asset === asset && validQuote(body.quotes[asset], Date.now()))) throw new Error("The market feed returned outdated or invalid prices.");
        if (active) { setQuotes(body.quotes); setError(""); setNow(Date.now()); }
      } catch (reason) {
        if (active) setError(reason instanceof Error && reason.name !== "AbortError" ? reason.message : "The price request timed out. Please retry.");
      } finally { window.clearTimeout(timer); busy = false; if (active) setLoading(false); }
    };
    refreshRef.current = () => { void refresh(); };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 60000);
    const resume = () => { if (!document.hidden && Date.now() - lastAttempt >= 60000) void refresh(); };
    document.addEventListener("visibilitychange", resume);
    return () => { active = false; controller?.abort(); window.clearInterval(interval); document.removeEventListener("visibilitychange", resume); refreshRef.current = () => {}; };
  }, [mode]);
  const displayed = mode === "demo" ? demoQuotes : quotes;
  const fresh = mode === "demo" || Boolean(quotes && !error && CRYPTO_ASSETS.every((asset) => validQuote(quotes[asset], now)));
  return { mode, setMode, quotes: displayed, loading, error, fresh, now, refresh: () => refreshRef.current() };
}
