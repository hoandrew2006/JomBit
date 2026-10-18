import assert from "node:assert/strict";
import test from "node:test";
import { calculateExpenseShares } from "../lib/calculations.ts";
import { insightEntries, periodBuckets, periodRange, setEntryCategory, suggestCategory, summarise, toMyrCents } from "../lib/insights.ts";
import { createSeedState } from "../lib/seed.ts";

// Sunday 18 Oct 2026, 12:00 MYT.
const NOW = new Date("2026-10-18T04:00:00.000Z");

function baseState() {
  const items = [
    { id: "i1", name: "Dinner", quantity: 1, unitCents: 10000, allocation: { memberIds: ["me", "maya"] } },
    { id: "i2", name: "Drinks", quantity: 1, unitCents: 2000, allocation: { memberIds: ["maya"] } },
  ];
  return {
    user: { id: "me", name: "Aisha", defaultCurrency: "MYR", onboarded: true },
    members: { me: { id: "me", name: "Aisha" }, maya: { id: "maya", name: "Maya" } },
    groups: [{ id: "g1", name: "Crew", emoji: "🍜", currency: "MYR", memberIds: ["me", "maya"] }, { id: "g2", name: "Trip", emoji: "✈️", currency: "THB", memberIds: ["me", "maya"] }],
    expenses: [
      // I paid the whole RM120 bill upfront, but my share is RM50.
      { id: "e1", groupId: "g1", merchant: "Jalan 222 Mamak", date: "2026-10-14", payerId: "me", currency: "MYR", items, taxCents: 0, serviceCents: 0, shares: calculateExpenseShares(items, 0, 0) },
      { id: "e2", groupId: "g2", merchant: "Phuket hotel", date: "2026-10-13", payerId: "maya", currency: "THB", items: [{ id: "t1", name: "Room", quantity: 1, unitCents: 200000, allocation: { memberIds: ["me", "maya"] } }], taxCents: 0, serviceCents: 0, shares: { me: { itemsCents: 100000, taxCents: 0, serviceCents: 0, totalCents: 100000 }, maya: { itemsCents: 100000, taxCents: 0, serviceCents: 0, totalCents: 100000 } }, myrRate: 0.13 },
      { id: "e3", groupId: "g1", merchant: "Maya only", date: "2026-10-14", payerId: "maya", currency: "MYR", items: [], taxCents: 0, serviceCents: 0, shares: { maya: { itemsCents: 900, taxCents: 0, serviceCents: 0, totalCents: 900 } } },
    ],
    settlements: [],
    fiatBalances: { MYR: 100000, SGD: 0, THB: 0, IDR: 0 },
    counterpartBalances: {},
    crypto: {},
    walletTransactions: [
      { id: "w1", kind: "payment", title: "Grab ride", subtitle: "", amountCents: 1500, currency: "MYR", date: "2026-10-15T01:00:00.000Z", direction: "out" },
      { id: "w2", kind: "payment", title: "Shopee order", subtitle: "", amountCents: 4000, currency: "MYR", date: "2026-10-12T16:30:00.000Z", direction: "out", category: "bills" },
      { id: "w3", kind: "received", title: "Maya sent you money", subtitle: "", amountCents: 3000, currency: "MYR", date: "2026-10-16T05:00:00.000Z", direction: "in" },
      { id: "w4", kind: "staking-reward", title: "Sample staking reward · SOL", subtitle: "", date: "2026-10-17T01:30:00.000Z", direction: "neutral", crypto: { asset: "SOL", quantity: 0.01, priceMyr: 700, priceSource: "demo", priceUpdatedAt: null, feeCents: 0, seeded: true } },
      // None of these count.
      { id: "x1", kind: "settlement", title: "Maya settled with Aisha", subtitle: "", amountCents: 5000, currency: "MYR", date: "2026-10-16T05:00:00.000Z", direction: "in" },
      { id: "x2", kind: "settlement", title: "Aisha settled with Maya", subtitle: "", amountCents: 700, currency: "MYR", date: "2026-10-16T05:00:00.000Z", direction: "out" },
      { id: "x3", kind: "topup", title: "MYR wallet deposit", subtitle: "", amountCents: 50000, currency: "MYR", date: "2026-10-16T05:00:00.000Z", direction: "in" },
      { id: "x4", kind: "exchange", title: "SGD → MYR", subtitle: "", amountCents: 9000, currency: "MYR", date: "2026-10-16T05:00:00.000Z", direction: "in" },
      { id: "x5", kind: "transfer", title: "Sent to Maya", subtitle: "", amountCents: 2000, currency: "MYR", date: "2026-10-16T05:00:00.000Z", direction: "out" },
      { id: "x6", kind: "stake", title: "Staked SOL", subtitle: "", date: "2026-10-16T05:00:00.000Z", direction: "neutral", crypto: { asset: "SOL", quantity: 1, priceMyr: null, priceSource: null, priceUpdatedAt: null, feeCents: 0 } },
      { id: "x7", kind: "crypto-receive", title: "Received ETH", subtitle: "", date: "2026-10-16T05:00:00.000Z", direction: "in", crypto: { asset: "ETH", quantity: 1, priceMyr: 14000, priceSource: "demo", priceUpdatedAt: null, feeCents: 0 } },
    ],
    card: { virtualActive: false, frozen: false, paymentSource: "fiat" },
  };
}

