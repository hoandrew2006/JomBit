import { CRYPTO_ASSETS, CRYPTO_PRECISION, holdingMetrics, validQuote } from "./crypto-ledger.ts";
import type { DuitNowQr } from "./duitnow-qr.ts";
import { parseFiatAmount } from "./fiat-ledger.ts";
import { isSpendCategory } from "./insights.ts";
import type { AppState, CryptoAsset, CryptoQuote, SpendCategory, WalletTransaction } from "./models";

// Paying a DuitNow QR (preview only: nothing reaches the recipient, even for a real QR).
// - Cash: the amount comes out of the MYR wallet.
// - Crypto: the coin is converted to MYR for the recipient at the reviewed reference price. A conversion
//   fee is added on top and recorded with the payment, so Insights shows it under "Fees".

/** Preview conversion fee for crypto payments: 1% of the amount, at least RM0.50. A placeholder, not a quoted price. */
export const CRYPTO_PAYMENT_FEE_BASIS_POINTS = 100;
export const CRYPTO_PAYMENT_MIN_FEE_CENTS = 50;
export const QR_PAYMENT_LIMIT_CENTS = 500_000;

export type QrPaymentMethod = "cash" | "crypto";
export interface QrPaymentCommand {
  id: string;
  qr: DuitNowQr;
  // MYR the recipient receives, as typed (ignored when the QR fixes the amount).
  amount: string;
  method: QrPaymentMethod;
  category: SpendCategory;
  asset?: CryptoAsset;
  // The reference price shown at review; confirming uses exactly this price.
  quote?: CryptoQuote;
}

export function cryptoPaymentFeeCents(amountCents: number) {
  return Math.max(CRYPTO_PAYMENT_MIN_FEE_CENTS, Math.round((amountCents * CRYPTO_PAYMENT_FEE_BASIS_POINTS) / 10_000));
}

export function quoteQrPayment(state: AppState, command: QrPaymentCommand, now = Date.now()) {
  const amountCents = command.qr.amountCents ?? parseFiatAmount(command.amount);
  if (amountCents > QR_PAYMENT_LIMIT_CENTS) throw new Error("Preview payments are limited to RM5,000.00.");
  if (!isSpendCategory(command.category)) throw new Error("Choose a category for this payment.");
  if (command.method === "cash") {
    if (amountCents > state.fiatBalances.MYR) throw new Error("Your MYR balance is too low. Top up or pay with crypto.");
    return { amountCents, feeCents: 0, cryptoUnits: 0 };
  }
  if (command.method !== "crypto") throw new Error("Choose cash or crypto.");
  const asset = command.asset;
  if (!asset || !CRYPTO_ASSETS.includes(asset)) throw new Error("Choose which crypto to pay with.");
  const quote = command.quote;
  if (!quote || quote.asset !== asset || !validQuote(quote, now)) throw new Error("A current price is needed to pay with crypto. Refresh prices and try again.");
  const feeCents = cryptoPaymentFeeCents(amountCents);
  // Round the coin amount up so the recipient always gets the full MYR amount.
  const cryptoUnits = Math.ceil(((amountCents + feeCents) / 100 / quote.priceMyr) * CRYPTO_PRECISION);
  const holding = state.crypto[asset];
  if (!holding || !Number.isFinite(holding.available) || Math.round(holding.available * CRYPTO_PRECISION) < cryptoUnits) throw new Error(`Not enough available ${asset}. Staked ${asset} can't be used for payments.`);
  return { amountCents, feeCents, cryptoUnits };
}

export function executeQrPayment(state: AppState, command: QrPaymentCommand, now = Date.now()): AppState {
  if (!command.id || state.walletTransactions.some((tx) => tx.id === command.id)) throw new Error("This payment was already recorded.");
  const { amountCents, feeCents, cryptoUnits } = quoteQrPayment(state, command, now);
  const date = new Date(now).toISOString();
  const payee = command.qr.payeeName;
  const label = command.qr.sample ? "Sample DuitNow QR" : "DuitNow QR";
  if (command.method === "cash") {
    const tx: WalletTransaction = { id: command.id, date, kind: "payment", title: payee, subtitle: `${label} · paid from MYR wallet · preview`, amountCents, currency: "MYR", direction: "out", category: command.category };
    return { ...state, fiatBalances: { ...state.fiatBalances, MYR: state.fiatBalances.MYR - amountCents }, walletTransactions: [tx, ...state.walletTransactions] };
  }
  const asset = command.asset!;
  const quote = command.quote!;
  const holding = state.crypto[asset];
  const available = Math.round(holding.available * CRYPTO_PRECISION);
  const total = available + Math.round(holding.staked * CRYPTO_PRECISION);
  const cost = holdingMetrics(holding).cost;
  const tx: WalletTransaction = {
    id: command.id, date, kind: "crypto-payment", title: payee, subtitle: `${label} · ${asset} converted to MYR for the recipient · preview`,
    amountCents, currency: "MYR", direction: "out", category: command.category,
    crypto: { asset, quantity: cryptoUnits / CRYPTO_PRECISION, priceMyr: quote.priceMyr, priceSource: quote.source, priceUpdatedAt: quote.updatedAt, feeCents, recipient: payee },
  };
  return {
    ...state,
    crypto: { ...state.crypto, [asset]: { ...holding, available: (available - cryptoUnits) / CRYPTO_PRECISION, costBasisCents: cost === null ? null : Math.round(cost * ((total - cryptoUnits) / total)) } },
    walletTransactions: [tx, ...state.walletTransactions],
  };
}
