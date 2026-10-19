import { DEMO_FX_IN_MYR } from "./mock-services.ts";
import type { AppState, CryptoAsset, Currency, SpendCategory } from "./models";

// Insights business rules (see AGENTS.md → Business rules). All classification happens in insightEntries().
// - Spend = my own share of group expenses + my own payments: wallet payments, card spend and crypto payments.
//   A crypto payment counts once, as the MYR the recipient received, in its normal category; its conversion
//   fee is a separate "Fees" entry. Never the full bill I paid upfront, settle-ups I paid, or bank withdrawals.
// - Money in = top-ups + money received from others + repayments (settle-ups received) + staking rewards.
//   The MYR converted from crypto to fund a crypto payment is part of that payment, not money in.
// - Excluded: transfers to friends, conversions between my own balances, crypto receipts and price changes.
// - Everything is shown in MYR, converted with the rate stored on the transaction day.

export type IncomeCategory = "topup" | "received" | "repayment" | "staking";
export type InsightCategory = SpendCategory | "fees" | IncomeCategory;
export type InsightFlow = "in" | "out";
export type InsightScope = "all" | "personal" | "group";
export type PeriodKind = "week" | "month" | "year";

export const SPEND_CATEGORIES: SpendCategory[] = ["food", "groceries", "transport", "shopping", "entertainment", "travel", "bills", "others"];
export const CATEGORY_LABELS: Record<InsightCategory, string> = {
  food: "Food & Drink",
  groceries: "Groceries",
  transport: "Transport",
  shopping: "Shopping",
  entertainment: "Entertainment",
  travel: "Travel",
  bills: "Bills",
  others: "Others",
  fees: "Fees",
  topup: "Top-ups",
  received: "Received from others",
  repayment: "Repayments",
  staking: "Staking rewards",
};

// Checked in order, so more specific words win (e.g. "Grab Food" is food, "Grab" alone is transport).
const CATEGORY_KEYWORDS: [SpendCategory, RegExp][] = [
  ["groceries", /grocer|lotus|speedmart|giant|aeon big|village grocer|mydin|tesco|nsk|supermarket|\bmart\b|market supplies/i],
  ["food", /mamak|restaurant|kopitiam|kopi|coffee|cafe|café|zus|starbucks|tealive|teh|nasi|mee|roti|sushi|hotpot|steamboat|bbq|dinner|lunch|breakfast|brunch|food|bakery|pizza|burger|mcdonald|kfc|satay|dim sum|bistro|bar\b/i],
  ["bills", /\btnb\b|tenaga|unifi|maxis|digi|celcom|\bu mobile|astro|indah water|air selangor|syabas|bill|insurance|rent/i],
  ["transport", /grab|petrol|petronas|shell|caltex|\bbhp\b|fuel|toll|touch ?'?n ?go|parking|\blrt\b|\bmrt\b|ktm|rapidkl|taxi|bus\b|train|e-hailing/i],
  ["travel", /hotel|airasia|malaysia airlines|batik air|flight|airport|airbnb|agoda|booking\.com|resort|hostel|trip|bangkok|phuket|holiday/i],
  ["entertainment", /\bgsc\b|tgv|mbo|cinema|movie|netflix|spotify|disney|karaoke|red box|concert|bowling|arcade|steam|playstation|theme park|sunway lagoon/i],
  ["shopping", /shopee|lazada|zalora|uniqlo|h&m|ikea|mr\.? ?diy|watsons|guardian|sephora|mall|store|shop/i],
];

export function suggestCategory(merchant: string): SpendCategory {
  const text = merchant.trim();
  if (!text) return "others";
  return CATEGORY_KEYWORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? "others";
}

export function isSpendCategory(value: unknown): value is SpendCategory {
  return typeof value === "string" && (SPEND_CATEGORIES as string[]).includes(value);
}

export function toMyrCents(cents: number, currency: Currency = "MYR", rate?: number) {
  if (currency === "MYR") return cents;
  const myrPerUnit = typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : DEMO_FX_IN_MYR[currency];
  return Math.round(cents * myrPerUnit);
}

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Malaysia (UTC+8) calendar day of a timestamp or a plain YYYY-MM-DD date. */
export function dayKey(value: string | Date): string | null {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + MYT_OFFSET_MS).toISOString().slice(0, 10);
}

const keyMs = (key: string) => Date.parse(`${key}T00:00:00Z`);
const msKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export interface InsightEntry {
  id: string;
  source: "expense" | "wallet";
  flow: InsightFlow;
  scope: "personal" | "group";
  category: InsightCategory;
  title: string;
  subtitle: string;
  day: string;
  sortKey: string;
  myrCents: number;
  groupName?: string;
  // Crypto payments: the coin and amount spent, shown as a "Paid with" badge.
  paidWith?: { asset: CryptoAsset; quantity: number };
}

