"use client";

import { useMemo, useState, type ComponentType } from "react";
import { ArrowDownLeft, ArrowLeft, Car, ChevronLeft, ChevronRight, Clapperboard, Coins, HandCoins, Percent, Plane, ReceiptText, Shapes, ShieldCheck, ShoppingBag, ShoppingBasket, Utensils, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/calculations";
import { CATEGORY_LABELS, SPEND_CATEGORIES, insightEntries, isSpendCategory, periodRange, setEntryCategory, summarise, type InsightBucket, type InsightCategory, type InsightEntry, type InsightFlow, type InsightScope, type PeriodKind, type PeriodRange } from "@/lib/insights";
import type { SpendCategory } from "@/lib/models";
import { useAppState } from "@/lib/state";
import { Modal, Segmented } from "./ui";
import "../../src/insights.css";

const ICONS: Record<InsightCategory, ComponentType<{ size?: number }>> = {
  food: Utensils,
  groceries: ShoppingBasket,
  transport: Car,
  shopping: ShoppingBag,
  entertainment: Clapperboard,
  travel: Plane,
  bills: ReceiptText,
  others: Shapes,
  fees: Percent,
  topup: Wallet,
  received: ArrowDownLeft,
  repayment: HandCoins,
  staking: Coins,
};

const PERIOD_NAMES: Record<PeriodKind, [string, string]> = { week: ["This week", "Last week"], month: ["This month", "Last month"], year: ["This year", "Last year"] };
const SCOPES: { value: InsightScope; label: string }[] = [{ value: "all", label: "All" }, { value: "personal", label: "Personal" }, { value: "group", label: "Group" }];
const cryptoAmount = (value: number) => value.toLocaleString("en-MY", { maximumFractionDigits: 8 });
const dayLabel = (day: string) => new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
const periodTitle = (range: PeriodRange) => range.offset === 0 ? PERIOD_NAMES[range.kind][0] : range.offset === -1 ? PERIOD_NAMES[range.kind][1] : range.label;

export function CategoryIcon({ category, size = 18 }: { category: InsightCategory; size?: number }) {
  const Icon = ICONS[category];
  return <span className={`insight-icon insight-cat-${category}`} aria-hidden="true"><Icon size={size} /></span>;
}

function MiniBars({ buckets }: { buckets: InsightBucket[] }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.cents));
  return <div className="insight-mini-bars" aria-hidden="true">{buckets.map((bucket) => <span key={bucket.start} className={bucket.future ? "is-future" : ""}>{!bucket.future && <i style={{ height: `${Math.max(bucket.cents ? 8 : 2, (bucket.cents / max) * 100)}%` }} />}</span>)}</div>;
}

function BarChart({ buckets, hide, flow }: { buckets: InsightBucket[]; hide: (value: string) => string; flow: InsightFlow }) {
  const [active, setActive] = useState<number>();
  const max = Math.max(1, ...buckets.map((bucket) => bucket.cents));
  const shown = active !== undefined && !buckets[active]?.future ? buckets[active] : undefined;
  return <div className={`insight-chart insight-chart-${flow}`} onMouseLeave={() => setActive(undefined)}>
    <div className="insight-chart-tooltip" role="status" aria-live="polite">{shown ? <><strong>{hide(formatMoney(shown.cents))}</strong><small>{shown.tooltip}</small></> : <small>Tap a bar for details</small>}</div>
    <div className="insight-chart-bars" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}>
      {buckets.map((bucket, index) => bucket.future
        ? <span key={bucket.start} className="insight-bar is-future"><span className="insight-bar-track" /><small>{bucket.label}</small></span>
        : <button key={bucket.start} type="button" className={`insight-bar ${active === index ? "is-active" : ""}`} aria-label={`${bucket.tooltip}: ${hide(formatMoney(bucket.cents))}`} aria-pressed={active === index} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)}>
          <span className="insight-bar-track"><i style={{ height: `${bucket.cents ? Math.max(4, (bucket.cents / max) * 100) : 0}%` }} /></span><small>{bucket.label}</small>
        </button>)}
    </div>
  </div>;
}

