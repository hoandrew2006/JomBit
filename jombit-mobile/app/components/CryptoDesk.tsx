"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronDown, Flame, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { useAppState } from "@/lib/state";
import { formatMoney } from "@/lib/calculations";
import { CRYPTO_ASSETS, CRYPTO_NAMES, STAKING_ASSETS, executeCryptoCommand, holdingMetrics, type CryptoAction, type CryptoCommand } from "@/lib/crypto-ledger";
import { useCryptoMarket } from "@/lib/crypto-market";
import type { CryptoAsset, WalletTransaction } from "@/lib/models";
import { Modal, Segmented, Toast } from "./ui";
import { CryptoHoldingFacts } from "./CryptoHoldingFacts";
import { LUNO_INTEGRATION_NOTE, LUNO_STAKING_GUIDE } from "../../lib/staking-config";
import "../../src/crypto.css";

const quantity = (value: number) => value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
const price = (value: number | null | undefined) => value == null ? "Unavailable" : formatMoney(Math.round(value * 100));
const signedMoney = (cents: number) => `${cents >= 0 ? "+" : "−"}${formatMoney(Math.abs(cents))}`;
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
  const [review, setReview] = useState<{ command: CryptoCommand; order: WalletTransaction }>();
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(10);
  const submitted = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const orderInput = useRef<HTMLInputElement>(null);
  const reviewTitle = useRef<HTMLParagraphElement>(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (action) (review ? reviewTitle.current : orderInput.current)?.focus();
  }, [action, review]);
  const hide = (value: string) => balancesVisible ? value : "••••••";
  const holding = state.crypto[asset];
  const quote = market.quotes?.[asset];
  const metrics = holdingMetrics(holding, quote?.priceMyr);
  const totals = CRYPTO_ASSETS.map((code) => holdingMetrics(state.crypto[code], market.quotes?.[code]?.priceMyr));
  const portfolioValue = totals.every((item) => item.value !== null) ? totals.reduce((sum, item) => sum + item.value!, 0) : null;
  const portfolioCost = totals.every((item) => item.cost !== null) ? totals.reduce((sum, item) => sum + item.cost!, 0) : null;
  const portfolioPnl = portfolioValue !== null && portfolioCost !== null ? portfolioValue - portfolioCost : null;
  const canStake = STAKING_ASSETS.includes(asset);
  const stakedValues = STAKING_ASSETS.map((code) => holdingMetrics({ ...state.crypto[code], available: 0 }, market.quotes?.[code]?.priceMyr).value);
  const stakedValue = stakedValues.every((value) => value !== null) ? stakedValues.reduce<number>((sum, value) => sum + value!, 0) : null;
  const records = state.walletTransactions.filter((tx) => ["crypto-buy", "crypto-sell", "stake", "unstake"].includes(tx.kind))
    .filter((tx) => filter === "all" || (filter === "legacy" ? tx.kind === "crypto-buy" || tx.kind === "crypto-sell" : tx.kind === "stake" || tx.kind === "unstake"))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
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
      setReview({ command, order: preview.walletTransactions[0] });
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
    <section className="crypto-provider-note" aria-label="Luno integration status"><span className="crypto-paper-badge">PLANNED INTEGRATION</span><h2>Staking, with a Luno integration in mind.</h2><p>{LUNO_INTEGRATION_NOTE} JomBit will focus on staking existing eligible crypto, not buying or selling it.</p><a href={LUNO_STAKING_GUIDE} target="_blank" rel="noreferrer">Read Luno’s staking guide <ArrowUpRight size={15} /></a><small>Demo only: no account linking, deposits, real rewards or provider requests.</small></section>
    <section className="crypto-market-status" aria-label="Market price source">
      <div><span className={`crypto-source-dot ${market.mode === "live" && market.fresh ? "is-live" : ""}`} /><strong>{market.mode === "demo" ? "Demo prices" : market.fresh ? "Live reference prices" : market.loading && !market.quotes ? "Loading market prices…" : market.quotes ? "Last known prices · stale" : "Live prices unavailable"}</strong><button type="button" className="crypto-refresh" aria-label="Refresh market prices" onClick={market.refresh} disabled={market.loading || market.mode === "demo"}><RefreshCw size={16} className={market.loading ? "is-spinning" : ""} /></button></div>
      <Segmented value={market.mode} onChange={(value) => { close(); market.setMode(value); }} options={[{ value: "live", label: "Live prices" }, { value: "demo", label: "Demo prices" }]} />
      <p>{market.mode === "demo" ? "Static sample prices. Not a market feed." : <><a href="https://www.coingecko.com/en/api" target="_blank" rel="noreferrer">Data provided by CoinGecko</a> · refreshed every 60s while visible. {quoteTime ? `Provider updated ${dateLabel(quoteTime)}.` : "No wallet or purchase data is sent."}</>}</p>
      {market.error && <p className="crypto-feed-error" role="status">{market.error}</p>}
    </section>

    <section className="crypto-portfolio-card">
      <span><Wallet size={17} /> STAKING OVERVIEW · DEMO</span><strong>{hide(portfolioValue === null ? "Unavailable" : formatMoney(portfolioValue))}</strong>
      <div className={portfolioPnl !== null && portfolioPnl < 0 ? "crypto-negative" : "crypto-positive"}>{hide(portfolioPnl === null ? "Profit / loss unavailable" : `${signedMoney(portfolioPnl)}${portfolioCost ? ` (${percent(portfolioPnl / portfolioCost * 100)})` : ""}`)}<small>Unrealized · {market.mode === "demo" ? "demo valuation" : market.fresh ? "live reference valuation" : "valuation may be outdated"}</small></div>
      <footer><span>Remaining purchase cost<b>{hide(portfolioCost === null ? "History incomplete" : formatMoney(portfolioCost))}</b></span><span>Staked value estimate<b>{hide(stakedValue === null ? "Unavailable" : formatMoney(stakedValue))}</b></span></footer>
    </section>

    <section className="section-block"><div className="section-heading"><h2>Your crypto holdings</h2><span>MYR price · 24h change</span></div><div className="crypto-market-list">{CRYPTO_ASSETS.map((code) => {
      const coinQuote = market.quotes?.[code];
      return <button type="button" key={code} aria-pressed={asset === code} onClick={() => setAsset(code)}><span className={`asset-icon asset-${code.toLowerCase()}`}>{code === "BTC" ? "₿" : code === "ETH" ? "E" : "S"}</span><span><strong>{CRYPTO_NAMES[code]}</strong><small>{code} · {hide(`${quantity(state.crypto[code].available + state.crypto[code].staked)} held`)}{code === "BTC" ? " · View-only" : ""}</small></span><span><strong>{price(coinQuote?.priceMyr)}</strong><small className={coinQuote?.change24h != null && coinQuote.change24h < 0 ? "crypto-negative" : "crypto-positive"}>{market.mode === "demo" ? "Sample price" : percent(coinQuote?.change24h)}</small></span></button>;
    })}</div></section>

    <section className="crypto-position" aria-label={`${asset} holding details`}><div className="crypto-position-heading"><div><span>YOUR POSITION</span><h2>{CRYPTO_NAMES[asset]} <small>{asset}</small></h2></div><span className="crypto-paper-badge">SIMULATED</span></div>
      <CryptoHoldingFacts asset={asset} holding={holding} referencePrice={quote?.priceMyr} priceLabel={market.mode === "demo" ? "Demo price now" : market.fresh ? "Live reference price" : "Last known price"} balancesVisible={balancesVisible} />
      <p className="crypto-history-note">Latest staking activity: {hide(latestStaking ? dateLabel(latestStaking.date) : "None recorded")}.</p>
      {metrics.cost === null && <p className="crypto-history-note">This holding predates detailed purchase tracking. Its original price and date are unknown; new staking activity will be recorded. No history has been invented.</p>}
      {canStake ? <div className="crypto-stake-actions"><button type="button" onClick={() => open("stake")} disabled={holding.available <= 0}><Flame size={15} /> Demo stake</button><button type="button" onClick={() => open("unstake")} disabled={holding.staked <= 0}>Unstake {asset}</button><small>Local simulation only. Real provider fees, rewards and unstaking delays are not simulated.</small></div> : <p className="crypto-history-note">BTC is view-only and cannot be staked here. Existing balances are preserved.</p>}
      <p className="crypto-history-note">Average-cost basis includes available + staked holdings. Purchase dates and costs are historical records, not a buying service. Value changes are not staking rewards.</p>
    </section>

    <section className="section-block crypto-orders"><div className="section-heading"><h2>Staking &amp; earlier activity</h2><span>Dates shown in MYT</span></div><Segmented value={filter} onChange={(value) => { setFilter(value); setShown(10); }} options={[{ value: "all", label: "All" }, { value: "stake", label: "Staking" }, { value: "legacy", label: "Earlier records" }]} />
      {!records.length && <p className="crypto-empty">No activity in this view. Your next demo stake or unstake will appear here.</p>}
      {records.slice(0, shown).map((tx) => <details key={tx.id} className="crypto-order"><summary><span className="crypto-order-icon">{tx.kind === "crypto-buy" ? <ArrowDownLeft size={18} /> : tx.kind === "crypto-sell" ? <ArrowUpRight size={18} /> : <Flame size={18} />}</span><span><strong>{tx.title}</strong><small>{dateLabel(tx.date)}</small></span><span><strong>{hide(tx.crypto ? `${quantity(tx.crypto.quantity)} ${tx.crypto.asset}` : "Legacy record")}</strong><small>{tx.kind === "crypto-buy" || tx.kind === "crypto-sell" ? "Earlier demo record" : tx.crypto?.seeded ? "Seeded example" : "Demo completed"}</small></span><ChevronDown size={14} /></summary><dl><div><dt>Purchased / executed at</dt><dd>{dateLabel(tx.date)}</dd></div><div><dt>Execution price per coin</dt><dd>{hide(tx.crypto?.priceMyr != null ? price(tx.crypto.priceMyr) : tx.crypto ? "Not a trade" : "Not recorded")}</dd></div><div><dt>Total {tx.direction === "out" ? "paid" : tx.direction === "in" ? "received" : "cash movement"}</dt><dd>{hide(tx.amountCents !== undefined ? formatMoney(tx.amountCents) : "None")}</dd></div><div><dt>Fee</dt><dd>{hide(tx.crypto ? `${formatMoney(tx.crypto.feeCents)} · demo policy` : "Not recorded")}</dd></div><div><dt>Price source</dt><dd>{tx.crypto?.priceSource === "coingecko" ? "CoinGecko reference quote" : tx.crypto?.priceSource === "demo" ? "Fictional demo price" : "Not applicable / not recorded"}</dd></div>{tx.crypto?.priceUpdatedAt && <div><dt>Provider quote time</dt><dd>{dateLabel(tx.crypto.priceUpdatedAt)}</dd></div>}{tx.kind === "crypto-sell" && <div><dt>Realized paper profit / loss</dt><dd>{hide(tx.crypto?.realizedPnlCents == null ? "Unknown purchase cost" : signedMoney(tx.crypto.realizedPnlCents))}</dd></div>}<div><dt>Reference</dt><dd className="crypto-order-id">{tx.id}</dd></div></dl>{!tx.crypto && <p>Older record: execution price and quantity were not stored. The original entry is preserved.</p>}</details>)}
      {records.length > shown && <button className="secondary-button crypto-load-more" type="button" onClick={() => setShown(shown + 10)}>Show more activity</button>}
    </section>
    <p className="poc-warning">Staking simulation only. No buying or selling in JomBit. Luno integration is planned, not connected. Any future rewards, fees, eligible assets and unstaking periods depend on the provider and network; rewards are not guaranteed and crypto can lose value.</p>

    <Modal open={Boolean(action)} onClose={close} title={`${review ? "Review" : action === "stake" ? "Stake" : "Unstake"} ${asset}`} eyebrow="JOMBIT · DEMO STAKING">
      <div className="form-stack crypto-order-form">
        {!review ? <>
          <p className="crypto-order-notice"><ShieldCheck size={18} /> Local simulation only. No request is sent to Luno.</p>
          <label><span>{asset} quantity</span><div className="money-input"><b>{asset}</b><input ref={orderInput} autoComplete="off" inputMode="decimal" type="text" value={amount} onChange={(event) => { setAmount(event.target.value); setError(""); }} placeholder="0.00" /></div><small>{quantity(action === "unstake" ? holding.staked : holding.available)} {asset} available</small></label>
          <button className="primary-button" type="button" onClick={prepare}>Review demo {action}</button>
        </> : <>
          <div className="crypto-review-icon"><CheckCircle2 size={26} /></div>
          <p className="crypto-review-heading" ref={reviewTitle} tabIndex={-1}>Check your demo staking activity</p>
          <dl className="crypto-review-details"><div><dt>Action</dt><dd>{action} {asset} · simulated</dd></div><div><dt>Quantity</dt><dd>{quantity(review.order.crypto!.quantity)} {asset}</dd></div><div><dt>MYR movement</dt><dd>None</dd></div><div><dt>Rewards</dt><dd>Not accrued in this demo</dd></div><div><dt>Luno connection</dt><dd>Not connected</dd></div></dl>
          <button className="primary-button" type="button" onClick={confirm}>Confirm demo {action}</button>
          <button className="secondary-button" type="button" onClick={() => { setReview(undefined); setError(""); }}>Edit amount</button>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="fine-print">The demo moves balances immediately. This is not a promise of instant unstaking from Luno. No provider fees, lock-up periods, blockchain requests or rewards are simulated.</p>
      </div>
    </Modal><Toast message={toast} />
  </div>;
}
