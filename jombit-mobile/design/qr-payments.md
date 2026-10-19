# Pay with DuitNow QR

The Scan button in the bottom bar opens a choice:

1. **Scan a receipt**: the existing receipt split flow.
2. **Scan DuitNow QR to pay**: a general payment to any person or merchant with a DuitNow QR.

QR payments are deliberately separate from **Home → "Ready to settle up?"**. Settle-ups repay group shares from the bill-splitting flow. QR payments are ordinary spending and never touch groups.

## Decisions

- **Preview only.** Even a real DuitNow QR is never paid. Real codes show a warning naming the payee and saying they will not receive money. QR images and camera frames are decoded on the device and never uploaded.
- **Reading QR codes.** DuitNow QR follows the EMVCo merchant-presented format: tag + length + value, with a CRC-16 checksum.
  - `lib/duitnow-qr.ts` accepts only Malaysian (`MY`), ringgit (`458`) codes with a valid checksum.
  - It reads the payee name, city, optional fixed amount and reference.
  - Sample codes use the account ID `MY.JOMBIT.SAMPLE` so they are always labelled as samples.
- **Decoder.** `jsqr` 1.4.0 (Apache-2.0, no dependencies) decodes camera frames and images in every browser, including iPhone Safari, where the built-in `BarcodeDetector` isn't available.
- **Cash** comes from the MYR wallet.
- **Crypto:**
  - Only the available balance can pay; staked coins never do.
  - The live reference price shown at review is the price used. If the price isn't fresh, crypto is blocked rather than using a stale or sample price.
  - The coin amount is rounded up so the recipient always gets the full MYR amount.
  - The coin's recorded cost is reduced in proportion.
- **JomBit's spread (founders' decision):** a percentage, always lower than both the maker and the taker fee a user pays on Luno's Exchange (advanced trading) in Malaysia.
  - The spread is 0.30%, set against Luno's retail-tier fees of 0.35% maker and 0.60% taker.
  - Those Luno figures could not be re-checked on Luno's own site from the development environment (its sites didn't resolve), and third-party sites disagree. Confirm them on Luno's Malaysian fee page.
  - The spread is rounded down to the sen and has no minimum, so it never exceeds 0.30% even on small amounts.
  - `tests/qr-payment.test.mjs` fails if the spread is not below both Luno fees.
  - Demo crypto payments use the same spread.
- **Live prices** are expected to be available. Crypto payments use only a fresh live price; there is no sample-price fallback (founders' decision).
- **Insights:** cash payments are `payment` records and crypto payments are `crypto-payment` records, so the existing Spend rules apply. That means one entry in the chosen category (suggested from the payee name), a "Paid with [coin]" badge, and the fee under Fees.

## Not done

- Not verified against real DuitNow QR codes from banks or merchants; only codes built to the EMVCo format.
- Not tested on a real phone camera.
- No payment history screen of its own; payments appear in Wallet activity and Insights.
