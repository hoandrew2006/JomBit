import assert from "node:assert/strict";
import test from "node:test";
import { executeCryptoCommand, holdingMetrics, normalizeCryptoHistory, validQuote } from "../lib/crypto-ledger.ts";

const NOW = Date.parse("2026-10-05T08:00:00.000Z");
const OLD = "2026-09-20T01:00:00.000Z";
const state = () => ({
  fiatBalances: { MYR: 100000, SGD: 0, THB: 0, IDR: 0 },
  crypto: {
    BTC: { asset: "BTC", available: 0.002, staked: 0, costBasisCents: 80000, firstBoughtAt: OLD, lastBoughtAt: OLD },
    ETH: { asset: "ETH", available: 0.6, staked: 0.4, costBasisCents: 800000, firstBoughtAt: OLD, lastBoughtAt: OLD },
    SOL: { asset: "SOL", available: 1.4, staked: 2.2, costBasisCents: 234000, firstBoughtAt: OLD, lastBoughtAt: OLD },
  },
  walletTransactions: [{ id: "old-buy", kind: "crypto-buy", title: "Earlier purchase", date: OLD, amountCents: 800000, direction: "out" }],
  groups: [{ id: "preserve-group" }], expenses: [], settlements: [],
});
const command = (options = {}) => ({ id: "test-stake", asset: "ETH", action: "stake", amount: "0.2", ...options });

test("Stake atomically records a dated local activity without changing cash, costs or earlier history", () => {
  const original = state(), before = structuredClone(original);
  const result = executeCryptoCommand(original, command(), NOW);
  assert.deepEqual(original, before);
  assert.equal(result.crypto.ETH.available, 0.4);
  assert.equal(result.crypto.ETH.staked, 0.6);
  assert.equal(result.fiatBalances, original.fiatBalances);
  assert.equal(result.groups, original.groups);
  assert.equal(result.crypto.ETH.costBasisCents, original.crypto.ETH.costBasisCents);
  assert.equal(result.crypto.ETH.firstBoughtAt, OLD);
  assert.equal(result.crypto.ETH.lastBoughtAt, OLD);
  assert.deepEqual(result.walletTransactions.slice(1), original.walletTransactions);
  const tx = result.walletTransactions[0];
  assert.equal(tx.date, new Date(NOW).toISOString());
  assert.equal(tx.kind, "stake");
  assert.equal(tx.direction, "neutral");
  assert.equal(tx.amountCents, undefined);
  assert.equal(tx.crypto.quantity, 0.2);
  assert.equal(tx.crypto.priceMyr, null);
  assert.equal(tx.crypto.feeCents, 0);
  assert.match(tx.subtitle, /Not sent to Luno/);
});

test("Buying and selling are rejected at the command boundary, even with a valid-looking quote", () => {
  for (const action of ["buy", "sell"]) {
    const original = state(), before = structuredClone(original);
    assert.throws(() => executeCryptoCommand(original, command({ action, quote: { asset: "ETH", priceMyr: 10000, source: "demo", updatedAt: null }, expiresAt: NOW + 60000 }), NOW), /does not support buying or selling/);
    assert.deepEqual(original, before);
  }
});

test("Unstaking conserves all units and historical acquisition details without quotes", () => {
  const original = state();
  const result = executeCryptoCommand(original, command({ action: "unstake", amount: "0.4" }), NOW);
  assert.equal(result.crypto.ETH.available, 1);
  assert.equal(result.crypto.ETH.staked, 0);
  assert.equal(result.crypto.ETH.costBasisCents, 800000);
  assert.equal(result.fiatBalances, original.fiatBalances);
  assert.equal(result.walletTransactions[0].kind, "unstake");
  assert.equal(result.crypto.ETH.firstBoughtAt, OLD);
});

test("BTC stays view-only and unsupported assets cannot stake or unstake", () => {
  for (const asset of ["BTC", "ADA", "INVALID"]) for (const action of ["stake", "unstake"]) {
    assert.throws(() => executeCryptoCommand(state(), command({ asset, action }), NOW), /view-only/);
  }
});

