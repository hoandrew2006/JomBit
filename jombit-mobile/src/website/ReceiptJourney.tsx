import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CheckCheck, Pause, Play, ReceiptText, RotateCcw } from "lucide-react";
import { formatMoney } from "../../lib/calculations";
import { dinnerItems, dinnerPeople, dinnerService, dinnerShares, dinnerTax, dinnerTotal, examplePayments, personName, separatePayments } from "./journey-data";
import { useReducedMotion } from "./Motion";

const steps = [
  { label: "Scan", title: "One receipt. All the details.", text: "Aisha paid for dinner. Start with the items, then check the tax, service charge and total. You stay in control of every field." },
  { label: "Assign", title: "Shared dishes. Personal shares.", text: "Aisha and Maya had the nasi lemak. Everyone shared the satay and drinks. Each item goes to the people who actually shared it." },
  { label: "Split", title: "Fair doesn’t always mean equal.", text: "Tax and service follow each person’s item subtotal. All four shares add up to the original receipt, down to the last cent." },
  { label: "Simplify", title: "One evening. Less back-and-forth.", text: "Maya also paid RM24.00 for everyone’s taxi home. Combine both expenses: six separate repayments become three clear suggestions." },
];

export function ReceiptJourney() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!playing || reduced) return;
    const timer = window.setTimeout(() => {
      if (step === steps.length - 1) setPlaying(false);
      else setStep(step + 1);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [step, playing, reduced]);
  useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);
  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    const observer = "IntersectionObserver" in window ? new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setPlaying(false);
    }) : null;
    if (section.current) observer?.observe(section.current);
    return () => { document.removeEventListener("visibilitychange", pauseWhenHidden); observer?.disconnect(); };
  }, []);
  const select = (index: number) => { setStep(index); setPlaying(false); };

  return <section className="m-journey-section m-section" id="how-it-works" ref={section}>
    <div className="m-container" data-reveal>
      <div className="m-journey-heading"><div className="m-section-intro"><span className="m-eyebrow">SEE JOMBIT IN ACTION</span><h2>One dinner.<br />Every good bit, accounted for.</h2><p>Meet the KL dinner crew. Follow their bill from the first scan to the final split.</p></div><span className="m-status-tag"><span /> ILLUSTRATIVE WALKTHROUGH</span></div>
      <div className="m-journey-tabs" role="tablist" aria-label="Receipt walkthrough steps">
        {steps.map(({ label }, index) => <button type="button" key={label} role="tab" id={`journey-tab-${index}`} aria-selected={step === index} aria-controls="journey-panel" tabIndex={step === index ? 0 : -1} onClick={() => select(index)} onKeyDown={(event) => {
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % steps.length;
          else if (event.key === "ArrowLeft") next = (index + steps.length - 1) % steps.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = steps.length - 1;
          else return;
          event.preventDefault(); select(next); document.getElementById(`journey-tab-${next}`)?.focus();
        }}><span>{String(index + 1).padStart(2, "0")}</span>{label}<Check size={16} className={index < step ? "is-complete" : ""} /></button>)}
      </div>
      <div className="m-journey-panel" id="journey-panel" role="tabpanel" aria-labelledby={`journey-tab-${step}`} tabIndex={0}>
        <div className={`m-demo-receipt ${step === 1 ? "is-assigning" : ""}`}>
          <div className="m-demo-receipt-head"><ReceiptText size={22} /><span>JOMBIT SAMPLE CAFE<small>KL dinner crew · 4 friends</small></span></div>
          <div className="m-demo-receipt-items">{dinnerItems.map((item, index) => <div className="m-demo-line" key={item.id} style={{ animationDelay: `${index * 150}ms` }}><div><span>{item.name}</span><b>{formatMoney(item.quantity * item.unitCents)}</b></div>{step >= 1 && <span className="m-assignment"><Check size={12} />{item.allocation.memberIds.length === 4 ? "Shared by all four" : "Aisha + Maya"}</span>}</div>)}</div>
          <dl><div><dt>Items subtotal</dt><dd>RM76.00</dd></div><div><dt>Tax · sample 6%</dt><dd>{formatMoney(dinnerTax)}</dd></div><div><dt>Service · sample 10%</dt><dd>{formatMoney(dinnerService)}</dd></div><div className="m-demo-total"><dt>Total</dt><dd>{formatMoney(dinnerTotal)}</dd></div></dl>
          <div className="m-demo-payer"><CheckCheck size={15} /> Paid by Aisha</div>
          {step === 0 && playing && <div className="m-demo-scan" aria-hidden="true" />}
        </div>
        <div className="m-journey-result" key={step}>
          <span className="m-eyebrow">{String(step + 1).padStart(2, "0")} / THE JOMBIT WAY</span><h3>{steps[step].title}</h3><p>{steps[step].text}</p>
          {step === 0 && <div className="m-scan-facts"><span><Check /> Item-level details</span><span><Check /> Tax & service charges</span><span><Check /> Editable before you split</span><small>Camera + Gemini scanning is available in the configured local app. This website uses a sample receipt and uploads nothing.</small></div>}
          {step === 1 && <div className="m-demo-people">{dinnerPeople.map((person, index) => <div key={person.id}><span className={`m-person-avatar m-avatar-${index}`}>{person.initial}</span><div><strong>{person.name}</strong><small>{index < 2 ? "Nasi lemak + shared dishes" : "Shared satay + a drink"}</small></div></div>)}</div>}
          {step === 2 && <div className="m-share-breakdown"><div className="m-share-heading"><span>Person</span><span>Items</span><span>Charges</span><span>Total</span></div>{dinnerPeople.map((person) => { const share = dinnerShares[person.id]; return <div key={person.id}><strong>{person.name}</strong><span>{formatMoney(share.itemsCents)}</span><span>{formatMoney(share.taxCents + share.serviceCents)}</span><b>{formatMoney(share.totalCents)}</b></div>; })}<p><CheckCheck size={16} /> Four shares. Exactly {formatMoney(dinnerTotal)}.</p></div>}
          {step === 3 && <div className="m-demo-settlements"><div className="m-payment-reduction"><span><b>{separatePayments.length}</b> separate payments</span><ArrowRight /><span><b>{examplePayments.length}</b> after simplifying</span></div><div className="m-debt-threads" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>{examplePayments.map((payment) => <div className="m-demo-payment" key={payment.fromId}><span>{personName(payment.fromId)} <ArrowRight size={14} /> {personName(payment.toId)}</span><strong>{formatMoney(payment.amountCents)}</strong></div>)}<small>Suggested repayments for dinner + taxi. No payment is made.</small></div>}
        </div>
      </div>
      <div className="m-journey-controls"><span aria-live="polite">Step {step + 1} of 4 · {steps[step].label}</span><div>{!reduced && <button type="button" className="m-play-button" aria-pressed={playing} onClick={() => { if (playing) setPlaying(false); else { if (step === 3) setStep(0); setPlaying(true); } }}>{playing ? <Pause size={16} /> : step === 3 ? <RotateCcw size={16} /> : <Play size={16} />}{playing ? "Pause" : step === 3 ? "Replay walkthrough" : "Play walkthrough"}</button>}<button type="button" className="m-next-button" onClick={() => select((step + 1) % steps.length)}>{step === 3 ? "Back to receipt" : "Next step"}<ArrowRight size={16} /></button></div></div>
      <p className="m-section-footnote">A sample, not a live scan. Real split calculations; simulated settlement. Sample tax rates are illustrative, not a tax guide.</p>
    </div>
  </section>;
}
