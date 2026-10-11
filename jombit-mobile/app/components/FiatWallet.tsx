"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCircle2, ChevronDown, Globe2, Landmark, Plus, Send, ShieldCheck } from "lucide-react";
import { useAppState } from "@/lib/state";
import { formatMoney } from "@/lib/calculations";
import { useFxRates } from "@/lib/fx-rates";
import { executeFiatCommand, FIAT_CURRENCIES, FOREIGN_CURRENCIES, legacyMyrCredit, myrBudgetInCurrency, myrDebitForPayment, parseFiatAmount, type FiatCommand, type ForeignCurrency } from "@/lib/fiat-ledger";
import type { Currency, WalletTransaction } from "@/lib/models";
import { CountryFlag } from "./CountryFlag";
import { Modal, Toast } from "./ui";
import "../../src/fiat.css";

const places: Record<ForeignCurrency, string> = { SGD: "Singapore", THB: "Thailand", IDR: "Indonesia" };
type Action = "deposit" | "send" | "consolidate";
const rateLabel = (from: Currency, to: Currency, rate: number) => `1 ${from} ≈ ${rate.toLocaleString("en-MY", { maximumFractionDigits: to === "IDR" ? 2 : 6 })} ${to}`;
const dateLabel = (date: string) => Number.isFinite(Date.parse(date)) ? new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(date)) + " MYT" : "Date not recorded";

