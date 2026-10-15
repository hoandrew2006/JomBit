"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronDown, Flame, Link2, RefreshCw, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { useAppState } from "@/lib/state";
import { formatMoney } from "@/lib/calculations";
import { CRYPTO_ASSETS, CRYPTO_NAMES, STAKING_ASSETS, executeCryptoCommand, holdingMetrics, isStakingActivity, stakingRewardsReceived, type CryptoAction, type CryptoCommand } from "@/lib/crypto-ledger";
import { useCryptoMarket } from "@/lib/crypto-market";
import type { CryptoAsset, WalletTransaction } from "@/lib/models";
import { Modal, Segmented, Toast } from "./ui";
import { CryptoHoldingFacts } from "./CryptoHoldingFacts";
import { LUNO_INTEGRATION_NOTE, LUNO_STAKING_GUIDE } from "../../lib/staking-config";
import "../../src/crypto.css";

const quantity = (value: number) => value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
const price = (value: number | null | undefined) => value == null ? "Unavailable" : formatMoney(Math.round(value * 100));
const percent = (value: number | null | undefined) => value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
function dateLabel(value: string | null | undefined, short = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Unknown";
  return new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short", year: "numeric", ...(short ? {} : { hour: "2-digit", minute: "2-digit" }), timeZone: "Asia/Kuala_Lumpur" }).format(new Date(value)) + (short ? "" : " MYT");
}

