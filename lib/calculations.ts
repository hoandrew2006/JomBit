import type {
  Currency,
  Expense,
  ExpenseItem,
  Group,
  MemberShare,
  Settlement,
  SettlementSuggestion,
} from "./models";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  MYR: "RM",
  SGD: "S$",
  THB: "฿",
  IDR: "Rp",
};

export function formatMoney(cents: number, currency: Currency = "MYR") {
  const value = cents / 100;
  return `${CURRENCY_SYMBOLS[currency]}${new Intl.NumberFormat("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export function expenseSubtotal(items: ExpenseItem[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitCents, 0);
}

export function expenseTotal(
  items: ExpenseItem[],
  taxCents: number,
  serviceCents: number,
) {
  return expenseSubtotal(items) + taxCents + serviceCents;
}

export function splitCents(totalCents: number, memberIds: string[]) {
  if (!memberIds.length) return {} as Record<string, number>;
  const base = Math.floor(totalCents / memberIds.length);
  let remainder = totalCents - base * memberIds.length;
  return memberIds.reduce<Record<string, number>>((result, id) => {
    result[id] = base + (remainder > 0 ? 1 : 0);
    remainder -= remainder > 0 ? 1 : 0;
    return result;
  }, {});
}

export function allocateProportionally(
  totalCents: number,
  weights: Record<string, number>,
) {
  const entries = Object.entries(weights);
  const weightTotal = entries.reduce((sum, [, value]) => sum + value, 0);
  if (totalCents === 0) {
    return Object.fromEntries(entries.map(([id]) => [id, 0]));
  }
  if (weightTotal <= 0) return {} as Record<string, number>;

  const parts = entries.map(([id, weight]) => {
    const exact = (totalCents * weight) / weightTotal;
    const floor = Math.floor(exact);
    return { id, cents: floor, fraction: exact - floor };
  });
  let remainder = totalCents - parts.reduce((sum, part) => sum + part.cents, 0);
  parts
    .sort((a, b) => b.fraction - a.fraction || a.id.localeCompare(b.id))
    .forEach((part) => {
      if (remainder > 0) {
        part.cents += 1;
        remainder -= 1;
      }
    });
  return Object.fromEntries(parts.map((part) => [part.id, part.cents]));
}

export function calculateExpenseShares(
  items: ExpenseItem[],
  taxCents: number,
  serviceCents: number,
) {
  const itemTotals: Record<string, number> = {};
  for (const item of items) {
    const total = item.quantity * item.unitCents;
    const split = splitCents(total, item.allocation.memberIds);
    for (const [memberId, cents] of Object.entries(split)) {
      itemTotals[memberId] = (itemTotals[memberId] ?? 0) + cents;
    }
  }
  const tax = allocateProportionally(taxCents, itemTotals);
  const service = allocateProportionally(serviceCents, itemTotals);
  return Object.fromEntries(
    Object.keys(itemTotals).map((memberId) => {
      const itemsCents = itemTotals[memberId];
      const taxCentsForMember = tax[memberId] ?? 0;
      const serviceCentsForMember = service[memberId] ?? 0;
      const share: MemberShare = {
        itemsCents,
        taxCents: taxCentsForMember,
        serviceCents: serviceCentsForMember,
        totalCents: itemsCents + taxCentsForMember + serviceCentsForMember,
      };
      return [memberId, share];
    }),
  );
}

export function groupBalances(
  group: Group,
  expenses: Expense[],
  settlements: Settlement[],
) {
  const balances = Object.fromEntries(group.memberIds.map((id) => [id, 0]));
  expenses
    .filter((expense) => expense.groupId === group.id)
    .forEach((expense) => {
      balances[expense.payerId] =
        (balances[expense.payerId] ?? 0) +
        expenseTotal(expense.items, expense.taxCents, expense.serviceCents);
      Object.entries(expense.shares).forEach(([memberId, share]) => {
        balances[memberId] = (balances[memberId] ?? 0) - share.totalCents;
      });
    });
  settlements
    .filter((settlement) => settlement.groupId === group.id)
    .forEach((settlement) => {
      balances[settlement.fromId] =
        (balances[settlement.fromId] ?? 0) + settlement.amountCents;
      balances[settlement.toId] =
        (balances[settlement.toId] ?? 0) - settlement.amountCents;
    });
  return balances;
}

export function simplifyDebts(balances: Record<string, number>) {
  const creditors = Object.entries(balances)
    .filter(([, cents]) => cents > 0)
    .map(([id, cents]) => ({ id, cents }));
  const debtors = Object.entries(balances)
    .filter(([, cents]) => cents < 0)
    .map(([id, cents]) => ({ id, cents: Math.abs(cents) }));
  const result: SettlementSuggestion[] = [];

  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.cents - a.cents || a.id.localeCompare(b.id));
    debtors.sort((a, b) => b.cents - a.cents || a.id.localeCompare(b.id));
    const creditor = creditors[0];
    const debtor = debtors[0];
    const amountCents = Math.min(creditor.cents, debtor.cents);
    if (amountCents <= 0) break;
    result.push({ fromId: debtor.id, toId: creditor.id, amountCents });
    creditor.cents -= amountCents;
    debtor.cents -= amountCents;
    if (creditor.cents <= 1) creditors.shift();
    if (debtor.cents <= 1) debtors.shift();
  }
  return result;
}

