import { Camera } from "lucide-react";

/** Shared by the app and its marketing preview; no storage or camera side effects. */
export function GroupLedgerHero({ onScan, href }: { onScan?: () => void; href?: string }) {
  const label = <><Camera size={18} /> Scan a receipt</>;
  return <section className="hero-panel">
    <div className="hero-copy">
      <span className="demo-label">JOMBIT GROUP LEDGER</span>
      <h2>Every bite counted.<br />Every cent accounted for.</h2>
      <p>Scan a receipt and let JomBit work out the fair split.</p>
      {href ? <a className="light-button" href={href}>{label}</a> : <button className="light-button" onClick={onScan}>{label}</button>}
    </div>
    <div className="hero-rings" aria-hidden="true"><i /><i /><i /></div>
  </section>;
}
