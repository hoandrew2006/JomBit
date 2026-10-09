"use client";

import { Check, ChevronRight, CircleHelp, Database, QrCode, RefreshCcw, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import type { Currency } from "@/lib/models";
import { useAppState } from "@/lib/state";
import { Avatar, Brand, Modal, PageHeader, Toast } from "./ui";

export function ProfileScreen() {
  const { state, setState, reset } = useAppState();
  const [name, setName] = useState(state.user.name);
  const [currency, setCurrency] = useState<Currency>(state.user.defaultCurrency);
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState("");

  const save = () => {
    if (!name.trim()) return;
    setState((current) => ({
      ...current,
      user: { ...current.user, name: name.trim(), defaultCurrency: currency },
      members: { ...current.members, me: { ...current.members.me, name: name.trim() } },
    }));
    setToast("Profile saved on this device");
    window.setTimeout(() => setToast(""), 2500);
  };

  const uploadQr = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      setState((current) => ({ ...current, user: { ...current.user, duitNowQr: value }, members: { ...current.members, me: { ...current.members.me, hasDuitNowQr: true } } }));
      setToast("DuitNow QR saved locally");
      window.setTimeout(() => setToast(""), 2500);
    };
    reader.readAsDataURL(file);
  };

  const resetDemo = () => {
    reset();
    setResetOpen(false);
  };

  return (
    <div className="screen profile-screen">
      <PageHeader eyebrow="YOUR JOMBIT" title="Profile & demo settings" />
      <section className="profile-identity"><Avatar name={state.user.name} size="lg" /><div><h2>{state.user.name}</h2><p>JomBit member · local demo profile</p></div><span><Check size={14} /> Ready</span></section>

      <section className="profile-card">
        <div className="section-heading"><h2>Personal details</h2><UserRound size={19} /></div>
        <div className="form-stack"><label><span>Display name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Default expense currency</span><select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}><option value="MYR">MYR — Malaysian Ringgit</option><option value="SGD">SGD — Singapore Dollar</option><option value="THB">THB — Thai Baht</option><option value="IDR">IDR — Indonesian Rupiah</option></select></label><button className="primary-button" onClick={save}>Save profile</button></div>
      </section>

      <section className="profile-card qr-profile-card">
        <div className="section-heading"><div><h2>Your DuitNow QR</h2><p>Shown when friends settle a MYR balance with you.</p></div><QrCode size={20} /></div>
        <label className="profile-qr-upload"><input type="file" accept="image/*" onChange={(event) => uploadQr(event.target.files?.[0])} />{state.user.duitNowQr ? <img src={state.user.duitNowQr} alt="Your saved DuitNow QR" /> : <span><QrCode size={34} /></span>}<span><strong>{state.user.duitNowQr ? "Change DuitNow QR" : "Upload DuitNow QR"}</strong><small>Stored only in your browser for this demo</small></span><ChevronRight size={18} /></label>
      </section>

      <section className="about-jombit">
        <Brand />
        <h2>Friends, food and funds — in one place.</h2>
        <p>JomBit is a group-expense and fintech proof of concept. Its working local ledger splits receipt items, allocates charges to the cent, simplifies group debt and records demo settlements.</p>
        <div><span><Database size={17} /> Local-first demo state</span><span><ShieldCheck size={17} /> No real funds moved</span><span><CircleHelp size={17} /> Simulated financial services</span></div>
      </section>

      <section className="danger-zone"><div><RefreshCcw size={21} /><span><strong>Reset JomBit demo</strong><small>Restore groups, balances, history and onboarding</small></span></div><button onClick={() => setResetOpen(true)}>Reset Demo</button></section>
      <p className="profile-footer">JomBit proof of concept · Version 1.0 · Built for demonstration</p>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset all demo data?" eyebrow="START FRESH"><div className="form-stack"><p className="modal-copy">This clears every local change and restores JomBit’s original sample groups, wallet balances, crypto holdings and card state.</p><button className="danger-button" onClick={resetDemo}>Yes, reset JomBit</button><button className="secondary-button" onClick={() => setResetOpen(false)}>Keep my demo data</button></div></Modal>
      <Toast message={toast} />
    </div>
  );
}

