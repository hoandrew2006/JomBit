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
import { useMemo, useState } from "react";
import { calculateExpenseShares, expenseSubtotal, expenseTotal, formatMoney } from "@/lib/calculations";
import { demoReceiptItems, mockDelay } from "@/lib/mock-services";
import type { Expense, ExpenseItem, MemberShare } from "@/lib/models";
import { useAppState } from "@/lib/state";
import { Avatar, Brand } from "./ui";

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
  const [scanStep, setScanStep] = useState(0);
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

  const group = state.groups.find((item) => item.id === groupId) ?? state.groups[0];
  const members = group ? group.memberIds.map((id) => state.members[id]).filter(Boolean) : [];
  const shares = useMemo(() => calculateExpenseShares(items, taxCents, serviceCents), [items, taxCents, serviceCents]);
  const total = expenseTotal(items, taxCents, serviceCents);
  const assignedTotal = Object.values(shares).reduce((sum, share) => sum + share.totalCents, 0);
  const hasUnassigned = items.some((item) => !item.allocation.memberIds.length);

  const beginScan = async (file?: File) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setPreview(String(reader.result));
      reader.readAsDataURL(file);
    }
    setPhase("scanning");
    setScanStep(0);
    await mockDelay(500);
    setScanStep(1);
    await mockDelay(550);
    setScanStep(2);
    await mockDelay(500);
    setMerchant("Kedai Kopi Rasa Sayang");
    setItems(demoReceiptItems());
    setTaxCents(502);
    setServiceCents(837);
    setPhase("edit");
  };

  const updateItem = (id: string, changes: Partial<ExpenseItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  };

  const setSelectedGroup = (id: string) => {
    setGroupId(id);
    const next = state.groups.find((item) => item.id === id);
    if (next && !next.memberIds.includes(payerId)) setPayerId("me");
    setItems((current) => current.map((item) => ({ ...item, allocation: { memberIds: [] } })));
  };

  const goToAssignment = () => {
    if (!merchant.trim()) return setError("Add a merchant name before continuing.");
    if (!items.length || expenseSubtotal(items) <= 0) return setError("Add at least one positive-value receipt item.");
    if (items.some((item) => !item.name.trim() || item.quantity <= 0 || item.unitCents <= 0)) return setError("Every item needs a name, quantity and positive price.");
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
      receiptPreview: preview,
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
        <button className="back-button" onClick={phase === "upload" || editingExpense ? onClose : () => setPhase(phase === "assign" ? "edit" : "upload")}><ArrowLeft size={18} /> Back</button>
        <Brand compact />
        <span className="demo-pill"><Sparkles size={13} /> Demo OCR</span>
      </header>

      <div className="flow-progress" aria-label="Expense progress">
        {["Receipt", "Review", "Assign", "Done"].map((label, index) => {
          const position = phase === "upload" || phase === "scanning" ? 0 : phase === "edit" ? 1 : phase === "assign" ? 2 : 3;
          return <span key={label} className={index <= position ? "active" : ""}><i>{index < position ? <Check size={12} /> : index + 1}</i>{label}</span>;
        })}
      </div>

      {phase === "upload" && (
        <section className="flow-stage upload-stage">
          <p className="eyebrow">ADD A GROUP EXPENSE</p>
          <h1>Turn a receipt into a fair split.</h1>
          <p>Upload a photo or use our reliable demo receipt. JomBit’s scanner is simulated for this proof of concept.</p>
          <label className="receipt-dropzone">
            <input type="file" accept="image/*" onChange={(event) => beginScan(event.target.files?.[0])} />
            <span className="scan-illustration"><ReceiptText size={42} /><i /></span>
            <strong>Drop a receipt here</strong>
            <small>or tap to choose a photo</small>
            <span className="secondary-button"><ImagePlus size={17} /> Choose image</span>
          </label>
          <div className="or-divider"><span>or</span></div>
          <button className="demo-receipt-button" onClick={() => beginScan()}>
            <span><Camera size={22} /></span>
            <span><strong>Try the demo receipt</strong><small>Malaysian restaurant · 4 items · SST + service</small></span>
            <ArrowRight size={18} />
          </button>
          <p className="fine-print">Demo scanner only. No image is sent to an external OCR service.</p>
        </section>
      )}

      {phase === "scanning" && (
        <section className="flow-stage scanning-stage">
          <div className="scanner-window">
            {preview ? <img src={preview} alt="Receipt being processed" /> : <div className="demo-paper"><strong>KEDAI KOPI</strong><span>NASI LEMAK × 2</span><span>CHAR KUEY TEOW</span><span>SATAY PLATTER</span><span>TEH TARIK × 3</span></div>}
            <div className="scan-line" />
          </div>
          <h1>{["Reading receipt…", "Detecting items…", "Checking totals…"][scanStep]}</h1>
          <p>Simulating receipt recognition locally</p>
          <div className="scan-steps">{[0, 1, 2].map((step) => <i key={step} className={step <= scanStep ? "active" : ""} />)}</div>
        </section>
      )}

      {phase === "edit" && (
        <section className="flow-stage review-stage">
          <div className="stage-heading"><div><p className="eyebrow">SIMULATED OCR RESULT</p><h1>Check every detail</h1><p>Everything is editable before it reaches the group ledger.</p></div>{preview && <img src={preview} alt="Receipt preview" />}</div>
          <div className="review-grid">
            <div className="review-main">
              <div className="form-card receipt-meta-grid">
                <label><span>Merchant</span><input value={merchant} onChange={(event) => setMerchant(event.target.value)} /></label>
                <label><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
                <label><span>Group</span><select value={group.id} onChange={(event) => setSelectedGroup(event.target.value)}>{state.groups.map((item) => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}</select></label>
                <label><span>Paid by</span><select value={payerId} onChange={(event) => setPayerId(event.target.value)}>{members.map((member) => <option key={member.id} value={member.id}>{member.name}{member.id === "me" ? " (You)" : ""}</option>)}</select></label>
              </div>
              <div className="items-card">
                <div className="section-heading"><h2>Receipt items</h2><span>{items.length} detected</span></div>
                {items.map((item, index) => (
                  <div className="editable-item" key={item.id}>
                    <span className="item-index">{index + 1}</span>
                    <label className="grow"><span>Item</span><input value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} /></label>
                    <label className="qty-field"><span>Qty</span><input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Math.max(1, Number(event.target.value)) })} /></label>
                    <label className="price-field"><span>Price ({group.currency})</span><input type="number" min="0.01" step="0.01" value={(item.unitCents / 100).toFixed(2)} onChange={(event) => updateItem(item.id, { unitCents: Math.round(Number(event.target.value) * 100) })} /></label>
                    <button className="icon-button" aria-label={`Delete ${item.name}`} onClick={() => setItems((current) => current.filter((value) => value.id !== item.id))}><Trash2 size={17} /></button>
                  </div>
                ))}
                <button className="add-item-button" onClick={() => setItems((current) => [...current, { id: `item-${Date.now()}`, name: "", quantity: 1, unitCents: 0, allocation: { memberIds: [] } }])}><Plus size={17} /> Add item manually</button>
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
    </div>
  );
}

