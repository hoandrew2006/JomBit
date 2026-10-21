import type { AppState, Currency } from "./models";

// Creating groups and adding people. Shared by the Groups screen and the receipt flow, so a group made
// or a person added mid-receipt follows exactly the same rules.
const MAX_NAME = 40;
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const same = (a: string, b: string) => clean(a).toLowerCase() === clean(b).toLowerCase();

/** "Maya, Daniel,  Sarah" → ["Maya", "Daniel", "Sarah"]. */
export function splitMemberNames(text: string) {
  return text.split(",").map(clean).filter(Boolean);
}

function checkName(state: AppState, existingIds: string[], name: string) {
  if (!name) throw new Error("Enter a name.");
  if (name.length > MAX_NAME) throw new Error(`Names can be up to ${MAX_NAME} characters.`);
  if (same(name, state.user.name)) throw new Error("That's your name, and you're already in the group. Add a friend's name instead.");
  const existing = existingIds.find((id) => id !== "me" && same(state.members[id]?.name ?? "", name));
  if (existing) throw new Error(`${state.members[existing].name} is already in this group.`);
}

const freshId = (state: AppState, prefix: string, now: number) => {
  let id = `${prefix}-${now}`;
  for (let n = 1; state.members[id] || state.groups.some((group) => group.id === id); n++) id = `${prefix}-${now}-${n}`;
  return id;
};

export function createGroup(state: AppState, input: { name: string; emoji?: string; currency: Currency; memberNames: string[] }, now = Date.now()) {
  const name = clean(input.name);
  if (!name) throw new Error("Give the group a name.");
  if (name.length > MAX_NAME) throw new Error(`Group names can be up to ${MAX_NAME} characters.`);
  let next = state;
  const memberIds = ["me"];
  for (const raw of input.memberNames) {
    const member = clean(raw);
    checkName(next, memberIds, member);
    const id = freshId(next, "m", now);
    next = { ...next, members: { ...next.members, [id]: { id, name: member } } };
    memberIds.push(id);
  }
  const groupId = freshId(next, "g", now);
  next = { ...next, groups: [...next.groups, { id: groupId, name, emoji: clean(input.emoji ?? "") || "✨", currency: input.currency, memberIds }] };
  return { state: next, groupId };
}

export function addGroupMember(state: AppState, groupId: string, rawName: string, now = Date.now()) {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) throw new Error("This group no longer exists.");
  const name = clean(rawName);
  checkName(state, group.memberIds, name);
  const memberId = freshId(state, "m", now);
  return {
    memberId,
    state: {
      ...state,
      members: { ...state.members, [memberId]: { id: memberId, name } },
      groups: state.groups.map((item) => item.id === groupId ? { ...item, memberIds: [...item.memberIds, memberId] } : item),
    },
  };
}

/** Where a member still appears in a group's ledger: expenses they paid for or share in, and settle-ups. */
export function memberUsage(state: AppState, groupId: string, memberId: string) {
  const expenses = state.expenses.filter((expense) => expense.groupId === groupId && (expense.payerId === memberId || expense.items.some((item) => item.allocation.memberIds.includes(memberId))));
  const settlements = state.settlements.filter((settlement) => settlement.groupId === groupId && (settlement.fromId === memberId || settlement.toId === memberId));
  return { expenses, settlements };
}

/**
 * Removes someone from a group. You can't remove yourself, and someone still on an expense or a settle-up
 * can't be removed, because that would quietly change everyone's balances: edit those expenses first.
 */
export function removeGroupMember(state: AppState, groupId: string, memberId: string) {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) throw new Error("This group no longer exists.");
  if (memberId === "me") throw new Error("You can't remove yourself from a group.");
  if (!group.memberIds.includes(memberId)) throw new Error("This person isn't in the group.");
  const name = state.members[memberId]?.name ?? "This person";
  const { expenses, settlements } = memberUsage(state, groupId, memberId);
  if (expenses.length) throw new Error(`${name} is still on ${expenses.length === 1 ? "1 expense" : `${expenses.length} expenses`}. Edit ${expenses.length === 1 ? "it" : "them"} to move their items to someone else first.`);
  if (settlements.length) throw new Error(`${name} has a recorded settle-up in this group, so they can't be removed.`);
  return { ...state, groups: state.groups.map((item) => item.id === groupId ? { ...item, memberIds: item.memberIds.filter((id) => id !== memberId) } : item) };
}
