import { calculateExpenseShares } from "./calculations.ts";
import type { AppState, Expense, ExpenseItem } from "./models";
import { demoActivity, PHUKET_GROUP } from "./seed-activity.ts";
import { applyHistory } from "./balance-effects.ts";

const item = (
  id: string,
  name: string,
  quantity: number,
  unitCents: number,
  memberIds: string[],
): ExpenseItem => ({
  id,
  name,
  quantity,
  unitCents,
  allocation: { memberIds },
});

const makeExpense = (
  expense: Omit<Expense, "shares">,
): Expense => ({
  ...expense,
  shares: calculateExpenseShares(
    expense.items,
    expense.taxCents,
    expense.serviceCents,
  ),
});

/** Demo data with its opening balances from about three months ago, before any history is applied. */
export function createSeedOpeningState(now: Date = new Date()): AppState {
  const activity = demoActivity(now);
  const mamakItems = [
    item("seed-i1", "Nasi Goreng Kampung", 2, 1650, ["me", "maya"]),
    item("seed-i2", "Maggi Goreng Special", 1, 1480, ["daniel"]),
    item("seed-i3", "Satay Sharing Platter", 1, 2800, ["me", "maya", "daniel", "sarah"]),
    item("seed-i4", "Teh Tarik", 4, 350, ["me", "maya", "daniel", "sarah"]),
  ];
  const fuelItems = [
    item("seed-i5", "Petrol to Melaka", 1, 7200, ["me", "maya", "daniel", "sarah"]),
    item("seed-i6", "Toll", 1, 2400, ["me", "maya", "daniel", "sarah"]),
  ];
  const bangkokItems = [
    item("seed-i7", "Riverside dinner", 1, 18400, ["me", "aiman", "jules"]),
    item("seed-i8", "Taxi from airport", 1, 8600, ["me", "aiman", "jules"]),
  ];

  return {
    user: {
      id: "me",
      name: "Aisha",
      defaultCurrency: "MYR",
      onboarded: false,
    },
    members: {
      me: { id: "me", name: "Aisha", hasDuitNowQr: true },
      maya: { id: "maya", name: "Maya", hasDuitNowQr: true },
      daniel: { id: "daniel", name: "Daniel", hasDuitNowQr: true },
      sarah: { id: "sarah", name: "Sarah", hasDuitNowQr: false },
      aiman: { id: "aiman", name: "Aiman", hasDuitNowQr: true },
      jules: { id: "jules", name: "Jules", hasDuitNowQr: false },
    },
    groups: [
      {
        id: "g-kl",
        name: "KL Food Crew",
        emoji: "🍜",
        currency: "MYR",
        memberIds: ["me", "maya", "daniel", "sarah"],
      },
      {
        id: "g-bkk",
        name: "Bangkok Weekend",
        emoji: "✈️",
        currency: "MYR",
        memberIds: ["me", "aiman", "jules"],
      },
      PHUKET_GROUP,
    ],
    expenses: [
      makeExpense({
        id: "e-mamak",
        groupId: "g-kl",
        merchant: "Jalan 222 Mamak",
        date: "2026-09-28",
        payerId: "maya",
        currency: "MYR",
        items: mamakItems,
        taxCents: 426,
        serviceCents: 710,
      }),
      makeExpense({
        id: "e-fuel",
        groupId: "g-kl",
        merchant: "Road trip fuel & toll",
        date: "2026-09-24",
        payerId: "me",
        currency: "MYR",
        items: fuelItems,
        taxCents: 0,
        serviceCents: 0,
      }),
      makeExpense({
        id: "e-bkk",
        groupId: "g-bkk",
        merchant: "Bangkok arrival day",
        date: "2026-09-18",
        payerId: "aiman",
        currency: "MYR",
        items: bangkokItems,
        taxCents: 1890,
        serviceCents: 2700,
      }),
      ...activity.expenses,
    ],
    settlements: activity.settlements,
    fiatBalances: { MYR: 120000, SGD: 0, THB: 0, IDR: 0 },
    counterpartBalances: {
      maya: { MYR: 25600 },
      daniel: { MYR: 9300 },
      aiman: { SGD: 4500 },
    },
    crypto: {
      BTC: { asset: "BTC", available: 0.00182, staked: 0, costBasisCents: 72800, firstBoughtAt: "2026-09-24T03:00:00.000Z", lastBoughtAt: "2026-09-24T03:00:00.000Z" },
      ETH: { asset: "ETH", available: 0.042, staked: 0.018, costBasisCents: 72000, firstBoughtAt: "2026-09-26T04:00:00.000Z", lastBoughtAt: "2026-09-26T04:00:00.000Z" },
      SOL: { asset: "SOL", available: 1.4, staked: 2.2, costBasisCents: 234000, firstBoughtAt: "2026-09-25T05:00:00.000Z", lastBoughtAt: "2026-09-25T05:00:00.000Z" },
      ADA: { asset: "ADA", available: 320, staked: 180, costBasisCents: 165000, firstBoughtAt: "2026-09-18T04:00:00.000Z", lastBoughtAt: "2026-09-28T04:00:00.000Z" },
      ATOM: { asset: "ATOM", available: 12, staked: 8, costBasisCents: 41000, firstBoughtAt: "2026-09-19T04:00:00.000Z", lastBoughtAt: "2026-09-19T04:00:00.000Z" },
      AVAX: { asset: "AVAX", available: 5.5, staked: 2, costBasisCents: 69000, firstBoughtAt: "2026-09-21T04:00:00.000Z", lastBoughtAt: "2026-09-21T04:00:00.000Z" },
      DOT: { asset: "DOT", available: 24, staked: 16, costBasisCents: 62000, firstBoughtAt: "2026-09-22T04:00:00.000Z", lastBoughtAt: "2026-09-29T04:00:00.000Z" },
      NEAR: { asset: "NEAR", available: 60, staked: 40, costBasisCents: 84000, firstBoughtAt: "2026-09-23T04:00:00.000Z", lastBoughtAt: "2026-09-23T04:00:00.000Z" },
    },
    walletTransactions: [
      {
        id: "tx-1",
        kind: "topup",
        title: "MYR wallet deposit",
        subtitle: "Starting balance • Today",
        amountCents: 50000,
        currency: "MYR",
        date: "2026-10-01T08:20:00.000Z",
        direction: "in",
      },
      {
        id: "tx-2",
        kind: "transfer",
        title: "Sent to Maya",
        subtitle: "JomBit-to-JomBit • Sep 29",
        amountCents: 4280,
        currency: "MYR",
        date: "2026-09-29T10:15:00.000Z",
        direction: "out",
      },
      ...activity.walletTransactions,
    ],
    card: {
      virtualActive: false,
      frozen: false,
      paymentSource: "fiat",
      paymentAsset: "ETH",
    },
  };
}

/** Demo data with today's balances: the opening balances plus every payment, top-up and reward shown. */
export function createSeedState(now: Date = new Date()): AppState {
  const state = createSeedOpeningState(now);
  const { fiatBalances, crypto } = applyHistory(state, state.walletTransactions);
  return { ...state, fiatBalances, crypto };
}