test("Spend counts only my share of group bills plus my own payments; settle-ups and transfers never count", () => {
  const week = summarise(insightEntries(baseState()), { range: periodRange("week", 0, NOW), flow: "out" });
  // RM50 share (not the RM120 I paid) + THB1,000 × 0.13 + RM15 Grab + RM40 Shopee.
  assert.equal(week.totalCents, 5000 + 13000 + 1500 + 4000);
  assert.deepEqual(week.entries.map((entry) => entry.id).sort(), ["e1", "e2", "w1", "w2"]);
});

test("Money in is sample staking rewards plus non-settle-up money received; top-ups, exchanges and crypto receipts are excluded", () => {
  const week = summarise(insightEntries(baseState()), { range: periodRange("week", 0, NOW), flow: "in" });
  assert.equal(week.totalCents, 3000 + 700);
  assert.deepEqual(week.categories.map((row) => [row.category, row.cents, row.percent]), [["received", 3000, 81], ["staking", 700, 19]]);
});

test("Foreign amounts use the stored day rate, falling back to the demo rate for older records", () => {
  assert.equal(toMyrCents(100000, "THB", 0.13), 13000);
  assert.equal(toMyrCents(100000, "THB"), 12900);
  assert.equal(toMyrCents(1234, "MYR", 9), 1234);
  const legacy = baseState();
  delete legacy.expenses[1].myrRate;
  assert.equal(insightEntries(legacy).find((entry) => entry.id === "e2").myrCents, 12900);
});

test("Categories are suggested from the merchant, stored choices win and can be changed later", () => {
  assert.equal(suggestCategory("Jalan 222 Mamak"), "food");
  assert.equal(suggestCategory("Jaya Grocer"), "groceries");
  assert.equal(suggestCategory("Grab ride"), "transport");
  assert.equal(suggestCategory("Grab Food · lunch"), "food");
  assert.equal(suggestCategory("Road trip fuel & toll"), "transport");
  assert.equal(suggestCategory("Bangkok arrival day"), "travel");
  assert.equal(suggestCategory("GSC Mid Valley"), "entertainment");
  assert.equal(suggestCategory("TNB electricity bill"), "bills");
  assert.equal(suggestCategory("Shopee order"), "shopping");
  assert.equal(suggestCategory("Mystery shop?"), "shopping");
  assert.equal(suggestCategory("Something"), "others");
  const state = baseState();
  const entries = insightEntries(state);
  assert.equal(entries.find((entry) => entry.id === "w2").category, "bills", "a stored category beats the suggestion");
  const changed = setEntryCategory(setEntryCategory(state, { id: "e1", source: "expense" }, "entertainment"), { id: "w1", source: "wallet" }, "others");
  assert.equal(changed.expenses[0].category, "entertainment");
  assert.equal(changed.walletTransactions[0].category, "others");
  assert.equal(state.expenses[0].category, undefined, "the original state is not mutated");
  assert.throws(() => setEntryCategory(state, { id: "e1", source: "expense" }, "crypto"));
});

test("Personal and Group filters split wallet spend from group shares", () => {
  const entries = insightEntries(baseState());
  const range = periodRange("week", 0, NOW);
  assert.equal(summarise(entries, { range, flow: "out", scope: "group" }).totalCents, 18000);
  assert.equal(summarise(entries, { range, flow: "out", scope: "personal" }).totalCents, 5500);
  const group = entries.find((entry) => entry.id === "e1");
  assert.equal(group.scope, "group");
  assert.equal(group.groupName, "Crew");
});