function PeriodStepper({ range, onStep }: { range: PeriodRange; onStep: (delta: number) => void }) {
  return <div className="insight-stepper">
    <button type="button" className="icon-button" aria-label={`Previous ${range.kind}`} onClick={() => onStep(-1)}><ChevronLeft size={18} /></button>
    <span>{range.label}</span>
    <button type="button" className="icon-button" aria-label={`Next ${range.kind}`} disabled={range.isCurrent} onClick={() => onStep(1)}><ChevronRight size={18} /></button>
  </div>;
}

function EntryRow({ entry, hide, children }: { entry: InsightEntry; hide: (value: string) => string; children?: React.ReactNode }) {
  return <li className="insight-entry">
    <CategoryIcon category={entry.category} />
    <span className="insight-entry-text"><strong>{entry.title}</strong><small>{entry.scope === "group" && <b className="insight-group-badge">Group</b>}{entry.paidWith && <b className="insight-paid-badge">Paid with {entry.paidWith.asset}</b>}{entry.groupName ? `${entry.groupName} · ` : ""}{dayLabel(entry.day)} · {CATEGORY_LABELS[entry.category]}{entry.paidWith && ` · ${hide(`${cryptoAmount(entry.paidWith.quantity)} ${entry.paidWith.asset}`)}`}</small>{children}</span>
    <b className={entry.flow === "in" ? "is-in" : ""}>{hide(`${entry.flow === "in" ? "+" : "−"}${formatMoney(entry.myrCents)}`)}</b>
  </li>;
}

