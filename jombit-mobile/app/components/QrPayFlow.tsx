"use client";

import { ArrowLeft, Camera, CheckCircle2, ImagePlus, QrCode, ShieldCheck, Wallet, X } from "lucide-react";
import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/calculations";
import { CRYPTO_ASSETS, CRYPTO_NAMES } from "@/lib/crypto-ledger";
import { useCryptoMarket } from "@/lib/crypto-market";
import { buildSampleDuitNowQr, parseDuitNowQr, type DuitNowQr } from "@/lib/duitnow-qr";
import { CATEGORY_LABELS, SPEND_CATEGORIES, suggestCategory } from "@/lib/insights";
import type { CryptoAsset, SpendCategory } from "@/lib/models";
import { CRYPTO_PAYMENT_SPREAD_BASIS_POINTS, quoteQrPayment, type QrPaymentCommand, type QrPaymentMethod } from "@/lib/qr-payment";
import { useAppState } from "@/lib/state";
import { Brand, Segmented } from "./ui";
import "../../src/receipt.css";
import "../../src/qr-pay.css";

const SAMPLES = [
  { label: "Sample shop QR", hint: "You enter the amount", payload: () => buildSampleDuitNowQr({ name: "Kopitiam Sample", city: "Petaling Jaya" }) },
  { label: "Sample bill QR", hint: "Fixed amount RM18.50", payload: () => buildSampleDuitNowQr({ name: "Nasi Lemak Sample", city: "Kuala Lumpur", amountCents: 1850, reference: "TABLE-12" }) },
  { label: "Sample friend QR", hint: "Pay a person", payload: () => buildSampleDuitNowQr({ name: "Maya (sample)", city: "Kuala Lumpur" }) },
];
const coin = (units: number) => (units / 1e8).toLocaleString("en-MY", { maximumFractionDigits: 8 });
const spreadLabel = `${(CRYPTO_PAYMENT_SPREAD_BASIS_POINTS / 100).toFixed(2)}%`;

/** Reads a QR code from a video frame or image, scaled down so decoding stays quick on phones. */
function decodeQr(source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, 800 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

function QrScanner({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const found = useRef(false);
  // Keep the latest callback without restarting the camera on every render.
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const scan = () => {
      const element = video.current;
      if (cancelled || found.current) return;
      if (element?.videoWidth) {
        const text = decodeQr(element, element.videoWidth, element.videoHeight);
        if (text) { found.current = true; onCodeRef.current(text); return; }
      }
      timer = window.setTimeout(scan, 250);
    };
    const open = async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("The camera needs a secure website or localhost. Choose a QR image instead.");
        const next = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
        if (cancelled) { next.getTracks().forEach((track) => track.stop()); return; }
        stream = next;
        if (video.current) { video.current.srcObject = next; await video.current.play(); }
        scan();
      } catch (issue) {
        if (cancelled) return;
        const name = issue instanceof Error ? issue.name : "";
        setError(name === "NotAllowedError" ? "Camera permission was denied. Allow the camera, or choose a QR image instead." : name === "NotFoundError" ? "No camera was found. Choose a QR image instead." : issue instanceof Error ? issue.message : "The camera is unavailable. Choose a QR image instead.");
      }
    };
    void open();
    return () => { cancelled = true; window.clearTimeout(timer); stream?.getTracks().forEach((track) => track.stop()); previousFocus?.focus(); };
  }, []);

  return <div className="receipt-camera-overlay"><div className="receipt-camera" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="qr-camera-title" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
    <div className="receipt-camera-heading"><div><p className="eyebrow">DUITNOW QR</p><h2 id="qr-camera-title">Point your camera at the QR code.</h2></div><button className="icon-button" onClick={onClose} aria-label="Close camera"><X /></button></div>
    <div className="receipt-camera-view qr-camera-view"><video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} aria-label="Live QR camera preview" /><div className="qr-camera-guide" aria-hidden="true" />{!ready && !error && <p role="status">Waiting for camera permission…</p>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="fine-print">The code is read on this device. Nothing is sent anywhere.</p>
  </div></div>;
}