test("Periods use Malaysia days, never chart the future and can only step backwards", () => {
  const thursday = new Date("2026-10-15T04:00:00.000Z");
  const week = periodRange("week", 0, thursday);
  assert.deepEqual([week.start, week.end, week.label, week.isCurrent], ["2026-10-12", "2026-10-18", "12 Oct – 18 Oct", true]);
  assert.deepEqual(periodBuckets(week).map((bucket) => bucket.future), [false, false, false, false, true, true, true]);
  assert.deepEqual(periodRange("week", 3, thursday), week, "future periods clamp to the current one");
  assert.equal(periodRange("week", -1, thursday).start, "2026-10-05");
  assert.equal(periodRange("month", -1, thursday).label, "September 2026");
  assert.equal(periodRange("year", 0, thursday).label, "2026");
  const month = periodBuckets(periodRange("month", 0, thursday));
  assert.deepEqual(month.map((bucket) => [bucket.start, bucket.end]), [["2026-10-01", "2026-10-04"], ["2026-10-05", "2026-10-11"], ["2026-10-12", "2026-10-18"], ["2026-10-19", "2026-10-25"], ["2026-10-26", "2026-10-31"]]);
  assert.deepEqual(month.map((bucket) => bucket.future), [false, false, false, true, true]);
  const year = periodBuckets(periodRange("year", 0, thursday));
  assert.equal(year.length, 12);
  assert.equal(year.filter((bucket) => !bucket.future).length, 10);
  // 16:30 UTC on 12 Oct is 00:30 on 13 Oct in Malaysia.
  assert.equal(insightEntries(baseState()).find((entry) => entry.id === "w2").day, "2026-10-13");
  // Records after today are ignored, and future buckets stay empty.
  const state = baseState();
  state.walletTransactions.push({ id: "future", kind: "payment", title: "Later", subtitle: "", amountCents: 99900, currency: "MYR", date: "2026-10-17T02:00:00.000Z", direction: "out" });
  const summary = summarise(insightEntries(state), { range: week, flow: "out" });
  assert.equal(summary.entries.some((entry) => entry.id === "future"), false);
  assert.ok(summary.buckets.filter((bucket) => bucket.future).every((bucket) => bucket.cents === 0));
});

test("Older saved state without categories or new kinds still produces insights", () => {
  const legacy = createSeedState(NOW);
  legacy.expenses = legacy.expenses.map(({ category, myrRate, ...expense }) => expense);
  legacy.walletTransactions = legacy.walletTransactions.filter((tx) => !["payment", "received", "staking-reward"].includes(tx.kind));
  const entries = insightEntries(legacy);
  assert.ok(entries.length > 0);
  assert.ok(entries.every((entry) => entry.flow === "out" && entry.scope === "group" && entry.category));
});

test("Demo data populates every period across the last three months without future records", () => {
  const state = createSeedState(NOW);
  const entries = insightEntries(state);
  assert.equal(JSON.stringify(createSeedState(NOW)), JSON.stringify(state), "demo data is deterministic for a given day");
  for (const kind of ["week", "month"]) {
    for (let offset = 0; offset > (kind === "week" ? -12 : -3); offset--) {
      const range = periodRange(kind, offset, NOW);
      assert.ok(summarise(entries, { range, flow: "out" }).totalCents > 0, `${kind} ${offset} spend`);
      assert.ok(summarise(entries, { range, flow: "in" }).totalCents > 0, `${kind} ${offset} money in`);
    }
  }
  const quarter = summarise(entries, { range: periodRange("year", 0, NOW), flow: "out" });
  assert.equal(new Set(quarter.categories.map((row) => row.category)).size, 8, "every spend category appears");
  assert.ok(quarter.entries.some((entry) => entry.scope === "group") && quarter.entries.some((entry) => entry.scope === "personal"));
  assert.ok(state.walletTransactions.every((tx) => Date.parse(tx.date) <= NOW.getTime()));
  assert.ok(state.walletTransactions.some((tx) => tx.kind === "settlement") && state.settlements.length === 2);
  assert.ok(state.walletTransactions.filter((tx) => tx.kind === "staking-reward").every((tx) => tx.amountCents === undefined && /Sample/.test(tx.title)), "sample rewards never move MYR");
  assert.ok(state.expenses.some((expense) => expense.currency === "THB" && expense.myrRate));
  assert.equal(state.walletTransactions.filter((tx) => tx.kind === "crypto-buy" || tx.kind === "crypto-sell").length, 0);
});
