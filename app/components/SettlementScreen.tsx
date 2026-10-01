"use client";

import { ArrowLeft, ArrowRight, Check, LockKeyhole, QrCode, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatMoney, groupBalances, simplifyDebts } from "@/lib/calculations";
import { demoPaymentPayload, mockDelay } from "@/lib/mock-services";
import type { Group } from "@/lib/models";
import { useAppState } from "@/lib/state";
import { Avatar, Brand } from "./ui";

interface Props {
  group: Group;
  fromId: string;
  toId: string;
  amountCents: number;
  onClose: () => void;
  onDone: () => void;
}

export function SettlementScreen({ group, fromId, toId, amountCents, onClose, onDone }: Props) {
  const { state, setState } = useAppState();
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const from = state.members[fromId];
  const to = state.members[toId];
  const payload = demoPaymentPayload(toId, amountCents, group.currency);
  const recipientHasQr = toId === "me" ? Boolean(state.user.duitNowQr || to.hasDuitNowQr) : Boolean(to.hasDuitNowQr);

  const generate = async () => {
    setLoading(true);
    await mockDelay(650);
    setGenerated(true);
    setLoading(false);
  };

  const markPaid = async () => {
    setLoading(true);
    await mockDelay(650);
    const id = `s-${Date.now()}`;
    setState((current) => ({
      ...current,
      settlements: [...current.settlements, { id, groupId: group.id, fromId, toId, amountCents, currency: group.currency, date: new Date().toISOString() }],
      walletTransactions: [{
        id: `tx-${Date.now()}`,
        kind: "settlement",
        title: `${from.name} settled with ${to.name}`,
        subtitle: `${group.name} · Demo DuitNow settlement`,
        amountCents,
        currency: group.currency,
        date: new Date().toISOString(),
        direction: fromId === "me" ? "out" : toId === "me" ? "in" : "neutral",
      }, ...current.walletTransactions],
    }));
    setLoading(false);
    setSuccess(true);
  };

  const remaining = success
    ? simplifyDebts(groupBalances(group, state.expenses, state.settlements)).length
    : 1;

  if (success) {
    return (
      <div className="settlement-screen settlement-success">
        <Brand />
        <div className="success-check"><Check size={44} /></div>
        <p className="eyebrow">DEMO SETTLEMENT RECORDED</p>
        <h1>{remaining === 0 ? "You’re all settled 🎉" : "Payment marked as paid."}</h1>
        <p>JomBit has updated the group ledger and simplified what remains. No real funds were moved.</p>
        <div className="payment-recap"><span>{from.name} <ArrowRight size={16} /> {to.name}</span><strong>{formatMoney(amountCents, group.currency)}</strong></div>
        <button className="primary-button" onClick={onDone}>See updated group</button>
      </div>
    );
  }

  return (
    <div className="settlement-screen">
      <header className="expense-flow-header"><button className="back-button" onClick={onClose}><ArrowLeft size={18} /> Back</button><Brand compact /><span className="demo-pill"><LockKeyhole size={13} /> Demo only</span></header>
      <section className="settlement-content">
        <p className="eyebrow">SETTLE UP</p>
        <h1>One payment. A much cleaner tab.</h1>
        <p>Record this suggested payment for <strong>{group.name}</strong>.</p>

        <div className="payee-card">
          <div className="payee-route"><Avatar name={from.name} size="lg" /><span><ArrowRight size={18} /></span><Avatar name={to.name} size="lg" /></div>
          <span>{fromId === "me" ? "You pay" : from.name + " pays"} {toId === "me" ? "you" : to.name}</span>
          <strong>{formatMoney(amountCents, group.currency)}</strong>
          <small>{group.name} · simplified group settlement</small>
        </div>

        {!recipientHasQr && (
          <div className="warning-note"><QrCode size={20} /><span><strong>{to.name} hasn’t added a DuitNow QR</strong><small>You can still record this demo settlement below.</small></span></div>
        )}

        {!generated ? (
          <button className="primary-button qr-generate" onClick={generate} disabled={loading || !recipientHasQr}>{loading ? <><span className="spinner" /> Preparing payment QR…</> : <><QrCode size={19} /> Generate Payment QR</>}</button>
        ) : (
          <div className="qr-panel">
            <div className="qr-label"><ShieldCheck size={16} /> DEMO PAYMENT QR</div>
            <div className="qr-code"><QRCodeSVG value={payload} size={202} bgColor="#ffffff" fgColor="#151515" level="M" marginSize={2} /></div>
            <strong>Scan to preview payment</strong>
            <small>{payload}</small>
          </div>
        )}
        <p className="poc-warning">Proof-of-concept payment QR. This is not a valid PayNet QR and no real funds will be transferred.</p>
        <button className="secondary-button full-width" onClick={markPaid} disabled={loading}>{loading ? <><span className="spinner dark" /> Recording…</> : "Mark as Paid — Demo"}</button>
      </section>
    </div>
  );
}

