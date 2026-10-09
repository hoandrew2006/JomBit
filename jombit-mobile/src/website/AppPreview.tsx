import { ArrowRight, ScanLine } from "lucide-react";
import { Brand } from "../../app/components/ui";
import { GroupLedgerHero } from "../../app/components/GroupLedgerHero";
import { formatMoney } from "../../lib/calculations";
import { dinnerPeople, dinnerShares, dinnerTotal } from "./journey-data";

export function AppPreview() {
  return <figure className="m-app-preview">
    <div className="m-app-window">
      <div className="m-app-toolbar"><Brand compact /><span>Product preview</span></div>
      <GroupLedgerHero href="#how-it-works" />
      <div className="m-app-receipt">
        <div className="m-app-receipt-heading"><span>Dinner with the crew<small>Four friends. One fair split.</small></span><strong>{formatMoney(dinnerTotal)}</strong></div>
        <dl>{dinnerPeople.map((person) => <div key={person.id}><dt>{person.name}</dt><dd>{formatMoney(dinnerShares[person.id].totalCents)}</dd></div>)}</dl>
        <a href="#how-it-works">See how it adds up <ArrowRight size={17} /></a>
      </div>
    </div>
    <figcaption><ScanLine size={16} /> App component with sample receipt data. No money moves.</figcaption>
  </figure>;
}
