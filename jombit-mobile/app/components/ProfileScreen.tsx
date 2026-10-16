"use client";

import { Check, ChevronRight, CircleHelp, Cloud, Database, LogOut, QrCode, RefreshCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { Currency } from "@/lib/models";
import { useAppState } from "@/lib/state";
import { Avatar, Brand, Modal, PageHeader, Toast } from "./ui";

export function ProfileScreen() {
  const { state, setState, reset, backendMode, syncStatus, userEmail, signOut } = useAppState();
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
    setToast(backendMode === "cloud" ? "Profile saved to JomBit" : "Profile saved on this device");
    window.setTimeout(() => setToast(""), 2500);
  };

  const uploadQr = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      setState((current) => ({ ...current, user: { ...current.user, duitNowQr: value }, members: { ...current.members, me: { ...current.members.me, hasDuitNowQr: true } } }));
      setToast(backendMode === "cloud" ? "DuitNow QR saved to JomBit" : "DuitNow QR saved locally");
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
      <PageHeader title="Profile" />
      <section className="profile-identity"><Avatar name={state.user.name} size="lg" /><div><h2>{state.user.name}</h2><p>{backendMode === "cloud" ? userEmail : "Local demo profile"}</p></div><span><Check size={14} /> {backendMode === "cloud" ? (syncStatus === "saved" ? "Synced" : syncStatus === "saving" ? "Saving" : "Cloud") : "Ready"}</span></section>

      {backendMode === "cloud" && <section className="profile-card"><div className="section-heading"><div><h2>JomBit Cloud</h2><p>Your app data is private to this signed-in account.</p></div><Cloud size={20} /></div><button className="secondary-button" onClick={() => void signOut()}><LogOut size={17} /> Sign out</button></section>}

      <section className="profile-card">
        <div className="section-heading"><h2>Personal details</h2></div>
        <div className="form-stack"><label><span>Display name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Default expense currency</span><select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}><option value="MYR">MYR — Malaysian Ringgit</option><option value="SGD">SGD — Singapore Dollar</option><option value="THB">THB — Thai Baht</option><option value="IDR">IDR — Indonesian Rupiah</option></select></label><button className="primary-button" onClick={save}>Save profile</button></div>
      </section>

      <section className="profile-card qr-profile-card">
        <div className="section-heading"><div><h2>Your DuitNow QR</h2><p>Friends see this when they settle a MYR balance with you.</p></div></div>
        <label className="profile-qr-upload"><input type="file" accept="image/*" onChange={(event) => uploadQr(event.target.files?.[0])} />{state.user.duitNowQr ? <img src={state.user.duitNowQr} alt="Your saved DuitNow QR" /> : <span><QrCode size={34} /></span>}<span><strong>{state.user.duitNowQr ? "Change DuitNow QR" : "Upload DuitNow QR"}</strong><small>{backendMode === "cloud" ? "Saved privately with your JomBit data" : "Stored only in your browser for this demo"}</small></span><ChevronRight size={18} /></label>
      </section>

      <section className="about-jombit">
        <div className="about-jombit-heading"><Brand compact /><span>Prototype</span></div>
        <h2>Built for fairer group spending</h2>
        <p>JomBit splits receipt items, keeps group balances clear and records simulated settlements.</p>
        <div className="about-jombit-facts"><span><Database size={17} /> {backendMode === "cloud" ? "Private cloud data" : "Local demo data"}</span><span><ShieldCheck size={17} /> No real funds moved</span><span><CircleHelp size={17} /> Financial features are simulated</span></div>
      </section>

      <section className="danger-zone"><div><RefreshCcw size={21} /><span><strong>Reset demo data</strong><small>Restore the original groups, balances and history</small></span></div><button onClick={() => setResetOpen(true)}>Reset data</button></section>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset all demo data?"><div className="form-stack"><p className="modal-copy">This clears every {backendMode === "cloud" ? "cloud-synced" : "local"} change and restores JomBit’s original sample groups, wallet balances, crypto holdings and card state.</p><button className="danger-button" onClick={resetDemo}>Yes, reset JomBit</button><button className="secondary-button" onClick={() => setResetOpen(false)}>Keep my demo data</button></div></Modal>
      <Toast message={toast} />
    </div>
  );
}

