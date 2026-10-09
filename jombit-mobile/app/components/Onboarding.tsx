"use client";

import { Camera, Check, QrCode, Sparkles } from "lucide-react";
import { useState } from "react";
import type { Currency } from "@/lib/models";
import { useAppState } from "@/lib/state";
import { Brand } from "./ui";

export function Onboarding() {
  const { state, setState } = useAppState();
  const [name, setName] = useState(state.user.name);
  const [currency, setCurrency] = useState<Currency>(state.user.defaultCurrency);
  const [qr, setQr] = useState<string | undefined>(state.user.duitNowQr);

  const finish = () => {
    const finalName = name.trim() || "Aisha";
    setState((current) => ({
      ...current,
      user: { ...current.user, name: finalName, defaultCurrency: currency, duitNowQr: qr, onboarded: true },
      members: { ...current.members, me: { ...current.members.me, name: finalName, hasDuitNowQr: Boolean(qr) } },
    }));
  };

  const readQr = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setQr(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <main className="onboarding-shell">
      <section className="onboarding-card">
        <div className="onboarding-top">
          <Brand />
          <span className="demo-pill"><Sparkles size={14} /> Proof of concept</span>
        </div>
        <div className="onboarding-copy">
          <p className="eyebrow">Welcome to JomBit</p>
          <h1>Split the bill.<br /><span>Keep the good bits.</span></h1>
          <p>Scan receipts, share every item fairly, and turn a messy group tab into a few simple payments.</p>
        </div>

        <div className="onboarding-form">
          <label>
            <span>Your display name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="How friends see you" />
          </label>
          <label>
            <span>Default currency</span>
            <select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
              <option value="MYR">MYR — Malaysian Ringgit</option>
              <option value="SGD">SGD — Singapore Dollar</option>
              <option value="THB">THB — Thai Baht</option>
              <option value="IDR">IDR — Indonesian Rupiah</option>
            </select>
          </label>

          <label className={`qr-upload ${qr ? "has-file" : ""}`}>
            <input type="file" accept="image/*" onChange={(event) => readQr(event.target.files?.[0])} />
            {qr ? <img src={qr} alt="Uploaded DuitNow QR preview" /> : <QrCode size={28} />}
            <span>
              <strong>{qr ? "DuitNow QR added" : "Add your DuitNow QR"}</strong>
              <small>{qr ? "Stored on this device only" : "Friends can use it when they settle with you"}</small>
            </span>
            {qr ? <Check size={20} /> : <Camera size={20} />}
          </label>

          <button className="primary-button" onClick={finish}>Start using JomBit</button>
          <button className="text-button" onClick={finish}>Explore with demo data</button>
          <p className="fine-print">JomBit is a local proof of concept. No real funds, banking or crypto transactions occur.</p>
        </div>
      </section>
      <aside className="onboarding-visual" aria-hidden="true">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="floating-card floating-card-one">
          <span>DINNER AT MERDEKA 118</span>
          <strong>RM 168.40</strong>
          <small>Split perfectly • 4 people</small>
        </div>
        <div className="floating-card floating-card-two">
          <span>YOU’RE ALL SETTLED</span>
          <strong>✓</strong>
          <small>That was easy.</small>
        </div>
      </aside>
    </main>
  );
}

