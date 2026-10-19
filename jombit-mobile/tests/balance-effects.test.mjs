import assert from "node:assert/strict";
import test from "node:test";
import { applyHistory, balanceEffect } from "../lib/balance-effects.ts";
import { createSeedOpeningState, createSeedState } from "../lib/seed.ts";

const NOW = new Date("2026-10-19T04:00:00.000Z");
const at = (day) => `2026-10-${day}T04:00:00.000Z`;
const opening = {
  fiatBalances: { MYR: 10000, SGD: 0, THB: 0, IDR: 0 },
  crypto: { ETH: { asset: "ETH", available: 0.05, staked: 0.05, costBasisCents: 100000, firstBoughtAt: null, lastBoughtAt: null } },
};

test("Payments, top-ups, repayments and withdrawals move the MYR balance; crypto payments and rewards move crypto", () => {
  const history = [
    { id: "t", kind: "topup", title: "", subtitle: "", amountCents: 50000, currency: "MYR", date: at(10), direction: "in" },
    { id: "p", kind: "payment", title: "", subtitle: "", amountCents: 2500, currency: "MYR", date: at(11), direction: "out" },
    { id: "r", kind: "settlement", title: "", subtitle: "", amountCents: 1200, currency: "MYR", date: at(12), direction: "in" },
    { id: "s", kind: "settlement", title: "", subtitle: "", amountCents: 800, currency: "MYR", date: at(12), direction: "out" },
    { id: "w", kind: "withdrawal", title: "", subtitle: "", amountCents: 20000, currency: "MYR", date: at(13), direction: "out" },
    { id: "c", kind: "crypto-payment", title: "", subtitle: "", amountCents: 4500, currency: "MYR", date: at(14), direction: "out", crypto: { asset: "ETH", quantity: 0.01, priceMyr: 4590, priceSource: "demo", priceUpdatedAt: null, feeCents: 90 } },
    { id: "k", kind: "staking-reward", title: "", subtitle: "", date: at(15), direction: "neutral", crypto: { asset: "ETH", quantity: 0.0001, priceMyr: 10000, priceSource: "demo", priceUpdatedAt: null, feeCents: 0 } },
    { id: "x", kind: "crypto-receive", title: "", subtitle: "", date: at(16), direction: "in", crypto: { asset: "ETH", quantity: 5, priceMyr: null, priceSource: null, priceUpdatedAt: null, feeCents: 0 } },
  ];
  const result = applyHistory(opening, history);
  assert.equal(result.fiatBalances.MYR, 10000 + 50000 - 2500 + 1200 - 800 - 20000);
  // The crypto payment does not touch MYR: it spends 0.01 ETH (the RM45 plus its fee) from the available balance.
  assert.equal(balanceEffect(history[5]).myrCents, 0);
  assert.equal(result.crypto.ETH.available, 0.0401);
  assert.equal(result.crypto.ETH.staked, 0.05, "staked units are untouched");
  // Spending 10% of the holding releases 10% of its recorded cost; rewards add units without a cost.
  assert.equal(result.crypto.ETH.costBasisCents, 90000);
  assert.equal(opening.crypto.ETH.available, 0.05, "the opening state is not mutated");
  assert.equal(result.lowestMyrCents, 10000);
  assert.equal(result.lowestCrypto.ETH, 0.04);
});

test("Demo balances are the opening balances plus the activity shown, and never go below zero", () => {
  const start = createSeedOpeningState(NOW);
  const today = createSeedState(NOW);
  const replay = applyHistory(start, start.walletTransactions);
  assert.equal(today.fiatBalances.MYR, replay.fiatBalances.MYR);
  assert.notEqual(today.fiatBalances.MYR, start.fiatBalances.MYR, "the history changes the MYR balance");
  for (const asset of ["ETH", "SOL", "BTC", "ADA"]) assert.ok(today.crypto[asset].available < start.crypto[asset].available, `${asset} payments reduce the balance`);
  for (const asset of ["DOT", "NEAR", "ATOM", "AVAX"]) assert.ok(today.crypto[asset].available > start.crypto[asset].available, `${asset} rewards add to the balance`);
  for (let day = 0; day < 120; day += 3) {
    const date = new Date(NOW.getTime() + day * 86_400_000);
    const opening = createSeedOpeningState(date);
    const { lowestMyrCents, lowestCrypto } = applyHistory(opening, opening.walletTransactions);
    assert.ok(lowestMyrCents >= 0, `MYR never negative (${date.toISOString().slice(0, 10)})`);
    assert.ok(Object.values(lowestCrypto).every((value) => value >= 0), `crypto never negative (${date.toISOString().slice(0, 10)})`);
  }
});
