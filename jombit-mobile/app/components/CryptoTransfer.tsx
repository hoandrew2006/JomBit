import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useAppState } from "@/lib/state";
import { executeCryptoTransfer, type CryptoTransferCommand } from "@/lib/crypto-ledger";
import type { CryptoAsset } from "@/lib/models";
import { Modal } from "./ui";

export function CryptoTransfer({ asset, onClose, onComplete }: { asset: CryptoAsset; onClose: () => void; onComplete: () => void }) {
  const { state, transferCrypto } = useAppState();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [review, setReview] = useState<CryptoTransferCommand>();
  const [error, setError] = useState("");
  const submitted = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLParagraphElement>(null);
  const available = state.crypto[asset].available;
  useEffect(() => { (review ? heading.current : input.current)?.focus(); }, [review]);
  const prepare = () => {
    try {
      const command = { id: `crypto-transfer-${crypto.randomUUID()}`, asset, amount, recipient: recipient.trim() };
      executeCryptoTransfer(state, command);
      setReview(command); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Check the transfer details."); }
  };
  const confirm = () => {
    if (!review || submitted.current) return;
    try { submitted.current = true; transferCrypto(review); onComplete(); }
    catch (reason) { submitted.current = false; setError(reason instanceof Error ? reason.message : "Transfer could not be recorded."); }
  };
  return <Modal open onClose={onClose} title={`Transfer ${asset}`} eyebrow="JOMBIT CRYPTO WALLET">
    <form className="form-stack crypto-transfer-form" onSubmit={(event) => { event.preventDefault(); review ? confirm() : prepare(); }}>
      <p className="crypto-receive-warning"><ShieldCheck size={18} /> Preview transfer only. No crypto is sent to another wallet.</p>
      {!review ? <>
        <label><span>Recipient label</span><input ref={input} value={recipient} maxLength={80} onChange={(event) => { setRecipient(event.target.value); setError(""); }} placeholder="e.g. Travel wallet" autoComplete="off" /><small>A label for this preview, not a blockchain address.</small></label>
        <label><span>Amount</span><div className="money-input"><b>{asset}</b><input value={amount} onChange={(event) => { setAmount(event.target.value); setError(""); }} inputMode="decimal" placeholder="0.00" autoComplete="off" /></div></label>
        <div className="crypto-transfer-available"><span>{available.toLocaleString("en-MY", { maximumFractionDigits: 8 })} {asset} available</span><button type="button" className="text-button" onClick={() => { setAmount(available.toFixed(8)); setError(""); }}>Use max</button></div>
        <button type="submit" className="primary-button"><ArrowUpRight size={18} /> Review transfer</button>
      </> : <>
        <p ref={heading} tabIndex={-1} className="crypto-review-heading">Check your transfer</p>
        <dl className="crypto-review-details"><div><dt>Recipient</dt><dd>{review.recipient}</dd></div><div><dt>Amount</dt><dd>{review.amount} {asset}</dd></div><div><dt>Balance used</dt><dd>Available crypto only</dd></div><div><dt>Network transfer</dt><dd>Not performed</dd></div></dl>
        <button type="submit" className="primary-button">Confirm preview transfer</button>
        <button type="button" className="secondary-button" onClick={() => { setReview(undefined); setError(""); }}>Edit transfer</button>
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  </Modal>;
}
