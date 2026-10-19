import { calculateExpenseShares } from "./calculations.ts";
import { DEMO_CRYPTO_PRICES_MYR, DEMO_FX_IN_MYR } from "./mock-services.ts";
import type { CryptoAsset, Currency, Expense, ExpenseItem, Group, Settlement, SpendCategory, WalletTransaction } from "./models";

// About three months of fictional demo activity, dated relative to `now` so every Insights
// period stays populated. A fixed pseudo-random sequence keeps it identical for the same day.

const DAYS = 92;
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;

function random(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KL = ["me", "maya", "daniel", "sarah"];
const PHUKET = ["me", "aiman", "jules", "maya"];

export const PHUKET_GROUP: Group = { id: "g-hkt", name: "Phuket Getaway", emoji: "🏝️", currency: "THB", memberIds: PHUKET };

// Staked units in the seed state, with an indicative yearly rate used only to size sample records.
const REWARD_ASSETS: { asset: CryptoAsset; staked: number; yearly: number }[] = [
  { asset: "SOL", staked: 2.2, yearly: 0.065 },
  { asset: "ADA", staked: 180, yearly: 0.028 },
  { asset: "DOT", staked: 16, yearly: 0.12 },
  { asset: "NEAR", staked: 40, yearly: 0.09 },
  { asset: "ETH", staked: 0.018, yearly: 0.03 },
  { asset: "ATOM", staked: 8, yearly: 0.15 },
  { asset: "AVAX", staked: 2, yearly: 0.07 },
];

interface Template { title: string; category: SpendCategory; min: number; max: number }
const COFFEE: Template[] = [
  { title: "ZUS Coffee", category: "food", min: 990, max: 1590 },
  { title: "Tealive", category: "food", min: 790, max: 1290 },
  { title: "Nasi lemak breakfast", category: "food", min: 650, max: 1400 },
  { title: "Grab Food · lunch", category: "food", min: 1590, max: 3290 },
  { title: "Kopitiam lunch", category: "food", min: 1100, max: 2200 },
];
const RIDES: Template[] = [
  { title: "Grab ride", category: "transport", min: 1100, max: 3400 },
  { title: "LRT & MRT fares", category: "transport", min: 340, max: 820 },
  { title: "Parking · Mid Valley", category: "transport", min: 400, max: 1200 },
];

export function demoActivity(now: Date) {
  const rand = random(20261018);
  const between = (min: number, max: number) => Math.round((min + rand() * (max - min)) / 10) * 10;
  const pick = <T,>(values: T[]) => values[Math.floor(rand() * values.length)];
  const todayMs = Date.parse(`${new Date(now.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 10)}T00:00:00Z`);
  const dayOf = (daysAgo: number) => new Date(todayMs - daysAgo * 86_400_000);
  const keyOf = (daysAgo: number) => dayOf(daysAgo).toISOString().slice(0, 10);
  // A MYT clock time on that day. Today's records are squeezed into the hours already passed, so
  // the current period is populated even early in the morning and nothing is dated after `now`.
  const at = (daysAgo: number, hour: number, minute = 0) => {
    const midnight = todayMs - daysAgo * 86_400_000 - MYT_OFFSET_MS;
    const offset = (hour * 60 + minute) * 60_000;
    if (midnight + offset <= now.getTime()) return new Date(midnight + offset).toISOString();
    const elapsed = now.getTime() - midnight;
    return daysAgo === 0 && elapsed > 0 ? new Date(midnight + Math.floor(elapsed * (offset / 86_400_000))).toISOString() : null;
  };

  const walletTransactions: WalletTransaction[] = [];
  const expenses: Expense[] = [];
  const settlements: Settlement[] = [];
  let counter = 0;
  const pay = (daysAgo: number, hour: number, template: Template, amountCents = between(template.min, template.max)) => {
    const date = at(daysAgo, hour, Math.floor(rand() * 60));
    if (!date) return;
    walletTransactions.push({ id: `seed-pay-${++counter}`, kind: "payment", title: template.title, subtitle: rand() < 0.5 ? "JomBit Card · preview" : "MYR wallet payment · preview", amountCents, currency: "MYR", date, direction: "out", category: template.category });
  };

  for (let d = DAYS - 1; d >= 0; d--) {
    const dom = dayOf(d).getUTCDate();
    const weekday = dayOf(d).getUTCDay();
    if (rand() < 0.6) pay(d, 8 + Math.floor(rand() * 6), pick(COFFEE));
    if (rand() < 0.4) pay(d, 17 + Math.floor(rand() * 4), pick(RIDES));
    if (weekday === 6) pay(d, 11, { title: "Jaya Grocer", category: "groceries", min: 8500, max: 19000 });
    if (weekday === 3 && rand() < 0.7) pay(d, 19, { title: "99 Speedmart", category: "groceries", min: 1800, max: 4500 });
    if (weekday === 1) pay(d, 7, { title: "Petronas fuel", category: "transport", min: 5500, max: 8500 });
    if (d % 9 === 4) pay(d, 22, { title: "Shopee order", category: "shopping", min: 2900, max: 14900 });
    if (d % 23 === 11) pay(d, 15, { title: "Uniqlo Pavilion", category: "shopping", min: 7900, max: 19900 });
    if (d % 12 === 8) pay(d, 20, { title: "GSC Mid Valley", category: "entertainment", min: 1900, max: 4200 });
    if (d % 14 === 6) pay(d, 18, { title: "Dobi Express laundry", category: "others", min: 1200, max: 2500 });
    if (dom === 5) pay(d, 9, { title: "Netflix", category: "entertainment", min: 5500, max: 5500 });
    if (dom === 12) pay(d, 9, { title: "Spotify Premium", category: "entertainment", min: 1690, max: 1690 });
    if (dom === 3) pay(d, 10, { title: "TNB electricity bill", category: "bills", min: 9800, max: 16500 });
    if (dom === 8) pay(d, 10, { title: "Unifi home fibre", category: "bills", min: 12900, max: 12900 });
    if (dom === 15) pay(d, 10, { title: "Maxis postpaid", category: "bills", min: 6800, max: 6800 });

    // One sample reward record a day, rotating assets, each covering a week of the indicative rate.
    const reward = REWARD_ASSETS[d % REWARD_ASSETS.length];
    const rewardDate = at(d, 9, 30);
    if (rewardDate) {
      const priceMyr = Math.round(DEMO_CRYPTO_PRICES_MYR[reward.asset] * (0.94 + rand() * 0.12) * 100) / 100;
      const quantity = Number(((reward.staked * reward.yearly * 7) / 365).toFixed(8));
      walletTransactions.push({ id: `seed-reward-${d}`, kind: "staking-reward", title: `Sample staking reward · ${reward.asset}`, subtitle: "Illustrative sample record · not added to your balance", date: rewardDate, direction: "neutral", crypto: { asset: reward.asset, quantity, priceMyr, priceSource: "demo", priceUpdatedAt: null, feeCents: 0, seeded: true } });
    }
  }

  const received: [number, string, string, number][] = [
    [6, "Maya sent you money", "Concert tickets · JomBit-to-JomBit", 18000],
    [27, "Daniel sent you money", "Badminton court booking · JomBit-to-JomBit", 4500],
    [44, "Sarah sent you money", "Shared Netflix plan · JomBit-to-JomBit", 1375],
    [63, "Jules sent you money", "Birthday gift pool · JomBit-to-JomBit", 6000],
    [81, "Aiman sent you money", "Event ticket resale · JomBit-to-JomBit", 12000],
  ];
  for (const [daysAgo, title, subtitle, amountCents] of received) {
    const date = at(daysAgo, 13, 15);
    if (date) walletTransactions.push({ id: `seed-received-${daysAgo}`, kind: "received", title, subtitle, amountCents, currency: "MYR", date, direction: "in" });
  }
  for (const [daysAgo, amountCents] of [[5, 20000], [20, 30000], [36, 25000], [52, 50000], [66, 30000], [79, 40000]]) {
    const date = at(daysAgo, 8, 40);
    if (date) walletTransactions.push({ id: `seed-topup-${daysAgo}`, kind: "topup", title: "MYR wallet deposit", subtitle: "Top-up from your bank · preview", amountCents, currency: "MYR", date, direction: "in" });
  }
  // Paying merchants with crypto: one spend entry for what the merchant received, plus a conversion fee.
  const cryptoMerchants: Template[] = [
    { title: "Starbucks Pavilion", category: "food", min: 1590, max: 3290 },
    { title: "Uniqlo KLCC", category: "shopping", min: 7900, max: 21900 },
    { title: "GSC Pavilion", category: "entertainment", min: 2200, max: 4800 },
    { title: "Grab ride", category: "transport", min: 1400, max: 3800 },
    { title: "Sushi Zanmai", category: "food", min: 4500, max: 9800 },
    { title: "Shopee order", category: "shopping", min: 3500, max: 12900 },
  ];
  const cryptoAssets: CryptoAsset[] = ["ETH", "SOL", "BTC", "ADA"];
  for (let d = DAYS - 2, index = 0; d >= 0; d -= 7, index++) {
    const date = at(d, 19, 10);
    if (!date) continue;
    const merchant = cryptoMerchants[index % cryptoMerchants.length];
    const asset = cryptoAssets[index % cryptoAssets.length];
    const amountCents = between(merchant.min, merchant.max);
    const feeCents = Math.max(50, Math.round(amountCents * 0.01));
    const priceMyr = Math.round(DEMO_CRYPTO_PRICES_MYR[asset] * (0.94 + rand() * 0.12) * 100) / 100;
    const quantity = Number(((amountCents + feeCents) / 100 / priceMyr).toFixed(8));
    walletTransactions.push({ id: `seed-crypto-pay-${d}`, kind: "crypto-payment", title: merchant.title, subtitle: `Crypto payment preview · ${asset} converted to MYR for the merchant`, amountCents, currency: "MYR", date, direction: "out", category: merchant.category, crypto: { asset, quantity, priceMyr, priceSource: "demo", priceUpdatedAt: null, feeCents, recipient: merchant.title, seeded: true } });
  }
  const withdrawalDate = at(40, 10, 20);
  if (withdrawalDate) walletTransactions.push({ id: "seed-withdrawal-40", kind: "withdrawal", title: "Withdrawal to your bank", subtitle: "MYR wallet to bank account · preview", amountCents: 25000, currency: "MYR", date: withdrawalDate, direction: "out" });
  const transferDate = at(33, 21, 5);
  if (transferDate) walletTransactions.push({ id: "seed-transfer-33", kind: "transfer", title: "Sent to Daniel", subtitle: "JomBit-to-JomBit transfer · MYR wallet", amountCents: 3500, currency: "MYR", date: transferDate, direction: "out", fiat: { fromCurrency: "MYR", toCurrency: "MYR", fromCents: 3500, toCents: 3500, rate: 1, feeCents: 0, source: "demo" } });

  // Group meals and outings: my share counts as spend, whoever paid.
  const outings: { merchant: string; category: SpendCategory; items: [string, number, number, string[] | "all"][]; sst: boolean; service: boolean }[] = [
    { merchant: "Village Park Nasi Lemak", category: "food", sst: false, service: false, items: [["Nasi lemak ayam goreng", 4, 1650, "all"], ["Teh tarik", 4, 380, "all"], ["Extra sambal sotong", 1, 900, ["me", "maya"]]] },
    { merchant: "Sushi Mentai Mid Valley", category: "food", sst: true, service: true, items: [["Salmon mentai rolls", 2, 1880, "all"], ["Chawanmushi", 2, 690, ["me", "sarah"]], ["Green tea refill", 4, 300, "all"]] },
    { merchant: "Beauty in The Pot hotpot", category: "food", sst: true, service: true, items: [["Twin soup pot", 1, 6800, "all"], ["Wagyu platter", 1, 7800, ["me", "daniel", "maya"]], ["Drinks", 4, 790, "all"]] },
    { merchant: "Lotus's BBQ supplies", category: "groceries", sst: false, service: false, items: [["Chicken wings", 2, 2290, "all"], ["Charcoal & foil", 1, 1890, "all"], ["Ice & soft drinks", 1, 2450, "all"]] },
    { merchant: "Red Box Karaoke", category: "entertainment", sst: true, service: false, items: [["Room · 3 hours", 1, 12000, "all"], ["Snack set", 1, 3800, ["me", "maya", "sarah"]]] },
    { merchant: "Grab to Genting (shared)", category: "transport", sst: false, service: false, items: [["GrabCar XL return trip", 1, 16800, "all"]] },
    { merchant: "Movie night · TGV Sunway", category: "entertainment", sst: false, service: false, items: [["Tickets", 4, 1900, "all"], ["Popcorn combo", 2, 2200, ["me", "daniel"]]] },
  ];
  const sstRate = 0.06;
  let outingIndex = 0;
  for (let d = DAYS - 4; d >= 0; d -= 4) {
    const plan = outings[outingIndex % outings.length];
    const payerId = KL[outingIndex % KL.length];
    outingIndex++;
    const items: ExpenseItem[] = plan.items.map(([name, quantity, unitCents, members], index) => ({ id: `seed-x${d}-i${index}`, name, quantity, unitCents, allocation: { memberIds: members === "all" ? [...KL] : members } }));
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCents, 0);
    const taxCents = plan.sst ? Math.round(subtotal * sstRate) : 0;
    const serviceCents = plan.service ? Math.round(subtotal * 0.1) : 0;
    expenses.push({ id: `seed-x${d}`, groupId: "g-kl", merchant: plan.merchant, date: keyOf(d), payerId, currency: "MYR", items, taxCents, serviceCents, shares: calculateExpenseShares(items, taxCents, serviceCents), category: plan.category, myrRate: 1 });
  }

  // A THB trip, converted to MYR with the rate stored for each day.
  const trip: { daysAgo: number; merchant: string; category: SpendCategory; payerId: string; items: [string, number, number, string[]][] }[] = [
    { daysAgo: 43, merchant: "Patong Bay hotel · 2 nights", category: "travel", payerId: "aiman", items: [["Deluxe room × 2 nights", 2, 240000, PHUKET]] },
    { daysAgo: 43, merchant: "Seafood dinner, Patong", category: "food", payerId: "me", items: [["Seafood platter", 1, 180000, PHUKET], ["Thai iced tea", 4, 9000, PHUKET]] },
    { daysAgo: 42, merchant: "Phi Phi island boat tour", category: "travel", payerId: "jules", items: [["Speedboat tour", 4, 120000, PHUKET]] },
    { daysAgo: 42, merchant: "Songthaew & taxi rides", category: "transport", payerId: "maya", items: [["Rides around Patong", 1, 64000, PHUKET]] },
    { daysAgo: 41, merchant: "Jungceylon mall souvenirs", category: "shopping", payerId: "me", items: [["Souvenir set", 2, 45000, ["me", "maya"]]] },
  ];
  for (const plan of trip) {
    const items: ExpenseItem[] = plan.items.map(([name, quantity, unitCents, members], index) => ({ id: `seed-hkt${plan.daysAgo}-${index}-${plan.payerId}`, name, quantity, unitCents, allocation: { memberIds: members } }));
    const myrRate = Math.round(DEMO_FX_IN_MYR.THB * (0.985 + rand() * 0.03) * 100_000) / 100_000;
    expenses.push({ id: `seed-hkt-${plan.daysAgo}-${plan.payerId}`, groupId: PHUKET_GROUP.id, merchant: plan.merchant, date: keyOf(plan.daysAgo), payerId: plan.payerId, currency: "THB" as Currency, items, taxCents: 0, serviceCents: 0, shares: calculateExpenseShares(items, 0, 0), category: plan.category, myrRate });
  }

  // Settle-ups. Ones I pay are never spend; ones friends pay me are "Repayments" in Money in.
  const used = new Set<string>();
  const settle = (fromId: string, toId: string, daysAgo: number) => {
    const date = at(daysAgo, 20, 30);
    const creditor = fromId === "me" ? toId : "me";
    const expense = expenses.find((item) => item.groupId === "g-kl" && item.payerId === creditor && item.date <= keyOf(daysAgo + 1) && !used.has(item.id) && (item.shares[fromId]?.totalCents ?? 0) > 0);
    const amountCents = expense?.shares[fromId]?.totalCents ?? 0;
    if (!expense || !date || amountCents <= 0) return;
    used.add(expense.id);
    const name = (id: string) => id === "me" ? "Aisha" : id[0].toUpperCase() + id.slice(1);
    settlements.push({ id: `seed-settle-${daysAgo}`, groupId: "g-kl", fromId, toId, amountCents, currency: "MYR", date, paymentMethod: "fiat" });
    walletTransactions.push({ id: `seed-settle-tx-${daysAgo}`, kind: "settlement", title: `${name(fromId)} settled with ${name(toId)}`, subtitle: "KL Food Crew · Fiat settlement preview", amountCents, currency: "MYR", date, direction: fromId === "me" ? "out" : "in" });
  };
  settle("me", "maya", 25);
  for (const [fromId, daysAgo] of [["sarah", 80], ["maya", 62], ["daniel", 45], ["daniel", 18], ["sarah", 9], ["maya", 2]] as const) settle(fromId, "me", daysAgo);

  return { expenses, settlements, walletTransactions };
}
