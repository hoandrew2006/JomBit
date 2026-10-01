import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateProportionally,
  calculateExpenseShares,
  expenseTotal,
  groupBalances,
  simplifyDebts,
  splitCents,
} from "../lib/calculations.ts";
import { convertCurrencyCents } from "../lib/mock-services.ts";

test("splits indivisible cents deterministically", () => {
  assert.deepEqual(splitCents(100, ["a", "b", "c"]), { a: 34, b: 33, c: 33 });
});

test("allocates tax and service charge without losing a cent", () => {
  const items = [
    { id: "1", name: "Shared", quantity: 1, unitCents: 1001, allocation: { memberIds: ["a", "b", "c"] } },
    { id: "2", name: "Solo", quantity: 1, unitCents: 777, allocation: { memberIds: ["b"] } },
  ];
  const shares = calculateExpenseShares(items, 107, 189);
  assert.equal(Object.values(shares).reduce((sum, share) => sum + share.totalCents, 0), expenseTotal(items, 107, 189));
  assert.equal(Object.values(shares).reduce((sum, share) => sum + share.taxCents, 0), 107);
  assert.equal(Object.values(shares).reduce((sum, share) => sum + share.serviceCents, 0), 189);
});

test("proportional rounding is deterministic", () => {
  assert.deepEqual(allocateProportionally(7, { a: 1, b: 1, c: 1 }), { a: 3, b: 2, c: 2 });
});

test("ledger derives balances from expenses and settlements", () => {
  const group = { id: "g", name: "Test", emoji: "T", currency: "MYR", memberIds: ["a", "b", "c"] };
  const items = [{ id: "1", name: "Meal", quantity: 1, unitCents: 3000, allocation: { memberIds: ["a", "b", "c"] } }];
  const expense = { id: "e", groupId: "g", merchant: "Cafe", date: "2026-01-01", payerId: "a", currency: "MYR", items, taxCents: 0, serviceCents: 0, shares: calculateExpenseShares(items, 0, 0) };
  assert.deepEqual(groupBalances(group, [expense], []), { a: 2000, b: -1000, c: -1000 });
  assert.deepEqual(groupBalances(group, [expense], [{ id: "s", groupId: "g", fromId: "b", toId: "a", amountCents: 1000, currency: "MYR", date: "" }]), { a: 1000, b: 0, c: -1000 });
});

test("debt simplification clears balances with a small payment set", () => {
  const suggestions = simplifyDebts({ a: 5000, b: 2500, c: -4000, d: -3500 });
  assert.deepEqual(suggestions, [
    { fromId: "c", toId: "a", amountCents: 4000 },
    { fromId: "d", toId: "b", amountCents: 2500 },
    { fromId: "d", toId: "a", amountCents: 1000 },
  ]);
});

test("static currency conversion is reversible within rounding", () => {
  const sgd = convertCurrencyCents(10000, "MYR", "SGD");
  const myr = convertCurrencyCents(sgd, "SGD", "MYR");
  assert.ok(Math.abs(myr - 10000) <= 2);
});
