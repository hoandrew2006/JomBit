import { Camera, ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ReceiptCamera({ onPhoto, onClose }: { onPhoto: (file: File) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    let stream: MediaStream | undefined;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const open = async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Camera preview needs a secure website or localhost. Use the phone-camera or image-picker option below.");
        const next = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
        if (cancelled) { next.getTracks().forEach((track) => track.stop()); return; }
        stream = next;
        if (video.current) { video.current.srcObject = next; await video.current.play(); }
      } catch (issue) {
        if (cancelled) return;
        const name = issue instanceof Error ? issue.name : "";
        setError(name === "NotAllowedError" ? "Camera permission was denied. Allow the camera in your browser, or choose an existing photo below." : name === "NotFoundError" ? "No camera was found. Choose a receipt photo below." : issue instanceof Error ? issue.message : "The camera is unavailable. Choose a photo below.");
      }
    };
    void open();
    return () => { mounted.current = false; cancelled = true; stream?.getTracks().forEach((track) => track.stop()); previousFocus?.focus(); };
  }, []);

  const capture = () => {
    const element = video.current;
    if (!element?.videoWidth || capturing) return;
    setCapturing(true);
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth; canvas.height = element.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) { setCapturing(false); setError("Photo capture is unavailable. Choose an existing photo."); return; }
    context.drawImage(element, 0, 0);
    canvas.toBlob((blob) => {
      if (!mounted.current) return;
      if (blob) onPhoto(new File([blob], "jombit-receipt.jpg", { type: "image/jpeg" }));
      else { setCapturing(false); setError("Could not capture this frame. Please try again."); }
    }, "image/jpeg", .92);
  };

  return <div className="receipt-camera-overlay"><div className="receipt-camera" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="receipt-camera-title" onKeyDown={(event) => {
    if (event.key === "Escape") onClose();
    if (event.key === "Tab") {
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? []);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <div className="receipt-camera-heading"><div><p className="eyebrow">JOMBIT RECEIPT CAMERA</p><h2 id="receipt-camera-title">Keep the whole bill in view.</h2></div><button className="icon-button" onClick={onClose} aria-label="Close camera"><X /></button></div>
    <div className="receipt-camera-view"><video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} aria-label="Live receipt camera preview" /><div className="receipt-camera-guide" aria-hidden="true" />{!ready && !error && <p role="status">Waiting for camera permission…</p>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="fine-print">Nothing is uploaded until you confirm and choose “Scan with Gemini”. Avoid shadows, glare and personal details.</p>
    <button className="primary-button" disabled={!ready || capturing} onClick={capture}><Camera size={19} />{capturing ? "Taking photo…" : "Take photo"}</button>
    <label className="receipt-file-button secondary-button"><ImagePlus size={18} /> Use phone camera / choose photo<input aria-label="Take or choose a receipt photo" type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) onPhoto(file); }} /></label>
  </div></div>;
}
