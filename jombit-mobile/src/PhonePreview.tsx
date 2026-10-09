import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, BatteryFull, ReceiptText, Signal, Wifi } from "lucide-react";
import { Brand } from "../app/components/ui";

export function PhonePreview({ appDocument }: { appDocument?: string }) {
  const phoneRef = useRef<HTMLElement>(null);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const appUrl = new URL(window.location.href);
  appUrl.search = "?app=1";
  appUrl.hash = "";

  return (
    <main className="phone-showcase">
      <div className="showcase-orbit orbit-a" aria-hidden="true" />
      <div className="showcase-orbit orbit-b" aria-hidden="true" />
      <header className="showcase-header">
        <Brand />
        <a href={appUrl.href} target="_blank" rel="noreferrer">Open app <ArrowUpRight size={15} /></a>
      </header>
      <section className="showcase-copy" aria-label="About JomBit">
        <span className="showcase-kicker"><i /> MADE FOR THE WAY WE SHARE</span>
        <h1>Good times.<br />Fair splits.<br /><em>Zero awkwardness.</em></h1>
        <p>From the last satay to the next getaway.<br />Split every item, keep the group in sync,<br />and get back to the good bits.</p>
        <button className="showcase-cta" onClick={() => { phoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); phoneRef.current?.querySelector("iframe")?.focus(); }}>
          Try JomBit <ArrowUpRight size={18} />
        </button>
        <div className="showcase-steps"><span>01 <b>Scan it</b></span><i /><span>02 <b>Split it</b></span><i /><span>03 <b>Settle it</b></span></div>
        <span className="showcase-note"><ReceiptText size={15} /> A working demo. Every cent calculated.</span>
      </section>
      <section className="phone-stage" ref={phoneRef} aria-label="Interactive JomBit mobile app">
        <div className="phone-caption"><span>YOUR JOMBIT. GO ON, TAP IT.</span><ArrowDown size={16} /></div>
        <div className="device-frame">
          <div className="device-side-button side-silent" aria-hidden="true" />
          <div className="device-side-button side-volume" aria-hidden="true" />
          <div className="device-side-button side-power" aria-hidden="true" />
          <div className="device-screen">
            <div className="device-status" aria-hidden="true">
              <span>{clock.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
              <div className="device-camera"><i /></div>
              <span><Signal size={14} /><Wifi size={14} /><BatteryFull size={21} /></span>
            </div>
            <iframe className="device-app" title="JomBit app" allow="camera" src={appDocument ? undefined : appUrl.href} srcDoc={appDocument} />
          </div>
        </div>
      </section>
      <footer className="showcase-footer"><span>JomBit</span><span>SHARED MOMENTS. SHARED FAIRLY.</span><span>Demo · No real funds moved</span></footer>
    </main>
  );
}
