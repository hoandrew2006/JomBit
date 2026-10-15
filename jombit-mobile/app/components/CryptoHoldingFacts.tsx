import { formatMoney } from "../../lib/calculations";
import { holdingMetrics, STAKING_ASSETS } from "../../lib/crypto-ledger";
import type { CryptoAsset, CryptoHolding } from "../../lib/models";

interface Props {
  asset: CryptoAsset;
  holding: CryptoHolding;
  referencePrice?: number;
  priceLabel: string;
  balancesVisible?: boolean;
  rewardsReceived?: number;
}

/** Balances held in the user's linked Luno account, shown the same way in the app and the website preview.
 *  JomBit never buys or sells crypto, so there is no purchase price, cost or profit/loss here. */
export function CryptoHoldingFacts({ asset, holding, referencePrice, priceLabel, balancesVisible = true, rewardsReceived = 0 }: Props) {
  const metrics = holdingMetrics(holding, referencePrice);
  const hide = (value: string) => balancesVisible ? value : "••••••";
  const price = (value: number | null | undefined) => value == null ? "Unavailable" : formatMoney(Math.round(value * 100));
  const quantity = (value: number) => `${value.toLocaleString("en-MY", { maximumFractionDigits: 8 })} ${asset}`;
  const stakeable = STAKING_ASSETS.includes(asset);
  return <>
    <div className="crypto-price-pair"><div><span>{priceLabel}</span><strong>{price(referencePrice)}</strong></div><div><span>Estimated value in Luno</span><strong>{hide(metrics.value === null ? "Unavailable" : formatMoney(metrics.value))}</strong></div></div>
    <dl className="crypto-position-grid">
      <div><dt>Held in your Luno account</dt><dd>{hide(quantity(metrics.total))}</dd></div>
      <div><dt>Staked via Luno</dt><dd>{hide(stakeable ? quantity(holding.staked) : "Not stakeable here")}</dd></div>
      <div><dt>Not staked</dt><dd>{hide(quantity(holding.available))}</dd></div>
      <div><dt>Staking rewards received</dt><dd>{hide(stakeable ? quantity(rewardsReceived) : "—")}</dd></div>
    </dl>
  </>;
}