export function CryptoDesk({ balancesVisible }: { balancesVisible: boolean }) {
  const { state, stakeCrypto } = useAppState();
  const market = useCryptoMarket();
  const [asset, setAsset] = useState<CryptoAsset>("ETH");
  const [action, setAction] = useState<CryptoAction>();
  const [amount, setAmount] = useState("");
  const [review, setReview] = useState<{ command: CryptoCommand; activity: WalletTransaction }>();
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(10);
  const submitted = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const amountInput = useRef<HTMLInputElement>(null);
  const reviewTitle = useRef<HTMLParagraphElement>(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (action) (review ? reviewTitle.current : amountInput.current)?.focus();
  }, [action, review]);
  const hide = (value: string) => balancesVisible ? value : "••••••";
  const holding = state.crypto[asset];
  const quote = market.quotes?.[asset];
  const totals = CRYPTO_ASSETS.map((code) => holdingMetrics(state.crypto[code], market.quotes?.[code]?.priceMyr));
  const lunoValue = totals.every((item) => item.value !== null) ? totals.reduce((sum, item) => sum + item.value!, 0) : null;
  const canStake = STAKING_ASSETS.includes(asset);
  const stakedValues = STAKING_ASSETS.map((code) => holdingMetrics({ ...state.crypto[code], available: 0 }, market.quotes?.[code]?.priceMyr).value);
  const stakedValue = stakedValues.every((value) => value !== null) ? stakedValues.reduce<number>((sum, value) => sum + value!, 0) : null;
  // Staking events only: staked, rewards, unstaked. JomBit never buys or sells crypto.
  const records = state.walletTransactions.filter(isStakingActivity)
    .filter((tx) => filter === "all" || (filter === "rewards" ? tx.kind === "staking-reward" : tx.kind === "stake" || tx.kind === "unstake"))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const activityLabel = (tx: WalletTransaction) => tx.kind === "stake" ? "Staked" : tx.kind === "unstake" ? "Unstaked" : "Reward received";
  const quoteTime = market.quotes ? Object.values(market.quotes).map((q) => q.updatedAt).filter(Boolean).sort()[0] : null;
  const latestStaking = state.walletTransactions.filter((tx) => (tx.kind === "stake" || tx.kind === "unstake") && tx.crypto?.asset === asset).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];

  const close = () => { setAction(undefined); setReview(undefined); setError(""); setAmount(""); };
  const open = (next: CryptoAction) => { submitted.current = false; setAction(next); setReview(undefined); setAmount(""); setError(""); };
  const prepare = () => {
    if (!action) return;
    setError("");
    try {
      const command: CryptoCommand = { id: `staking-${crypto.randomUUID()}`, action, asset, amount };
      const preview = executeCryptoCommand(state, command);
      setReview({ command, activity: preview.walletTransactions[0] });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Check this staking amount."); }
  };
  const confirm = () => {
    if (!review || submitted.current) return;
    try {
      submitted.current = true;
      stakeCrypto(review.command);
      close();
      setToast("Demo staking activity recorded. Nothing was sent to Luno.");
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(""), 3500);
    } catch (reason) { submitted.current = false; setError(reason instanceof Error ? reason.message : "The staking activity could not be recorded."); }
  };

  return <div className="crypto-desk">
    <section className="crypto-provider-note" aria-label="Linked Luno account"><span className="crypto-paper-badge"><Link2 size={12} /> LINKED LUNO ACCOUNT · DEMO</span><h2>Your crypto stays in your Luno account.</h2><p>JomBit shows the balances in your linked Luno account and lets you stake eligible assets through Luno. JomBit never buys, sells or holds crypto. {LUNO_INTEGRATION_NOTE}</p><a href={LUNO_STAKING_GUIDE} target="_blank" rel="noreferrer">Read Luno’s staking guide <ArrowUpRight size={15} /></a><small>Demo only: sample balances. No real Luno account is linked and no requests are sent to Luno.</small></section>
    <section className="crypto-market-status" aria-label="Market price source">
      <div><span className={`crypto-source-dot ${market.mode === "live" && market.fresh ? "is-live" : ""}`} /><strong>{market.mode === "demo" ? "Demo prices" : market.fresh ? "Live reference prices" : market.loading && !market.quotes ? "Loading market prices…" : market.quotes ? "Last known prices · stale" : "Live prices unavailable"}</strong><button type="button" className="crypto-refresh" aria-label="Refresh market prices" onClick={market.refresh} disabled={market.loading || market.mode === "demo"}><RefreshCw size={16} className={market.loading ? "is-spinning" : ""} /></button></div>
      <Segmented value={market.mode} onChange={(value) => { close(); market.setMode(value); }} options={[{ value: "live", label: "Live prices" }, { value: "demo", label: "Demo prices" }]} />
      <p>{market.mode === "demo" ? "Static sample prices. Not a market feed." : <><a href="https://www.coingecko.com/en/api" target="_blank" rel="noreferrer">Data provided by CoinGecko</a> · refreshed every 60s while visible. {quoteTime ? `Provider updated ${dateLabel(quoteTime)}.` : "No account data is sent."}</>}</p>
      {market.error && <p className="crypto-feed-error" role="status">{market.error}</p>}
    </section>

    <section className="crypto-portfolio-card">
      <span><Wallet size={17} /> HELD IN YOUR LUNO ACCOUNT · DEMO</span><strong>{hide(lunoValue === null ? "Unavailable" : formatMoney(lunoValue))}</strong>
      <div>Estimated value of your Luno balances<small>{market.mode === "demo" ? "Demo valuation" : market.fresh ? "Live reference valuation" : "Valuation may be outdated"} · value changes are not staking rewards</small></div>
      <footer><span>Staked value estimate<b>{hide(stakedValue === null ? "Unavailable" : formatMoney(stakedValue))}</b></span><span>Assets you can stake here<b>{STAKING_ASSETS.join(" · ")}</b></span></footer>
    </section>

    <section className="section-block"><div className="section-heading"><h2>Held in your Luno account</h2><span>MYR price · 24h change</span></div><div className="crypto-market-list">{CRYPTO_ASSETS.map((code) => {
      const coinQuote = market.quotes?.[code];
      return <button type="button" key={code} aria-pressed={asset === code} onClick={() => setAsset(code)}><span className={`asset-icon asset-${code.toLowerCase()}`}>{code === "BTC" ? "₿" : code === "ETH" ? "E" : "S"}</span><span><strong>{CRYPTO_NAMES[code]}</strong><small>{code} · {hide(`${quantity(state.crypto[code].available + state.crypto[code].staked)} in Luno`)}{code === "BTC" ? " · View-only" : ""}</small></span><span><strong>{price(coinQuote?.priceMyr)}</strong><small className={coinQuote?.change24h != null && coinQuote.change24h < 0 ? "crypto-negative" : "crypto-positive"}>{market.mode === "demo" ? "Sample price" : percent(coinQuote?.change24h)}</small></span></button>;
    })}</div></section>

    <section className="crypto-position" aria-label={`${asset} holding details`}><div className="crypto-position-heading"><div><span>IN YOUR LUNO ACCOUNT</span><h2>{CRYPTO_NAMES[asset]} <small>{asset}</small></h2></div><span className="crypto-paper-badge">SIMULATED</span></div>
      <CryptoHoldingFacts asset={asset} holding={holding} referencePrice={quote?.priceMyr} priceLabel={market.mode === "demo" ? "Demo price now" : market.fresh ? "Live reference price" : "Last known price"} balancesVisible={balancesVisible} rewardsReceived={stakingRewardsReceived(state.walletTransactions, asset)} />
      <p className="crypto-history-note">Latest staking activity: {hide(latestStaking ? dateLabel(latestStaking.date) : "None recorded")}.</p>
      {canStake ? <div className="crypto-stake-actions"><button type="button" onClick={() => open("stake")} disabled={holding.available <= 0}><Flame size={15} /> Demo stake</button><button type="button" onClick={() => open("unstake")} disabled={holding.staked <= 0}>Unstake {asset}</button><small>Staking happens through Luno; your crypto never leaves your Luno account. Local simulation only: real fees, rewards and unstaking delays are not simulated.</small></div> : <p className="crypto-history-note">BTC is view-only: JomBit shows your Luno balance but staking is not offered for it here.</p>}
      <p className="crypto-history-note">Balances are held in your own Luno account; JomBit only displays them. Estimated values use reference prices and are not staking rewards.</p>
    </section>

    <section className="section-block crypto-orders"><div className="section-heading"><h2>Staking activity</h2><span>Dates shown in MYT</span></div><Segmented value={filter} onChange={(value) => { setFilter(value); setShown(10); }} options={[{ value: "all", label: "All" }, { value: "staking", label: "Staked & unstaked" }, { value: "rewards", label: "Rewards" }]} />
      {!records.length && <p className="crypto-empty">No staking activity in this view. Your next demo stake or unstake will appear here.</p>}
      {records.slice(0, shown).map((tx) => <details key={tx.id} className="crypto-order"><summary><span className="crypto-order-icon">{tx.kind === "staking-reward" ? <Sparkles size={18} /> : tx.kind === "unstake" ? <ArrowDownLeft size={18} /> : <Flame size={18} />}</span><span><strong>{tx.title}</strong><small>{dateLabel(tx.date)}</small></span><span><strong>{hide(tx.crypto ? `${tx.kind === "staking-reward" ? "+" : ""}${quantity(tx.crypto.quantity)} ${tx.crypto.asset}` : "—")}</strong><small>{tx.crypto?.seeded ? "Seeded example" : "Demo completed"}</small></span><ChevronDown size={14} /></summary><dl><div><dt>Activity</dt><dd>{activityLabel(tx)}</dd></div><div><dt>Date</dt><dd>{dateLabel(tx.date)}</dd></div><div><dt>Quantity</dt><dd>{hide(tx.crypto ? `${quantity(tx.crypto.quantity)} ${tx.crypto.asset}` : "Not recorded")}</dd></div><div><dt>Where</dt><dd>Your Luno account</dd></div><div><dt>MYR movement</dt><dd>None</dd></div><div><dt>Reference</dt><dd className="crypto-order-id">{tx.id}</dd></div></dl>{tx.kind === "staking-reward" && <p>Illustrative demo reward. Real rewards are variable, paid by Luno and not guaranteed.</p>}</details>)}
      {records.length > shown && <button className="secondary-button crypto-load-more" type="button" onClick={() => setShown(shown + 10)}>Show more activity</button>}
    </section>
    <p className="poc-warning">Staking simulation only. JomBit never buys, sells or holds crypto; your crypto stays in your Luno account. Luno integration is planned, not connected. Any future rewards, fees, eligible assets and unstaking periods depend on the provider and network; rewards are not guaranteed and crypto can lose value.</p>

    <Modal open={Boolean(action)} onClose={close} title={`${review ? "Review" : action === "stake" ? "Stake" : "Unstake"} ${asset}`} eyebrow="JOMBIT · DEMO STAKING">
      <div className="form-stack crypto-order-form">
        {!review ? <>
          <p className="crypto-order-notice"><ShieldCheck size={18} /> Local simulation only. No request is sent to Luno.</p>
          <label><span>{asset} quantity</span><div className="money-input"><b>{asset}</b><input ref={amountInput} autoComplete="off" inputMode="decimal" type="text" value={amount} onChange={(event) => { setAmount(event.target.value); setError(""); }} placeholder="0.00" /></div><small>{quantity(action === "unstake" ? holding.staked : holding.available)} {asset} available</small></label>
          <button className="primary-button" type="button" onClick={prepare}>Review demo {action}</button>
        </> : <>
          <div className="crypto-review-icon"><CheckCircle2 size={26} /></div>
          <p className="crypto-review-heading" ref={reviewTitle} tabIndex={-1}>Check your demo staking activity</p>
          <dl className="crypto-review-details"><div><dt>Action</dt><dd>{action} {asset} · simulated</dd></div><div><dt>Quantity</dt><dd>{quantity(review.activity.crypto!.quantity)} {asset}</dd></div><div><dt>MYR movement</dt><dd>None</dd></div><div><dt>Rewards</dt><dd>Not accrued in this demo</dd></div><div><dt>Where</dt><dd>Your Luno account</dd></div><div><dt>Luno connection</dt><dd>Not connected (demo)</dd></div></dl>
          <button className="primary-button" type="button" onClick={confirm}>Confirm demo {action}</button>
          <button className="secondary-button" type="button" onClick={() => { setReview(undefined); setError(""); }}>Edit amount</button>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="fine-print">The demo moves balances immediately. This is not a promise of instant unstaking from Luno. No provider fees, lock-up periods, blockchain requests or rewards are simulated.</p>
      </div>
    </Modal><Toast message={toast} />
  </div>;
}
