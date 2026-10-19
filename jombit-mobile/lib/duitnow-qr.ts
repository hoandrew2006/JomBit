// Reads Malaysian DuitNow QR codes. DuitNow QR follows the EMVCo merchant-presented QR format:
// two-digit tag + two-digit length + value, ending with a CRC-16 checksum (tag 63).
// Reading a QR never pays anyone: JomBit only previews the payment (see lib/qr-payment.ts).

export interface DuitNowQr {
  payeeName: string;
  payeeCity: string;
  // Fixed amount from a dynamic QR (e.g. a shop's bill); null when the payer enters the amount.
  amountCents: number | null;
  reference: string | null;
  dynamic: boolean;
  // A JomBit sample code for demos, not a real payee.
  sample: boolean;
}

export const SAMPLE_ACCOUNT_ID = "MY.JOMBIT.SAMPLE";

function readFields(payload: string): Map<string, string> {
  const fields = new Map<string, string>();
  let index = 0;
  while (index < payload.length) {
    const tag = payload.slice(index, index + 2);
    const length = Number(payload.slice(index + 2, index + 4));
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(payload.slice(index + 2, index + 4)) || index + 4 + length > payload.length) throw new Error("This QR code isn't a valid DuitNow QR.");
    fields.set(tag, payload.slice(index + 4, index + 4 + length));
    index += 4 + length;
  }
  return fields;
}

/** CRC-16/CCITT-FALSE, as used by EMVCo QR codes. */
export function qrChecksum(text: string) {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const clean = (value: string | undefined) => (value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 60);

export function parseDuitNowQr(raw: string): DuitNowQr {
  const payload = raw.trim();
  if (payload.length < 30 || payload.length > 512) throw new Error("This QR code isn't a valid DuitNow QR.");
  const fields = readFields(payload);
  if (fields.get("00") !== "01" || !payload.endsWith(fields.get("63") ?? "") || payload.slice(-8, -4) !== "6304") throw new Error("This QR code isn't a valid DuitNow QR.");
  if (qrChecksum(payload.slice(0, -4)) !== fields.get("63")?.toUpperCase()) throw new Error("This QR code couldn't be read correctly. Scan it again.");
  if (fields.get("58") !== "MY" || fields.get("53") !== "458") throw new Error("Only Malaysian DuitNow QR codes in ringgit are supported.");
  const payeeName = clean(fields.get("59"));
  if (!payeeName) throw new Error("This QR code doesn't include a recipient name.");
  let amountCents: number | null = null;
  const amount = fields.get("54");
  if (amount !== undefined) {
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(amount)) throw new Error("This QR code has an invalid amount.");
    amountCents = Math.round(Number(amount) * 100);
    if (amountCents <= 0) amountCents = null;
  }
  const accounts = [...fields.entries()].filter(([tag]) => Number(tag) >= 26 && Number(tag) <= 51).map(([, value]) => value);
  const extra = fields.get("62");
  let reference: string | null = null;
  if (extra) {
    try {
      const sub = readFields(extra);
      reference = clean(sub.get("01") ?? sub.get("05")) || null;
    } catch { reference = null; }
  }
  return {
    payeeName,
    payeeCity: clean(fields.get("60")),
    amountCents,
    reference,
    dynamic: fields.get("01") === "12",
    sample: accounts.some((value) => value.includes(SAMPLE_ACCOUNT_ID)),
  };
}

const field = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, "0")}${value}`;

/** Builds a JomBit sample DuitNow-format QR (for the demo and tests). It is not linked to any real account. */
export function buildSampleDuitNowQr({ name, city = "Kuala Lumpur", amountCents, reference }: { name: string; city?: string; amountCents?: number; reference?: string }) {
  const body = [
    field("00", "01"),
    field("01", amountCents ? "12" : "11"),
    field("26", field("00", SAMPLE_ACCOUNT_ID) + field("01", "000000000000")),
    field("52", "5814"),
    field("53", "458"),
    ...(amountCents ? [field("54", (amountCents / 100).toFixed(2))] : []),
    field("58", "MY"),
    field("59", name.slice(0, 25)),
    field("60", city.slice(0, 15)),
    ...(reference ? [field("62", field("05", reference.slice(0, 25)))] : []),
  ].join("") + "6304";
  return body + qrChecksum(body);
}
