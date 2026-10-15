import assert from "node:assert/strict";
import test from "node:test";
import { executeCryptoCommand, holdingMetrics, isStakingActivity, normalizeCryptoHistory, stakingRewardsReceived, validQuote } from "../lib/crypto-ledger.ts";
import { createSeedState } from "../lib/seed.ts";

const NOW = Date.parse("2026-10-05T08:00:00.000Z");
const OLD = "2026-09-20T01:00:00.000Z";
const state = () => ({
  fiatBalances: { MYR: 100000, SGD: 0, THB: 0, IDR: 0 },
  crypto: {
    BTC: { asset: "BTC", available: 0.002, staked: 0 },
    ETH: { asset: "ETH", available: 0.6, staked: 0.4 },
    SOL: { asset: "SOL", available: 1.4, staked: 2.2 },
  },
  walletTransactions: [{ id: "old-stake", kind: "stake", title: "Staked ETH — Demo", date: OLD, direction: "neutral", crypto: { asset: "ETH", quantity: 0.4 } }],
  groups: [{ id: "preserve-group" }], expenses: [], settlements: [],
});
const command = (options = {}) => ({ id: "test-stake", asset: "ETH", action: "stake", amount: "0.2", ...options });

test("Stake atomically records a dated local activity without changing cash or earlier history", () => {
  const original = state(), before = structuredClone(original);
  const result = executeCryptoCommand(original, command(), NOW);
  assert.deepEqual(original, before);
  assert.equal(result.crypto.ETH.available, 0.4);
  assert.equal(result.crypto.ETH.staked, 0.6);
  assert.equal(result.fiatBalances, original.fiatBalances);
  assert.equal(result.groups, original.groups);
  assert.deepEqual(result.walletTransactions.slice(1), original.walletTransactions);
  const tx = result.walletTransactions[0];
  assert.equal(tx.date, new Date(NOW).toISOString());
  assert.equal(tx.kind, "stake");
  assert.equal(tx.direction, "neutral");
  assert.equal(tx.amountCents, undefined);
  assert.equal(tx.crypto.quantity, 0.2);
  assert.deepEqual(tx.crypto, { asset: "ETH", quantity: 0.2 }, "Staking records carry no price, cost or fee");
  assert.match(tx.subtitle, /Not sent to Luno/);
});

test("Buying and selling are rejected at the command boundary, even with a valid-looking quote", () => {
  for (const action of ["buy", "sell"]) {
    const original = state(), before = structuredClone(original);
    assert.throws(() => executeCryptoCommand(original, command({ action, quote: { asset: "ETH", priceMyr: 10000, source: "demo", updatedAt: null }, expiresAt: NOW + 60000 }), NOW), /does not support buying or selling/);
    assert.deepEqual(original, before);
  }
});

test("Unstaking conserves all units without quotes", () => {
  const original = state();
  const result = executeCryptoCommand(original, command({ action: "unstake", amount: "0.4" }), NOW);
  assert.equal(result.crypto.ETH.available, 1);
  assert.equal(result.crypto.ETH.staked, 0);
  assert.equal(result.fiatBalances, original.fiatBalances);
  assert.equal(result.walletTransactions[0].kind, "unstake");
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

test("Holdings show total held and reference value only: no purchase cost or profit/loss", () => {
  const original = state();
  assert.deepEqual(holdingMetrics(original.crypto.ETH, 10000), { total: 1, value: 1000000 });
  assert.deepEqual(holdingMetrics(original.crypto.ETH), { total: 1, value: null });
  const result = executeCryptoCommand(original, command(), NOW);
  const history = structuredClone(result.walletTransactions);
  assert.equal(holdingMetrics(result.crypto.ETH, 6000).value, 600000);
  assert.deepEqual(result.walletTransactions, history, "Price changes never alter recorded activity");
  assert.equal(result.crypto.ETH.available + result.crypto.ETH.staked, 1);
});

test("Loading saved data removes earlier buy/sell records and purchase-cost fields, keeping balances and staking", () => {
  const original = state();
  Object.assign(original.crypto.ETH, { costBasisCents: 800000, firstBoughtAt: OLD, lastBoughtAt: OLD });
  original.walletTransactions.push(
    { id: "old-buy", kind: "crypto-buy", title: "Bought ETH", date: OLD, amountCents: 800000, currency: "MYR", direction: "out", crypto: { asset: "ETH", quantity: 1, priceMyr: 8000 } },
    { id: "old-sell", kind: "crypto-sell", title: "Sold SOL", date: OLD, amountCents: 5000, currency: "MYR", direction: "in" },
    { id: "topup", kind: "topup", title: "MYR deposit", date: OLD, amountCents: 1000, currency: "MYR", direction: "in" },
  );
  const before = structuredClone(original);
  const normalized = normalizeCryptoHistory(original);
  assert.deepEqual(original, before, "Normalisation does not mutate the input");
  assert.deepEqual(normalized.walletTransactions.map((tx) => tx.id), ["old-stake", "topup"]);
  assert.deepEqual(normalized.crypto.ETH, { asset: "ETH", available: 0.6, staked: 0.4 });
  assert.equal(normalized.fiatBalances, original.fiatBalances, "MYR balance is not changed");
  assert.equal(normalized.groups, original.groups);
  assert.deepEqual(normalizeCryptoHistory(normalized), normalized, "Safe to run on every load");
});

test("Demo data has no crypto purchases: staking events only, and the SOL history adds up", () => {
  const seed = createSeedState();
  assert.ok(seed.walletTransactions.every((tx) => !/crypto-buy|crypto-sell/.test(tx.kind) && !/\b(Bought|Sold|Buy|Sell)\b/.test(tx.title)));
  const crypto = seed.walletTransactions.filter((tx) => tx.crypto);
  assert.ok(crypto.length > 0 && crypto.every(isStakingActivity));
  assert.deepEqual([...new Set(crypto.map((tx) => tx.kind))].sort(), ["stake", "staking-reward", "unstake"]);
  assert.ok(crypto.every((tx) => tx.amountCents === undefined), "Staking never moves MYR");
  for (const holding of Object.values(seed.crypto)) assert.deepEqual(Object.keys(holding).sort(), ["asset", "available", "staked"]);
  const sol = (kind) => crypto.filter((tx) => tx.kind === kind && tx.crypto.asset === "SOL").reduce((sum, tx) => sum + tx.crypto.quantity, 0);
  assert.ok(Math.abs(sol("stake") - sol("unstake") - seed.crypto.SOL.staked) < 1e-9);
  assert.equal(stakingRewardsReceived(seed.walletTransactions, "SOL"), 0.0124);
  assert.equal(stakingRewardsReceived(seed.walletTransactions, "BTC"), 0);
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
