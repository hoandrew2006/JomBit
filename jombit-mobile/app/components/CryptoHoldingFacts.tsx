import { formatMoney } from "../../lib/calculations";
import { holdingMetrics } from "../../lib/crypto-ledger";
import type { CryptoAsset, CryptoHolding } from "../../lib/models";

interface Props {
  asset: CryptoAsset;
  holding: CryptoHolding;
  referencePrice?: number;
  priceLabel: string;
  balancesVisible?: boolean;
}

/** The same position details in the app and the read-only website preview. */
export function CryptoHoldingFacts({ asset, holding, referencePrice, priceLabel, balancesVisible = true }: Props) {
  const metrics = holdingMetrics(holding, referencePrice);
  const hide = (value: string) => balancesVisible ? value : "••••••";
  const price = (value: number | null | undefined) => value == null ? "Unavailable" : formatMoney(Math.round(value * 100));
  const quantity = (value: number) => `${value.toLocaleString("en-MY", { maximumFractionDigits: 8 })} ${asset}`;
  const date = (value: string | null | undefined) => !value || !Number.isFinite(Date.parse(value)) ? "Unknown" : new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(value));
  return <>
    <div className="crypto-price-pair"><div><span>{priceLabel}</span><strong>{price(referencePrice)}</strong></div><div><span>Average purchase price</span><strong>{hide(metrics.averagePrice === null ? "Unknown" : price(metrics.averagePrice))}</strong></div></div>
    <dl className="crypto-position-grid">
      <div><dt>Unstaked balance</dt><dd>{hide(quantity(holding.available))}</dd></div>
      <div><dt>Staked</dt><dd>{hide(quantity(holding.staked))}</dd></div>
      <div><dt>Current holding value</dt><dd>{hide(metrics.value === null ? "Unavailable" : formatMoney(metrics.value))}</dd></div>
      <div><dt>Unrealized profit / loss</dt><dd className={metrics.pnl !== null && metrics.pnl < 0 ? "crypto-negative" : "crypto-positive"}>{hide(metrics.pnl === null ? "Unknown" : `${metrics.pnl >= 0 ? "+" : "−"}${formatMoney(Math.abs(metrics.pnl))}`)}</dd></div>
      <div><dt>First purchase</dt><dd>{hide(date(holding.firstBoughtAt))}</dd></div>
      <div><dt>Latest purchase</dt><dd>{hide(date(holding.lastBoughtAt))}</dd></div>
    </dl>
  </>;
}
