import assert from "node:assert/strict";
import test from "node:test";
import { addGroupMember, createGroup, splitMemberNames } from "../lib/groups.ts";

const base = () => ({
  user: { id: "me", name: "Ian", defaultCurrency: "MYR", onboarded: true },
  members: { me: { id: "me", name: "Ian" } },
  groups: [], expenses: [], settlements: [], fiatBalances: { MYR: 0, SGD: 0, THB: 0, IDR: 0 }, counterpartBalances: {}, crypto: {}, walletTransactions: [],
  card: { virtualActive: false, frozen: false, paymentSource: "fiat" },
});

test("Creating a group adds you plus each invited friend, with tidy names", () => {
  const { state, groupId } = createGroup(base(), { name: "  Dinner   club ", currency: "MYR", memberNames: splitMemberNames(" Rayn,Rayna , , Raynard ") }, 1000);
  const group = state.groups.find((item) => item.id === groupId);
  assert.deepEqual([group.name, group.emoji, group.currency], ["Dinner club", "✨", "MYR"]);
  assert.deepEqual(group.memberIds.map((id) => state.members[id].name), ["Ian", "Rayn", "Rayna", "Raynard"]);
  assert.equal(new Set(group.memberIds).size, 4, "every member gets its own id");
  assert.throws(() => createGroup(base(), { name: "  ", currency: "MYR", memberNames: [] }), /Give the group a name/);
});

test("You can't be added twice, and the same friend can't be added twice", () => {
  assert.throws(() => createGroup(base(), { name: "Trip", currency: "MYR", memberNames: ["Maya", "ian"] }), /your name/);
  assert.throws(() => createGroup(base(), { name: "Trip", currency: "MYR", memberNames: ["Maya", "maya "] }), /already in this group/);
  const { state, groupId } = createGroup(base(), { name: "Trip", currency: "MYR", memberNames: ["Maya"] }, 1000);
  assert.throws(() => addGroupMember(state, groupId, " MAYA", 2000), /Maya is already in this group\./);
  assert.throws(() => addGroupMember(state, groupId, "Ian", 2000), /your name/);
  assert.throws(() => addGroupMember(state, groupId, "   ", 2000), /Enter a name/);
  assert.throws(() => addGroupMember(state, "missing", "Daniel", 2000), /no longer exists/);
});

test("Adding a member at the last minute puts them in that group only, ready to be assigned items", () => {
  let { state, groupId } = createGroup(base(), { name: "Trip", currency: "MYR", memberNames: ["Maya"] }, 1000);
  ({ state } = createGroup(state, { name: "Other", currency: "SGD", memberNames: [] }, 1000));
  const before = structuredClone(state);
  const result = addGroupMember(state, groupId, "Daniel", 1000);
  assert.deepEqual(state, before, "the original state is not changed");
  const trip = result.state.groups.find((item) => item.id === groupId);
  assert.equal(result.state.members[result.memberId].name, "Daniel");
  assert.equal(trip.memberIds.at(-1), result.memberId);
  assert.equal(result.state.groups.find((item) => item.name === "Other").memberIds.length, 1);
  assert.ok(!Object.keys(state.members).includes(result.memberId), "a fresh id even when created in the same millisecond");
});
