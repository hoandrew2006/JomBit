import { calculateExpenseShares } from "./calculations.ts";
import type { AppState, Expense, ExpenseItem } from "./models";

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

export function createSeedState(): AppState {
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
    ],
    settlements: [],
    fiatBalances: { MYR: 184250, SGD: 0, THB: 0, IDR: 0 },
    counterpartBalances: {
      maya: { MYR: 25600 },
      daniel: { MYR: 9300 },
      aiman: { SGD: 4500 },
    },
    // Demo balances held in the user's linked Luno account. JomBit never buys, sells or holds crypto.
    crypto: {
      BTC: { asset: "BTC", available: 0.00182, staked: 0 },
      ETH: { asset: "ETH", available: 0.042, staked: 0.018 },
      SOL: { asset: "SOL", available: 1.4, staked: 2.2 },
    },
    walletTransactions: [
      {
        id: "tx-1",
        kind: "topup",
        title: "Demo wallet top up",
        subtitle: "Simulated FPX • Today",
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
      // Staking activity only (staked, rewards, unstaked). SOL: 2.5 staked − 0.3 unstaked = 2.2 staked.
      { id: "seed-sol-reward", kind: "staking-reward", title: "SOL staking reward — Demo", subtitle: "Illustrative example paid into your Luno account. Not a promise of future rewards.", date: "2026-10-03T02:00:00.000Z", direction: "in", crypto: { asset: "SOL", quantity: 0.0124, seeded: true } },
      { id: "seed-sol-unstake", kind: "unstake", title: "Unstaked SOL — Demo", subtitle: "Seeded example in your Luno account", date: "2026-10-02T09:30:00.000Z", direction: "neutral", crypto: { asset: "SOL", quantity: 0.3, seeded: true } },
      { id: "seed-eth-reward", kind: "staking-reward", title: "ETH staking reward — Demo", subtitle: "Illustrative example paid into your Luno account. Not a promise of future rewards.", date: "2026-10-01T02:00:00.000Z", direction: "in", crypto: { asset: "ETH", quantity: 0.00004, seeded: true } },
      { id: "seed-sol-stake", kind: "stake", title: "Staked SOL — Demo", subtitle: "Seeded example in your Luno account", date: "2026-09-26T06:00:00.000Z", direction: "neutral", crypto: { asset: "SOL", quantity: 2.5, seeded: true } },
      { id: "seed-eth-stake", kind: "stake", title: "Staked ETH — Demo", subtitle: "Seeded example in your Luno account", date: "2026-09-26T05:00:00.000Z", direction: "neutral", crypto: { asset: "ETH", quantity: 0.018, seeded: true } },
    ],
    card: {
      virtualActive: false,
      frozen: false,
      paymentSource: "fiat",
    },
  };
}

