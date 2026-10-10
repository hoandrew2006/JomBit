import assert from "node:assert/strict";
import test from "node:test";
import { checkedRates, DEMO_FX_RATES, executeFiatCommand, FOREIGN_CURRENCIES, legacyMyrCredit, myrBudgetInCurrency, myrDebitForPayment, parseFiatAmount } from "../lib/fiat-ledger.ts";

const NOW = Date.parse("2026-10-05T10:00:00Z");
const state = () => ({ user: { id: "me" }, members: { me: { id: "me", name: "Me" }, maya: { id: "maya", name: "Maya" } }, fiatBalances: { MYR: 10000, SGD: 0, THB: 0, IDR: 0 }, counterpartBalances: { maya: { MYR: 2000, SGD: 300 } }, crypto: { BTC: { available: 0.1 } }, groups: [{ id: "preserved" }], walletTransactions: [] });
const deposit = (patch = {}) => ({ id: "deposit", action: "deposit", currency: "MYR", amount: "100.00", ...patch });
const send = (patch = {}) => ({ id: "send", action: "send", currency: "SGD", amount: "10.00", recipientId: "maya", ...patch });

test("Deposits fund MYR only and foreign-currency estimates update without separate balances", () => {
  const initial = state();
  const next = executeFiatCommand(initial, deposit(), NOW);
  assert.deepEqual(next.fiatBalances, { MYR: 20000, SGD: 0, THB: 0, IDR: 0 });
  assert.equal(initial.fiatBalances.MYR, 10000);
  assert.equal(next.crypto, initial.crypto);
  assert.equal(next.groups, initial.groups);
  for (const currency of FOREIGN_CURRENCIES) assert.ok(myrBudgetInCurrency(next.fiatBalances.MYR, currency) > myrBudgetInCurrency(initial.fiatBalances.MYR, currency));
  assert.equal(next.walletTransactions[0].currency, "MYR");
  assert.equal(next.walletTransactions[0].date, new Date(NOW).toISOString());
  for (const currency of FOREIGN_CURRENCIES) assert.throws(() => executeFiatCommand(initial, deposit({ currency }), NOW), /MYR only/);
});

test("Switching currency estimates is read-only and never adds more money", () => {
  const initial = state(); const before = structuredClone(initial);
  assert.equal(myrBudgetInCurrency(10000, "MYR"), 10000);
  assert.equal(myrBudgetInCurrency(10000, "SGD"), 2890);
  assert.equal(myrBudgetInCurrency(10000, "THB"), 77519);
  assert.equal(myrBudgetInCurrency(10000, "IDR"), 35842293);
  assert.deepEqual(initial, before);
});

test("Every displayed foreign-currency budget fits within the MYR balance, including small amounts", () => {
  for (const myr of [0, 1, 2, 10, 99, 100, 101, 999, 10000, 184250, 999999999]) {
    for (const currency of FOREIGN_CURRENCIES) {
      const budget = myrBudgetInCurrency(myr, currency);
      assert.ok(myrDebitForPayment(budget, currency) <= myr);
      assert.ok(myrDebitForPayment(budget + 1, currency) > myr);
    }
  }
});

test("A foreign-currency send deducts MYR and records exactly what the recipient received", () => {
  const initial = state(); const before = structuredClone(initial);
  const result = executeFiatCommand(initial, send(), NOW);
  assert.deepEqual(initial, before);
  assert.deepEqual(result.fiatBalances, { MYR: 6540, SGD: 0, THB: 0, IDR: 0 });
  assert.deepEqual(result.counterpartBalances.maya, { MYR: 2000, SGD: 1300 });
  assert.equal(result.walletTransactions[0].amountCents, 3460);
  assert.equal(result.walletTransactions[0].currency, "MYR");
  assert.deepEqual(result.walletTransactions[0].fiat, { fromCurrency: "MYR", toCurrency: "SGD", fromCents: 3460, toCents: 1000, rate: 1 / 3.46, feeCents: 0, source: "demo" });
});

test("Domestic sends stay in MYR and may spend the entire available balance", () => {
  const result = executeFiatCommand(state(), send({ currency: "MYR", amount: "100.00" }), NOW);
  assert.equal(result.fiatBalances.MYR, 0);
  assert.equal(result.counterpartBalances.maya.MYR, 12000);
  assert.equal(result.walletTransactions[0].fiat.rate, 1);
});

