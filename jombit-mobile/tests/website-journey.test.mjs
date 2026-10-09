import assert from "node:assert/strict";
import test from "node:test";
import { dinnerItems, dinnerShares, dinnerTotal, exampleBalances, exampleExpenses, examplePayments, separatePayments } from "../src/website/journey-data.ts";

test("Website dinner example preserves the receipt total, tax and service", () => {
  assert.equal(dinnerTotal, 8816);
  assert.equal(Object.values(dinnerShares).reduce((sum, share) => sum + share.totalCents, 0), dinnerTotal);
  assert.deepEqual(Object.values(dinnerShares).map((share) => share.totalCents), [3248, 3248, 1160, 1160]);
  assert.equal(Object.values(dinnerShares).reduce((sum, share) => sum + share.taxCents, 0), 456);
  assert.equal(Object.values(dinnerShares).reduce((sum, share) => sum + share.serviceCents, 0), 760);
});

test("Website assignments charge only the people sharing each item", () => {
  assert.deepEqual(dinnerItems[0].allocation.memberIds, ["aisha", "maya"]);
  assert.equal(dinnerItems[1].allocation.memberIds.length, 4);
  assert.equal(dinnerItems[2].allocation.memberIds.length, 4);
  assert.equal(dinnerShares.daniel.itemsCents, 1000);
  assert.equal(dinnerShares.aisha.itemsCents, 2800);
});

test("The six-to-three payment claim is derived from two real example expenses", () => {
  assert.equal(exampleExpenses.length, 2);
  assert.equal(separatePayments.length, 6);
  assert.equal(examplePayments.length, 3);
  const remaining = { ...exampleBalances };
  for (const payment of examplePayments) {
    remaining[payment.fromId] += payment.amountCents;
    remaining[payment.toId] -= payment.amountCents;
  }
  assert.ok(Object.values(remaining).every((cents) => cents === 0));
  assert.deepEqual(Object.fromEntries(examplePayments.map((payment) => [payment.fromId, payment.amountCents])), { daniel: 1760, sarah: 1760, maya: 1448 });
});
