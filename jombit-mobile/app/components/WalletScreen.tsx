"use client";

import {
  CreditCard,
  Eye,
  EyeOff,
  Flame,
  ShieldCheck,
  Snowflake,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { mockDelay } from "@/lib/mock-services";
import { formatMoney } from "@/lib/calculations";
import type { WalletTransaction } from "@/lib/models";
import { useAppState } from "@/lib/state";
import { Modal, PageHeader, Segmented, Toast } from "./ui";
import { CryptoDesk } from "./CryptoDesk";
import { FiatWallet } from "./FiatWallet";

type WalletTab = "fiat" | "crypto" | "card";


function createTransaction(transaction: Omit<WalletTransaction, "id" | "date">): WalletTransaction {
  return { id: `tx-${Date.now()}`, date: new Date().toISOString(), ...transaction };
}

export function WalletScreen() {
  const { state, setState } = useAppState();
  const [tab, setTab] = useState<WalletTab>("fiat");
  const [balancesVisible, setBalancesVisible] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [cardOrder, setCardOrder] = useState<"plastic" | "metal">();

  const finish = (message: string) => {
    setError("");
    setProcessing(false);
    setCardOrder(undefined);
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const activateVirtual = () => {
    setState((current) => ({ ...current, card: { ...current.card, virtualActive: true }, walletTransactions: [createTransaction({ kind: "card", title: "JomBit Virtual Card set up", subtitle: "Card preview · no issuer connection", direction: "neutral" }), ...current.walletTransactions] }));
    setToast("Virtual card preview is ready");
  };

  const orderPhysical = async () => {
    if (!cardOrder) return;
    const cost = cardOrder === "plastic" ? 1200 : 3000;
    if (state.fiatBalances.MYR < cost) return setError("Your available MYR balance is too low for this card preview.");
    setProcessing(true); await mockDelay();
    setState((current) => ({
      ...current,
      fiatBalances: { ...current.fiatBalances, MYR: current.fiatBalances.MYR - cost },
      card: { ...current.card, physicalType: cardOrder },
      walletTransactions: [createTransaction({ kind: "card", title: `${cardOrder === "metal" ? "Metal" : "Plastic"} JomBit Card selected`, subtitle: "Card preview selection", amountCents: cost, currency: "MYR", direction: "out" }), ...current.walletTransactions],
    }));
    finish(`${cardOrder === "metal" ? "Metal" : "Plastic"} card added to your preview`);
  };

  return (
    <div className="screen wallet-screen">
      <PageHeader eyebrow="JOMBIT WALLET" title="Your money, your way" action={<button className="icon-button balance-toggle" onClick={() => setBalancesVisible((value) => !value)} aria-label={balancesVisible ? "Hide balances" : "Show balances"}>{balancesVisible ? <Eye size={19} /> : <EyeOff size={19} />}</button>} />
      <Segmented value={tab} onChange={setTab} options={[{ value: "fiat", label: "Fiat" }, { value: "crypto", label: "Staking" }, { value: "card", label: "JomBit Card" }]} />

      {tab === "fiat" && <FiatWallet balancesVisible={balancesVisible} />}

      {tab === "crypto" && <CryptoDesk balancesVisible={balancesVisible} />}

      {tab === "card" && (
        <>
          <section className={`jombit-card-visual ${state.card.frozen ? "frozen" : ""}`}>
            <div className="card-top"><span className="card-brand"><i /> JomBit</span><span>VIRTUAL · PREVIEW</span></div>
            <div className="card-chip"><i /><i /><i /></div>
            <strong>{state.card.virtualActive ? "JOMBIT •••• 2048" : "SET UP YOUR VIRTUAL CARD"}</strong>
            <div className="card-bottom"><span>{state.user.name.toUpperCase()}</span><span>FIAT SOURCE</span></div>
            {state.card.frozen && <div className="frozen-overlay"><Snowflake size={26} /> Frozen</div>}
          </section>
          {!state.card.virtualActive ? <section className="activate-card-panel"><CreditCard size={26} /><h2>Meet your virtual JomBit Card</h2><p>Explore how card controls and a fiat-only payment source could work.</p><button className="primary-button" onClick={activateVirtual}>Set up card preview</button></section> : <section className="card-controls"><button onClick={() => setState((current) => ({ ...current, card: { ...current.card, frozen: !current.card.frozen } }))}>{state.card.frozen ? <Flame size={18} /> : <Snowflake size={18} />}<span><strong>{state.card.frozen ? "Unfreeze card" : "Freeze card"}</strong><small>Applies to this preview</small></span></button><div><span><ShieldCheck size={18} /><span><strong>Payment source</strong><small>Staking holdings are never used for card spending</small></span></span><span>Fiat only</span></div></section>}
          <section className="section-block"><div className="section-heading"><h2>Choose your finish</h2><span>Preview pricing</span></div><div className="physical-card-grid"><article><span className="plastic-swatch" /><h3>Plastic</h3><strong>RM12</strong><p>Lightweight, classic and designed for everyday spending.</p><button className="secondary-button" onClick={() => { setCardOrder("plastic"); setError(""); }}>{state.card.physicalType === "plastic" ? "Selected" : "Choose plastic"}</button></article><article className="metal-option"><span className="metal-swatch" /><h3>Metal</h3><strong>RM30</strong><p>A weightier card with a brushed graphite finish.</p><button className="primary-button" onClick={() => { setCardOrder("metal"); setError(""); }}>{state.card.physicalType === "metal" ? "Selected" : "Choose metal"}</button></article></div></section>
          <p className="product-disclosure"><ShieldCheck size={15} /> Card preview only. No card is issued and no payment network is connected.</p>
        </>
      )}

      <Modal open={Boolean(cardOrder)} onClose={() => setCardOrder(undefined)} title={`Choose ${cardOrder ?? "physical"} JomBit Card`} eyebrow="CARD PREVIEW"><div className="form-stack"><div className="order-summary"><span>{cardOrder === "metal" ? <Sparkles size={24} /> : <CreditCard size={24} />}<span><strong>{cardOrder === "metal" ? "Metal JomBit Card" : "Plastic JomBit Card"}</strong><small>Preview selection · no card will be issued</small></span></span><strong>{formatMoney(cardOrder === "metal" ? 3000 : 1200)}</strong></div><div className="quote-card"><span>Available MYR balance</span><strong>{formatMoney(state.fiatBalances.MYR)}</strong></div>{error && <p className="form-error">{error}</p>}<button className="primary-button" onClick={orderPhysical} disabled={processing}>{processing ? <><span className="spinner" /> Saving selection…</> : "Confirm selection"}</button></div></Modal>
      <Toast message={toast} />
    </div>
  );
}