test("Tiny foreign transfers always debit at least a sen, with exact integer rounding", () => {
  assert.equal(myrDebitForPayment(1, "IDR"), 1);
  assert.equal(myrDebitForPayment(1, "SGD"), 4);
  assert.equal(myrDebitForPayment(1000, "SGD"), 3460);
  const result = executeFiatCommand(state(), send({ currency: "IDR", amount: "0.01" }), NOW);
  assert.equal(result.fiatBalances.MYR, 9999);
  assert.equal(result.counterpartBalances.maya.IDR, 1);
});

test("Foreign holdings cannot fund a send when there is not enough MYR", () => {
  const initial = state(); initial.fiatBalances.MYR = 1; initial.fiatBalances.SGD = 99999;
  assert.throws(() => executeFiatCommand(initial, send(), NOW), /MYR balance is too low/);
  assert.equal(initial.fiatBalances.SGD, 99999);
});

test("Rejects duplicate deposits/transfers and competing orders against the latest balance", () => {
  const topped = executeFiatCommand(state(), deposit(), NOW);
  assert.throws(() => executeFiatCommand(topped, deposit(), NOW), /already recorded/);
  const first = executeFiatCommand(state(), send({ currency: "MYR", amount: "90" }), NOW);
  assert.throws(() => executeFiatCommand(first, send(), NOW), /already recorded/);
  assert.throws(() => executeFiatCommand(first, send({ id: "another" }), NOW), /too low/);
});

test("Invalid amounts, currencies, recipients and unsafe balances fail before mutation", () => {
  for (const amount of ["", "0", "-1", "NaN", "Infinity", "1e2", "1,000", "0.001", "1.000", "9007199254740999", "1.2.3"]) assert.throws(() => executeFiatCommand(state(), deposit({ amount }), NOW));
  assert.equal(parseFiatAmount(" 42.30 "), 4230);
  for (const recipientId of ["me", "unknown", "__proto__", "constructor"]) assert.throws(() => executeFiatCommand(state(), send({ recipientId }), NOW), /another JomBit member/);
  assert.throws(() => executeFiatCommand(state(), send({ currency: "INVALID" }), NOW), /Unsupported currency/);
  for (const value of [-1, 1.5, NaN, Infinity]) {
    const initial = state(); initial.fiatBalances.MYR = value;
    assert.throws(() => executeFiatCommand(initial, deposit(), NOW), /invalid/);
  }
  const overflow = state(); overflow.counterpartBalances.maya.SGD = Number.MAX_SAFE_INTEGER;
  assert.throws(() => executeFiatCommand(overflow, send(), NOW), /limit/);
});

test("Earlier foreign balances remain untouched by deposits and payments", () => {
  const initial = state(); Object.assign(initial.fiatBalances, { SGD: 18450, THB: 326000, IDR: 175000000 });
  const topped = executeFiatCommand(initial, deposit(), NOW);
  const sent = executeFiatCommand(topped, send(), NOW);
  for (const currency of FOREIGN_CURRENCIES) assert.equal(sent.fiatBalances[currency], initial.fiatBalances[currency]);
});

test("Optional consolidation explicitly converts earlier balances to MYR and preserves history", () => {
  const initial = state(); Object.assign(initial.fiatBalances, { SGD: 18450, THB: 326000, IDR: 175000000 });
  initial.walletTransactions = [{ id: "older", kind: "exchange" }];
  const expectedForeign = { SGD: 18450, THB: 326000, IDR: 175000000 };
  const cmd = { id: "consolidate", action: "consolidate", expectedForeign };
  const result = executeFiatCommand(initial, cmd, NOW);
  const credit = FOREIGN_CURRENCIES.reduce((total, currency) => total + legacyMyrCredit(expectedForeign[currency], currency), 0);
  assert.deepEqual(result.fiatBalances, { MYR: 10000 + credit, SGD: 0, THB: 0, IDR: 0 });
  assert.equal(result.walletTransactions.length, 4);
  assert.equal(result.walletTransactions[3], initial.walletTransactions[0]);
  assert.equal(result.walletTransactions[0].fiat.fromCents, 18450);
  assert.equal(initial.fiatBalances.SGD, 18450);
  assert.throws(() => executeFiatCommand(result, cmd, NOW), /already recorded/);
  assert.throws(() => executeFiatCommand(initial, { ...cmd, expectedForeign: { ...expectedForeign, SGD: 18451 } }, NOW), /changed/);
});

