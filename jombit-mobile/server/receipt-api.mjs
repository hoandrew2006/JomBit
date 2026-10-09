import { receiptSchema, receiptInstruction, validateReceipt, ScanError } from "./receipt-schema.mjs";

const MAX_IMAGE = 3 * 1024 * 1024;
const MAX_BODY = 4 * 1024 * 1024 + 2048;
export const DEFAULT_MODEL = "gemini-3.5-flash-lite";

function reply(res, status, value) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(value));
}

export function validateUpload(body) {
  if (body?.consent !== true) throw new ScanError(400, "Confirm the Google upload notice before scanning.");
  if (body.mimeType !== "image/jpeg" || typeof body.imageBase64 !== "string" || !body.imageBase64.length || body.imageBase64.length > Math.ceil(MAX_IMAGE / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.imageBase64)) {
    throw new ScanError(400, "Choose a supported receipt photo of up to 3 MB after resizing.");
  }
  const bytes = Buffer.from(body.imageBase64, "base64");
  if (bytes.length > MAX_IMAGE || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff || bytes.toString("base64") !== body.imageBase64) {
    throw new ScanError(400, "The receipt image is invalid. Choose the photo again.");
  }
  return body.imageBase64;
}

async function readBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] ?? "")) throw new ScanError(415, "Send a JSON receipt upload.");
  if (Number(req.headers["content-length"]) > MAX_BODY) throw new ScanError(413, "The photo is too large. Choose a smaller image.");
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_BODY) throw new ScanError(413, "The photo is too large. Choose a smaller image.");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ScanError(400, "The receipt upload could not be read."); }
}

export function createReceiptApi({ env = process.env, fetchImpl = fetch, now = Date.now, timeoutMs = 60000 } = {}) {
  let active = false;
  let day = "";
  let dailyCount = 0;
  let recent = [];
  return async function receiptApi(req, res, next = () => reply(res, 404, { error: "Not found." })) {
    const path = (req.url ?? "").split("?")[0];
    if (!path.startsWith("/api/receipt/")) return next();
    let release = false;
    let controller;
    const onDisconnect = () => { if (!res.writableEnded) controller?.abort(); };
    try {
      // This unauthed prototype is deliberately loopback-only, even behind a proxy.
      const host = req.headers.host ?? "";
      const address = req.socket.remoteAddress;
      if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) || !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address) || req.headers["x-forwarded-for"]) {
        throw new ScanError(403, "The receipt scanner is local-only. Open JomBit on this computer.");
      }
      const key = env.GEMINI_API_KEY?.trim();
      const model = env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
      const configured = Boolean(key && !key.startsWith("your_") && /^[a-zA-Z0-9._-]+$/.test(model));
      if (path === "/api/receipt/status" && req.method === "GET") return reply(res, 200, { configured, provider: "Gemini", localOnly: true });
      if (path !== "/api/receipt/scan") return reply(res, 404, { error: "Not found." });
      if (req.method !== "POST") return reply(res, 405, { error: "Use POST to scan a receipt." });
      if (!["http://" + host, "https://" + host].includes(req.headers.origin) || req.headers["x-jombit-scan"] !== "1") throw new ScanError(403, "Open the JomBit app on the same local website to scan.");
      if (!configured) throw new ScanError(503, "Gemini is not configured. Add GEMINI_API_KEY to jombit-mobile/.env.local and restart the app server. Never paste a key into the app.");
      const body = await readBody(req);
      const imageBase64 = validateUpload(body);
      const today = new Date(now()).toISOString().slice(0, 10);
      if (today !== day) { day = today; dailyCount = 0; }
      recent = recent.filter((time) => now() - time < 60000);
      const configuredLimit = Number(env.JOMBIT_DAILY_SCAN_LIMIT ?? 25);
      const dailyLimit = Number.isSafeInteger(configuredLimit) && configuredLimit >= 0 ? configuredLimit : 25;
      if (active || recent.length >= 5 || dailyCount >= dailyLimit) throw new ScanError(429, "JomBit’s local scan limit was reached or another scan is running. Wait and retry, or enter the receipt manually.");
      recent.push(now()); dailyCount++; active = true; release = true;
      controller = new AbortController();
      req.once("aborted", onDisconnect);
      res.once("close", onDisconnect);
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);
      let response;
      try {
        response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST", signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: receiptInstruction }] },
            contents: [{ role: "user", parts: [{ text: "Read this receipt. Return only the receipt fields in the JSON schema. Mark unclear values as null and describe any uncertainty." }, { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }] }],
            generationConfig: {
              responseFormat: { text: { mimeType: "APPLICATION_JSON", schema: receiptSchema } },
              maxOutputTokens: 8192,
            },
          }),
        });
        if (!response.ok) {
          if (response.status === 429) throw new ScanError(429, "Gemini’s quota or rate limit was reached. Retry later or enter the receipt manually. JomBit will not switch to a paid model.");
          if ([400, 401, 403, 404].includes(response.status)) throw new ScanError(502, "Gemini rejected the request. Check the server’s API key, selected model and Google AI Studio access. No sample data has been substituted.");
          throw new ScanError(502, "Gemini is temporarily unavailable. Please retry or enter the receipt manually.");
        }
        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (candidate?.finishReason !== "STOP") throw new ScanError(422, "Gemini could not finish reading this receipt. Retake the photo or enter the receipt manually.");
        const text = candidate.content?.parts?.filter((part) => !part.thought && typeof part.text === "string").map((part) => part.text).join("");
        if (!text || text.length > 100000) throw new ScanError(502, "Gemini did not return usable receipt details. Try another photo.");
        let parsed;
        try { parsed = JSON.parse(text); } catch { throw new ScanError(502, "Gemini returned an unreadable result. Try again or enter the receipt manually."); }
        return reply(res, 200, { receipt: validateReceipt(parsed) });
      } catch (error) {
        if (error instanceof ScanError) throw error;
        if (signal.aborted) throw new ScanError(504, "The scan was cancelled or timed out. Please try again.");
        throw new ScanError(502, "Could not reach Gemini. Check the server’s internet connection and try again.");
      }
    } catch (error) {
      return reply(res, error instanceof ScanError ? error.status : 500, { error: error instanceof ScanError ? error.message : "The receipt scan failed. Please try again." });
    } finally {
      if (release) active = false;
      req.off("aborted", onDisconnect);
      res.off("close", onDisconnect);
    }
  };
}
