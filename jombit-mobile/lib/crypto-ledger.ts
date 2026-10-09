import type { AppState, CryptoAsset, CryptoHolding, CryptoQuote, WalletTransaction } from "./models";

export const CRYPTO_ASSETS: CryptoAsset[] = ["BTC", "ETH", "SOL"];
// Limited prototype coverage, not a claim to cover all Luno-supported assets.
export const STAKING_ASSETS: CryptoAsset[] = ["ETH", "SOL"];
export const CRYPTO_NAMES: Record<CryptoAsset, string> = { BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana" };
export const CRYPTO_PRECISION = 1e8;
export const LIVE_QUOTE_MAX_AGE = 180_000;
export type CryptoAction = "stake" | "unstake";
export interface CryptoCommand {
  id: string;
  action: CryptoAction;
  asset: CryptoAsset;
  amount: string;
}

const units = (quantity: number) => Math.round(quantity * CRYPTO_PRECISION);
const quantity = (atomic: number) => atomic / CRYPTO_PRECISION;
export function validQuote(quote: CryptoQuote | undefined, now: number) {
  if (!quote || !CRYPTO_ASSETS.includes(quote.asset) || !Number.isFinite(quote.priceMyr) || quote.priceMyr <= 0 || quote.priceMyr > 1e9) return false;
  if (quote.source === "demo") return quote.updatedAt === null;
  if (quote.source !== "coingecko" || !quote.updatedAt) return false;
  const age = now - Date.parse(quote.updatedAt);
  return Number.isFinite(age) && age >= -30_000 && age <= LIVE_QUOTE_MAX_AGE;
}

export function holdingMetrics(holding: CryptoHolding, priceMyr?: number) {
  const total = quantity(units(holding.available) + units(holding.staked));
  const cost = Number.isSafeInteger(holding.costBasisCents) && Number(holding.costBasisCents) >= 0 ? holding.costBasisCents! : null;
  const value = priceMyr && Number.isFinite(priceMyr) && priceMyr > 0 ? Math.round(total * priceMyr * 100) : null;
  const pnl = cost !== null && value !== null ? value - cost : null;
  return { total, cost, value, averagePrice: total > 0 && cost !== null ? cost / 100 / total : null, pnl, pnlPercent: cost && pnl !== null ? pnl / cost * 100 : null };
}

function parseAmount(value: string, decimals: number) {
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(value.trim())) throw new Error(`Use a positive amount with at most ${decimals} decimal places.`);
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0 || !Number.isSafeInteger(Math.round(result * 10 ** decimals))) throw new Error("Enter a valid positive amount.");
  return result;
}

// Staking-only simulation. Moves existing units, never cash, and preserves acquisition history.
export function executeCryptoCommand(state: AppState, command: CryptoCommand, now = Date.now()): AppState {
  if (!["stake", "unstake"].includes(command.action)) throw new Error("JomBit does not support buying or selling crypto.");
  if (!command.id || state.walletTransactions.some((tx) => tx.id === command.id)) throw new Error("This demo activity was already recorded.");
  if (!STAKING_ASSETS.includes(command.asset)) throw new Error("This asset is view-only. Demo staking supports ETH and SOL.");
  const { action, asset } = command;
  const holding = state.crypto[asset];
  if (!holding || !Number.isFinite(holding.available) || !Number.isFinite(holding.staked) || holding.available < 0 || holding.staked < 0) throw new Error("This holding needs to be checked before staking.");
  let available = units(holding.available);
  let staked = units(holding.staked);
  if (!Number.isSafeInteger(available + staked)) throw new Error("Holding quantity exceeds the demo limit.");
  const moved = units(parseAmount(command.amount, 8));
  if (moved < 1) throw new Error("Enter at least 0.00000001 units.");
  if (action === "stake") {
    if (moved > available) throw new Error("You cannot stake more than your unstaked balance.");
    available -= moved; staked += moved;
  } else {
    if (moved > staked) throw new Error("You cannot unstake more than your staked balance.");
    staked -= moved; available += moved;
  }
  const transaction: WalletTransaction = {
    id: command.id, date: new Date(now).toISOString(), kind: action,
    title: `${action === "stake" ? "Staked" : "Unstaked"} ${asset} - Demo`,
    subtitle: "Local staking simulation. Not sent to Luno.", direction: "neutral",
    crypto: { asset, quantity: quantity(moved), priceMyr: null, priceSource: null, priceUpdatedAt: null, feeCents: 0 },
  };
  return { ...state, crypto: { ...state.crypto, [asset]: { ...holding, available: quantity(available), staked: quantity(staked) } }, walletTransactions: [transaction, ...state.walletTransactions] };
}

export function normalizeCryptoHistory(state: AppState): AppState {
  // Preserve old balances and transactions. Missing history is not evidence of a purchase.
  const crypto = { ...state.crypto };
  for (const asset of CRYPTO_ASSETS) {
    const holding = crypto[asset];
    if (!holding) continue;
    crypto[asset] = { ...holding, costBasisCents: holding.costBasisCents ?? ((holding.available + holding.staked) === 0 ? 0 : null), firstBoughtAt: holding.firstBoughtAt ?? null, lastBoughtAt: holding.lastBoughtAt ?? null };
  }
  return { ...state, crypto };
}
