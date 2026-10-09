import type { AppState, Currency, WalletTransaction } from "./models";
import { DEMO_FX_IN_MYR } from "./mock-services.ts";

export const FIAT_CURRENCIES: Currency[] = ["MYR", "SGD", "THB", "IDR"];
export const FOREIGN_CURRENCIES = ["SGD", "THB", "IDR"] as const;
export type ForeignCurrency = typeof FOREIGN_CURRENCIES[number];
export type FiatCommand = { id: string } & (
  | { action: "deposit"; currency: "MYR"; amount: string }
  | { action: "send"; currency: Currency; amount: string; recipientId: string }
  | { action: "consolidate"; expectedForeign: Record<ForeignCurrency, number> }
);

function checkedCents(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("The amount is invalid or exceeds the demo limit.");
  return value;
}

function rateUnits(currency: Currency) {
  if (!FIAT_CURRENCIES.includes(currency)) throw new Error("Unsupported currency.");
  return BigInt(Math.round(DEMO_FX_IN_MYR[currency] * 1_000_000));
}

export function parseFiatAmount(amount: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount.trim())) throw new Error("Enter a positive amount with at most two decimal places.");
  const [whole, decimals = ""] = amount.trim().split(".");
  const cents = checkedCents(Number(BigInt(whole) * 100n + BigInt(decimals.padEnd(2, "0"))));
  if (cents === 0) throw new Error("Enter an amount greater than zero.");
  return cents;
}

// FX is fictional. Integer arithmetic keeps the displayed budget within the MYR balance.
export function myrBudgetInCurrency(myrCents: number, currency: Currency) {
  return checkedCents(Number(BigInt(checkedCents(myrCents)) * 1_000_000n / rateUnits(currency)));
}

export function myrDebitForPayment(receiveCents: number, currency: Currency) {
  const numerator = BigInt(checkedCents(receiveCents)) * rateUnits(currency);
  return checkedCents(Number((numerator + 999_999n) / 1_000_000n));
}

export function legacyMyrCredit(foreignCents: number, currency: ForeignCurrency) {
  return checkedCents(Number((BigInt(checkedCents(foreignCents)) * rateUnits(currency) + 500_000n) / 1_000_000n));
}

export function executeFiatCommand(state: AppState, command: FiatCommand, now = Date.now()): AppState {
  if (!command.id || state.walletTransactions.some((tx) => tx.id === command.id)) throw new Error("This demo transaction was already recorded.");
  const balances = { ...state.fiatBalances };
  checkedCents(balances.MYR);
  const date = new Date(now).toISOString();
  let counterparts = state.counterpartBalances;
  let entries: WalletTransaction[];

  if (command.action === "deposit") {
    if (command.currency !== "MYR") throw new Error("JomBit deposits are MYR only.");
    const amountCents = parseFiatAmount(command.amount);
    balances.MYR = checkedCents(balances.MYR + amountCents);
    // Ensure all supported foreign-currency previews remain representable.
    for (const currency of FOREIGN_CURRENCIES) myrBudgetInCurrency(balances.MYR, currency);
    entries = [{ id: command.id, date, kind: "topup", title: "MYR deposit — Demo", subtitle: "Added to your MYR wallet · simulated bank deposit", amountCents, currency: "MYR", direction: "in" }];
  } else if (command.action === "send") {
    const member = state.members[command.recipientId];
    if (!Object.hasOwn(state.members, command.recipientId) || !member || member.id !== command.recipientId || member.id === state.user.id) throw new Error("Choose another JomBit member.");
    const receiveCents = parseFiatAmount(command.amount);
    const debitCents = myrDebitForPayment(receiveCents, command.currency);
    if (debitCents > balances.MYR) throw new Error("Your MYR balance is too low. Deposit MYR or enter a smaller amount.");
    balances.MYR -= debitCents;
    const recipientBalance = checkedCents(state.counterpartBalances[member.id]?.[command.currency] ?? 0);
    counterparts = { ...state.counterpartBalances, [member.id]: { ...state.counterpartBalances[member.id], [command.currency]: checkedCents(recipientBalance + receiveCents) } };
    entries = [{ id: command.id, date, kind: "transfer", title: `Sent to ${member.name} — Demo`, subtitle: command.currency === "MYR" ? "JomBit-to-JomBit transfer · MYR wallet" : `MYR converted to ${command.currency} at payment · demo rate`, amountCents: debitCents, currency: "MYR", direction: "out", fiat: { fromCurrency: "MYR", toCurrency: command.currency, fromCents: debitCents, toCents: receiveCents, rate: 1 / DEMO_FX_IN_MYR[command.currency], feeCents: 0, source: "demo" } }];
  } else if (command.action === "consolidate") {
    for (const currency of FOREIGN_CURRENCIES) {
      checkedCents(balances[currency]);
      if (balances[currency] !== command.expectedForeign?.[currency]) throw new Error("The previous demo balances changed. Review the conversion again.");
    }
    const existing = FOREIGN_CURRENCIES.filter((currency) => balances[currency] > 0);
    if (!existing.length) throw new Error("There are no earlier foreign-currency balances to move.");
    entries = existing.map((currency, index) => {
      const foreignCents = balances[currency];
      const creditCents = legacyMyrCredit(foreignCents, currency);
      if (creditCents === 0) throw new Error("An earlier balance is worth less than RM0.01. It has been kept unchanged.");
      balances.MYR = checkedCents(balances.MYR + creditCents);
      balances[currency] = 0;
      return { id: index === 0 ? command.id : `${command.id}-${currency}`, date, kind: "exchange", title: `${currency} → MYR — Demo`, subtitle: "Earlier demo balance moved to your MYR wallet", amountCents: creditCents, currency: "MYR", direction: "in", fiat: { fromCurrency: currency, toCurrency: "MYR", fromCents: foreignCents, toCents: creditCents, rate: DEMO_FX_IN_MYR[currency], feeCents: 0, source: "demo" } };
    });
    for (const currency of FOREIGN_CURRENCIES) myrBudgetInCurrency(balances.MYR, currency);
  } else throw new Error("Unsupported fiat transaction.");

  return { ...state, fiatBalances: balances, counterpartBalances: counterparts, walletTransactions: [...entries, ...state.walletTransactions] };
}
