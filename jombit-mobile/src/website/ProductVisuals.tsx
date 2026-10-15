import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Check,
  CheckCheck, CreditCard, Home, Plane, ReceiptText,
} from "lucide-react";
import { Brand } from "../../app/components/ui";

export function MiniPeople() {
  return <div className="m-people" aria-label="Four friends"><span>A</span><span>M</span><span>D</span><span>S</span></div>;
}


export function ReceiptVisual() {
  return <div className="m-receipt-visual"><div className="m-receipt-paper"><span>JOMBIT · YOUR DINNER CREW</span><h4>Good food.<br />Fair shares.</h4><div><span>Nasi lemak × 2</span><b>RM 36.00</b></div><div><span>Satay platter</span><b>RM 24.00</b></div><div><span>Teh tarik × 4</span><b>RM 16.00</b></div><hr /><div><span>Items subtotal</span><b>RM 76.00</b></div><div><span>SST + service</span><b>RM 12.16</b></div><div className="m-receipt-total"><strong>Total</strong><strong>RM 88.16</strong></div><span className="m-receipt-perforation" /></div><div className="m-assigned-dish"><span>🍢</span><div><strong>Sharing the satay?</strong><small>Assign it to everyone at the table.</small></div><MiniPeople /></div><div className="m-receipt-tick"><Check size={23} /></div></div>;
}

export function GroupVisual() {
  return <div className="m-ledger-visual"><div className="m-ledger-head"><span>✈️</span><div><small>YOUR TRAVEL CREW</small><h4>Bangkok weekend</h4></div><MiniPeople /></div><div className="m-ledger-total"><span>Shared spending</span><strong>RM 960.00</strong><small>3 expenses · 4 friends</small></div>{[["Hotel", "Aisha paid", "600.00"], ["Dinner", "Maya paid", "240.00"], ["Airport taxi", "Daniel paid", "120.00"]].map(([title, who, value]) => <div className="m-ledger-row" key={title}><span><ReceiptText size={18} /></span><div><strong>{title}</strong><small>{who}</small></div><b>RM {value}</b></div>)}<div className="m-ledger-foot"><CheckCheck size={17} /> One clear record. Everyone in the loop.</div></div>;
}

export function SettlementVisual() {
  return <div className="m-settlement-visual"><span className="m-visual-kicker">ONE GROUP BALANCE. FEWER PAYMENTS.</span><div className="m-settle-before"><div><i>A</i><i>M</i></div><div><i>D</i><i>S</i></div><span className="m-debt-line line-1" /><span className="m-debt-line line-2" /><span className="m-debt-line line-3" /><span className="m-debt-line line-4" /></div><span className="m-simplified-pill"><CheckCheck size={15} /> Simplified by JomBit</span><div className="m-simple-payment"><span>D</span><div><strong>Daniel pays Maya</strong><small>One clear next step</small></div><ArrowRight size={17} /><b>RM 42.30</b></div><div className="m-simple-payment"><span>S</span><div><strong>Sarah pays you</strong><small>No more chasing the group chat</small></div><ArrowRight size={17} /><b>RM 18.90</b></div><small className="m-visual-note">Illustrative settlement suggestions</small></div>;
}

export function CurrencyVisual() {
  return <div className="m-currency-visual"><div><span>🇲🇾</span><strong>MYR</strong><small>Your wallet balance</small></div><div><span>🇸🇬</span><strong>SGD</strong><small>Estimated equivalent</small></div><div><span>🇹🇭</span><strong>THB</strong><small>Estimated equivalent</small></div><div><span>🇮🇩</span><strong>IDR</strong><small>Estimated equivalent</small></div><span className="m-currency-exchange"><ArrowDownLeft size={15} /><ArrowUpRight size={15} /></span></div>;
}

export function CardVisual({ metal = false }: { metal?: boolean }) {
  return <div className={`m-bank-card ${metal ? "m-bank-card-metal" : ""}`}><div><Brand compact /><span>PREPAID CONCEPT</span></div><div className="m-bank-chip"><i /><i /><i /></div><span className="m-bank-card-number">JOMBIT · EVERYDAY</span><div><span>GOOD TIMES, ON THE GO.</span><span>DEMO</span></div></div>;
}

export function JourneyIcon({ type }: { type: "food" | "travel" | "home" }) {
  return <span className={`m-journey-icon m-journey-${type}`}>{type === "food" ? <ReceiptText size={27} /> : type === "travel" ? <Plane size={27} /> : <Home size={27} />}</span>;
}
