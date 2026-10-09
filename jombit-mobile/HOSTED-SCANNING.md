# Receipt scanning on Vercel

The app uses `/api/receipt/status` and `/api/receipt/scan`, deployed from the `api/receipt` folder in the **jombit-mobile** Vercel root. Uploading only `dist` to a static host cannot run these functions.

## Owner setup

1. In your existing Vercel project, open **Settings > Environment Variables**. Add the values below to **Production**. Do not use a `VITE_` prefix, paste secrets into chat, or commit `.env.local`.
2. Use a password manager to generate a random 32–64 character alphanumeric scan access code. This is a separate secret, **not your Gemini key**. Share it privately only with trusted testers.
3. Commit/push the source changes and deploy, or redeploy after changing environment variables. Keep the Vercel root `jombit-mobile`, Vite preset, build `npm run build`, output `dist`.
4. Open `https://jom-bit-6667.vercel.app/?app=1`, choose **Scan**, take/choose a redacted receipt, enter the scan access code and approve the upload. Check all extracted amounts before saving. Test camera permission on the actual phone.

| Variable | Value |
| --- | --- |
| `GEMINI_API_KEY` | Your existing private Google AI Studio key |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` (existing project default; confirm access in AI Studio) |
| `JOMBIT_APP_ORIGIN` | `https://jom-bit-6667.vercel.app` (no trailing slash or query) |
| `JOMBIT_SCAN_ACCESS_CODE` | Your new random code, at least 32 characters |

Preview deployments are not automatically authorised to scan. They must have a deliberately configured exact HTTPS origin and their own secrets if you want to enable them. A scan status of `configured: true` only checks configuration, not provider credentials or available quota.

## Safeguards and limitations

- An exact configured origin, request marker and timing-safe access-code check gate hosted scans. The code is held only in the screen's memory, not saved to browser storage. This is temporary shared tester access, not individual account authentication. Rotate the code if shared accidentally; add proper accounts before a broad public rollout.
- No durable shared usage limit or hosted daily limit is configured. Vercel may run multiple independent function instances, so the in-memory busy/burst guard is not a dependable project-wide quota. Keep billing disabled or configure limits with Google, protect the access code, and rotate it if exposed. Add authenticated accounts and a durable rate limiter before broad public access. `JOMBIT_DAILY_SCAN_LIMIT` applies only to local Vite use and can be removed from Vercel.
- Inputs are limited to a 3 MB JPEG after browser resizing, with consent and server-side validation. The provider call times out after 45 seconds; the function has a 60-second limit. Cancellation cannot guarantee Google stops work already submitted.
- No request bodies, photos, access codes or provider error details are logged by our handlers. The Gemini key stays on the server. Photos are not saved by JomBit's backend; browser photo retention is opt-in.
- Google's unpaid-service terms allow product improvement and human review. Use only redacted/sample receipts without personal, sensitive or confidential information. The UI keeps upload consent and links to these terms.
- The refreshed flow has no sample receipt button and no silent demo fallback. Manual entry remains available if scanning fails. Finance/staking features still remain simulations; group data is browser-local.
- Live crypto prices on Vercel are a separate upcoming task; this change enables receipt scanning only.

## Validation and troubleshooting

Run `npm test` and `npm run build`. Hosted API tests simulate Vercel-parsed bodies, blocked access, validation and provider errors. They use test secrets and a mocked provider; they do not prove your live credentials work. Actual Vercel deployment, phone camera and Google connectivity must be tested after owner setup.

If scanning is unavailable, verify all environment variables and redeploy. A wrong access code returns 401 and missing configuration returns 503. Do not expose the local Vite server to the internet.

References: [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [Gemini generation API](https://ai.google.dev/api/generate-content), [Google data terms](https://ai.google.dev/gemini-api/terms).
