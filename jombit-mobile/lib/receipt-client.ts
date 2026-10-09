import type { ExpenseItem } from "./models";

export interface PreparedReceipt { preview: string; imageBase64: string; mimeType: "image/jpeg" }
export interface ScannedReceipt {
  merchant: string; date: string; currency: string; items: ExpenseItem[];
  taxCents: number; serviceCents: number; totalCents: number | null; warnings: string[];
}

export async function prepareReceiptPhoto(file: File): Promise<PreparedReceipt> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") throw new Error("Choose a JPG, PNG, WebP or a photo your browser can display.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose a photo smaller than 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); } catch { throw new Error("This photo format cannot be opened here. Try JPG or PNG, or take a new photo."); }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 64_000_000) throw new Error("The photo dimensions are too large. Use a smaller photo.");
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo processing is unavailable in this browser.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Re-encoding also strips camera EXIF metadata; receipt content remains visible.
    let preview = canvas.toDataURL("image/jpeg", .88);
    if (preview.length > 4 * 1024 * 1024) preview = canvas.toDataURL("image/jpeg", .7);
    const imageBase64 = preview.split(",")[1];
    if (!imageBase64 || imageBase64.length > 4 * 1024 * 1024) throw new Error("The photo is still too large. Crop to the receipt and choose it again.");
    return { preview, imageBase64, mimeType: "image/jpeg" };
  } finally { URL.revokeObjectURL(url); }
}

export async function scanReceipt(photo: PreparedReceipt, signal: AbortSignal): Promise<ScannedReceipt> {
  if (window.location.protocol === "file:") throw new Error("Gemini scanning needs the local JomBit server. Open http://127.0.0.1:5173/?app=1 after starting it. You can still enter a receipt manually here.");
  let response: Response;
  try {
    response = await fetch("/api/receipt/scan", {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", "X-JomBit-Scan": "1" },
      body: JSON.stringify({ mimeType: photo.mimeType, imageBase64: photo.imageBase64, consent: true }),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("The JomBit scanner could not be reached. Start the local app server, then retry.");
  }
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("The Gemini backend is not available on this website. Run the independent JomBit app locally.");
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Receipt scanning failed. Please retry.");
  if (!body.receipt || !Array.isArray(body.receipt.items) || !Array.isArray(body.receipt.warnings)) throw new Error("The scan returned incomplete details. Please retry.");
  return body.receipt;
}
