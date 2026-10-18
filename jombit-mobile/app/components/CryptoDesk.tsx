"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronDown, Copy, Flame, QrCode, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAppState } from "@/lib/state";
import { formatMoney } from "@/lib/calculations";
import { CRYPTO_ASSETS, CRYPTO_NAMES, STAKING_ASSETS, executeCryptoCommand, executeCryptoReceive, holdingMetrics, type CryptoAction, type CryptoCommand, type CryptoReceiveCommand } from "@/lib/crypto-ledger";
import { useCryptoMarket } from "@/lib/crypto-market";
import type { CryptoAsset, WalletTransaction } from "@/lib/models";
import { Modal, Segmented, Toast } from "./ui";
import { CryptoHoldingFacts } from "./CryptoHoldingFacts";
import { CryptoTransfer } from "./CryptoTransfer";
import { LUNO_INTEGRATION_NOTE, LUNO_STAKING_GUIDE } from "../../lib/staking-config";
import "../../src/crypto.css";

const quantity = (value: number) => value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
const signedMoney = (cents: number) => `${cents >= 0 ? "+" : "−"}${formatMoney(Math.abs(cents))}`;
const percent = (value: number | null | undefined) => value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const assetMark: Record<CryptoAsset, string> = { BTC: "₿", ETH: "Ξ", SOL: "S", ADA: "A", ATOM: "C", AVAX: "A", DOT: "●", NEAR: "N" };
function dateLabel(value: string | null | undefined, short = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Unknown";
  return new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short", year: "numeric", ...(short ? {} : { hour: "2-digit", minute: "2-digit" }), timeZone: "Asia/Kuala_Lumpur" }).format(new Date(value)) + (short ? "" : " MYT");
}

