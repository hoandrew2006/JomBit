import assert from "node:assert/strict";
import test from "node:test";
import { executeCryptoCommand, executeCryptoReceive, executeCryptoTransfer, holdingMetrics, normalizeCryptoHistory, validQuote } from "../lib/crypto-ledger.ts";

const NOW = Date.parse("2026-10-05T08:00:00.000Z");
const OLD = "2026-09-20T01:00:00.000Z";
const state = () => ({
  fiatBalances: { MYR: 100000, SGD: 0, THB: 0, IDR: 0 },
  crypto: {
    BTC: { asset: "BTC", available: 0.002, staked: 0, costBasisCents: 80000, firstBoughtAt: OLD, lastBoughtAt: OLD },
    ETH: { asset: "ETH", available: 0.6, staked: 0.4, costBasisCents: 800000, firstBoughtAt: OLD, lastBoughtAt: OLD },
    SOL: { asset: "SOL", available: 1.4, staked: 2.2, costBasisCents: 234000, firstBoughtAt: OLD, lastBoughtAt: OLD },
    ADA: { asset: "ADA", available: 300, staked: 200, costBasisCents: 160000, firstBoughtAt: OLD, lastBoughtAt: OLD },
    ATOM: { asset: "ATOM", available: 12, staked: 8, costBasisCents: 40000, firstBoughtAt: OLD, lastBoughtAt: OLD },
    AVAX: { asset: "AVAX", available: 5, staked: 2, costBasisCents: 65000, firstBoughtAt: OLD, lastBoughtAt: OLD },
    DOT: { asset: "DOT", available: 24, staked: 16, costBasisCents: 60000, firstBoughtAt: OLD, lastBoughtAt: OLD },
    NEAR: { asset: "NEAR", available: 60, staked: 40, costBasisCents: 80000, firstBoughtAt: OLD, lastBoughtAt: OLD },
  },
  walletTransactions: [{ id: "old-buy", kind: "crypto-buy", title: "Earlier purchase", date: OLD, amountCents: 800000, direction: "out" }],
  groups: [{ id: "preserve-group" }], expenses: [], settlements: [],
});
const command = (options = {}) => ({ id: "test-stake", asset: "ETH", action: "stake", amount: "0.2", ...options });

test("Transfer spends only available units, allocates cost and preserves cash and staking", () => {
  const original = state(), before = structuredClone(original);
  const cmd = { id: "outgoing", asset: "ETH", amount: "0.2", recipient: "Travel wallet" };
  const result = executeCryptoTransfer(original, cmd, NOW);
  assert.deepEqual(original, before);
  assert.equal(result.crypto.ETH.available, 0.4);
  assert.equal(result.crypto.ETH.staked, 0.4);
  assert.equal(result.crypto.ETH.costBasisCents, 640000);
  assert.equal(result.fiatBalances, original.fiatBalances);
  assert.equal(result.walletTransactions[0].kind, "crypto-transfer");
  assert.equal(result.walletTransactions[0].crypto.recipient, "Travel wallet");
  assert.equal(result.walletTransactions[0].direction, "out");
  assert.throws(() => executeCryptoTransfer(result, cmd), /already recorded/);
  assert.throws(() => executeCryptoTransfer(result, { ...cmd, id: "next", amount: "0.5" }), /Not enough available/);
});

test("Transfer rejects invalid input and supports the smallest unit without inventing costs", () => {
  const cmd = { id: "transfer", asset: "BTC", amount: "0.00000001", recipient: "Other wallet" };
  const original = state(); original.crypto.BTC.costBasisCents = null;
  const result = executeCryptoTransfer(original, cmd);
  assert.equal(result.crypto.BTC.available, 0.00199999);
  assert.equal(result.crypto.BTC.costBasisCents, null);
  for (const amount of ["0", "-1", "NaN", "1e-2", "0.000000001", "99999999999999"]) assert.throws(() => executeCryptoTransfer(original, { ...cmd, amount }));
  for (const recipient of ["", "a", "x".repeat(81), "https://wallet.example"]) assert.throws(() => executeCryptoTransfer(original, { ...cmd, recipient }));
  assert.throws(() => executeCryptoTransfer(original, { ...cmd, asset: "INVALID" }));
});

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
  assert.match(tx.subtitle, /not sent to Luno/i);
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

