"use client";

import { Camera, Home, Sparkles, UserRound, Users, WalletCards } from "lucide-react";
import { useState } from "react";
import { groupBalances, simplifyDebts } from "@/lib/calculations";
import type { Expense, Group } from "@/lib/models";
import { useAppState, AppStateProvider } from "@/lib/state";
import { ExpenseFlow } from "./ExpenseFlow";
import { GroupsScreen } from "./GroupsScreen";
import { HomeScreen } from "./HomeScreen";
import { Onboarding } from "./Onboarding";
import { ProfileScreen } from "./ProfileScreen";
import { SettlementScreen } from "./SettlementScreen";
import { Brand } from "./ui";
import { WalletScreen } from "./WalletScreen";

type Nav = "home" | "groups" | "wallet" | "profile";

interface SettlementRoute {
  group: Group;
  fromId: string;
  toId: string;
  amountCents: number;
}

function JomBitExperience() {
  const { state } = useAppState();
  const [nav, setNav] = useState<Nav>("home");
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseGroupId, setExpenseGroupId] = useState<string>();
  const [editingExpense, setEditingExpense] = useState<Expense>();
  const [settlement, setSettlement] = useState<SettlementRoute>();

  if (!state.user.onboarded) return <Onboarding />;

  const openExpense = (groupId?: string, editing?: Expense) => {
    setExpenseGroupId(groupId);
    setEditingExpense(editing);
    setExpenseOpen(true);
  };

  const openGroup = (group: Group) => {
    setNav("groups");
    setSelectedGroupId(group.id);
  };

  const openSuggestedSettlement = (group: Group) => {
    const suggestions = simplifyDebts(groupBalances(group, state.expenses, state.settlements));
    const suggestion = suggestions.find((item) => item.fromId === "me") ?? suggestions[0];
    if (suggestion) setSettlement({ group, ...suggestion });
    else openGroup(group);
  };

  if (expenseOpen) {
    return <ExpenseFlow initialGroupId={expenseGroupId} editingExpense={editingExpense} onClose={() => { setExpenseOpen(false); setEditingExpense(undefined); }} onSaved={(groupId) => { setExpenseOpen(false); setEditingExpense(undefined); setSelectedGroupId(groupId); setNav("groups"); }} />;
  }

  if (settlement) {
    return <SettlementScreen {...settlement} onClose={() => setSettlement(undefined)} onDone={() => { setSettlement(undefined); openGroup(settlement.group); }} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar"><Brand compact /><span className="topbar-demo"><Sparkles size={13} /> Proof of concept · local demo</span></header>
      <main className="app-main">
        {nav === "home" && <HomeScreen onScan={() => openExpense()} onCreateGroup={() => { setNav("groups"); setSelectedGroupId(undefined); }} onOpenGroup={openGroup} onSettleGroup={openSuggestedSettlement} onWallet={() => setNav("wallet")} />}
        {nav === "groups" && <GroupsScreen selectedGroupId={selectedGroupId} onSelectGroup={setSelectedGroupId} onAddExpense={(groupId) => openExpense(groupId)} onEditExpense={(expense) => openExpense(expense.groupId, expense)} onSettle={(group, fromId, toId, amountCents) => setSettlement({ group, fromId, toId, amountCents })} />}
        {nav === "wallet" && <WalletScreen />}
        {nav === "profile" && <ProfileScreen />}
      </main>
      <nav className="bottom-nav" aria-label="Primary navigation">
        <button className={nav === "home" ? "active" : ""} onClick={() => setNav("home")}><Home size={21} /><span>Home</span></button>
        <button className={nav === "groups" ? "active" : ""} onClick={() => setNav("groups")}><Users size={21} /><span>Groups</span></button>
        <button className="scan-nav" onClick={() => openExpense()} aria-label="Scan receipt"><span><Camera size={24} /></span><small>Scan</small></button>
        <button className={nav === "wallet" ? "active" : ""} onClick={() => setNav("wallet")}><WalletCards size={21} /><span>Wallet</span></button>
        <button className={nav === "profile" ? "active" : ""} onClick={() => setNav("profile")}><UserRound size={21} /><span>Profile</span></button>
      </nav>
    </div>
  );
}

export function JomBitApp() {
  return <AppStateProvider><JomBitExperience /></AppStateProvider>;
}

