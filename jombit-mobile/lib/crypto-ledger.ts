import type { AppState, CryptoAsset, CryptoHolding, CryptoQuote, WalletTransaction } from "./models";

export const CRYPTO_ASSETS: CryptoAsset[] = ["BTC", "ETH", "SOL", "ADA", "ATOM", "AVAX", "DOT", "NEAR"];
// Luno's documented Malaysia staking set as checked on 17 October 2026.
export const STAKING_ASSETS: CryptoAsset[] = ["ETH", "SOL", "ADA", "ATOM", "AVAX", "DOT", "NEAR"];
export const CRYPTO_NAMES: Record<CryptoAsset, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  ADA: "Cardano",
  ATOM: "Cosmos",
  AVAX: "Avalanche",
  DOT: "Polkadot",
  NEAR: "NEAR Protocol",
};
export const CRYPTO_PRECISION = 1e8;
export const LIVE_QUOTE_MAX_AGE = 180_000;
export type CryptoAction = "stake" | "unstake";
export interface CryptoCommand {
  id: string;
  action: CryptoAction;
  asset: CryptoAsset;
  amount: string;
}

export interface CryptoReceiveCommand {
  id: string;
  asset: CryptoAsset;
  amount: string;
  // Live reference price at the moment of deposit, so Insights can value it in MYR.
  quote?: CryptoQuote;
}

export interface CryptoTransferCommand extends CryptoReceiveCommand {
  recipient: string;
}

// Local ledger simulation only; never broadcasts a blockchain transaction.
export function executeCryptoTransfer(state: AppState, command: CryptoTransferCommand, now = Date.now()): AppState {
  if (!command.id || state.walletTransactions.some((tx) => tx.id === command.id)) throw new Error("This transfer was already recorded.");
  if (!CRYPTO_ASSETS.includes(command.asset)) throw new Error("Choose a supported crypto asset.");
  const recipient = command.recipient.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 ._-]{1,79}$/.test(recipient)) throw new Error("Enter a recipient label using 2–80 letters, numbers, spaces or . _ -.");
  const holding = state.crypto[command.asset];
  if (!holding || !Number.isFinite(holding.available) || !Number.isFinite(holding.staked) || holding.available < 0 || holding.staked < 0) throw new Error("This holding needs to be checked before transferring.");
  const available = units(holding.available), total = available + units(holding.staked);
  if (!Number.isSafeInteger(total)) throw new Error("Holding quantity exceeds the preview limit.");
  const sent = units(parseAmount(command.amount, 8));
  if (sent > available) throw new Error("Not enough available crypto. Unstake first to use your staked balance.");
  const cost = holdingMetrics(holding).cost;
  const transaction: WalletTransaction = {
    id: command.id, date: new Date(now).toISOString(), kind: "crypto-transfer", direction: "out",
    title: `Transferred ${command.asset}`, subtitle: "Transfer preview · no blockchain transfer",
    crypto: { asset: command.asset, quantity: quantity(sent), recipient, priceMyr: null, priceSource: null, priceUpdatedAt: null, feeCents: 0 },
  };
  return { ...state, crypto: { ...state.crypto, [command.asset]: { ...holding, available: quantity(available - sent), costBasisCents: cost === null ? null : Math.round(cost * ((total - sent) / total)) } }, walletTransactions: [transaction, ...state.walletTransactions] };
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
  if (!command.id || state.walletTransactions.some((tx) => tx.id === command.id)) throw new Error("This staking activity was already recorded.");
  if (!STAKING_ASSETS.includes(command.asset)) throw new Error("This asset is available to hold, but not to stake in this preview.");
  const { action, asset } = command;
  const holding = state.crypto[asset];
  if (!holding || !Number.isFinite(holding.available) || !Number.isFinite(holding.staked) || holding.available < 0 || holding.staked < 0) throw new Error("This holding needs to be checked before staking.");
  let available = units(holding.available);
  let staked = units(holding.staked);
  if (!Number.isSafeInteger(available + staked)) throw new Error("Holding quantity exceeds the preview limit.");
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
    title: `${action === "stake" ? "Staked" : "Unstaked"} ${asset}`,
    subtitle: "Staking preview · not sent to Luno", direction: "neutral",
    crypto: { asset, quantity: quantity(moved), priceMyr: null, priceSource: null, priceUpdatedAt: null, feeCents: 0 },
  };
  return { ...state, crypto: { ...state.crypto, [asset]: { ...holding, available: quantity(available), staked: quantity(staked) } }, walletTransactions: [transaction, ...state.walletTransactions] };
}

// Simulates an incoming wallet transfer. No blockchain or custody provider is contacted.
export function executeCryptoReceive(state: AppState, command: CryptoReceiveCommand, now = Date.now()): AppState {
  if (!command.id || state.walletTransactions.some((tx) => tx.id === command.id)) throw new Error("This incoming transfer was already recorded.");
  if (!CRYPTO_ASSETS.includes(command.asset)) throw new Error("Choose a supported crypto asset.");
  const holding = state.crypto[command.asset];
  if (!holding || !Number.isFinite(holding.available) || !Number.isFinite(holding.staked) || holding.available < 0 || holding.staked < 0) throw new Error("This holding needs to be checked before receiving crypto.");
  const available = units(holding.available);
  const received = units(parseAmount(command.amount, 8));
  if (received < 1) throw new Error("Enter at least 0.00000001 units.");
  if (!Number.isSafeInteger(available + received)) throw new Error("Holding quantity exceeds the preview limit.");
  const priced = Boolean(command.quote && command.quote.asset === command.asset && command.quote.source === "coingecko" && validQuote(command.quote, now));
  const transaction: WalletTransaction = {
    id: command.id,
    date: new Date(now).toISOString(),
    kind: "crypto-receive",
    title: `Received ${command.asset}`,
    subtitle: "Wallet transfer preview · no blockchain transfer",
    direction: "in",
    crypto: priced
      ? { asset: command.asset, quantity: quantity(received), priceMyr: command.quote!.priceMyr, priceSource: command.quote!.source, priceUpdatedAt: command.quote!.updatedAt, feeCents: 0 }
      : { asset: command.asset, quantity: quantity(received), priceMyr: null, priceSource: null, priceUpdatedAt: null, feeCents: 0 },
  };
  // With a live price, the deposit's MYR value at arrival becomes its recorded cost. Without one, the
  // cost of the holding becomes unknown rather than invented.
  const cost = holdingMetrics(holding).cost;
  const costBasisCents = priced && cost !== null ? cost + Math.round(quantity(received) * command.quote!.priceMyr * 100) : null;
  return {
    ...state,
    crypto: {
      ...state.crypto,
      [command.asset]: {
        ...holding,
        available: quantity(available + received),
        costBasisCents,
      },
    },
    walletTransactions: [transaction, ...state.walletTransactions],
  };
}

export function normalizeCryptoHistory(state: AppState): AppState {
  // Preserve old balances and transactions while adding newly supported assets safely.
  const crypto = { ...state.crypto } as AppState["crypto"];
  for (const asset of CRYPTO_ASSETS) {
    const holding = crypto[asset] ?? { asset, available: 0, staked: 0, costBasisCents: 0, firstBoughtAt: null, lastBoughtAt: null };
    crypto[asset] = { ...holding, costBasisCents: holding.costBasisCents ?? ((holding.available + holding.staked) === 0 ? 0 : null), firstBoughtAt: holding.firstBoughtAt ?? null, lastBoughtAt: holding.lastBoughtAt ?? null };
  }
  return { ...state, crypto };
}
