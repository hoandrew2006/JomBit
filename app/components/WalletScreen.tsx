"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bitcoin,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Flame,
  Landmark,
  Plus,
  Send,
  ShieldCheck,
  Snowflake,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { convertCurrencyCents, DEMO_APY, DEMO_CRYPTO_PRICES_MYR, DEMO_FX_IN_MYR, demoRate, mockDelay } from "@/lib/mock-services";
import { formatMoney } from "@/lib/calculations";
import type { CryptoAsset, Currency, WalletTransaction } from "@/lib/models";
import { useAppState } from "@/lib/state";
import { Modal, PageHeader, Segmented, Toast } from "./ui";

type WalletTab = "fiat" | "crypto" | "card";
type FiatAction = "topup" | "exchange" | "send";
type CryptoAction = "buy" | "sell" | "stake" | "unstake";

const currencies: Currency[] = ["MYR", "SGD", "THB", "IDR"];
const assets: CryptoAsset[] = ["BTC", "ETH", "SOL"];

function createTransaction(transaction: Omit<WalletTransaction, "id" | "date">): WalletTransaction {
  return { id: `tx-${Date.now()}`, date: new Date().toISOString(), ...transaction };
}

export function WalletScreen() {
  const { state, setState } = useAppState();
  const [tab, setTab] = useState<WalletTab>("fiat");
  const [balancesVisible, setBalancesVisible] = useState(true);
  const [fiatAction, setFiatAction] = useState<FiatAction>();
  const [cryptoAction, setCryptoAction] = useState<CryptoAction>();
  const [fromCurrency, setFromCurrency] = useState<Currency>("MYR");
  const [toCurrency, setToCurrency] = useState<Currency>("SGD");
  const [currency, setCurrency] = useState<Currency>("MYR");
  const [recipientId, setRecipientId] = useState("maya");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<CryptoAsset>("ETH");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [cardOrder, setCardOrder] = useState<"plastic" | "metal">();

  const totalMyr = currencies.reduce((sum, code) => sum + Math.round(state.fiatBalances[code] * DEMO_FX_IN_MYR[code]), 0);
  const portfolioCents = assets.reduce((sum, code) => {
    const holding = state.crypto[code];
    return sum + Math.round((holding.available + holding.staked) * DEMO_CRYPTO_PRICES_MYR[code] * 100);
  }, 0);
  const numericAmount = Number(amount || 0);
  const amountCents = Math.round(numericAmount * 100);
  const expectedExchange = convertCurrencyCents(amountCents, fromCurrency, toCurrency);

  const finish = (message: string) => {
    setAmount("");
    setError("");
    setProcessing(false);
    setFiatAction(undefined);
    setCryptoAction(undefined);
    setCardOrder(undefined);
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const runFiatAction = async () => {
    if (amountCents <= 0) return setError("Enter a positive amount.");
    if (fiatAction === "topup") {
      setProcessing(true);
      await mockDelay();
      setState((current) => ({
        ...current,
        fiatBalances: { ...current.fiatBalances, [currency]: current.fiatBalances[currency] + amountCents },
        walletTransactions: [createTransaction({ kind: "topup", title: `Demo ${currency} top up`, subtitle: "Simulated FPX / bank flow", amountCents, currency, direction: "in" }), ...current.walletTransactions],
      }));
      return finish("Demo top up completed");
    }
    if (fiatAction === "exchange") {
      if (fromCurrency === toCurrency) return setError("Choose two different currencies.");
      if (state.fiatBalances[fromCurrency] < amountCents) return setError(`You only have ${formatMoney(state.fiatBalances[fromCurrency], fromCurrency)} available.`);
      setProcessing(true);
      await mockDelay();
      setState((current) => ({
        ...current,
        fiatBalances: {
          ...current.fiatBalances,
          [fromCurrency]: current.fiatBalances[fromCurrency] - amountCents,
          [toCurrency]: current.fiatBalances[toCurrency] + expectedExchange,
        },
        walletTransactions: [createTransaction({ kind: "exchange", title: `${fromCurrency} → ${toCurrency}`, subtitle: `Demo rate · received ${formatMoney(expectedExchange, toCurrency)}`, amountCents, currency: fromCurrency, direction: "neutral" }), ...current.walletTransactions],
      }));
      return finish("Currency exchange completed");
    }
    if (fiatAction === "send") {
      if (state.fiatBalances[currency] < amountCents) return setError(`Insufficient ${currency} demo balance.`);
      const member = state.members[recipientId];
      setProcessing(true);
      await mockDelay();
      setState((current) => ({
        ...current,
        fiatBalances: { ...current.fiatBalances, [currency]: current.fiatBalances[currency] - amountCents },
        counterpartBalances: {
          ...current.counterpartBalances,
          [recipientId]: { ...current.counterpartBalances[recipientId], [currency]: (current.counterpartBalances[recipientId]?.[currency] ?? 0) + amountCents },
        },
        walletTransactions: [createTransaction({ kind: "transfer", title: `Sent to ${member.name}`, subtitle: "JomBit-to-JomBit transfer · simulated", amountCents, currency, direction: "out" }), ...current.walletTransactions],
      }));
      return finish(`Sent demo ${currency} to ${member.name}`);
    }
  };

  const runCryptoAction = async () => {
    if (numericAmount <= 0) return setError("Enter a positive amount.");
    const price = DEMO_CRYPTO_PRICES_MYR[asset];
    if (cryptoAction === "buy") {
      if (state.fiatBalances.MYR < amountCents) return setError("Your MYR demo balance is too low for this order.");
      const quantity = numericAmount / price;
      setProcessing(true); await mockDelay();
      setState((current) => ({
        ...current,
        fiatBalances: { ...current.fiatBalances, MYR: current.fiatBalances.MYR - amountCents },
        crypto: { ...current.crypto, [asset]: { ...current.crypto[asset], available: current.crypto[asset].available + quantity } },
        walletTransactions: [createTransaction({ kind: "crypto-buy", title: `Bought ${asset}`, subtitle: `${quantity.toFixed(6)} ${asset} · demo price`, amountCents, currency: "MYR", direction: "out" }), ...current.walletTransactions],
      }));
      return finish(`Demo ${asset} purchase completed`);
    }
    if (cryptoAction === "sell") {
      if (state.crypto[asset].available < numericAmount) return setError(`You only have ${state.crypto[asset].available.toFixed(6)} ${asset} available.`);
      const proceeds = Math.round(numericAmount * price * 100);
      setProcessing(true); await mockDelay();
      setState((current) => ({
        ...current,
        fiatBalances: { ...current.fiatBalances, MYR: current.fiatBalances.MYR + proceeds },
        crypto: { ...current.crypto, [asset]: { ...current.crypto[asset], available: current.crypto[asset].available - numericAmount } },
        walletTransactions: [createTransaction({ kind: "crypto-sell", title: `Sold ${asset}`, subtitle: `${numericAmount.toFixed(6)} ${asset} · demo price`, amountCents: proceeds, currency: "MYR", direction: "in" }), ...current.walletTransactions],
      }));
      return finish(`Demo ${asset} sale completed`);
    }
    if (cryptoAction === "stake") {
      if (!DEMO_APY[asset]) return setError(`${asset} staking is not supported in this demo.`);
      if (state.crypto[asset].available < numericAmount) return setError(`You only have ${state.crypto[asset].available.toFixed(6)} ${asset} available.`);
      setProcessing(true); await mockDelay();
      setState((current) => ({ ...current, crypto: { ...current.crypto, [asset]: { ...current.crypto[asset], available: current.crypto[asset].available - numericAmount, staked: current.crypto[asset].staked + numericAmount } }, walletTransactions: [createTransaction({ kind: "stake", title: `Staked ${asset}`, subtitle: `${numericAmount.toFixed(6)} ${asset} · Demo APY`, direction: "neutral" }), ...current.walletTransactions] }));
      return finish(`${asset} moved to demo staking`);
    }
    if (cryptoAction === "unstake") {
      if (state.crypto[asset].staked < numericAmount) return setError(`You only have ${state.crypto[asset].staked.toFixed(6)} staked ${asset}.`);
      setProcessing(true); await mockDelay();
      setState((current) => ({ ...current, crypto: { ...current.crypto, [asset]: { ...current.crypto[asset], available: current.crypto[asset].available + numericAmount, staked: current.crypto[asset].staked - numericAmount } }, walletTransactions: [createTransaction({ kind: "unstake", title: `Unstaked ${asset}`, subtitle: `${numericAmount.toFixed(6)} ${asset} returned`, direction: "neutral" }), ...current.walletTransactions] }));
      return finish(`${asset} returned to available balance`);
    }
  };

  const activateVirtual = () => {
    setState((current) => ({ ...current, card: { ...current.card, virtualActive: true }, walletTransactions: [createTransaction({ kind: "card", title: "JomBit Virtual Card created", subtitle: "Demo card · no issuer connection", direction: "neutral" }), ...current.walletTransactions] }));
    setToast("JomBit Virtual Card is ready");
  };

  const orderPhysical = async () => {
    if (!cardOrder) return;
    const cost = cardOrder === "plastic" ? 1200 : 3000;
    if (state.fiatBalances.MYR < cost) return setError("Your MYR demo balance is too low for this card order.");
    setProcessing(true); await mockDelay();
    setState((current) => ({
      ...current,
      fiatBalances: { ...current.fiatBalances, MYR: current.fiatBalances.MYR - cost },
      card: { ...current.card, physicalType: cardOrder },
      walletTransactions: [createTransaction({ kind: "card", title: `${cardOrder === "metal" ? "Metal" : "Plastic"} JomBit Card ordered`, subtitle: "Simulated card order", amountCents: cost, currency: "MYR", direction: "out" }), ...current.walletTransactions],
    }));
    finish(`${cardOrder === "metal" ? "Metal" : "Plastic"} card order simulated`);
  };

  const openFiat = (action: FiatAction) => { setFiatAction(action); setAmount(""); setError(""); };
  const openCrypto = (action: CryptoAction) => { setCryptoAction(action); setAmount(""); setError(""); if ((action === "stake" || action === "unstake") && asset === "BTC") setAsset("ETH"); };

  return (
    <div className="screen wallet-screen">
      <PageHeader eyebrow="JOMBIT WALLET · DEMO BALANCES" title="Your money, your way" action={<button className="icon-button balance-toggle" onClick={() => setBalancesVisible((value) => !value)} aria-label={balancesVisible ? "Hide balances" : "Show balances"}>{balancesVisible ? <Eye size={19} /> : <EyeOff size={19} />}</button>} />
      <Segmented value={tab} onChange={setTab} options={[{ value: "fiat", label: "Fiat" }, { value: "crypto", label: "Crypto" }, { value: "card", label: "JomBit Card" }]} />

      {tab === "fiat" && (
        <>
          <section className="wallet-hero fiat-hero">
            <span><Landmark size={18} /> Approximate wallet value</span>
            <strong>{balancesVisible ? formatMoney(totalMyr) : "RM ••••••"}</strong>
            <small>Demo balances · converted using static local rates</small>
            <div className="wallet-actions"><button onClick={() => openFiat("topup")}><Plus size={19} />Top up</button><button onClick={() => openFiat("send")}><Send size={19} />Send</button><button onClick={() => openFiat("exchange")}><ArrowLeftRight size={19} />Exchange</button></div>
          </section>
          <section className="section-block"><div className="section-heading"><h2>Currency balances</h2><span>Demo only</span></div><div className="currency-grid">{currencies.map((code) => <article className="currency-card" key={code}><span className={`currency-flag flag-${code.toLowerCase()}`}>{code.slice(0, 2)}</span><span><strong>{code}</strong><small>{code === "MYR" ? "Malaysian Ringgit" : code === "SGD" ? "Singapore Dollar" : code === "THB" ? "Thai Baht" : "Indonesian Rupiah"}</small></span><strong>{balancesVisible ? formatMoney(state.fiatBalances[code], code) : "••••••"}</strong></article>)}</div></section>
          <WalletHistory transactions={state.walletTransactions} />
        </>
      )}

      {tab === "crypto" && (
        <>
          <section className="wallet-hero crypto-hero"><span><Bitcoin size={18} /> Demo crypto portfolio</span><strong>{balancesVisible ? formatMoney(portfolioCents) : "RM ••••••"}</strong><small>Static demo market prices · not live</small><div className="wallet-actions"><button onClick={() => openCrypto("buy")}><ArrowDownLeft size={19} />Buy</button><button onClick={() => openCrypto("sell")}><ArrowUpRight size={19} />Sell</button><button onClick={() => openCrypto("stake")}><Flame size={19} />Stake</button></div></section>
          <section className="section-block"><div className="section-heading"><h2>Your assets</h2><span>Demo prices</span></div><div className="asset-list">{assets.map((code) => { const holding = state.crypto[code]; const value = Math.round((holding.available + holding.staked) * DEMO_CRYPTO_PRICES_MYR[code] * 100); return <button key={code} onClick={() => { setAsset(code); openCrypto("buy"); }}><span className={`asset-icon asset-${code.toLowerCase()}`}>{code[0]}</span><span><strong>{code}</strong><small>RM {DEMO_CRYPTO_PRICES_MYR[code].toLocaleString("en-MY")} demo price</small></span><span><strong>{holding.available.toFixed(6)} {code}</strong><small>{formatMoney(value)} · {holding.staked ? `${holding.staked.toFixed(4)} staked` : "Available only"}</small></span><ChevronRight size={18} /></button>; })}</div></section>
          <section className="staking-banner"><Flame size={23} /><div><strong>Put demo assets to work</strong><p>Stake ETH or SOL with a clearly fictional Demo APY.</p></div><button onClick={() => openCrypto("stake")}>Explore</button></section>
          <WalletHistory transactions={state.walletTransactions.filter((tx) => tx.kind.includes("crypto") || tx.kind === "stake" || tx.kind === "unstake")} />
        </>
      )}

      {tab === "card" && (
        <>
          <section className={`jombit-card-visual ${state.card.frozen ? "frozen" : ""}`}>
            <div className="card-top"><span className="card-brand"><i /> JomBit</span><span>VIRTUAL · DEMO</span></div>
            <div className="card-chip"><i /><i /><i /></div>
            <strong>{state.card.virtualActive ? "JOMBIT • DEMO •••• POC" : "CREATE YOUR VIRTUAL CARD"}</strong>
            <div className="card-bottom"><span>{state.user.name.toUpperCase()}</span><span>{state.card.paymentSource.toUpperCase()} SOURCE</span></div>
            {state.card.frozen && <div className="frozen-overlay"><Snowflake size={26} /> Frozen</div>}
          </section>
          {!state.card.virtualActive ? <section className="activate-card-panel"><CreditCard size={26} /><h2>Your free virtual JomBit Card</h2><p>Create a mock card for the product demo. It has no usable payment number and connects to no issuer.</p><button className="primary-button" onClick={activateVirtual}>Create virtual card — Free</button></section> : <section className="card-controls"><button onClick={() => setState((current) => ({ ...current, card: { ...current.card, frozen: !current.card.frozen } }))}>{state.card.frozen ? <Flame size={18} /> : <Snowflake size={18} />}<span><strong>{state.card.frozen ? "Unfreeze card" : "Freeze card"}</strong><small>Demo control</small></span></button><div><span><ShieldCheck size={18} /><span><strong>Payment source</strong><small>Preference only</small></span></span><select value={state.card.paymentSource} onChange={(event) => setState((current) => ({ ...current, card: { ...current.card, paymentSource: event.target.value as "fiat" | "crypto" } }))}><option value="fiat">Fiat</option><option value="crypto">Crypto</option></select></div></section>}
          <section className="section-block"><div className="section-heading"><h2>Physical cards</h2><span>One-time demo fee</span></div><div className="physical-card-grid"><article><span className="plastic-swatch" /><h3>Plastic</h3><strong>RM12</strong><p>Lightweight, classic and ready for everyday spending in the future.</p><button className="secondary-button" onClick={() => { setCardOrder("plastic"); setError(""); }}>{state.card.physicalType === "plastic" ? "Ordered" : "Choose plastic"}</button></article><article className="metal-option"><span className="metal-swatch" /><h3>Metal</h3><strong>RM30</strong><p>A weightier premium concept card with a brushed graphite finish.</p><button className="primary-button" onClick={() => { setCardOrder("metal"); setError(""); }}>{state.card.physicalType === "metal" ? "Ordered" : "Choose metal"}</button></article></div></section>
          <p className="poc-warning">JomBit Card is a proof-of-concept feature. No issuer, payment network or real card account is connected.</p>
        </>
      )}

      <Modal open={Boolean(fiatAction)} onClose={() => setFiatAction(undefined)} title={fiatAction === "topup" ? "Top up demo balance" : fiatAction === "exchange" ? "Exchange currencies" : "Send to a JomBit member"} eyebrow="SIMULATED TRANSACTION">
        <div className="form-stack">
          {fiatAction === "exchange" ? <><div className="two-col"><label><span>Sell</span><select value={fromCurrency} onChange={(event) => setFromCurrency(event.target.value as Currency)}>{currencies.map((code) => <option key={code}>{code}</option>)}</select></label><label><span>Receive</span><select value={toCurrency} onChange={(event) => setToCurrency(event.target.value as Currency)}>{currencies.map((code) => <option key={code}>{code}</option>)}</select></label></div><label><span>Amount to sell</span><div className="money-input"><b>{fromCurrency}</b><input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></div><small>Available {formatMoney(state.fiatBalances[fromCurrency], fromCurrency)}</small></label><div className="quote-card"><span>Demo exchange rate</span><strong>1 {fromCurrency} = {demoRate(fromCurrency, toCurrency).toFixed(toCurrency === "IDR" ? 2 : 4)} {toCurrency}</strong><span>You receive <b>{formatMoney(expectedExchange, toCurrency)}</b></span></div></> : <><label><span>{fiatAction === "send" ? "Currency" : "Top-up currency"}</span><select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>{currencies.map((code) => <option key={code}>{code}</option>)}</select></label>{fiatAction === "send" && <label><span>Send to</span><select value={recipientId} onChange={(event) => setRecipientId(event.target.value)}>{Object.values(state.members).filter((member) => member.id !== "me").map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}<label><span>Amount</span><div className="money-input"><b>{currency}</b><input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></div>{fiatAction === "send" && <small>Available {formatMoney(state.fiatBalances[currency], currency)}</small>}</label></>}
          {error && <p className="form-error">{error}</p>}<button className="primary-button" onClick={runFiatAction} disabled={processing}>{processing ? <><span className="spinner" /> Processing demo transaction…</> : fiatAction === "topup" ? "Simulate top up" : fiatAction === "exchange" ? "Confirm exchange" : "Send — Demo"}</button><p className="fine-print">No bank, FX provider or payment network will be contacted.</p>
        </div>
      </Modal>

      <Modal open={Boolean(cryptoAction)} onClose={() => setCryptoAction(undefined)} title={cryptoAction ? `${cryptoAction[0].toUpperCase()}${cryptoAction.slice(1)} demo crypto` : "Crypto order"} eyebrow="STATIC DEMO PRICES">
        <div className="form-stack"><label><span>Asset</span><select value={asset} onChange={(event) => setAsset(event.target.value as CryptoAsset)}>{assets.filter((code) => !((cryptoAction === "stake" || cryptoAction === "unstake") && !DEMO_APY[code])).map((code) => <option key={code}>{code}</option>)}</select></label><div className="quote-card"><span>Demo market price</span><strong>{formatMoney(DEMO_CRYPTO_PRICES_MYR[asset] * 100)} / {asset}</strong>{DEMO_APY[asset] && (cryptoAction === "stake" || cryptoAction === "unstake") && <span>Demo APY <b>{DEMO_APY[asset]}%</b></span>}</div><label><span>{cryptoAction === "buy" ? "MYR to spend" : `${asset} quantity`}</span><div className="money-input"><b>{cryptoAction === "buy" ? "MYR" : asset}</b><input type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></div><small>{cryptoAction === "buy" ? `Available ${formatMoney(state.fiatBalances.MYR)}` : `Available ${cryptoAction === "unstake" ? state.crypto[asset].staked.toFixed(6) : state.crypto[asset].available.toFixed(6)} ${asset}`}</small></label>{numericAmount > 0 && <div className="trade-preview"><span>Estimated result</span><strong>{cryptoAction === "buy" ? `${(numericAmount / DEMO_CRYPTO_PRICES_MYR[asset]).toFixed(8)} ${asset}` : cryptoAction === "sell" ? formatMoney(Math.round(numericAmount * DEMO_CRYPTO_PRICES_MYR[asset] * 100)) : `${numericAmount.toFixed(6)} ${asset}`}</strong></div>}{error && <p className="form-error">{error}</p>}<button className="primary-button" onClick={runCryptoAction} disabled={processing}>{processing ? <><span className="spinner" /> Submitting demo order…</> : `Confirm ${cryptoAction} — Demo`}</button><p className="fine-print">No exchange, custodian or blockchain transaction is involved.</p></div>
      </Modal>

      <Modal open={Boolean(cardOrder)} onClose={() => setCardOrder(undefined)} title={`Order ${cardOrder ?? "physical"} JomBit Card`} eyebrow="SIMULATED CARD ORDER"><div className="form-stack"><div className="order-summary"><span>{cardOrder === "metal" ? <Sparkles size={24} /> : <CreditCard size={24} />}<span><strong>{cardOrder === "metal" ? "Metal JomBit Card" : "Plastic JomBit Card"}</strong><small>Mock order · no card will be issued</small></span></span><strong>{formatMoney(cardOrder === "metal" ? 3000 : 1200)}</strong></div><div className="quote-card"><span>Pay from MYR demo balance</span><strong>{formatMoney(state.fiatBalances.MYR)} available</strong></div>{error && <p className="form-error">{error}</p>}<button className="primary-button" onClick={orderPhysical} disabled={processing}>{processing ? <><span className="spinner" /> Placing demo order…</> : "Confirm mock card order"}</button></div></Modal>
      <Toast message={toast} />
    </div>
  );
}

function WalletHistory({ transactions }: { transactions: WalletTransaction[] }) {
  return <section className="section-block"><div className="section-heading"><h2>Transaction history</h2><span>Local demo ledger</span></div><div className="activity-list">{transactions.slice(0, 6).map((transaction) => <div className="activity-row" key={transaction.id}><span className={`activity-icon ${transaction.direction === "in" ? "wallet-icon" : ""}`}>{transaction.direction === "in" ? <ArrowDownLeft size={18} /> : transaction.direction === "out" ? <ArrowUpRight size={18} /> : <ArrowLeftRight size={18} />}</span><span><strong>{transaction.title}</strong><small>{transaction.subtitle}</small></span><span className={`activity-amount ${transaction.direction === "in" ? "positive" : ""}`}><strong>{transaction.amountCents !== undefined && transaction.currency ? `${transaction.direction === "in" ? "+" : transaction.direction === "out" ? "−" : ""}${formatMoney(transaction.amountCents, transaction.currency)}` : "Recorded"}</strong><small>Simulated</small></span></div>)}</div></section>;
}