test("Consolidation never silently discards sub-sen holdings or partial changes", () => {
  const initial = state(); initial.fiatBalances.SGD = 1000; initial.fiatBalances.IDR = 1;
  const before = structuredClone(initial);
  assert.throws(() => executeFiatCommand(initial, { id: "tiny", action: "consolidate", expectedForeign: { SGD: 1000, THB: 0, IDR: 1 } }, NOW), /less than RM0.01/);
  assert.deepEqual(initial, before);
  assert.throws(() => executeFiatCommand(state(), { id: "empty", action: "consolidate", expectedForeign: { SGD: 0, THB: 0, IDR: 0 } }, NOW), /no earlier/);
});

const LIVE = { inMyr: { MYR: 1, SGD: 1 / 0.3047, THB: 1 / 7.71, IDR: 1 / 3801.5 }, source: "live", updatedAt: "2026-10-10T00:02:31.000Z" };

test("Live rates drive estimates and transfers, and the record keeps the live rate and its time", () => {
  assert.equal(myrBudgetInCurrency(10000, "SGD", LIVE), 3047);
  assert.equal(myrBudgetInCurrency(10000, "THB", LIVE), 77100);
  // IDR rates are stored to nine decimal places: within 0.001% of the exact 38,015,000.
  assert.ok(Math.abs(myrBudgetInCurrency(10000, "IDR", LIVE) - 38015000) / 38015000 < 0.00001);
  const result = executeFiatCommand(state(), send({ rates: LIVE }), NOW);
  assert.equal(result.walletTransactions[0].amountCents, myrDebitForPayment(1000, "SGD", LIVE));
  assert.equal(result.walletTransactions[0].amountCents, 3282);
  assert.deepEqual(result.walletTransactions[0].fiat, { fromCurrency: "MYR", toCurrency: "SGD", fromCents: 3282, toCents: 1000, rate: 0.3047, feeCents: 0, source: "live", rateUpdatedAt: LIVE.updatedAt });
  assert.match(result.walletTransactions[0].subtitle, /live rate/);
});

test("Live-rate budgets still always fit within the MYR balance", () => {
  for (const myr of [0, 1, 2, 99, 101, 10000, 184250, 999999999]) {
    for (const currency of FOREIGN_CURRENCIES) {
      const budget = myrBudgetInCurrency(myr, currency, LIVE);
      assert.ok(myrDebitForPayment(budget, currency, LIVE) <= myr);
      assert.ok(myrDebitForPayment(budget + 1, currency, LIVE) > myr);
    }
  }
});

test("Live rates convert earlier balances; commands without rates keep the static demo rates", () => {
  const initial = state(); Object.assign(initial.fiatBalances, { SGD: 10000, THB: 0, IDR: 0 });
  const result = executeFiatCommand(initial, { id: "c", action: "consolidate", expectedForeign: { SGD: 10000, THB: 0, IDR: 0 }, rates: LIVE }, NOW);
  assert.equal(result.walletTransactions[0].amountCents, legacyMyrCredit(10000, "SGD", LIVE));
  assert.equal(result.walletTransactions[0].fiat.source, "live");
  assert.equal(executeFiatCommand(state(), send(), NOW).walletTransactions[0].fiat.source, "demo");
  assert.equal(checkedRates(DEMO_FX_RATES), DEMO_FX_RATES);
});

test("Malformed or implausible rates are rejected before any money moves", () => {
  const bad = [{ ...LIVE, source: "made-up" }, { ...LIVE, updatedAt: "not a date" }, { ...LIVE, inMyr: { ...LIVE.inMyr, MYR: 2 } }, { ...LIVE, inMyr: { ...LIVE.inMyr, SGD: 0 } }, { ...LIVE, inMyr: { ...LIVE.inMyr, IDR: NaN } }, { ...LIVE, inMyr: { ...LIVE.inMyr, THB: 1 } }];
  for (const rates of bad) {
    const initial = state(); const before = structuredClone(initial);
    assert.throws(() => executeFiatCommand(initial, send({ rates }), NOW), /exchange rates are invalid/);
    assert.deepEqual(initial, before);
  }
});