export function CryptoDesk({ balancesVisible }: { balancesVisible: boolean }) {
  const { state, stakeCrypto, receiveCrypto } = useAppState();
  const market = useCryptoMarket();
  const [asset, setAsset] = useState<CryptoAsset>("ETH");
  const [action, setAction] = useState<CryptoAction>();
  const [amount, setAmount] = useState("");
  const [review, setReview] = useState<{ command: CryptoCommand; order: WalletTransaction }>();
  const [receiving, setReceiving] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [receiveAmount, setReceiveAmount] = useState("");
  const [receiveReview, setReceiveReview] = useState<{ command: CryptoReceiveCommand; order: WalletTransaction }>();
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(10);
  const submitted = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const orderInput = useRef<HTMLInputElement>(null);
  const reviewTitle = useRef<HTMLParagraphElement>(null);
  const receiveInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (action) (review ? reviewTitle.current : orderInput.current)?.focus();
  }, [action, review]);
  useEffect(() => {
    if (receiving) (receiveReview ? reviewTitle.current : receiveInput.current)?.focus();
  }, [receiving, receiveReview]);
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
  const availableValues = CRYPTO_ASSETS.map((code) => holdingMetrics({ ...state.crypto[code], staked: 0 }, market.quotes?.[code]?.priceMyr).value);
  const availableValue = availableValues.every((value) => value !== null) ? availableValues.reduce<number>((sum, value) => sum + value!, 0) : null;
  const records = state.walletTransactions.filter((tx) => ["crypto-receive", "crypto-transfer", "stake", "unstake"].includes(tx.kind) && Boolean(tx.crypto) && !tx.crypto?.seeded)
    .filter((tx) => filter === "all" || (filter === "transfers" ? tx.kind === "crypto-receive" || tx.kind === "crypto-transfer" : tx.kind === "stake" || tx.kind === "unstake"))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const quoteTime = market.quotes ? Object.values(market.quotes).map((q) => q.updatedAt).filter(Boolean).sort()[0] : null;
  const latestStaking = state.walletTransactions.filter((tx) => (tx.kind === "stake" || tx.kind === "unstake") && tx.crypto?.asset === asset).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  const receivePayload = `jombit-demo://crypto/receive?asset=${asset}&account=member-id`;

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
      setToast("Staking activity added to your preview");
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(""), 3500);
    } catch (reason) { submitted.current = false; setError(reason instanceof Error ? reason.message : "The staking activity could not be recorded."); }
  };
  const closeReceive = () => { setReceiving(false); setReceiveAmount(""); setReceiveReview(undefined); setError(""); };
  const prepareReceive = () => {
    setError("");
    try {
      const command: CryptoReceiveCommand = { id: `crypto-receive-${crypto.randomUUID()}`, asset, amount: receiveAmount };
      const preview = executeCryptoReceive(state, command);
      setReceiveReview({ command, order: preview.walletTransactions[0] });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Check the incoming amount."); }
  };
  const confirmReceive = () => {
    if (!receiveReview || submitted.current) return;
    try {
      submitted.current = true;
      receiveCrypto(receiveReview.command);
      closeReceive();
      setToast(`${quantity(receiveReview.order.crypto!.quantity)} ${asset} added to your available balance`);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(""), 3500);
    } catch (reason) { submitted.current = false; setError(reason instanceof Error ? reason.message : "The incoming transfer could not be recorded."); }
  };
  const copyReceiveAddress = async () => {
    try { await navigator.clipboard.writeText(receivePayload); setToast("Preview address copied"); }
    catch { setToast("Copy unavailable. Press and hold the address instead."); }
  };

  return <div className="crypto-desk">
    <section className="crypto-provider-note" aria-label="Luno integration status"><span className="crypto-paper-badge">CRYPTO WALLET · PREVIEW</span><h2>Hold, receive and stake your crypto.</h2><p>Track your available and staked balances in one place. JomBit is exploring a future Luno integration for eligible staking assets; buying and selling are not offered here.</p><a href={LUNO_STAKING_GUIDE} target="_blank" rel="noreferrer">How staking works at Luno <ArrowUpRight size={15} /></a><small>{LUNO_INTEGRATION_NOTE} This preview does not connect an account, blockchain or custody provider.</small></section>
    <section className="crypto-market-status" aria-label="Market price source">
      <div><span className={`crypto-source-dot ${market.mode === "live" && market.fresh ? "is-live" : ""}`} /><strong>{market.mode === "demo" ? "Sample prices" : market.fresh ? "Live reference prices" : market.loading && !market.quotes ? "Loading market prices…" : market.quotes ? "Last known prices · stale" : "Live prices unavailable"}</strong><button type="button" className="crypto-refresh" aria-label="Refresh market prices" onClick={market.refresh} disabled={market.loading || market.mode === "demo"}><RefreshCw size={16} className={market.loading ? "is-spinning" : ""} /></button></div>
      <Segmented value={market.mode} onChange={(value) => { close(); market.setMode(value); }} options={[{ value: "live", label: "Live prices" }, { value: "demo", label: "Sample prices" }]} />
      <p>{market.mode === "demo" ? "Static sample prices. Not a market feed." : <><a href="https://www.coingecko.com/en/api" target="_blank" rel="noreferrer">Data provided by CoinGecko</a> · refreshed every 60s while visible. {quoteTime ? `Provider updated ${dateLabel(quoteTime)}.` : "No wallet or purchase data is sent."}</>}</p>
      {market.error && <p className="crypto-feed-error" role="status">{market.error}</p>}
    </section>

    <section className="crypto-portfolio-card">
      <span><Wallet size={17} /> CRYPTO PORTFOLIO</span><strong>{hide(portfolioValue === null ? "Unavailable" : formatMoney(portfolioValue))}</strong>
      <div className={portfolioPnl !== null && portfolioPnl < 0 ? "crypto-negative" : "crypto-positive"}>{hide(portfolioPnl === null ? "Profit / loss unavailable" : `${signedMoney(portfolioPnl)}${portfolioCost ? ` (${percent(portfolioPnl / portfolioCost * 100)})` : ""}`)}<small>Unrealized · {market.mode === "demo" ? "sample valuation" : market.fresh ? "live reference valuation" : "valuation may be outdated"}</small></div>
      <footer><span>Available balance<b>{hide(availableValue === null ? "Unavailable" : formatMoney(availableValue))}</b></span><span>Currently staked<b>{hide(stakedValue === null ? "Unavailable" : formatMoney(stakedValue))}</b></span><span>Recorded purchase cost<b>{hide(portfolioCost === null ? "History incomplete" : formatMoney(portfolioCost))}</b></span></footer>
    </section>

    <div className="crypto-holdings-layout"><section className="section-block"><div className="section-heading"><h2>Your crypto</h2><span>Available · staked · MYR value</span></div><div className="crypto-market-list">{CRYPTO_ASSETS.map((code) => {
      const coinQuote = market.quotes?.[code];
      const holding = state.crypto[code];
      const holdingValue = holdingMetrics(holding, coinQuote?.priceMyr).value;
      return <button type="button" key={code} aria-pressed={asset === code} onClick={() => setAsset(code)}><span className={`asset-icon asset-${code.toLowerCase()}`}>{assetMark[code]}</span><span><strong>{CRYPTO_NAMES[code]} <em>{code}</em></strong><small className="crypto-balance-split"><b>{hide(`${quantity(holding.available)} available`)}</b><i aria-hidden="true" /><b>{hide(`${quantity(holding.staked)} staked`)}</b>{code === "BTC" && <mark>Hold only</mark>}</small></span><span><strong>{hide(holdingValue === null ? "Unavailable" : formatMoney(holdingValue))}</strong><small>Holding value</small></span></button>;
    })}</div></section>

    <section className="crypto-position" aria-label={`${asset} holding details`}><div className="crypto-position-heading"><div><span>YOUR POSITION</span><h2>{CRYPTO_NAMES[asset]} <small>{asset}</small></h2></div><span className="crypto-paper-badge">PREVIEW</span></div>
      <CryptoHoldingFacts asset={asset} holding={holding} referencePrice={quote?.priceMyr} priceLabel={market.mode === "demo" ? "Sample price" : market.fresh ? "Live reference price" : "Last known price"} balancesVisible={balancesVisible} />
      <p className="crypto-history-note">Latest staking activity: {hide(latestStaking ? dateLabel(latestStaking.date) : "None recorded")}.</p>
      {metrics.cost === null && <p className="crypto-history-note">Purchase cost is incomplete, so profit and loss are unavailable.</p>}
      <div className="crypto-wallet-actions"><button type="button" className="secondary-button" onClick={() => setTransferring(true)}><ArrowUpRight size={18} /> Transfer {asset}</button><button type="button" className="primary-button" onClick={() => { submitted.current = false; setReceiving(true); setReceiveAmount(""); setReceiveReview(undefined); setError(""); }}><QrCode size={17} /> Receive {asset}</button>{canStake && <button type="button" className="secondary-button" onClick={() => open("stake")} disabled={holding.available <= 0}><Flame size={15} /> Stake {asset}</button>}</div>
      {canStake ? <div className="crypto-stake-actions"><button type="button" onClick={() => open("unstake")} disabled={holding.staked <= 0}>Unstake {asset}</button><small>Preview action only. Provider fees, rewards and unstaking delays are not applied.</small></div> : <p className="crypto-history-note">BTC can be held and received in this preview, but it cannot be staked here.</p>}
      <p className="crypto-history-note">Your total holding is available + staked. Recorded acquisition details are informational; JomBit does not offer buying or selling. Value changes are not staking rewards.</p>
    </section>

    </div>
    <section className="section-block crypto-orders"><div className="section-heading"><h2>Crypto activity</h2><span>Dates shown in MYT</span></div><Segmented value={filter} onChange={(value) => { setFilter(value); setShown(10); }} options={[{ value: "all", label: "All" }, { value: "transfers", label: "Transfers" }, { value: "stake", label: "Staking" }]} />
      {!records.length && <p className="crypto-empty">No crypto activity yet. Receive, transfer or stake crypto to create your history.</p>}
      {records.slice(0, shown).map((tx) => <details key={tx.id} className="crypto-order"><summary><span className="crypto-order-icon">{tx.kind === "crypto-receive" ? <ArrowDownLeft size={18} /> : tx.kind === "crypto-transfer" ? <ArrowUpRight size={18} /> : <Flame size={18} />}</span><span><strong>{tx.title}</strong><small>{dateLabel(tx.date)}</small></span><span><strong>{hide(`${quantity(tx.crypto!.quantity)} ${tx.crypto!.asset}`)}</strong><small>Completed</small></span><ChevronDown size={14} /></summary><dl><div><dt>Recorded at</dt><dd>{dateLabel(tx.date)}</dd></div><div><dt>MYR movement</dt><dd>None</dd></div><div><dt>Fee</dt><dd>{hide(formatMoney(tx.crypto!.feeCents))}</dd></div>{tx.crypto?.recipient && <div><dt>Recipient</dt><dd>{hide(tx.crypto.recipient)}</dd></div>}<div><dt>Reference</dt><dd className="crypto-order-id">{tx.id}</dd></div></dl>{(tx.kind === "crypto-receive" || tx.kind === "crypto-transfer") && <p>Preview transfer only. No blockchain transaction was detected or processed.</p>}</details>)}
      {records.length > shown && <button className="secondary-button crypto-load-more" type="button" onClick={() => setShown(shown + 10)}>Show more activity</button>}
    </section>
    <p className="product-disclosure"><ShieldCheck size={15} /> Crypto wallet preview only. JomBit does not hold or transfer real crypto, and Luno is not connected. Crypto can lose value.</p>

    <Modal open={Boolean(action)} onClose={close} title={`${review ? "Review" : action === "stake" ? "Stake" : "Unstake"} ${asset}`} eyebrow="JOMBIT STAKING · PREVIEW">
      <div className="form-stack crypto-order-form">
        {!review ? <>
          <p className="crypto-order-notice"><ShieldCheck size={18} /> Preview only. No request is sent to Luno.</p>
          <label><span>{asset} quantity</span><div className="money-input"><b>{asset}</b><input ref={orderInput} autoComplete="off" inputMode="decimal" type="text" value={amount} onChange={(event) => { setAmount(event.target.value); setError(""); }} placeholder="0.00" /></div><small>{quantity(action === "unstake" ? holding.staked : holding.available)} {asset} available</small></label>
          <button className="primary-button" type="button" onClick={prepare}>Review {action}</button>
        </> : <>
          <div className="crypto-review-icon"><CheckCircle2 size={26} /></div>
          <p className="crypto-review-heading" ref={reviewTitle} tabIndex={-1}>Check your staking activity</p>
          <dl className="crypto-review-details"><div><dt>Action</dt><dd>{action} {asset} · preview</dd></div><div><dt>Quantity</dt><dd>{quantity(review.order.crypto!.quantity)} {asset}</dd></div><div><dt>MYR movement</dt><dd>None</dd></div><div><dt>Rewards</dt><dd>Not accrued</dd></div><div><dt>Luno connection</dt><dd>Not connected</dd></div></dl>
          <button className="primary-button" type="button" onClick={confirm}>Confirm {action}</button>
          <button className="secondary-button" type="button" onClick={() => { setReview(undefined); setError(""); }}>Edit amount</button>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="fine-print">This preview updates test holdings immediately. A real provider may apply fees, lock-up periods, network processing and eligibility rules.</p>
      </div>
    </Modal>

    <Modal open={receiving} onClose={closeReceive} title={`Receive ${asset}`} eyebrow="JOMBIT CRYPTO WALLET">
      <div className="form-stack crypto-receive-form">
        {!receiveReview ? <>
          <div className="crypto-receive-qr" aria-label={`${asset} preview receive QR code`}><QRCodeSVG value={receivePayload} size={150} level="M" /></div>
          <div className="crypto-receive-address"><span>Preview wallet address</span><code>{receivePayload}</code><button type="button" className="secondary-button" onClick={copyReceiveAddress}><Copy size={16} /> Copy address</button></div>
          <p className="crypto-receive-warning"><ShieldCheck size={18} /> Preview only—do not send real crypto.</p>
          <label><span>Incoming {asset} amount</span><div className="money-input"><b>{asset}</b><input ref={receiveInput} autoComplete="off" inputMode="decimal" type="text" value={receiveAmount} onChange={(event) => { setReceiveAmount(event.target.value); setError(""); }} placeholder="0.00" /></div></label>
          <button className="primary-button" type="button" onClick={prepareReceive}>Review test transfer</button>
        </> : <>
          <div className="crypto-review-icon"><CheckCircle2 size={26} /></div>
          <p className="crypto-review-heading" ref={reviewTitle} tabIndex={-1}>Check incoming transfer</p>
          <dl className="crypto-review-details"><div><dt>Asset</dt><dd>{asset}</dd></div><div><dt>Amount</dt><dd>{quantity(receiveReview.order.crypto!.quantity)} {asset}</dd></div><div><dt>Added to</dt><dd>Available balance</dd></div><div><dt>MYR movement</dt><dd>None</dd></div><div><dt>Blockchain transfer</dt><dd>Not performed</dd></div></dl>
          <button className="primary-button" type="button" onClick={confirmReceive}>Record test transfer</button>
          <button className="secondary-button" type="button" onClick={() => { submitted.current = false; setReceiveReview(undefined); setError(""); }}>Edit amount</button>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </Modal>
    {transferring && <CryptoTransfer asset={asset} onClose={() => setTransferring(false)} onComplete={() => { setTransferring(false); setToast("Preview transfer recorded. Available balance updated."); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 3500); }} />}
    <Toast message={toast} />
  </div>;
}
