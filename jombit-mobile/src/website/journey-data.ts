import { calculateExpenseShares, expenseTotal, groupBalances, simplifyDebts } from "../../lib/calculations.ts";
import type { Expense, ExpenseItem, Group } from "../../lib/models";

// One fictional group, shared by the website previews. No app state or API calls.
export const dinnerPeople = [
  { id: "aisha", name: "Aisha", initial: "A" },
  { id: "maya", name: "Maya", initial: "M" },
  { id: "daniel", name: "Daniel", initial: "D" },
  { id: "sarah", name: "Sarah", initial: "S" },
];
const everyone = dinnerPeople.map(({ id }) => id);
export const dinnerItems: ExpenseItem[] = [
  { id: "nasi", name: "Nasi lemak × 2", quantity: 2, unitCents: 1800, allocation: { memberIds: ["aisha", "maya"] } },
  { id: "satay", name: "Satay platter", quantity: 1, unitCents: 2400, allocation: { memberIds: everyone } },
  { id: "tea", name: "Teh tarik × 4", quantity: 4, unitCents: 400, allocation: { memberIds: everyone } },
];
export const dinnerTax = 456;
export const dinnerService = 760;
export const dinnerTotal = expenseTotal(dinnerItems, dinnerTax, dinnerService);
export const dinnerShares = calculateExpenseShares(dinnerItems, dinnerTax, dinnerService);
export const dinnerGroup: Group = { id: "website-dinner", name: "KL dinner crew", emoji: "", currency: "MYR", memberIds: everyone };
const taxiItems: ExpenseItem[] = [{ id: "taxi", name: "Taxi home", quantity: 1, unitCents: 2400, allocation: { memberIds: everyone } }];
export const exampleExpenses: Expense[] = [
  { id: "dinner", groupId: dinnerGroup.id, merchant: "JomBit sample cafe", date: "2026-10-05", payerId: "aisha", currency: "MYR", items: dinnerItems, taxCents: dinnerTax, serviceCents: dinnerService, shares: dinnerShares },
  { id: "taxi", groupId: dinnerGroup.id, merchant: "Taxi home", date: "2026-10-05", payerId: "maya", currency: "MYR", items: taxiItems, taxCents: 0, serviceCents: 0, shares: calculateExpenseShares(taxiItems, 0, 0) },
];
export const separatePayments = exampleExpenses.flatMap((expense) => Object.entries(expense.shares)
  .filter(([id, share]) => id !== expense.payerId && share.totalCents > 0)
  .map(([id, share]) => ({ fromId: id, toId: expense.payerId, amountCents: share.totalCents })));
export const exampleBalances = groupBalances(dinnerGroup, exampleExpenses, []);
export const examplePayments = simplifyDebts(exampleBalances);
export const personName = (id: string) => dinnerPeople.find((person) => person.id === id)?.name ?? id;
