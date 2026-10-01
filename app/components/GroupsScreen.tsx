"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Plus,
  ReceiptText,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { expenseTotal, formatMoney, groupBalances, simplifyDebts } from "@/lib/calculations";
import type { Currency, Expense, Group } from "@/lib/models";
import { useAppState } from "@/lib/state";
import { Avatar, EmptyState, Modal, PageHeader } from "./ui";

interface Props {
  selectedGroupId?: string;
  onSelectGroup: (id?: string) => void;
  onAddExpense: (groupId?: string) => void;
  onEditExpense: (expense: Expense) => void;
  onSettle: (group: Group, fromId: string, toId: string, amountCents: number) => void;
}

export function GroupsScreen({ selectedGroupId, onSelectGroup, onAddExpense, onEditExpense, onSettle }: Props) {
  const { state, setState } = useAppState();
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [emoji, setEmoji] = useState("✨");
  const [currency, setCurrency] = useState<Currency>("MYR");
  const [memberNames, setMemberNames] = useState("");
  const [newMember, setNewMember] = useState("");
  const [deleteId, setDeleteId] = useState<string>();
  const selected = state.groups.find((group) => group.id === selectedGroupId);

  const createGroup = () => {
    if (!groupName.trim()) return;
    const id = `g-${Date.now()}`;
    const names = memberNames.split(",").map((name) => name.trim()).filter(Boolean);
    const additions = names.map((name, index) => ({ id: `m-${Date.now()}-${index}`, name }));
    setState((current) => ({
      ...current,
      members: {
        ...current.members,
        ...Object.fromEntries(additions.map((member) => [member.id, member])),
      },
      groups: [
        ...current.groups,
        { id, name: groupName.trim(), emoji, currency, memberIds: ["me", ...additions.map((member) => member.id)] },
      ],
    }));
    setCreateOpen(false);
    setGroupName("");
    setMemberNames("");
    onSelectGroup(id);
  };

  if (selected) {
    const balances = groupBalances(selected, state.expenses, state.settlements);
    const suggestions = simplifyDebts(balances);
    const expenses = state.expenses.filter((expense) => expense.groupId === selected.id).sort((a, b) => b.date.localeCompare(a.date));
    const total = expenses.reduce((sum, expense) => sum + expenseTotal(expense.items, expense.taxCents, expense.serviceCents), 0);
    const addMember = () => {
      if (!newMember.trim()) return;
      const id = `m-${Date.now()}`;
      setState((current) => ({
        ...current,
        members: { ...current.members, [id]: { id, name: newMember.trim() } },
        groups: current.groups.map((group) => group.id === selected.id ? { ...group, memberIds: [...group.memberIds, id] } : group),
      }));
      setNewMember("");
    };
    const removeExpense = (id: string) => {
      setState((current) => ({ ...current, expenses: current.expenses.filter((expense) => expense.id !== id) }));
      setDeleteId(undefined);
    };

    return (
      <div className="screen group-detail-screen">
        <button className="back-button" onClick={() => onSelectGroup(undefined)}><ArrowLeft size={18} /> All groups</button>
        <section className="group-hero">
          <span className="group-hero-emoji">{selected.emoji}</span>
          <div><p className="eyebrow">JOMBIT GROUP</p><h1>{selected.name}</h1><p>{selected.memberIds.length} members · {selected.currency}</p></div>
          <button className="primary-button compact" onClick={() => onAddExpense(selected.id)}><Plus size={18} /> Add expense</button>
        </section>

        <section className="group-total-card">
          <div><span>Total shared spending</span><strong>{formatMoney(total, selected.currency)}</strong><small>{expenses.length} expenses in this group</small></div>
          <div className={(balances.me ?? 0) >= 0 ? "position-positive" : "position-negative"}>
            <span>Your position</span>
            <strong>{formatMoney(Math.abs(balances.me ?? 0), selected.currency)}</strong>
            <small>{(balances.me ?? 0) >= 0 ? "You should receive" : "You still owe"}</small>
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading"><h2>Member balances</h2><span>Calculated live</span></div>
          <div className="balance-list">
            {selected.memberIds.map((id) => {
              const member = state.members[id];
              const value = balances[id] ?? 0;
              const isMe = id === "me";
              return (
                <div className="balance-row" key={id}>
                  <Avatar name={member.name} />
                  <span><strong>{member.name}{isMe ? " (You)" : ""}</strong><small>{value > 0 ? "Should receive" : value < 0 ? "Owes the group" : "All square"}</small></span>
                  <strong className={value > 0 ? "positive" : value < 0 ? "negative" : "muted"}>{value > 0 ? "+" : value < 0 ? "−" : ""}{formatMoney(Math.abs(value), selected.currency)}</strong>
                </div>
              );
            })}
          </div>
          <div className="member-add-row">
            <label className="sr-only" htmlFor="new-member">New member name</label>
            <input id="new-member" value={newMember} onChange={(event) => setNewMember(event.target.value)} placeholder="Add a member by name" onKeyDown={(event) => event.key === "Enter" && addMember()} />
            <button className="secondary-button" onClick={addMember}><UserPlus size={17} /> Add</button>
          </div>
        </section>

        <section className="section-block settlement-block">
          <div className="section-heading"><div><p className="eyebrow">SIMPLIFIED BY JOMBIT</p><h2>Who should pay whom</h2></div></div>
          {suggestions.length ? (
            <div className="settlement-list">
              {suggestions.map((suggestion, index) => {
                const from = state.members[suggestion.fromId];
                const to = state.members[suggestion.toId];
                return (
                  <button key={`${suggestion.fromId}-${suggestion.toId}-${index}`} onClick={() => onSettle(selected, suggestion.fromId, suggestion.toId, suggestion.amountCents)}>
                    <div className="settle-avatars"><Avatar name={from.name} /><span><ArrowRight size={14} /></span><Avatar name={to.name} /></div>
                    <span><strong>{suggestion.fromId === "me" ? "You" : from.name} pays {suggestion.toId === "me" ? "you" : to.name}</strong><small>One payment clears part of the group tab</small></span>
                    <strong>{formatMoney(suggestion.amountCents, selected.currency)}</strong>
                    <ArrowRight size={18} />
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<CheckCircle2 />} title="You’re all settled 🎉" copy="There are no outstanding group payments." />
          )}
        </section>

        <section className="section-block">
          <div className="section-heading"><h2>Expense history</h2><button onClick={() => onAddExpense(selected.id)}>Add <Plus size={16} /></button></div>
          {expenses.length ? (
            <div className="expense-list">
              {expenses.map((expense) => {
                const expenseAmount = expenseTotal(expense.items, expense.taxCents, expense.serviceCents);
                return (
                  <article className="expense-row" key={expense.id}>
                    <span className="activity-icon"><ReceiptText size={18} /></span>
                    <button className="expense-main" onClick={() => onEditExpense(expense)}>
                      <span><strong>{expense.merchant}</strong><small>{expense.date} · Paid by {state.members[expense.payerId]?.name}</small></span>
                      <span><strong>{formatMoney(expenseAmount, expense.currency)}</strong><small>Your share {formatMoney(expense.shares.me?.totalCents ?? 0, expense.currency)}</small></span>
                    </button>
                    {deleteId === expense.id ? (
                      <div className="delete-confirm"><button onClick={() => removeExpense(expense.id)}>Delete</button><button onClick={() => setDeleteId(undefined)}>Keep</button></div>
                    ) : (
                      <button className="icon-button" onClick={() => setDeleteId(expense.id)} aria-label={`Delete ${expense.merchant}`}><Trash2 size={17} /></button>
                    )}
                  </article>
                );
              })}
            </div>
          ) : <EmptyState icon={<ReceiptText />} title="No expenses yet" copy="Add a receipt to start your group ledger." action={<button className="primary-button" onClick={() => onAddExpense(selected.id)}>Add first expense</button>} />}
        </section>
      </div>
    );
  }

  return (
    <div className="screen groups-screen">
      <PageHeader eyebrow="Shared spending, without the spreadsheet" title="Your groups" action={<button className="primary-button compact" onClick={() => setCreateOpen(true)}><Plus size={18} /> New group</button>} />
      <div className="groups-intro"><Users size={28} /><div><strong>Make every group trip lighter</strong><p>JomBit keeps the real ledger underneath every receipt, so balances stay accurate as plans change.</p></div></div>
      <div className="groups-grid">
        {state.groups.map((group) => {
          const balances = groupBalances(group, state.expenses, state.settlements);
          const expenses = state.expenses.filter((expense) => expense.groupId === group.id);
          const total = expenses.reduce((sum, expense) => sum + expenseTotal(expense.items, expense.taxCents, expense.serviceCents), 0);
          return (
            <button className="group-card" key={group.id} onClick={() => onSelectGroup(group.id)}>
              <div className="group-card-top"><span>{group.emoji}</span><small>{group.memberIds.length} people</small></div>
              <h2>{group.name}</h2><p>{expenses.length} expenses · {formatMoney(total, group.currency)} spent</p>
              <div className="avatar-stack">{group.memberIds.slice(0, 4).map((id) => <Avatar key={id} name={state.members[id].name} size="sm" />)}</div>
              <div className="group-card-bottom"><span className={balances.me >= 0 ? "positive" : "negative"}>{balances.me >= 0 ? "You’re owed " : "You owe "}{formatMoney(Math.abs(balances.me), group.currency)}</span><ArrowRight size={18} /></div>
            </button>
          );
        })}
        <button className="new-group-card" onClick={() => setCreateOpen(true)}><Plus size={26} /><strong>Create a group</strong><span>Dinner, housemates or a getaway</span></button>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a new group" eyebrow="START A SHARED LEDGER">
        <div className="form-stack">
          <div className="emoji-name-row"><label><span>Icon</span><input className="emoji-input" value={emoji} onChange={(event) => setEmoji(event.target.value.slice(0, 3))} /></label><label className="grow"><span>Group name</span><input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Penang road trip" /></label></div>
          <label><span>Default currency</span><select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}><option value="MYR">MYR — Malaysian Ringgit</option><option value="SGD">SGD — Singapore Dollar</option><option value="THB">THB — Thai Baht</option><option value="IDR">IDR — Indonesian Rupiah</option></select></label>
          <label><span>Invite names <small>(comma separated)</small></span><textarea value={memberNames} onChange={(event) => setMemberNames(event.target.value)} placeholder="Maya, Daniel, Sarah" /></label>
          <p className="inline-note">You will be added to the group automatically. Friends are mock members in this demo.</p>
          <button className="primary-button" disabled={!groupName.trim()} onClick={createGroup}>Create JomBit group</button>
        </div>
      </Modal>
    </div>
  );
}