test("Rejects invalid quantities, overspending holdings and excessive precision", () => {
  for (const amount of ["0", "-1", "NaN", "Infinity", "1e-2", "", ".2", "0.000000001", "99999999999999"]) {
    assert.throws(() => executeCryptoCommand(state(), command({ amount }), NOW));
  }
  assert.throws(() => executeCryptoCommand(state(), command({ amount: "0.60000001" }), NOW), /unstaked balance/);
  assert.throws(() => executeCryptoCommand(state(), command({ action: "unstake", amount: "0.40000001" }), NOW), /staked balance/);
});

test("Eight-decimal staking precision is conserved", () => {
  const original = state();
  const staked = executeCryptoCommand(original, command({ amount: "0.00000001" }), NOW);
  const restored = executeCryptoCommand(staked, command({ id: "reverse", action: "unstake", amount: "0.00000001" }), NOW);
  assert.deepEqual(restored.crypto, original.crypto);
});

test("Rejects duplicate confirmations and revalidates competing actions against latest balances", () => {
  const first = executeCryptoCommand(state(), command({ amount: "0.5" }), NOW);
  assert.throws(() => executeCryptoCommand(first, command({ amount: "0.5" }), NOW), /already recorded/);
  assert.throws(() => executeCryptoCommand(first, command({ id: "second", amount: "0.2" }), NOW), /unstaked balance/);
});

test("Unknown acquisition costs and dates stay unknown after staking", () => {
  const original = state();
  original.crypto.ETH.costBasisCents = null;
  original.crypto.ETH.firstBoughtAt = null;
  original.crypto.ETH.lastBoughtAt = null;
  const result = executeCryptoCommand(original, command(), NOW);
  assert.equal(result.crypto.ETH.costBasisCents, null);
  assert.equal(result.crypto.ETH.firstBoughtAt, null);
  assert.equal(result.crypto.ETH.lastBoughtAt, null);
  assert.equal(holdingMetrics(result.crypto.ETH, 10000).pnl, null);
});

test("Valuation is not a staking reward and changing prices cannot change recorded history", () => {
  const original = state();
  assert.deepEqual(holdingMetrics(original.crypto.ETH, 10000), { total: 1, cost: 800000, value: 1000000, averagePrice: 8000, pnl: 200000, pnlPercent: 25 });
  const result = executeCryptoCommand(original, command(), NOW);
  const history = structuredClone(result.walletTransactions);
  assert.equal(holdingMetrics(result.crypto.ETH, 6000).pnl, -200000);
  assert.deepEqual(result.walletTransactions, history);
  assert.equal(result.crypto.ETH.available + result.crypto.ETH.staked, 1);
});

test("Legacy normalization preserves balances, old records and missing acquisition information", () => {
  const original = state();
  delete original.crypto.ETH.costBasisCents;
  delete original.crypto.ETH.firstBoughtAt;
  const normalized = normalizeCryptoHistory(original);
  assert.equal(normalized.crypto.ETH.costBasisCents, null);
  assert.equal(normalized.crypto.ETH.firstBoughtAt, null);
  assert.equal(normalized.crypto.ETH.available, original.crypto.ETH.available);
  assert.deepEqual(normalized.walletTransactions, original.walletTransactions);
  assert.deepEqual(original.walletTransactions[0], normalized.walletTransactions[0]);
});

test("Corrupted balances, invalid actions and unsafe totals are rejected without mutation", () => {
  for (const value of [NaN, Infinity, -1, 1e15]) {
    const original = state(); original.crypto.ETH.available = value;
    assert.throws(() => executeCryptoCommand(original, command(), NOW));
  }
  assert.throws(() => executeCryptoCommand(state(), command({ action: "deposit" }), NOW));
  assert.throws(() => executeCryptoCommand(state(), command({ id: "" }), NOW));
});

test("Public valuation quotes still reject invalid and stale market data", () => {
  const quote = { asset: "ETH", priceMyr: 10000, source: "coingecko", updatedAt: new Date(NOW - 1000).toISOString() };
  assert.equal(validQuote(quote, NOW), true);
  assert.equal(validQuote({ ...quote, priceMyr: 0 }, NOW), false);
  assert.equal(validQuote({ ...quote, updatedAt: new Date(NOW - 181000).toISOString() }, NOW), false);
  assert.equal(validQuote({ ...quote, source: "demo", updatedAt: null }, NOW), true);
});
