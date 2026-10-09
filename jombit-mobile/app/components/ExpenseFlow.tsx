"use client";

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ImagePlus,
  Plus,
  ReceiptText,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { calculateExpenseShares, expenseSubtotal, expenseTotal, formatMoney } from "@/lib/calculations";
import type { Expense, ExpenseItem, MemberShare } from "@/lib/models";
import { useAppState } from "@/lib/state";
import { Avatar, Brand } from "./ui";
import { ReceiptCamera } from "./ReceiptCamera";
import { prepareReceiptPhoto, scanReceipt, type PreparedReceipt } from "@/lib/receipt-client";
import { receiptReviewError } from "@/lib/receipt-review";
import "../../src/receipt.css";
import "../../src/receipt-refresh.css";

type Phase = "upload" | "scanning" | "edit" | "assign" | "success";

interface Props {
  initialGroupId?: string;
  editingExpense?: Expense;
  onClose: () => void;
  onSaved: (groupId: string) => void;
}

export function ExpenseFlow({ initialGroupId, editingExpense, onClose, onSaved }: Props) {
  const { state, setState } = useAppState();
  const firstGroup = initialGroupId ?? editingExpense?.groupId ?? state.groups[0]?.id ?? "";
  const [phase, setPhase] = useState<Phase>(editingExpense ? "edit" : "upload");

  const [preview, setPreview] = useState<string | undefined>(editingExpense?.receiptPreview);
  const [groupId, setGroupId] = useState(firstGroup);
  const [payerId, setPayerId] = useState(editingExpense?.payerId ?? "me");
  const [merchant, setMerchant] = useState(editingExpense?.merchant ?? "");
  const [date, setDate] = useState(editingExpense?.date ?? new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<ExpenseItem[]>(editingExpense?.items ?? []);
  const [taxCents, setTaxCents] = useState(editingExpense?.taxCents ?? 0);
  const [serviceCents, setServiceCents] = useState(editingExpense?.serviceCents ?? 0);
  const [expandedShare, setExpandedShare] = useState<string>();
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [photo, setPhoto] = useState<PreparedReceipt>();
  const [consent, setConsent] = useState(false);
  const [source, setSource] = useState<"manual" | "gemini">("manual");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [receiptCurrency, setReceiptCurrency] = useState("");
  const [printedTotalCents, setPrintedTotalCents] = useState<number | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [retainPhoto, setRetainPhoto] = useState(Boolean(editingExpense?.receiptPreview));
  const [backend, setBackend] = useState<"checking" | "ready" | "setup" | "offline">("checking");
  const [accessRequired, setAccessRequired] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const workId = useRef(0);
  const scanController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (window.location.protocol === "file:") setBackend("offline");
    else fetch("/api/receipt/status", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }).then(async (response) => {
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Unavailable");
      const status = await response.json();
      if (!controller.signal.aborted) { setBackend(status.configured ? "ready" : "setup"); setAccessRequired(status.accessRequired === true); }
    }).catch(() => { if (!controller.signal.aborted) setBackend("offline"); });
    return () => { controller.abort(); scanController.current?.abort(); workId.current++; };
  }, []);

  const group = state.groups.find((item) => item.id === groupId) ?? state.groups[0];
  const members = group ? group.memberIds.map((id) => state.members[id]).filter(Boolean) : [];
  const shares = useMemo(() => calculateExpenseShares(items, taxCents, serviceCents), [items, taxCents, serviceCents]);
  const total = expenseTotal(items, taxCents, serviceCents);
  const assignedTotal = Object.values(shares).reduce((sum, share) => sum + share.totalCents, 0);
  const hasUnassigned = items.some((item) => !item.allocation.memberIds.length);

  const cancelScan = () => { workId.current++; scanController.current?.abort(); setPreparing(false); setPhase("upload"); setError(""); };

  const choosePhoto = async (file?: File) => {
    if (!file) return;
    const id = ++workId.current;
    scanController.current?.abort();
    setCameraOpen(false); setPreparing(true); setError(""); setConsent(false); setReviewed(false); setPhoto(undefined); setPreview(undefined);
    try {
      const prepared = await prepareReceiptPhoto(file);
      if (id !== workId.current) return;
      setPhoto(prepared); setPreview(prepared.preview); setRetainPhoto(false);
    } catch (issue) { if (id === workId.current) setError(issue instanceof Error ? issue.message : "The photo could not be opened."); }
    finally { if (id === workId.current) setPreparing(false); }
  };

  const beginGeminiScan = async () => {
    if (!photo || !consent || scanController.current) return;
    const id = ++workId.current;
    const controller = new AbortController();
    scanController.current = controller;
    setSource("gemini"); setPhase("scanning"); setError(""); setReviewed(false);
    try {
      const result = await scanReceipt(photo, AbortSignal.any([controller.signal, AbortSignal.timeout(70000)]), accessCode);
      if (id !== workId.current) return;
      setMerchant(result.merchant); setDate(result.date); setItems(result.items);
      setTaxCents(result.taxCents); setServiceCents(result.serviceCents);
      setWarnings(result.warnings); setReceiptCurrency(result.currency); setPrintedTotalCents(result.totalCents); setPhase("edit");
    } catch (issue) {
      if (id !== workId.current || controller.signal.aborted) return;
      setError(issue instanceof Error && issue.name === "TimeoutError" ? "The scan took too long. Retry or enter the receipt manually." : issue instanceof Error ? issue.message : "Receipt scanning failed. Please retry.");
      setPhase("upload");
    } finally { if (scanController.current === controller) scanController.current = null; }
  };

  const beginManual = () => {
    workId.current++; scanController.current?.abort();
    setSource("manual"); setWarnings([]); setError(""); setMerchant(""); setDate(new Date().toISOString().slice(0, 10));
    setItems([{ id: `item-${Date.now()}`, name: "", quantity: 1, unitCents: 0, allocation: { memberIds: [] } }]);
    setTaxCents(0); setServiceCents(0); setPrintedTotalCents(null); setPhase("edit");
  };

  const updateItem = (id: string, changes: Partial<ExpenseItem>) => {
    setReviewed(false);
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  };

  const setSelectedGroup = (id: string) => {
    setGroupId(id);
    const next = state.groups.find((item) => item.id === id);
    if (next && !next.memberIds.includes(payerId)) setPayerId("me");
    setItems((current) => current.map((item) => ({ ...item, allocation: { memberIds: [] } })));
  };

  const goToAssignment = () => {
    const reviewError = receiptReviewError({ merchant, date, items, taxCents, serviceCents, aiScan: source === "gemini", receiptCurrency, groupCurrency: group.currency, printedTotalCents, reviewed });
    if (reviewError) return setError(reviewError);
    setError("");
    setPhase("assign");
  };

  const toggleMember = (itemId: string, memberId: string) => {
    setItems((current) => current.map((item) => {
      if (item.id !== itemId) return item;
      const ids = item.allocation.memberIds.includes(memberId)
        ? item.allocation.memberIds.filter((id) => id !== memberId)
        : [...item.allocation.memberIds, memberId];
      return { ...item, allocation: { memberIds: ids } };
    }));
  };

  const assignEveryone = (itemId?: string) => {
    const ids = members.map((member) => member.id);
    setItems((current) => current.map((item) => itemId && item.id !== itemId ? item : { ...item, allocation: { memberIds: ids } }));
  };

  const saveExpense = async () => {
    if (hasUnassigned) return setError("Assign every item before saving the expense.");
    if (assignedTotal !== total) return setError("The split must match the exact receipt total.");
    const expense: Expense = {
      id: editingExpense?.id ?? `e-${Date.now()}`,
      groupId: group.id,
      merchant: merchant.trim(),
      date,
      payerId,
      currency: group.currency,
      items,
      taxCents,
      serviceCents,
      shares,
      receiptPreview: retainPhoto ? preview : undefined,
    };
    setState((current) => ({
      ...current,
      expenses: editingExpense
        ? current.expenses.map((item) => item.id === editingExpense.id ? expense : item)
        : [expense, ...current.expenses],
    }));
    setPhase("success");
  };

  if (!group) {
    return <div className="expense-flow"><p>Create a group before adding an expense.</p><button onClick={onClose}>Go back</button></div>;
  }

  return (
    <div className="expense-flow">
      <header className="expense-flow-header">
        <button className="back-button" onClick={() => { if (phase === "upload" || editingExpense) { cancelScan(); onClose(); } else if (phase === "assign") setPhase("edit"); else cancelScan(); }}><ArrowLeft size={18} /> Back</button>
        <Brand compact />
        <span className="receipt-header-label">{editingExpense ? "Edit expense" : "New expense"}</span>
      </header>

      <div className="flow-progress" aria-label="Expense progress">
        {["Receipt", "Review", "Assign", "Done"].map((label, index) => {
          const position = phase === "upload" || phase === "scanning" ? 0 : phase === "edit" ? 1 : phase === "assign" ? 2 : 3;
          return <span key={label} className={index <= position ? "active" : ""}><i>{index < position ? <Check size={12} /> : index + 1}</i>{label}</span>;
        })}
      </div>

      {phase === "upload" && (
        <section className="flow-stage upload-stage">
          <div className="receipt-intro">
            <span className="receipt-intro-icon"><ReceiptText size={28} /></span>
            <p className="eyebrow">SPLIT SOMETHING GOOD</p>
            <h1>Start with a receipt.</h1>
            <p>Snap it. Check it. Split it your way.</p>
          </div>
          {!photo && <div className="receipt-capture-panel">
            <div className="receipt-capture-heading"><Camera size={25} /><div><h2>Every item, accounted for.</h2><p>Keep the whole receipt in frame, with good lighting.</p></div></div>
            <div className="receipt-capture-actions"><button className="primary-button" disabled={preparing} onClick={() => setCameraOpen(true)}><Camera size={19} /> Take a photo</button><label className="receipt-file-button secondary-button"><ImagePlus size={19} /> Choose a photo<input disabled={preparing} type="file" accept="image/*" aria-label="Choose a receipt image" onChange={(event) => { void choosePhoto(event.target.files?.[0]); event.target.value = ""; }} /></label></div>
            <span className="receipt-capture-hint">JPG, PNG or WebP · Up to 10 MB</span>
          </div>}
          {preparing && <p role="status">Preparing your photo…</p>}
          {backend !== "ready" && <p className="receipt-availability" role="status">{backend === "checking" ? "Connecting to scanner…" : "Scanning is unavailable right now. You can still enter a receipt manually."}</p>}
          {photo && <div className="receipt-photo-ready">
            <div className="receipt-photo-heading"><h2>Ready to scan?</h2><button className="text-button" onClick={() => { setPhoto(undefined); setPreview(undefined); setConsent(false); }}>Change photo</button></div>
            <img src={photo.preview} alt="Receipt photo ready for your approval" />
            <p>Make sure the text is clear and personal details are covered.</p>
            {accessRequired && <label className="receipt-access-field"><span>Scan access code</span><input type="password" value={accessCode} maxLength={256} autoComplete="off" onChange={(event) => setAccessCode(event.target.value)} placeholder="Enter your invite code" /><small>Provided by the JomBit team. Never enter an API key here.</small></label>}
            <label className="receipt-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to send this redacted photo to Google for processing. It contains no sensitive information.</span></label>
            <details className="receipt-privacy"><summary>How your photo is handled</summary><p>Under Google's unpaid-service terms, uploads may be used to improve products and reviewed by people. Use only sample or redacted receipts without personal or confidential information. JomBit does not save the photo unless you choose to keep it. <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Read Google's data terms</a>.</p></details>
            <button className="primary-button" disabled={!consent || backend !== "ready" || preparing || (accessRequired && !accessCode.trim())} onClick={beginGeminiScan}><Sparkles size={18} /> Scan receipt <ArrowRight size={17} /></button>
          </div>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="text-button receipt-manual-button" disabled={preparing} onClick={beginManual}><Plus size={16} /> Enter manually</button>
          <p className="receipt-bottom-note">You can check and edit everything before saving.</p>
        </section>
      )}

      {phase === "scanning" && (
        <section className="flow-stage scanning-stage">
          <div className="scanner-window">
            {preview && <img src={preview} alt="Receipt being processed" />}
            <div className="scan-line" />
          </div>
          <h1>Reading your receipt…</h1>
          <p role="status">Finding the items and checking the totals.</p>
          <button className="secondary-button" onClick={cancelScan}>Cancel scan</button>
        </section>
      )}

      {phase === "edit" && (
        <section className="flow-stage review-stage" onChangeCapture={(event) => { if (!(event.target as HTMLElement).hasAttribute("data-review-confirmation")) setReviewed(false); }}>
          <div className="stage-heading"><div><p className="eyebrow">YOUR RECEIPT</p><h1>Check every detail</h1><p>Everything is editable before it reaches the group ledger.</p></div>{preview && <img src={preview} alt="Receipt preview" />}</div>
          {source === "gemini" && <div className="receipt-review-notice"><strong>AI can misread receipts. Your review matters.</strong><p>Check every item, price, charge and the printed total. Adjust item prices for any discounts or rounding before continuing.</p>{warnings.length > 0 && <ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}</div>}
          <div className="review-grid">
            <div className="review-main">
              <div className="form-card receipt-meta-grid">
                <label><span>Merchant</span><input value={merchant} onChange={(event) => setMerchant(event.target.value)} /></label>
                <label><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
                <label><span>Group</span><select value={group.id} onChange={(event) => setSelectedGroup(event.target.value)}>{state.groups.map((item) => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}</select></label>
                <label><span>Paid by</span><select value={payerId} onChange={(event) => setPayerId(event.target.value)}>{members.map((member) => <option key={member.id} value={member.id}>{member.name}{member.id === "me" ? " (You)" : ""}</option>)}</select></label>
              </div>
              <div className="items-card">
                <div className="section-heading"><h2>Receipt items</h2><span>{items.length} items</span></div>
                {items.map((item, index) => (
                  <div className="editable-item" key={item.id}>
                    <span className="item-index">{index + 1}</span>
                    <label className="grow"><span>Item</span><input value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} /></label>
                    <label className="qty-field"><span>Qty</span><input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Math.max(1, Number(event.target.value)) })} /></label>
                    <label className="price-field"><span>Unit price ({group.currency})</span><input type="number" min="0" step="0.01" value={(item.unitCents / 100).toFixed(2)} onChange={(event) => updateItem(item.id, { unitCents: Math.round(Number(event.target.value) * 100) })} /></label>
                    <button className="icon-button" aria-label={`Delete ${item.name}`} onClick={() => { setReviewed(false); setItems((current) => current.filter((value) => value.id !== item.id)); }}><Trash2 size={17} /></button>
                  </div>
                ))}
                <button className="add-item-button" onClick={() => { setReviewed(false); setItems((current) => [...current, { id: `item-${Date.now()}`, name: "", quantity: 1, unitCents: 0, allocation: { memberIds: [] } }]); }}><Plus size={17} /> Add item manually</button>
              </div>
            </div>
            <aside className="receipt-totals-card">
              <p className="eyebrow">RECEIPT TOTAL</p>
              <div><span>Items subtotal</span><strong>{formatMoney(expenseSubtotal(items), group.currency)}</strong></div>
              <label><span>SST / tax</span><input type="number" min="0" step="0.01" value={(taxCents / 100).toFixed(2)} onChange={(event) => setTaxCents(Math.max(0, Math.round(Number(event.target.value) * 100)))} /></label>
              <label><span>Service charge</span><input type="number" min="0" step="0.01" value={(serviceCents / 100).toFixed(2)} onChange={(event) => setServiceCents(Math.max(0, Math.round(Number(event.target.value) * 100)))} /></label>
              <div className="grand-total"><span>Total</span><strong>{formatMoney(total, group.currency)}</strong></div>
              <small>Charges will be allocated proportionally to each person’s items.</small>
            </aside>
          </div>
          {source === "gemini" && <div className="receipt-review-extra">
            <label><span>Receipt currency — must match this group ({group.currency})</span><select value={receiptCurrency} onChange={(event) => { setReceiptCurrency(event.target.value); setReviewed(false); }}><option value="">Select the printed currency</option>{["MYR", "SGD", "THB", "IDR"].map((currency) => <option key={currency}>{currency}</option>)}{receiptCurrency && !["MYR", "SGD", "THB", "IDR"].includes(receiptCurrency) && <option value={receiptCurrency}>{receiptCurrency} — not supported by this demo</option>}</select></label>
            <label><span>Printed grand total — verify against your photo</span><input type="number" min="0" step="0.01" value={printedTotalCents === null ? "" : (printedTotalCents / 100).toFixed(2)} onChange={(event) => { setPrintedTotalCents(event.target.value === "" ? null : Math.round(Number(event.target.value) * 100)); setReviewed(false); }} /></label>
            <p className={`receipt-total-match ${printedTotalCents !== total ? "is-mismatch" : ""}`}>{printedTotalCents === null ? "Enter the total printed on your receipt." : printedTotalCents === total ? "Items + tax + service match the printed total." : `Difference to resolve: ${formatMoney(total - printedTotalCents, group.currency)}`}</p>
            <label className="receipt-consent"><input data-review-confirmation type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /><span>I checked the merchant, date, currency, items, quantities, charges and total against the receipt.</span></label>
          </div>}
          {preview && <div className="receipt-review-extra"><label className="receipt-consent"><input type="checkbox" checked={retainPhoto} onChange={(event) => setRetainPhoto(event.target.checked)} /><span>Also save the receipt photo in this browser’s local group ledger.</span></label><small>Off by default for new photos. The app server does not save or log your photo. Google’s own data terms still apply to scans you submit.</small></div>}
          {error && <p className="form-error">{error}</p>}
          <div className="sticky-flow-action"><span><small>Confirmed total</small><strong>{formatMoney(total, group.currency)}</strong></span><button className="primary-button" onClick={goToAssignment}>Assign items <ArrowRight size={18} /></button></div>
        </section>
      )}

      {phase === "assign" && (
        <section className="flow-stage assignment-stage">
          <div className="stage-heading"><div><p className="eyebrow">WHO HAD WHAT?</p><h1>Assign the receipt</h1><p>Tap everyone who shared each item. JomBit handles cent-perfect rounding.</p></div><button className="secondary-button" onClick={() => assignEveryone()}><Users size={17} /> Split everything evenly</button></div>
          <div className="assignment-layout">
            <div className="assignment-items">
              {items.map((item) => (
                <article className={`assignment-item ${!item.allocation.memberIds.length ? "needs-assignment" : ""}`} key={item.id}>
                  <div className="assignment-item-head"><span><strong>{item.name}</strong><small>{item.quantity} × {formatMoney(item.unitCents, group.currency)}</small></span><strong>{formatMoney(item.quantity * item.unitCents, group.currency)}</strong></div>
                  <div className="member-chips">
                    {members.map((member) => {
                      const selected = item.allocation.memberIds.includes(member.id);
                      return <button key={member.id} className={selected ? "selected" : ""} onClick={() => toggleMember(item.id, member.id)}><Avatar name={member.name} size="sm" />{member.id === "me" ? "You" : member.name}{selected && <Check size={14} />}</button>;
                    })}
                    <button className="everyone-chip" onClick={() => assignEveryone(item.id)}><Users size={15} /> Everyone</button>
                  </div>
                  {!item.allocation.memberIds.length && <small className="assignment-warning">Choose at least one person</small>}
                </article>
              ))}
            </div>
            <aside className="live-split-card">
              <div className="section-heading"><div><p className="eyebrow">LIVE TOTAL</p><h2>Everyone’s share</h2></div><span>{formatMoney(assignedTotal, group.currency)} / {formatMoney(total, group.currency)}</span></div>
              {members.map((member) => {
                const share: MemberShare = shares[member.id] ?? { itemsCents: 0, taxCents: 0, serviceCents: 0, totalCents: 0 };
                const expanded = expandedShare === member.id;
                return (
                  <button className="share-row" key={member.id} onClick={() => setExpandedShare(expanded ? undefined : member.id)}>
                    <span className="share-person"><Avatar name={member.name} size="sm" /><span><strong>{member.id === "me" ? "You" : member.name}</strong><small>Tap for breakdown</small></span></span>
                    <strong>{formatMoney(share.totalCents, group.currency)}</strong>
                    {expanded && <span className="share-breakdown"><span>Items <b>{formatMoney(share.itemsCents, group.currency)}</b></span><span>SST / tax <b>{formatMoney(share.taxCents, group.currency)}</b></span><span>Service <b>{formatMoney(share.serviceCents, group.currency)}</b></span><span>Final share <b>{formatMoney(share.totalCents, group.currency)}</b></span></span>}
                  </button>
                );
              })}
              <div className={`split-check ${!hasUnassigned && assignedTotal === total ? "valid" : ""}`}><CheckCircle2 size={18} /><span>{!hasUnassigned && assignedTotal === total ? "Exact match — every cent assigned" : `${items.filter((item) => !item.allocation.memberIds.length).length} items still need people`}</span></div>
            </aside>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="sticky-flow-action"><span><small>Receipt total</small><strong>{formatMoney(total, group.currency)}</strong></span><button className="primary-button" disabled={hasUnassigned || assignedTotal !== total} onClick={saveExpense}>{editingExpense ? "Update expense" : "Save to group"} <ArrowRight size={18} /></button></div>
        </section>
      )}

      {phase === "success" && (
        <section className="flow-stage success-stage">
          <div className="success-check"><Check size={44} /></div>
          <p className="eyebrow">LEDGER UPDATED</p>
          <h1>{editingExpense ? "Expense updated." : "Split saved perfectly."}</h1>
          <p>{merchant} is now part of {group.name}. Every member balance and settlement suggestion has been recalculated.</p>
          <div className="success-receipt"><span><ReceiptText size={20} /> {items.length} receipt items</span><strong>{formatMoney(total, group.currency)}</strong></div>
          <button className="primary-button" onClick={() => onSaved(group.id)}>View updated group <ArrowRight size={18} /></button>
          <button className="text-button" onClick={onClose}>Back to home</button>
        </section>
      )}
      {cameraOpen && <ReceiptCamera onClose={() => setCameraOpen(false)} onPhoto={(file) => { void choosePhoto(file); }} />}
    </div>
  );
}

