"use client";

import { ArrowLeft, ArrowRight, Check, Coins, LockKeyhole, QrCode, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatMoney, groupBalances, simplifyDebts } from "@/lib/calculations";
import { demoCryptoPaymentPayload, demoPaymentPayload, mockDelay } from "@/lib/mock-services";
import type { CryptoAsset, Group } from "@/lib/models";
import { CRYPTO_ASSETS, CRYPTO_NAMES } from "@/lib/crypto-ledger";
import { useCryptoMarket } from "@/lib/crypto-market";
import { useFxRates } from "@/lib/fx-rates";
import { useAppState } from "@/lib/state";
import { Avatar, Brand, Segmented } from "./ui";

type PaymentMethod = "fiat" | "crypto";
const cryptoAmountLabel = (value: number) => value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 8 });

interface Props {
  group: Group;
  fromId: string;
  toId: string;
  amountCents: number;
  onClose: () => void;
  onDone: () => void;
  initialPaymentMethod?: PaymentMethod;
  initialCryptoAsset?: CryptoAsset;
}

export function SettlementScreen({ group, fromId, toId, amountCents, onClose, onDone, initialPaymentMethod = "fiat", initialCryptoAsset = "ETH" }: Props) {
  const { state, setState } = useAppState();
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialPaymentMethod);
  const [cryptoAsset, setCryptoAsset] = useState<CryptoAsset>(initialCryptoAsset);
  const market = useCryptoMarket();
  const fx = useFxRates();
  const from = state.members[fromId];
  const to = state.members[toId];
  const quote = market.quotes?.[cryptoAsset];
  const settlementValueMyr = amountCents / 100 * fx.rates.inMyr[group.currency];
  const cryptoQuantity = quote ? settlementValueMyr / quote.priceMyr : null;
  const payload = paymentMethod === "crypto" && cryptoQuantity !== null
    ? demoCryptoPaymentPayload(toId, cryptoAsset, cryptoQuantity, amountCents, group.currency)
    : demoPaymentPayload(toId, amountCents, group.currency);
  const recipientHasQr = toId === "me" ? Boolean(state.user.duitNowQr || to.hasDuitNowQr) : Boolean(to.hasDuitNowQr);
  const canGenerate = paymentMethod === "crypto" ? Boolean(quote && market.fresh && cryptoQuantity) : recipientHasQr;

  const generate = async () => {
    if (!canGenerate) return;
    setLoading(true);
    await mockDelay(650);
    setGenerated(true);
    setLoading(false);
  };

  const markPaid = async () => {
    if (paymentMethod === "crypto" && (!market.fresh || !quote || cryptoQuantity === null)) return;
    setLoading(true);
    await mockDelay(650);
    const id = `s-${Date.now()}`;
    setState((current) => ({
      ...current,
      settlements: [...current.settlements, { id, groupId: group.id, fromId, toId, amountCents, currency: group.currency, date: new Date().toISOString(), paymentMethod, ...(paymentMethod === "crypto" && cryptoQuantity !== null ? { cryptoAsset, cryptoQuantity } : {}) }],
      walletTransactions: [{
        id: `tx-${Date.now()}`,
        kind: "settlement",
        title: `${from.name} settled with ${to.name}`,
        subtitle: paymentMethod === "crypto" && cryptoQuantity !== null ? `${group.name} · ${cryptoAmountLabel(cryptoQuantity)} ${cryptoAsset} settlement preview` : `${group.name} · Fiat settlement preview`,
        amountCents,
        currency: group.currency,
        date: new Date().toISOString(),
        direction: fromId === "me" ? "out" : toId === "me" ? "in" : "neutral",
        ...(paymentMethod === "crypto" && cryptoQuantity !== null ? { crypto: { asset: cryptoAsset, quantity: cryptoQuantity, priceMyr: quote?.priceMyr ?? null, priceSource: quote?.source ?? null, priceUpdatedAt: quote?.updatedAt ?? null, feeCents: 0, recipient: to.name } } : {}),
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
        <p className="eyebrow">SETTLEMENT RECORDED</p>
        <h1>{remaining === 0 ? "You’re all settled 🎉" : "Payment marked as paid."}</h1>
        <p>JomBit has updated the group ledger and simplified what remains. No real funds were moved.</p>
        <div className="payment-recap"><span>{from.name} <ArrowRight size={16} /> {to.name}</span><strong>{paymentMethod === "crypto" && cryptoQuantity !== null ? `${cryptoAmountLabel(cryptoQuantity)} ${cryptoAsset}` : formatMoney(amountCents, group.currency)}</strong><small>{paymentMethod === "crypto" ? `${formatMoney(amountCents, group.currency)} group balance` : "Fiat settlement"}</small></div>
        <button className="primary-button" onClick={onDone}>See updated group</button>
      </div>
    );
  }

  return (
    <div className="settlement-screen">
      <header className="expense-flow-header"><button className="back-button" onClick={onClose}><ArrowLeft size={18} /> Back</button><Brand compact /><span className="demo-pill"><LockKeyhole size={13} /> Preview mode</span></header>
      <section className="settlement-content">
        <p className="eyebrow">SETTLE UP</p>
        <h1>One payment. A much cleaner tab.</h1>

        <div className="payee-card">
          <div className="payee-route"><Avatar name={from.name} size="lg" /><span><ArrowRight size={18} /></span><Avatar name={to.name} size="lg" /></div>
          <span>{fromId === "me" ? "You pay" : from.name + " pays"} {toId === "me" ? "you" : to.name}</span>
          <strong>{formatMoney(amountCents, group.currency)}</strong>
          <small>{group.name} · simplified group settlement</small>
        </div>

        <div className="settlement-method" aria-label="Settlement payment method"><span>Pay with</span><Segmented value={paymentMethod} onChange={(value) => { setPaymentMethod(value); setGenerated(false); }} options={[{ value: "fiat", label: "Fiat QR" }, { value: "crypto", label: "Crypto QR" }]} /></div>

        {paymentMethod === "crypto" && <div className="settlement-crypto-options"><label><span>Crypto asset</span><select value={cryptoAsset} onChange={(event) => { setCryptoAsset(event.target.value as CryptoAsset); setGenerated(false); }}>{CRYPTO_ASSETS.map((asset) => <option value={asset} key={asset}>{CRYPTO_NAMES[asset]} ({asset})</option>)}</select></label><div><Coins size={18} /><span><small>Amount requested</small><strong>{cryptoQuantity !== null && market.fresh ? `${cryptoAmountLabel(cryptoQuantity)} ${cryptoAsset}` : "Live price required"}</strong><small>{formatMoney(amountCents, group.currency)} at live reference price</small></span></div>{market.error && <p role="status">Live price unavailable. Refresh and try again.</p>}</div>}

        {paymentMethod === "fiat" && !recipientHasQr && (
          <div className="warning-note"><QrCode size={20} /><span><strong>{to.name} hasn’t added a DuitNow QR</strong><small>You can still record the settlement in your group ledger.</small></span></div>
        )}

        {!generated ? (
          <button className="primary-button qr-generate" onClick={generate} disabled={loading || !canGenerate}>{loading ? <><span className="spinner" /> Preparing payment QR…</> : <><QrCode size={19} /> Generate {paymentMethod === "crypto" ? `${cryptoAsset} QR` : "Fiat QR"}</>}</button>
        ) : (
          <div className="qr-panel">
            <div className="qr-label"><ShieldCheck size={16} /> {paymentMethod === "crypto" ? `${cryptoAsset} PAYMENT` : "FIAT PAYMENT"} QR PREVIEW</div>
            <div className="qr-code"><QRCodeSVG value={payload} size={202} bgColor="#ffffff" fgColor="#151515" level="M" marginSize={2} /></div>
            <strong>Scan to preview {paymentMethod === "crypto" ? `${cryptoAsset} transfer` : "payment"}</strong>
            <small>{payload}</small>
          </div>
        )}
        <p className="product-disclosure"><ShieldCheck size={15} /> {paymentMethod === "crypto" ? "Preview only. No crypto is transferred." : "Preview only. No funds are transferred."}</p>
        <button className="secondary-button full-width" onClick={markPaid} disabled={loading || (paymentMethod === "crypto" && !canGenerate)}>{loading ? <><span className="spinner dark" /> Recording…</> : "Mark as paid"}</button>
      </section>
    </div>
  );
}