test("BTC stays hold-only and unsupported assets cannot stake or unstake", () => {
  for (const asset of ["BTC", "INVALID"]) for (const action of ["stake", "unstake"]) {
    assert.throws(() => executeCryptoCommand(state(), command({ asset, action }), NOW), /not to stake/);
  }
});

test("Every documented staking asset moves between available and staked balances", () => {
  for (const asset of ["ETH", "SOL", "ADA", "ATOM", "AVAX", "DOT", "NEAR"]) {
    const original = state();
    const result = executeCryptoCommand(original, command({ id: `stake-${asset}`, asset, amount: "0.1" }), NOW);
    assert.ok(Math.abs(result.crypto[asset].available - (original.crypto[asset].available - 0.1)) < 1e-8);
    assert.ok(Math.abs(result.crypto[asset].staked - (original.crypto[asset].staked + 0.1)) < 1e-8);
  }
});

test("Receiving crypto adds only to the available balance and records an incoming transfer", () => {
  const original = state(), before = structuredClone(original);
  const result = executeCryptoReceive(original, { id: "receive-btc", asset: "BTC", amount: "0.00012" }, NOW);
  assert.deepEqual(original, before);
  assert.equal(result.crypto.BTC.available, 0.00212);
  assert.equal(result.crypto.BTC.staked, 0);
  assert.equal(result.crypto.BTC.costBasisCents, null, "A transfer must not invent acquisition cost");
  assert.equal(result.fiatBalances, original.fiatBalances);
  assert.equal(result.walletTransactions[0].kind, "crypto-receive");
  assert.equal(result.walletTransactions[0].direction, "in");
  assert.equal(result.walletTransactions[0].amountCents, undefined);
  assert.equal(result.walletTransactions[0].crypto.quantity, 0.00012);
  assert.match(result.walletTransactions[0].subtitle, /no blockchain transfer/i);
});

test("A deposit with a live price records that price and adds its value at arrival to the recorded cost", () => {
  const quote = { asset: "BTC", priceMyr: 400000, change24h: 0, updatedAt: new Date(NOW - 20_000).toISOString(), source: "coingecko" };
  const result = executeCryptoReceive(state(), { id: "receive-priced", asset: "BTC", amount: "0.00012", quote }, NOW);
  const tx = result.walletTransactions[0];
  assert.deepEqual([tx.crypto.priceMyr, tx.crypto.priceSource, tx.amountCents], [400000, "coingecko", undefined], "no MYR moves");
  assert.equal(result.crypto.BTC.costBasisCents, 80000 + 4800, "0.00012 BTC × RM400,000 = RM48.00 added to the cost");
  // A stale, wrong-coin or sample price is not recorded, so the cost becomes unknown as before.
  for (const bad of [{ ...quote, updatedAt: new Date(NOW - 600_000).toISOString() }, { ...quote, asset: "ETH" }, { ...quote, source: "demo", updatedAt: null }]) {
    const unpriced = executeCryptoReceive(state(), { id: "receive-bad", asset: "BTC", amount: "0.00012", quote: bad }, NOW);
    assert.deepEqual([unpriced.walletTransactions[0].crypto.priceMyr, unpriced.crypto.BTC.costBasisCents], [null, null]);
  }
});

test("Incoming crypto rejects duplicate, invalid and unsafe transfers", () => {
  const received = executeCryptoReceive(state(), { id: "receive-eth", asset: "ETH", amount: "0.1" }, NOW);
  assert.throws(() => executeCryptoReceive(received, { id: "receive-eth", asset: "ETH", amount: "0.1" }, NOW), /already recorded/);
  for (const amount of ["", "0", "-1", ".2", "0.000000001", "NaN"]) {
    assert.throws(() => executeCryptoReceive(state(), { id: `bad-${amount}`, asset: "ETH", amount }, NOW));
  }
  assert.throws(() => executeCryptoReceive(state(), { id: "bad-asset", asset: "INVALID", amount: "1" }, NOW), /supported crypto asset/);
});

test("Legacy wallets gain zeroed holdings for newly supported assets", () => {
  const original = state();
  for (const asset of ["ADA", "ATOM", "AVAX", "DOT", "NEAR"]) delete original.crypto[asset];
  const normalized = normalizeCryptoHistory(original);
  for (const asset of ["ADA", "ATOM", "AVAX", "DOT", "NEAR"]) {
    assert.deepEqual(normalized.crypto[asset], { asset, available: 0, staked: 0, costBasisCents: 0, firstBoughtAt: null, lastBoughtAt: null });
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
