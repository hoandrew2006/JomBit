import assert from "node:assert/strict";
import test from "node:test";
import { createCloudState, isAppState, normalizeCloudState } from "../lib/cloud-state.ts";

test("new cloud accounts start with a safe display name and require onboarding", () => {
  const state = createCloudState({
    email: "new.member@example.com",
    user_metadata: {},
  });

  assert.equal(state.user.name, "new member");
  assert.equal(state.members.me.name, "new member");
  assert.equal(state.user.onboarded, false);
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

