import { calculateExpenseShares } from "./calculations";
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
    fiatBalances: { MYR: 184250, SGD: 18450, THB: 326000, IDR: 175000000 },
    counterpartBalances: {
      maya: { MYR: 25600 },
      daniel: { MYR: 9300 },
      aiman: { SGD: 4500 },
    },
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
      {
        id: "tx-3",
        kind: "crypto-buy",
        title: "Bought ETH",
        subtitle: "Demo crypto order • Sep 26",
        amountCents: 3000,
        currency: "MYR",
        date: "2026-09-26T12:00:00.000Z",
        direction: "out",
      },
    ],
    card: {
      virtualActive: false,
      frozen: false,
      paymentSource: "fiat",
    },
  };
}

