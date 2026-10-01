"use client";

import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Plus,
  ReceiptText,
  Users,
  WalletCards,
} from "lucide-react";
import { groupBalances, formatMoney } from "@/lib/calculations";
import { useAppState } from "@/lib/state";
import type { Group } from "@/lib/models";
import { Avatar, PageHeader } from "./ui";

interface Props {
  onScan: () => void;
  onCreateGroup: () => void;
  onOpenGroup: (group: Group) => void;
  onSettleGroup: (group: Group) => void;
  onWallet: () => void;
}

export function HomeScreen({ onScan, onCreateGroup, onOpenGroup, onSettleGroup, onWallet }: Props) {
  const { state } = useAppState();
  const groupStats = state.groups.map((group) => {
    const expenses = state.expenses.filter((expense) => expense.groupId === group.id);
    const balances = groupBalances(group, state.expenses, state.settlements);
    const spent = expenses.reduce(
      (sum, expense) =>
        sum + expense.items.reduce((subtotal, item) => subtotal + item.quantity * item.unitCents, 0) + expense.taxCents + expense.serviceCents,
      0,
    );
    return { group, expenses, balances, spent };
  });
  const net = groupStats.reduce((sum, item) => sum + (item.balances.me ?? 0), 0);
  const owed = Math.max(0, net);
  const owe = Math.max(0, -net);
  const monthlySpending = state.expenses.reduce(
    (sum, expense) => sum + (expense.shares.me?.totalCents ?? 0),
    0,
  );
  const recentExpenses = [...state.expenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <div className="screen home-screen">
      <PageHeader
        eyebrow="Your shared money, simplified"
        title={`Good afternoon, ${state.user.name.split(" ")[0]}`}
        action={<Avatar name={state.user.name} size="lg" />}
      />

      <section className="hero-panel">
        <div className="hero-copy">
          <span className="demo-label">JOMBIT GROUP LEDGER</span>
          <h2>Every bite counted.<br />Every cent accounted for.</h2>
          <p>Scan a receipt and let JomBit work out the fair split.</p>
          <button className="light-button" onClick={onScan}><Camera size={18} /> Scan a receipt</button>
        </div>
        <div className="hero-rings" aria-hidden="true"><i /><i /><i /></div>
      </section>

      <section className="summary-grid" aria-label="Financial summary">
        <article className="summary-card debt-card">
          <span>You owe</span>
          <strong>{formatMoney(owe)}</strong>
          <small>{owe ? "Across your active groups" : "Nothing due right now"}</small>
        </article>
        <article className="summary-card credit-card">
          <span>You are owed</span>
          <strong>{formatMoney(owed)}</strong>
          <small>{owed ? "Friends owe this to you" : "Everyone is even"}</small>
        </article>
        <article className="mini-summary"><Users size={18} /><span><strong>{state.groups.length}</strong> active groups</span></article>
        <article className="mini-summary"><ReceiptText size={18} /><span><strong>{formatMoney(monthlySpending)}</strong> your shared spend</span></article>
      </section>

      {owe > 0 && (
        <button
          className="settle-banner"
          onClick={() => {
            const first = groupStats.find((item) => (item.balances.me ?? 0) < 0);
            if (first) onSettleGroup(first.group);
          }}
        >
          <span className="settle-icon"><ArrowUpRight size={20} /></span>
          <span><strong>Ready to settle up?</strong><small>You have {formatMoney(owe)} outstanding</small></span>
          <ArrowRight size={19} />
        </button>
      )}

      <section className="section-block">
        <div className="section-heading"><h2>Quick actions</h2></div>
        <div className="quick-actions">
          <button onClick={onScan}><span><Camera size={20} /></span>Scan receipt</button>
          <button onClick={onScan}><span><ReceiptText size={20} /></span>Add expense</button>
          <button onClick={onCreateGroup}><span><Plus size={20} /></span>Create group</button>
          <button onClick={onWallet}><span><WalletCards size={20} /></span>Open wallet</button>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading"><h2>Your groups</h2><button onClick={onCreateGroup}>New <Plus size={16} /></button></div>
        <div className="horizontal-groups">
          {groupStats.map(({ group, balances, spent }) => (
            <button className="group-preview" key={group.id} onClick={() => onOpenGroup(group)}>
              <span className="group-emoji">{group.emoji}</span>
              <span className="group-name">{group.name}</span>
              <small>{group.memberIds.length} people · {formatMoney(spent, group.currency)}</small>
              <span className={balances.me >= 0 ? "positive" : "negative"}>
                {balances.me >= 0 ? "You’re owed " : "You owe "}{formatMoney(Math.abs(balances.me), group.currency)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="section-block activity-block">
        <div className="section-heading"><h2>Latest shared expenses</h2></div>
        <div className="activity-list">
          {recentExpenses.map((expense) => {
            const group = state.groups.find((item) => item.id === expense.groupId)!;
            const total = expense.items.reduce((sum, item) => sum + item.quantity * item.unitCents, 0) + expense.taxCents + expense.serviceCents;
            return (
              <button className="activity-row" key={expense.id} onClick={() => onOpenGroup(group)}>
                <span className="activity-icon"><ReceiptText size={18} /></span>
                <span><strong>{expense.merchant}</strong><small>{group.name} · {expense.date}</small></span>
                <span className="activity-amount"><strong>{formatMoney(total, expense.currency)}</strong><small>Your share {formatMoney(expense.shares.me?.totalCents ?? 0, expense.currency)}</small></span>
              </button>
            );
          })}
          <button className="activity-row" onClick={onWallet}>
            <span className="activity-icon wallet-icon"><ArrowDownLeft size={18} /></span>
            <span><strong>Demo wallet top up</strong><small>JomBit Wallet · simulated</small></span>
            <span className="activity-amount positive"><strong>+{formatMoney(50000)}</strong><small>No real funds moved</small></span>
          </button>
        </div>
      </section>
    </div>
  );
}

