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

test("Payments, top-ups, repayments and withdrawals move the MYR balance; crypto payments, rewards and deposits move crypto", () => {
  const history = [
    { id: "t", kind: "topup", title: "", subtitle: "", amountCents: 50000, currency: "MYR", date: at(10), direction: "in" },
    { id: "p", kind: "payment", title: "", subtitle: "", amountCents: 2500, currency: "MYR", date: at(11), direction: "out" },
    { id: "r", kind: "settlement", title: "", subtitle: "", amountCents: 1200, currency: "MYR", date: at(12), direction: "in" },
    { id: "s", kind: "settlement", title: "", subtitle: "", amountCents: 800, currency: "MYR", date: at(12), direction: "out" },
    { id: "w", kind: "withdrawal", title: "", subtitle: "", amountCents: 20000, currency: "MYR", date: at(13), direction: "out" },
    { id: "c", kind: "crypto-payment", title: "", subtitle: "", amountCents: 4500, currency: "MYR", date: at(14), direction: "out", crypto: { asset: "ETH", quantity: 0.01, priceMyr: 4590, priceSource: "demo", priceUpdatedAt: null, feeCents: 90 } },
    { id: "k", kind: "staking-reward", title: "", subtitle: "", date: at(15), direction: "neutral", crypto: { asset: "ETH", quantity: 0.0001, priceMyr: 10000, priceSource: "demo", priceUpdatedAt: null, feeCents: 0 } },
    { id: "x", kind: "crypto-receive", title: "", subtitle: "", date: at(16), direction: "in", crypto: { asset: "ETH", quantity: 0.002, priceMyr: 9000, priceSource: "coingecko", priceUpdatedAt: null, feeCents: 0 } },
  ];
  const result = applyHistory(opening, history);
  assert.equal(result.fiatBalances.MYR, 10000 + 50000 - 2500 + 1200 - 800 - 20000);
  // The crypto payment does not touch MYR: it spends 0.01 ETH (the RM45 plus its fee) from the available balance.
  assert.equal(balanceEffect(history[5]).myrCents, 0);
  // Payment −0.01, reward +0.0001, deposit +0.002.
  assert.equal(result.crypto.ETH.available, 0.0421);
  assert.equal(result.crypto.ETH.staked, 0.05, "staked units are untouched");
  // Spending 10% of the holding releases 10% of its recorded cost; rewards add units without a cost.
  // Spending 10% of the holding releases 10% of its cost (90000); the deposit adds its RM18.00 value at arrival.
  assert.equal(result.crypto.ETH.costBasisCents, 90000 + 1800);
  const unpriced = applyHistory(opening, [{ ...history[7], crypto: { ...history[7].crypto, priceMyr: null } }]);
  assert.equal(unpriced.crypto.ETH.costBasisCents, null, "an unpriced deposit makes the cost unknown, like the live ledger");
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
  // Every coin: today = opening + deposits + rewards − crypto payments (spread included).
  for (const asset of Object.keys(start.crypto)) {
    const sign = { "crypto-receive": 1, "staking-reward": 1, "crypto-payment": -1 };
    const net = start.walletTransactions.filter((tx) => tx.crypto?.asset === asset && sign[tx.kind]).reduce((sum, tx) => sum + sign[tx.kind] * Math.round(tx.crypto.quantity * 1e8), 0);
    assert.equal(Math.round(today.crypto[asset].available * 1e8), Math.round(start.crypto[asset].available * 1e8) + net, asset);
  }
  assert.ok(start.walletTransactions.some((tx) => tx.kind === "crypto-receive") && start.walletTransactions.some((tx) => tx.kind === "crypto-payment") && start.walletTransactions.some((tx) => tx.kind === "staking-reward"));
  for (let day = 0; day < 120; day += 3) {
    const date = new Date(NOW.getTime() + day * 86_400_000);
    const opening = createSeedOpeningState(date);
    const { lowestMyrCents, lowestCrypto } = applyHistory(opening, opening.walletTransactions);
    assert.ok(lowestMyrCents >= 0, `MYR never negative (${date.toISOString().slice(0, 10)})`);
    assert.ok(Object.values(lowestCrypto).every((value) => value >= 0), `crypto never negative (${date.toISOString().slice(0, 10)})`);
  }
});