export function QrPayFlow({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { state, payQr } = useAppState();
  const market = useCryptoMarket();
  const [qr, setQr] = useState<DuitNowQr>();
  const [scanning, setScanning] = useState(false);
  const [reading, setReading] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<QrPaymentMethod>("cash");
  const ownedAssets = CRYPTO_ASSETS.filter((asset) => state.crypto[asset]?.available > 0);
  const [asset, setAsset] = useState<CryptoAsset>(ownedAssets[0] ?? "ETH");
  const [chosenCategory, setChosenCategory] = useState<SpendCategory>();
  const [error, setError] = useState("");
  const [paid, setPaid] = useState<{ amountCents: number; feeCents: number; cryptoUnits: number; method: QrPaymentMethod; asset: CryptoAsset }>();
  const submitted = useRef(false);

  const accept = (text: string) => {
    setScanning(false);
    try {
      const next = parseDuitNowQr(text);
      setQr(next); setAmount(next.amountCents ? (next.amountCents / 100).toFixed(2) : ""); setChosenCategory(undefined); setError("");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "This QR code couldn't be read."); }
  };
  const readImage = async (file?: File) => {
    if (!file) return;
    setReading(true); setError("");
    try {
      const bitmap = await createImageBitmap(file);
      const text = decodeQr(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      if (!text) throw new Error("No QR code was found in that image. Try a clearer, closer picture.");
      accept(text);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "That image couldn't be opened."); }
    finally { setReading(false); }
  };

  const category = chosenCategory ?? (qr ? suggestCategory(qr.payeeName) : "others");
  const command: QrPaymentCommand | undefined = qr ? { id: "", qr, amount, method, category, asset: method === "crypto" ? asset : undefined, quote: method === "crypto" ? market.quotes?.[asset] : undefined } : undefined;
  let preview: ReturnType<typeof quoteQrPayment> | undefined;
  let previewError = "";
  if (command && (qr?.amountCents || amount.trim())) {
    try { preview = quoteQrPayment(state, command, market.now); } catch (issue) { previewError = issue instanceof Error ? issue.message : "Check this payment."; }
  }

  const confirm = () => {
    if (!command || !preview || submitted.current) return;
    try {
      submitted.current = true;
      payQr({ ...command, id: `qr-pay-${crypto.randomUUID()}` });
      setPaid({ ...preview, method, asset });
    } catch (issue) { submitted.current = false; setError(issue instanceof Error ? issue.message : "This payment could not be recorded."); }
  };

  return <div className="expense-flow qr-pay">
    <header className="expense-flow-header">
      <button className="back-button" onClick={() => { if (qr && !paid) { setQr(undefined); setError(""); } else onClose(); }}><ArrowLeft size={18} /> Back</button>
      <Brand compact />
      <span className="receipt-header-label">Pay with QR</span>
    </header>

    {!qr && !paid && <section className="flow-stage qr-pay-start">
      <div className="receipt-intro"><span className="receipt-intro-icon"><QrCode size={28} /></span><p className="eyebrow">DUITNOW QR</p><h1>Scan to pay.</h1><p>Pay a shop or a friend from your MYR wallet or with crypto.</p></div>
      <div className="receipt-capture-actions"><button className="primary-button" disabled={reading} onClick={() => { setError(""); setScanning(true); }}><Camera size={19} /> Scan a QR code</button><label className="receipt-file-button secondary-button"><ImagePlus size={19} /> Choose a QR image<input disabled={reading} type="file" accept="image/*" aria-label="Choose a DuitNow QR image" onChange={(event) => { void readImage(event.target.files?.[0]); event.target.value = ""; }} /></label></div>
      {reading && <p role="status">Reading the QR code…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="qr-samples"><p>No QR code handy? Try a sample:</p>{SAMPLES.map((sample) => <button key={sample.label} type="button" className="secondary-button" onClick={() => accept(sample.payload())}><QrCode size={16} /><span><strong>{sample.label}</strong><small>{sample.hint}</small></span></button>)}</div>
      <p className="product-disclosure"><ShieldCheck size={15} /> Preview only. JomBit doesn't send money to anyone, even when you scan a real DuitNow QR.</p>
    </section>}

    {qr && !paid && <section className="flow-stage qr-pay-review">
      <div className="qr-payee"><span className="qr-payee-icon"><QrCode size={22} /></span><span><small>Paying</small><strong>{qr.payeeName}</strong><small>{[qr.payeeCity, qr.reference && `Ref ${qr.reference}`].filter(Boolean).join(" · ")}</small></span><b className={qr.sample ? "qr-badge" : "qr-badge is-real"}>{qr.sample ? "Sample QR" : "Real QR"}</b></div>
      {!qr.sample && <p className="qr-real-warning" role="note"><ShieldCheck size={16} /> This is a real DuitNow QR, but JomBit is a preview: {qr.payeeName} will <strong>not</strong> receive any money. Don't treat this as paid.</p>}

      <label className="qr-field"><span>Amount {qr.amountCents ? "(set by the QR)" : "they receive"}</span><div className="money-input"><b>MYR</b><input type="text" inputMode="decimal" autoComplete="off" value={amount} readOnly={Boolean(qr.amountCents)} onChange={(event) => { setAmount(event.target.value); setError(""); }} placeholder="0.00" aria-label="Amount in MYR" /></div></label>

      <div className="qr-field"><span>Pay with</span><Segmented value={method} onChange={(value) => { setMethod(value); setError(""); }} options={[{ value: "cash", label: "Cash (MYR wallet)" }, { value: "crypto", label: "Crypto" }]} /></div>
      {method === "cash" ? <p className="qr-balance"><Wallet size={15} /> {formatMoney(state.fiatBalances.MYR)} in your MYR wallet</p> : <>
        {ownedAssets.length ? <label className="qr-field"><span>Crypto</span><select value={asset} onChange={(event) => { setAsset(event.target.value as CryptoAsset); setError(""); }}>{ownedAssets.map((code) => <option key={code} value={code}>{CRYPTO_NAMES[code]} ({code}) · {state.crypto[code].available.toLocaleString("en-MY", { maximumFractionDigits: 8 })} available</option>)}</select></label> : <p className="form-error">You don't have any available crypto. Receive or unstake crypto first.</p>}
        <p className="qr-balance">{market.quotes?.[asset] && market.fresh ? `1 ${asset} ≈ ${formatMoney(Math.round(market.quotes[asset].priceMyr * 100))} · live reference price` : market.loading ? "Loading live prices…" : "A live price is needed to pay with crypto."}</p>
      </>}

      <label className="qr-field"><span>Category{chosenCategory ? "" : " · suggested"}</span><select value={category} onChange={(event) => setChosenCategory(event.target.value as SpendCategory)}>{SPEND_CATEGORIES.map((value) => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}</select></label>

      {preview && <dl className="qr-summary">
        <div><dt>{qr.payeeName} receives</dt><dd>{formatMoney(preview.amountCents)}</dd></div>
        {method === "crypto" ? <>
          <div><dt>JomBit spread ({spreadLabel})</dt><dd>{formatMoney(preview.feeCents)}</dd></div>
          <div className="qr-summary-total"><dt>You pay</dt><dd>{coin(preview.cryptoUnits)} {asset}</dd></div>
        </> : <div className="qr-summary-total"><dt>MYR wallet after</dt><dd>{formatMoney(state.fiatBalances.MYR - preview.amountCents)}</dd></div>}
      </dl>}
      {(previewError || error) && <p className="form-error" role="alert">{previewError || error}</p>}
      <button className="primary-button" disabled={!preview} onClick={confirm}>Confirm preview payment</button>
      <p className="product-disclosure"><ShieldCheck size={15} /> {method === "crypto" ? `Your ${asset} is converted to MYR at the reference price shown, plus JomBit's ${spreadLabel} spread. ` : ""}Preview only: no money or crypto leaves JomBit and nothing reaches the recipient.</p>
    </section>}

    {paid && qr && <section className="flow-stage success-stage">
      <div className="success-check"><CheckCircle2 size={44} /></div>
      <p className="eyebrow">PREVIEW PAYMENT RECORDED</p>
      <h1>{formatMoney(paid.amountCents)} to {qr.payeeName}</h1>
      <p>{paid.method === "crypto" ? `Paid with ${coin(paid.cryptoUnits)} ${paid.asset}, including JomBit's ${formatMoney(paid.feeCents)} spread.` : "Paid from your MYR wallet."} It now appears in Wallet and Insights.</p>
      <p className="product-disclosure"><ShieldCheck size={15} /> No real money was sent. {qr.sample ? "This was a sample QR." : `${qr.payeeName} has not been paid.`}</p>
      <button className="primary-button" onClick={onDone}>Done</button>
    </section>}

    {scanning && <QrScanner onCode={accept} onClose={() => setScanning(false)} />}
  </div>;
}
