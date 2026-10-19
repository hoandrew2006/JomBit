import type { AppState, CryptoAsset, WalletTransaction } from "./models";

// How a recorded wallet transaction changes the user's own balances. Live commands (fiat-ledger,
// crypto-ledger) already apply their own effects; this is used to replay seeded demo history so the
// balances shown are the result of the activity shown.
// - MYR in: top-ups, money received, repayments (settle-ups paid to the user).
// - MYR out: wallet and card payments, transfers to friends, settle-ups the user paid, bank withdrawals.
// - Crypto: a crypto payment spends the coin quantity (including its fee) from the available balance;
//   a staking reward adds its quantity to the available balance.
const PRECISION = 100_000_000;
const units = (value: number) => Math.round(value * PRECISION);

export function balanceEffect(tx: WalletTransaction): { myrCents: number; crypto?: { asset: CryptoAsset; units: number } } {
  if (tx.kind === "crypto-payment" && tx.crypto && tx.crypto.quantity > 0) return { myrCents: 0, crypto: { asset: tx.crypto.asset, units: -units(tx.crypto.quantity) } };
  if (tx.kind === "staking-reward" && tx.crypto && tx.crypto.quantity > 0) return { myrCents: 0, crypto: { asset: tx.crypto.asset, units: units(tx.crypto.quantity) } };
  const cents = tx.amountCents ?? 0;
  if ((tx.currency ?? "MYR") !== "MYR" || !Number.isSafeInteger(cents) || cents <= 0) return { myrCents: 0 };
  if (tx.kind === "topup" || tx.kind === "received" || (tx.kind === "settlement" && tx.direction === "in")) return { myrCents: cents };
  if (["payment", "card", "transfer", "withdrawal"].includes(tx.kind) || (tx.kind === "settlement" && tx.direction === "out")) return tx.direction === "out" ? { myrCents: -cents } : { myrCents: 0 };
  return { myrCents: 0 };
}

/**
 * Applies history, oldest first, to opening balances. Crypto spent with a payment also releases the same
 * share of its recorded cost; rewards add units without a purchase cost. Also reports the lowest balance
 * reached, so demo data can be checked never to spend money it did not have.
 */
export function applyHistory(opening: Pick<AppState, "fiatBalances" | "crypto">, history: WalletTransaction[]) {
  const fiatBalances = { ...opening.fiatBalances };
  const crypto = Object.fromEntries(Object.entries(opening.crypto).map(([asset, holding]) => [asset, { ...holding }])) as AppState["crypto"];
  const available = Object.fromEntries(Object.entries(crypto).map(([asset, holding]) => [asset, units(holding.available)])) as Record<CryptoAsset, number>;
  let lowestMyrCents = fiatBalances.MYR;
  const lowestUnits = { ...available };
  for (const tx of [...history].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
    const effect = balanceEffect(tx);
    fiatBalances.MYR += effect.myrCents;
    lowestMyrCents = Math.min(lowestMyrCents, fiatBalances.MYR);
    if (!effect.crypto || !crypto[effect.crypto.asset]) continue;
    const { asset } = effect.crypto;
    const holding = crypto[asset];
    const before = available[asset] + units(holding.staked);
    if (effect.crypto.units < 0 && Number.isSafeInteger(holding.costBasisCents) && before > 0) {
      holding.costBasisCents = Math.round(holding.costBasisCents! * (before + effect.crypto.units) / before);
    }
    available[asset] += effect.crypto.units;
    lowestUnits[asset] = Math.min(lowestUnits[asset], available[asset]);
    holding.available = available[asset] / PRECISION;
  }
  const lowestCrypto = Object.fromEntries(Object.entries(lowestUnits).map(([asset, value]) => [asset, value / PRECISION])) as Record<CryptoAsset, number>;
  return { fiatBalances, crypto, lowestMyrCents, lowestCrypto };
}