export function InsightsScreen({ balancesVisible = true, now }: { balancesVisible?: boolean; now?: Date }) {
  const { state, setState } = useAppState();
  const [kind, setKind] = useState<PeriodKind>("week");
  const [offset, setOffset] = useState(0);
  const [scope, setScope] = useState<InsightScope>("all");
  const [summaryFlow, setSummaryFlow] = useState<InsightFlow>();
  const [openCategory, setOpenCategory] = useState<InsightCategory>();
  const [shown, setShown] = useState(8);
  const hide = (value: string) => balancesVisible ? value : "••••••";
  const today = now ?? new Date();
  const entries = useMemo(() => insightEntries(state), [state]);
  const range = periodRange(kind, offset, today);
  const changeKind = (next: PeriodKind) => { setKind(next); setOffset(0); setShown(8); };
  const step = (delta: number) => { setOffset((value) => Math.min(0, value + delta)); setShown(8); };

  const daily = { range, scope, granularity: "day" as const };
  const moneyIn = summarise(entries, { ...daily, flow: "in" });
  const spend = summarise(entries, { ...daily, flow: "out" });
  const rewards = summarise(entries, { ...daily, flow: "in", category: "staking" });
  const recent = [...moneyIn.entries, ...spend.entries].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const filters = <div className="insight-filters">
    <Segmented value={scope} onChange={(value) => { setScope(value); setShown(8); }} options={SCOPES} />
  </div>;
  const disclosure = <p className="product-disclosure"><ShieldCheck size={15} /> Insights are calculated from your preview ledger in MYR. Staking rewards are sample records in the demo data; staking in the preview does not create new rewards.</p>;

  if (summaryFlow) {
    const summary = summarise(entries, { range, scope, flow: summaryFlow });
    const categoryEntries = openCategory ? summary.entries.filter((entry) => entry.category === openCategory) : [];
    return <div className="insights insights-summary">
      <header className="insight-summary-head"><button type="button" className="back-button" onClick={() => { setSummaryFlow(undefined); setOpenCategory(undefined); }}><ArrowLeft size={18} /> Insights</button><h2>Summary</h2></header>
      <Segmented value={summaryFlow} onChange={(value) => { setSummaryFlow(value); setOpenCategory(undefined); }} options={[{ value: "in", label: "Money in" }, { value: "out", label: "Spend" }]} />
      <section className="insight-summary-card" aria-label={`${summaryFlow === "in" ? "Money in" : "Spend"} for ${range.label}`}>
        <PeriodStepper range={range} onStep={step} />
        <strong className="insight-summary-total">{hide(formatMoney(summary.totalCents))}</strong>
        <BarChart key={`${kind}-${range.start}-${summaryFlow}-${scope}`} buckets={summary.buckets} hide={hide} flow={summaryFlow} />
        <Segmented value={kind} onChange={changeKind} options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }, { value: "year", label: "Year" }]} />
      </section>
      {filters}
      <section className="section-block insight-categories"><div className="section-heading"><h2>Categories</h2><span>{summary.entries.length} transactions</span></div>
        {!summary.categories.length && <p className="insight-empty">Nothing {summaryFlow === "in" ? "came in" : "was spent"} in this period.</p>}
        <ul>{summary.categories.map((row) => <li key={row.category}><button type="button" onClick={() => setOpenCategory(row.category)}>
          <CategoryIcon category={row.category} />
          <span><strong>{CATEGORY_LABELS[row.category]}</strong><small>{row.count} {row.count === 1 ? "transaction" : "transactions"}</small></span>
          <span className="insight-category-amount"><strong className={summaryFlow === "in" ? "is-in" : ""}>{hide(`${summaryFlow === "in" ? "+" : ""}${formatMoney(row.cents)}`)}</strong><small>{row.percent === 0 && row.cents > 0 ? "<1" : row.percent}%</small></span>
        </button></li>)}</ul>
      </section>
      {disclosure}
      <Modal open={Boolean(openCategory)} onClose={() => setOpenCategory(undefined)} title={openCategory ? CATEGORY_LABELS[openCategory] : "Category"} eyebrow={`${range.label.toUpperCase()} · ${summaryFlow === "in" ? "MONEY IN" : "SPEND"}`}>
        <ul className="insight-entry-list insight-modal-list">{categoryEntries.map((entry) => <EntryRow key={`${entry.source}-${entry.id}`} entry={entry} hide={hide}>
          {isSpendCategory(entry.category) && <label className="insight-category-select"><span>Category</span><select value={entry.category} onChange={(event) => setState((current) => setEntryCategory(current, entry, event.target.value as SpendCategory))}>{SPEND_CATEGORIES.map((value) => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}</select></label>}
        </EntryRow>)}</ul>
        {!categoryEntries.length && <p className="insight-empty">No transactions left in this category.</p>}
      </Modal>
    </div>;
  }

  const topCategories = spend.categories.slice(0, 3);
  return <div className="insights">
    <div className="insight-period">
      <label className="insight-period-picker"><span className="sr-only">Period</span><select value={kind} onChange={(event) => changeKind(event.target.value as PeriodKind)}>{(Object.keys(PERIOD_NAMES) as PeriodKind[]).map((value) => <option key={value} value={value}>{value === kind ? periodTitle(range) : PERIOD_NAMES[value][0]}</option>)}</select></label>
      <PeriodStepper range={range} onStep={step} />
    </div>
    {filters}
    <section className="insight-tiles" aria-label="Insights overview">
      <button type="button" className="insight-tile insight-tile-in" onClick={() => setSummaryFlow("in")}><span>Money in <ChevronRight size={14} /></span><strong>{hide(formatMoney(moneyIn.totalCents))}</strong><MiniBars buckets={moneyIn.buckets} /></button>
      <button type="button" className="insight-tile insight-tile-out" onClick={() => setSummaryFlow("out")}><span>Spend <ChevronRight size={14} /></span><strong>{hide(formatMoney(spend.totalCents))}</strong><MiniBars buckets={spend.buckets} /></button>
      <button type="button" className="insight-tile insight-tile-reward" onClick={() => setSummaryFlow("in")}><span>Staking rewards <ChevronRight size={14} /></span><strong>{hide(formatMoney(rewards.totalCents))}</strong><MiniBars buckets={rewards.buckets} /><small>Sample records</small></button>
      <button type="button" className="insight-tile insight-tile-top" onClick={() => setSummaryFlow("out")}><span>Top category <ChevronRight size={14} /></span><strong>{topCategories[0] ? CATEGORY_LABELS[topCategories[0].category] : "No spend yet"}</strong><span className="insight-top-icons">{topCategories.map((row) => <CategoryIcon key={row.category} category={row.category} size={20} />)}</span></button>
    </section>
    <section className="section-block insight-recent"><div className="section-heading"><h2>Recent transactions</h2><span>{periodTitle(range)}</span></div>
      {!recent.length && <p className="insight-empty">No spending or money in for this period.</p>}
      <ul className="insight-entry-list">{recent.slice(0, shown).map((entry) => <EntryRow key={`${entry.source}-${entry.id}`} entry={entry} hide={hide} />)}</ul>
      {recent.length > shown && <button type="button" className="secondary-button full-width" onClick={() => setShown(shown + 8)}>Show more transactions</button>}
    </section>
    {disclosure}
  </div>;
}
