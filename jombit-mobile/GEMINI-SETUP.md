# Turn on JomBit receipt scanning

The app now supports a real camera preview, taking a photo, choosing an existing photo, sending an approved photo to Gemini, and reviewing/editing the extracted receipt before assigning items. The company website is unchanged. Payments and wallet services are still simulated.

For the deployed Vercel app, follow [HOSTED-SCANNING.md](HOSTED-SCANNING.md). The instructions below describe the loopback-only local server. The app no longer has a demo receipt button; choose a photo or enter items manually.

## One-time local setup

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey). Choose a project with the free-tier access you intend to use; JomBit does not enable billing or create a Google project for you. Keep the key private.
2. Open `.env.local` in this `jombit-mobile` folder. A blank template has been created in the working project. If you downloaded the source archive, copy `.env.example` to `.env.local` first.
3. Paste the key after `GEMINI_API_KEY=` and save. Do not paste it into chat, the browser, a `VITE_` variable, or a public repository. Leave the model setting as `gemini-3.5-flash-lite` unless you deliberately choose another supported image-and-structured-output model.
4. In a terminal in this folder, run `npm.cmd install` if dependencies are missing, then `npm.cmd run dev`. If the server is already running, stop it with Ctrl+C and run it again after saving your key.
5. Open [JomBit app](http://127.0.0.1:5173/?app=1), go to **Scan**, and allow the camera when asked. You can also choose an existing receipt photo. After reviewing the privacy notice, tick the confirmation and press **Scan receipt**.

If the default port is already occupied, you can run `npm.cmd run dev -- --port 5174` and open `http://127.0.0.1:5174/?app=1` instead. Use the port printed by the terminal. Browser-local demo data is separate for each port.

The scanner status reports whether a key is configured, not whether Google has accepted it or whether quota is available. A real scan is needed to verify those. Never publish or send `.env.local` to anyone.

## Review before splitting

All detected fields remain editable. Unknown dates/currencies remain blank; unknown prices and charges are flagged. JomBit preserves exact line totals when quantities cannot divide into whole cents. It does not silently invent items to balance a receipt.

The receipt currency must match the selected group; this flow does not perform FX conversion. Review discounts, inclusive tax, tips and rounding manually. Correct the items/charges and printed grand total until they agree, then check the review confirmation. Assign items and save as usual.

## Free tier and receipt privacy

The selected model currently has a free tier, subject to your Google project’s eligibility and quota. [Check Google’s pricing](https://ai.google.dev/gemini-api/docs/pricing) and your project limits in AI Studio. JomBit cannot guarantee free usage if you enable billing or change models. There is no automatic paid-model fallback or automatic retry.

Under Google’s unpaid-service terms applicable in Malaysia, submitted images and responses can be used for product improvement and reviewed by humans; Google says not to submit personal, sensitive or confidential information. Use sample receipts or redact all such information before scanning. [Read Google’s terms](https://ai.google.dev/gemini-api/terms). JomBit’s checkbox records your confirmation for the request, not an automated guarantee that the image is safe to share.

Photos are resized/re-encoded locally, removing EXIF metadata, before the approved image is sent through the local backend to Google. The JomBit backend processes images in memory and does not save photos or log request/response content. Saving the photo in the browser’s local ledger is a separate opt-in; extracted expense details are saved locally when you save the expense. Google’s data retention is governed separately by its own terms.

## Local use versus a real phone or public hosting

The Vite scanner is intentionally local-only: its API accepts loopback requests from the same local website, with an origin check and request limits. It runs in both `npm.cmd run dev` and, after a build, `npm.cmd run preview` (port 4173). Separate Vercel handlers enable hosted scanning with an exact-origin check and private tester access code; see the hosted guide.

On this computer, **Take a photo** uses its available camera/webcam. For a physical phone, use the configured HTTPS Vercel app. Do not expose Vite to the network or tunnel its local endpoint. Hosted shared-code access is for trusted testers; individual accounts and per-user quotas are still needed before a broad public rollout.

Opening `JomBit-app-demo.html` by double-clicking it supports manual entry. It cannot run Gemini by itself: use the online app or local server. Browser camera support inside a local-file phone frame varies. Nothing is uploaded merely by opening the camera or choosing a photo.

## Limits and troubleshooting

- 10 MB source photos, resized to a maximum edge of 2400 pixels and a 3 MB JPEG upload. JPG/PNG/WebP and other browser-decodable images work; unsupported formats get a conversion hint.
- One scan at a time, five attempts per minute, and 25 attempts per UTC day by default. `JOMBIT_DAILY_SCAN_LIMIT` can lower the last limit (0 disables scanning). These are in-memory local safeguards, reset on restart, not Google billing controls.
- A 60-second provider timeout and explicit cancellation. Cancelling stops local waiting and attempts to abort the provider request, but cannot guarantee that Google stops processing or charging for an already-submitted request.
- No available camera/permission: choose a photo instead, or allow camera access in the browser.
- Missing key: edit `.env.local` and restart. Never enter the key on the app screen.
- Quota reached: wait, inspect your Google project limits, or enter the receipt manually. JomBit will not invent a result.
- Unreadable/blocked receipt: retake the photo or enter it manually.

## Verification

`npm.cmd run build` checks TypeScript and bundles the app. `npm.cmd test` covers financial calculations, the backend using a mocked Gemini response, key isolation, consent/origin checks, input validation, provider errors, quotas, timeouts and review validation. These tests do not contact Google or use an API key.

A live synthetic JPEG receipt scan through the local app API was verified on 2026-10-02 with `gemini-3.5-flash-lite`. Gemini returned Tea (2 x MYR 3.50), Toast (1 x MYR 5.00), MYR 0.72 tax, MYR 1.20 service and the correct MYR 13.92 total, with no warnings. No personal receipt was used. The provider receives a compact structured-output schema; the server independently enforces all numeric and array limits. A saved key or this historical test does not guarantee future quota. Real-device camera capture and permissions still need testing on your device.

Implementation references: [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding), [structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output), [API key security](https://ai.google.dev/gemini-api/docs/api-key).