export function FiatWallet({ balancesVisible }: { balancesVisible: boolean }) {
  const { state, transactFiat } = useAppState();
  const fx = useFxRates();
  const rates = fx.rates;
  const live = rates.source === "live";
  const rateKind = live ? "live rate" : "static demo rate";
  const myrTo = (to: Currency) => rateLabel("MYR", to, 1 / rates.inMyr[to]);
  const [destination, setDestination] = useState<ForeignCurrency>("SGD");
  const [action, setAction] = useState<Action>();
  const [currency, setCurrency] = useState<Currency>("MYR");
  const recipients = Object.values(state.members).filter((member) => member.id !== state.user.id);
  const [recipientId, setRecipientId] = useState(recipients[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [review, setReview] = useState<{ command: FiatCommand; entries: WalletTransaction[]; afterMyr: number }>();
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [shown, setShown] = useState(8);
  const submitted = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const reviewHeading = useRef<HTMLParagraphElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => { if (action) (review ? reviewHeading.current : input.current)?.focus(); }, [action, review]);

  const myr = state.fiatBalances.MYR;
  const hide = (value: string) => balancesVisible ? value : "••••••";
  const legacy = FOREIGN_CURRENCIES.filter((code) => state.fiatBalances[code] > 0);
  const legacyTotal = legacy.reduce((sum, code) => sum + legacyMyrCredit(state.fiatBalances[code], code, rates), 0);
  const history = state.walletTransactions.filter((tx) => tx.amountCents !== undefined).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  let debit: number | null = null;
  try { if (action === "send") debit = myrDebitForPayment(parseFiatAmount(amount), currency, rates); } catch { /* Incomplete input is validated on review. */ }

  const close = () => { setAction(undefined); setReview(undefined); setError(""); setAmount(""); };
  const open = (next: Action, payCurrency: Currency = "MYR") => {
    submitted.current = false; setAction(next); setCurrency(payCurrency); setAmount(""); setReview(undefined); setError("");
  };
  const prepare = () => {
    if (!action) return;
    setError("");
    try {
      const id = `fiat-${crypto.randomUUID()}`;
      const command: FiatCommand = action === "deposit" ? { id, action, amount, currency: "MYR" } : action === "send" ? { id, action, amount, currency, recipientId, rates } : { id, action, expectedForeign: { SGD: state.fiatBalances.SGD, THB: state.fiatBalances.THB, IDR: state.fiatBalances.IDR }, rates };
      const next = executeFiatCommand(state, command);
      setReview({ command, entries: next.walletTransactions.slice(0, next.walletTransactions.length - state.walletTransactions.length), afterMyr: next.fiatBalances.MYR });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Check the details and try again."); }
  };
  const confirm = () => {
    if (!review || submitted.current) return;
    try {
      submitted.current = true;
      transactFiat(review.command);
      const message = action === "deposit" ? "Demo MYR added. All currency estimates are updated." : action === "send" ? "Demo transfer recorded. Paid from your MYR wallet." : "Earlier demo balances moved to MYR.";
      close(); setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 3500);
    } catch (reason) { submitted.current = false; setError(reason instanceof Error ? reason.message : "This transaction could not be recorded."); }
  };

  return <div className="fiat-wallet">
    <section className="wallet-hero fiat-hero">
      <span><Landmark size={18} /> Your MYR wallet</span>
      <strong>{hide(formatMoney(myr))}</strong>
      <small>MYR is your balance. Other currencies are estimates of it.</small>
      <div className="wallet-actions fiat-wallet-actions"><button type="button" onClick={() => open("deposit")}><Plus size={20} /> Deposit MYR</button><button type="button" onClick={() => open("send")}><Send size={18} /> Send from MYR</button></div>
    </section>
    <div className="fiat-funding-note"><ShieldCheck size={17} /><p>Top up in MYR only. Convert automatically when you confirm a foreign-currency demo transfer.</p></div>

    <section className="section-block fiat-travel" aria-label="Foreign-currency estimates of your MYR balance">
      <div className="section-heading"><h2>Your MYR, abroad</h2><span><Globe2 size={14} /> {live ? "Live rates" : "Demo rates"}</span></div>
      <p className="fiat-intro">See what the same money is worth in another currency. These are not separate balances and cannot be added together.</p>
      <p className="fiat-rate-status" role="status">{fx.status === "live" ? <>Rates updated {dateLabel(rates.updatedAt!)} · <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates By Exchange Rate API</a></> : fx.status === "loading" ? "Fetching live rates… static demo rates shown until they arrive." : "Live rates unavailable. Showing static demo rates."}</p>
      <div className="fiat-destinations">{FOREIGN_CURRENCIES.map((code) => <button type="button" key={code} aria-pressed={destination === code} onClick={() => setDestination(code)}><span className="currency-flag"><CountryFlag currency={code} /></span><span><strong>{places[code]}</strong><small>{code} · estimated equivalent</small></span><b>{hide(formatMoney(myrBudgetInCurrency(myr, code, rates), code))}</b></button>)}</div>
      <div className="fiat-rate-card"><span>Same {hide(formatMoney(myr))} · shown in {destination}</span><strong>{hide(formatMoney(myrBudgetInCurrency(myr, destination, rates), destination))}</strong><small>{myrTo(destination)} · {rateKind}</small><button type="button" className="secondary-button" onClick={() => open("send", destination)}>Send in {destination}<ArrowRight size={17} /></button><p>Changing the currency view does not move your money. You’ll review the MYR deduction before confirming.</p></div>
    </section>

    {legacy.length > 0 && <section className="fiat-legacy" aria-label="Earlier demo balances"><h2>Balances from the previous demo</h2><p>These older foreign-currency balances are preserved separately. They are not included in your MYR balance or the estimates above.</p><dl>{legacy.map((code) => <div key={code}><dt>{code}</dt><dd>{hide(formatMoney(state.fiatBalances[code], code))}</dd></div>)}</dl><p>Optional: move them to MYR for approximately {hide(formatMoney(legacyTotal))} using the {live ? "live" : "static demo"} rates. Your original transaction history will remain.</p><button type="button" className="secondary-button" onClick={() => open("consolidate")}>Review move to MYR</button></section>}

    <section className="section-block fiat-history"><div className="section-heading"><h2>Wallet history</h2><span>Local demo ledger</span></div>
      {!history.length && <p className="fiat-intro">Your MYR deposits and demo transfers will appear here.</p>}
      {history.slice(0, shown).map((tx) => <details className="fiat-transaction" key={tx.id}><summary><span>{tx.direction === "in" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span><span><strong>{tx.title}</strong><small>{dateLabel(tx.date)}</small></span><b>{hide(`${tx.direction === "in" ? "+" : tx.direction === "out" ? "−" : ""}${formatMoney(tx.amountCents!, tx.currency ?? "MYR")}`)}</b><ChevronDown size={14} /></summary><p>{tx.subtitle}</p>{tx.fiat && <dl><div><dt>{tx.kind === "transfer" ? "Paid from MYR" : "Previous balance converted"}</dt><dd>{hide(formatMoney(tx.fiat.fromCents, tx.fiat.fromCurrency))}</dd></div><div><dt>{tx.kind === "transfer" ? "Recipient received" : "Added to MYR"}</dt><dd>{hide(formatMoney(tx.fiat.toCents, tx.fiat.toCurrency))}</dd></div><div><dt>{tx.fiat.source === "live" ? "Live rate" : "Demo rate"}</dt><dd>{rateLabel(tx.fiat.fromCurrency, tx.fiat.toCurrency, tx.fiat.rate)}{tx.fiat.rateUpdatedAt && <small>Updated {dateLabel(tx.fiat.rateUpdatedAt)}</small>}</dd></div><div><dt>Demo fee</dt><dd>{formatMoney(tx.fiat.feeCents)}</dd></div></dl>}{tx.kind === "settlement" && <p>Group-ledger record only; this entry does not debit or credit your wallet.</p>}<small className="fiat-record-note">Simulated · {tx.id}</small></details>)}
      {history.length > shown && <button className="secondary-button full-width" type="button" onClick={() => setShown(shown + 8)}>Show more transactions</button>}
    </section>
    <p className="poc-warning">JomBit demo only. Deposits, transfers and conversions are simulated{live ? " using live reference exchange rates" : " with static demo rates"}. No bank, payment network or real money is involved.</p>

    <Modal open={Boolean(action)} onClose={close} title={review ? "Review demo transaction" : action === "deposit" ? "Deposit MYR" : action === "send" ? "Send from your MYR wallet" : "Move earlier balances to MYR"} eyebrow="JOMBIT WALLET · SIMULATED">
      <div className="form-stack fiat-form">
        {!review ? <>
          {action === "deposit" && <><p className="fiat-modal-copy">Money enters your JomBit Wallet in Malaysian Ringgit only. Your SGD, THB and IDR estimates update automatically.</p><label><span>Amount to deposit</span><div className="money-input"><b>MYR</b><input ref={input} type="text" inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => { setAmount(event.target.value); setError(""); }} placeholder="0.00" /></div></label><div className="fiat-presets">{[50, 100, 200].map((value) => <button type="button" key={value} onClick={() => { setAmount(value.toFixed(2)); setError(""); }}>RM{value}</button>)}</div><div className="quote-card"><span>Deposit currency</span><strong>MYR · Malaysian Ringgit</strong><small>Foreign-currency deposits are not supported.</small></div></>}
          {action === "send" && <><p className="fiat-modal-copy">Choose what your recipient receives. JomBit deducts the equivalent from your MYR balance when you confirm.</p><label><span>Send to</span><select value={recipientId} onChange={(event) => { setRecipientId(event.target.value); setError(""); }}>{recipients.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label><span>Recipient currency</span><select value={currency} onChange={(event) => { setCurrency(event.target.value as Currency); setError(""); }}>{FIAT_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}</select></label><label><span>Recipient receives</span><div className="money-input"><b>{currency}</b><input ref={input} type="text" inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => { setAmount(event.target.value); setError(""); }} placeholder="0.00" /></div><small>{formatMoney(myr)} available in MYR</small></label><div className="quote-card"><span>You pay from MYR</span><strong>{debit === null ? "Enter an amount" : formatMoney(debit)}</strong><span>{myrTo(currency)} · {rateKind}</span><small>MYR deductions round up to the nearest sen. Demo fee: RM0.00.</small></div>{debit !== null && debit > myr && <p className="form-error">Not enough MYR. Deposit MYR or reduce the amount.</p>}</>}
          {action === "consolidate" && <><p className="fiat-modal-copy">This optional conversion moves only the older foreign-currency demo balances into MYR. Nothing changes until you confirm.</p><dl className="fiat-review-details">{legacy.map((code) => <div key={code}><dt>{formatMoney(state.fiatBalances[code], code)}</dt><dd>{formatMoney(legacyMyrCredit(state.fiatBalances[code], code, rates))}</dd></div>)}</dl><p className="fiat-modal-copy">Estimated MYR credit: {formatMoney(legacyTotal)}. Conversion credits round to the nearest sen using {live ? "live" : "static demo"} rates; old records are kept.</p></>}
          <button className="primary-button" type="button" onClick={prepare}>Review {action === "deposit" ? "MYR deposit" : action === "send" ? "demo transfer" : "conversion"}</button>
        </> : <>
          <CheckCircle2 className="fiat-review-check" size={32} /><p className="fiat-review-title" ref={reviewHeading} tabIndex={-1}>Check before confirming</p>
          <dl className="fiat-review-details">
            {action === "deposit" && <div><dt>MYR deposit</dt><dd>{formatMoney(review.entries[0].amountCents!)}</dd></div>}
            {action === "send" && <><div><dt>Recipient</dt><dd>{state.members[recipientId]?.name}</dd></div><div><dt>Recipient receives</dt><dd>{formatMoney(review.entries[0].fiat!.toCents, currency)}</dd></div><div><dt>MYR deducted</dt><dd>{formatMoney(review.entries[0].amountCents!)}</dd></div><div><dt>{review.entries[0].fiat!.source === "live" ? "Live rate" : "Static demo rate"}</dt><dd>{rateLabel("MYR", currency, review.entries[0].fiat!.rate)}</dd></div></>}
            {action === "consolidate" && review.entries.map((tx) => <div key={tx.id}><dt>{formatMoney(tx.fiat!.fromCents, tx.fiat!.fromCurrency)}</dt><dd>+{formatMoney(tx.amountCents!)}</dd></div>)}
            <div><dt>Demo fee</dt><dd>RM0.00</dd></div><div><dt>Expected MYR balance after</dt><dd>{formatMoney(review.afterMyr)}</dd></div>
          </dl><button className="primary-button" type="button" onClick={confirm}>Confirm demo {action === "deposit" ? "MYR deposit" : action === "send" ? "transfer" : "conversion"}</button><button className="secondary-button" type="button" onClick={() => { setReview(undefined); setError(""); }}>Back to details</button>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}<p className="fine-print">No bank or real transfer is connected. Exchange rates are for reference only; zero fees are for this demo, not a financial-service offer.</p>
      </div>
    </Modal><Toast message={toast} />
  </div>;
}