export function insightEntries(state: AppState): InsightEntry[] {
  const entries: InsightEntry[] = [];
  const groups = new Map(state.groups.map((group) => [group.id, group]));
  for (const expense of state.expenses) {
    const share = expense.shares?.me?.totalCents ?? 0;
    const day = dayKey(expense.date);
    if (share <= 0 || !day) continue;
    const group = groups.get(expense.groupId);
    const payer = expense.payerId === "me" ? "You" : state.members[expense.payerId]?.name ?? "A friend";
    entries.push({
      id: expense.id,
      source: "expense",
      flow: "out",
      scope: "group",
      category: isSpendCategory(expense.category) ? expense.category : suggestCategory(expense.merchant),
      title: expense.merchant,
      subtitle: `Your share · ${payer} paid`,
      day,
      sortKey: `${day}T12:00:00.000Z`,
      myrCents: toMyrCents(share, expense.currency, expense.myrRate),
      groupName: group?.name,
    });
  }
  for (const tx of state.walletTransactions) {
    const day = dayKey(tx.date);
    if (!day) continue;
    const base = { id: tx.id, source: "wallet" as const, scope: "personal" as const, title: tx.title, subtitle: tx.subtitle, day, sortKey: tx.date };
    const amount = tx.amountCents && tx.amountCents > 0 ? toMyrCents(tx.amountCents, tx.currency, tx.myrRate) : 0;
    if ((tx.kind === "payment" || tx.kind === "card") && tx.direction === "out" && amount) {
      entries.push({ ...base, flow: "out", category: isSpendCategory(tx.category) ? tx.category : suggestCategory(tx.title), myrCents: amount });
    } else if (tx.kind === "crypto-payment" && tx.direction === "out" && amount && tx.crypto) {
      // One spend entry for what the recipient received; the conversion fee is its own "Fees" entry.
      entries.push({ ...base, flow: "out", category: isSpendCategory(tx.category) ? tx.category : suggestCategory(tx.title), sortKey: `${tx.date}~`, myrCents: amount, paidWith: { asset: tx.crypto.asset, quantity: tx.crypto.quantity } });
      if (tx.crypto.feeCents > 0) entries.push({ ...base, id: `${tx.id}:fee`, title: `Conversion fee · ${tx.title}`, subtitle: `Paid with ${tx.crypto.asset}`, flow: "out", category: "fees", myrCents: tx.crypto.feeCents });
    } else if (tx.kind === "topup" && tx.direction === "in" && amount) {
      entries.push({ ...base, flow: "in", category: "topup", myrCents: amount });
    } else if (tx.kind === "received" && tx.direction === "in" && amount) {
      entries.push({ ...base, flow: "in", category: "received", myrCents: amount });
    } else if (tx.kind === "settlement" && tx.direction === "in" && amount) {
      // A friend repaying me: a group record, so it counts under "Group". Settle-ups I pay are never spend.
      entries.push({ ...base, scope: "group", flow: "in", category: "repayment", myrCents: amount, groupName: tx.groupId ? groups.get(tx.groupId)?.name : undefined });
    } else if (tx.kind === "staking-reward" && tx.crypto?.priceMyr && tx.crypto.quantity > 0) {
      // Valued at the reference price recorded on the reward day, not today's price.
      entries.push({ ...base, flow: "in", category: "staking", myrCents: Math.round(tx.crypto.quantity * tx.crypto.priceMyr * 100) });
    }
  }
  return entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

export interface PeriodRange {
  kind: PeriodKind;
  offset: number;
  start: string;
  end: string;
  today: string;
  label: string;
  isCurrent: boolean;
}

const fmt = (key: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-MY", { timeZone: "UTC", ...options }).format(new Date(keyMs(key)));

/** offset 0 is the current period, -1 the previous one. Future periods are clamped to the current one. */
export function periodRange(kind: PeriodKind, offset: number, now: Date = new Date()): PeriodRange {
  const step = Math.min(0, Math.trunc(offset));
  const today = dayKey(now)!;
  const date = new Date(keyMs(today));
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  let start: number;
  let end: number;
  if (kind === "week") {
    const sinceMonday = (date.getUTCDay() + 6) % 7;
    start = date.getTime() - sinceMonday * DAY_MS + step * 7 * DAY_MS;
    end = start + 6 * DAY_MS;
  } else if (kind === "month") {
    start = Date.UTC(year, month + step, 1);
    end = Date.UTC(year, month + step + 1, 0);
  } else {
    start = Date.UTC(year + step, 0, 1);
    end = Date.UTC(year + step, 11, 31);
  }
  const startKey = msKey(start);
  const endKey = msKey(end);
  const sameYear = startKey.slice(0, 4) === endKey.slice(0, 4) && startKey.slice(0, 4) === today.slice(0, 4);
  const label = kind === "week"
    ? `${fmt(startKey, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) })} – ${fmt(endKey, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) })}`
    : kind === "month" ? fmt(startKey, { month: "long", year: "numeric" }) : startKey.slice(0, 4);
  return { kind, offset: step, start: startKey, end: endKey, today, label, isCurrent: step === 0 };
}

export interface InsightBucket {
  start: string;
  end: string;
  label: string;
  tooltip: string;
  future: boolean;
  cents: number;
}

/** Daily bars for a week, Monday–Sunday weekly bars for a month, monthly bars for a year. "day" forces daily bars. */
export function periodBuckets(range: PeriodRange, granularity: "auto" | "day" = "auto"): Omit<InsightBucket, "cents">[] {
  const unit = granularity === "day" && range.kind !== "year" ? "day" : range.kind === "week" ? "day" : range.kind === "month" ? "week" : "month";
  const out: Omit<InsightBucket, "cents">[] = [];
  const last = keyMs(range.end);
  if (unit === "day") {
    for (let ms = keyMs(range.start); ms <= last; ms += DAY_MS) {
      const key = msKey(ms);
      out.push({ start: key, end: key, label: String(new Date(ms).getUTCDate()), tooltip: fmt(key, { weekday: "short", day: "numeric", month: "short" }), future: key > range.today });
    }
  } else if (unit === "week") {
    let ms = keyMs(range.start);
    while (ms <= last) {
      const sinceMonday = (new Date(ms).getUTCDay() + 6) % 7;
      const endMs = Math.min(ms + (6 - sinceMonday) * DAY_MS, last);
      const start = msKey(ms);
      const end = msKey(endMs);
      out.push({ start, end, label: String(new Date(ms).getUTCDate()), tooltip: start === end ? fmt(start, { day: "numeric", month: "short" }) : `${fmt(start, { day: "numeric" })} – ${fmt(end, { day: "numeric", month: "short" })}`, future: start > range.today });
      ms = endMs + DAY_MS;
    }
  } else {
    const year = Number(range.start.slice(0, 4));
    for (let month = 0; month < 12; month++) {
      const start = msKey(Date.UTC(year, month, 1));
      const end = msKey(Date.UTC(year, month + 1, 0));
      out.push({ start, end, label: fmt(start, { month: "narrow" }), tooltip: fmt(start, { month: "long", year: "numeric" }), future: start > range.today });
    }
  }
  return out;
}

export interface CategorySummary {
  category: InsightCategory;
  count: number;
  cents: number;
  percent: number;
}

export interface InsightSummary {
  range: PeriodRange;
  totalCents: number;
  buckets: InsightBucket[];
  categories: CategorySummary[];
  entries: InsightEntry[];
}

export function matchesScope(entry: InsightEntry, scope: InsightScope) {
  return scope === "all" || entry.scope === scope;
}

export function summarise(all: InsightEntry[], options: { range: PeriodRange; flow: InsightFlow; scope?: InsightScope; category?: InsightCategory; granularity?: "auto" | "day" }): InsightSummary {
  const { range, flow, scope = "all", category } = options;
  // Never count anything after today, even if a record is dated in the future.
  const lastDay = range.end < range.today ? range.end : range.today;
  const entries = all.filter((entry) => entry.flow === flow && matchesScope(entry, scope) && (!category || entry.category === category) && entry.day >= range.start && entry.day <= lastDay);
  const totalCents = entries.reduce((sum, entry) => sum + entry.myrCents, 0);
  const buckets = periodBuckets(range, options.granularity).map((bucket) => ({
    ...bucket,
    cents: bucket.future ? 0 : entries.filter((entry) => entry.day >= bucket.start && entry.day <= bucket.end).reduce((sum, entry) => sum + entry.myrCents, 0),
  }));
  const byCategory = new Map<InsightCategory, CategorySummary>();
  for (const entry of entries) {
    const row = byCategory.get(entry.category) ?? { category: entry.category, count: 0, cents: 0, percent: 0 };
    row.count += 1;
    row.cents += entry.myrCents;
    byCategory.set(entry.category, row);
  }
  const categories = [...byCategory.values()]
    .map((row) => ({ ...row, percent: totalCents > 0 ? Math.round((row.cents / totalCents) * 100) : 0 }))
    .sort((a, b) => b.cents - a.cents || CATEGORY_LABELS[a.category].localeCompare(CATEGORY_LABELS[b.category]));
  return { range, totalCents, buckets, categories, entries };
}

/** Writes a user-chosen category onto the underlying expense or wallet record. */
export function setEntryCategory(state: AppState, entry: Pick<InsightEntry, "id" | "source">, category: SpendCategory): AppState {
  if (!isSpendCategory(category)) throw new Error("Choose a valid category.");
  if (entry.source === "expense") return { ...state, expenses: state.expenses.map((expense) => expense.id === entry.id ? { ...expense, category } : expense) };
  return { ...state, walletTransactions: state.walletTransactions.map((tx) => tx.id === entry.id && (tx.kind === "payment" || tx.kind === "card" || tx.kind === "crypto-payment") ? { ...tx, category } : tx) };
}
