import assert from "node:assert/strict";
import test from "node:test";
import { createCloudState, createDemoState, createEmptyState, isAppState, normalizeCloudState } from "../lib/cloud-state.ts";

test("new cloud accounts start with a safe display name and require onboarding", () => {
  const state = createCloudState({
    email: "new.member@example.com",
    user_metadata: {},
  });

  assert.equal(state.user.name, "new member");
  assert.equal(state.members.me.name, "new member");
  assert.equal(state.user.onboarded, false);
  assert.equal(state.groups.length, 0);
  assert.equal(state.expenses.length, 0);
  assert.equal(state.walletTransactions.length, 0);
  assert.equal(state.fiatBalances.MYR, 0);
  assert.ok(Object.values(state.crypto).every((holding) => holding.available === 0 && holding.staked === 0));
});

test("demo mode is the only new workspace populated with standardized sample data", () => {
  const demo = createDemoState();
  assert.equal(demo.user.name, "Aisha");
  assert.equal(demo.user.onboarded, true);
  assert.ok(demo.groups.length > 0);
  assert.ok(demo.expenses.length > 0);
  assert.ok(demo.walletTransactions.length > 0);
});

test("resetting an account clears activity while preserving its identity and setup", () => {
  const account = createCloudState({ email: "mira@example.com", user_metadata: { display_name: "Mira" } });
  const reset = createEmptyState({ ...account.user, onboarded: true, defaultCurrency: "SGD", duitNowQr: "data:image/png;base64,example" });
  assert.equal(reset.user.name, "Mira");
  assert.equal(reset.user.onboarded, true);
  assert.equal(reset.user.defaultCurrency, "SGD");
  assert.equal(reset.user.duitNowQr, "data:image/png;base64,example");
  assert.deepEqual(reset.groups, []);
  assert.deepEqual(reset.walletTransactions, []);
});

test("account metadata takes priority without changing the JomBit state shape", () => {
  const state = createCloudState({
    email: "ignored@example.com",
    user_metadata: { display_name: "Mira" },
  });

  assert.equal(state.user.name, "Mira");
  assert.equal(isAppState(state), true);
  assert.equal(normalizeCloudState(state)?.user.name, "Mira");
});

test("invalid database documents are rejected instead of replacing live state", () => {
  assert.equal(isAppState(null), false);
  assert.equal(isAppState({ user: { name: "Incomplete" } }), false);
  assert.equal(normalizeCloudState({ state: "not-jombit" }), undefined);
});
