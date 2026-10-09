# JomBit

## Current website and app

The current JomBit marketing website and app live in **[jombit-mobile](jombit-mobile/README.md)**. The older proof of concept below is retained for reference.

For Vercel, select `jombit-mobile` as the **Root Directory**, **Vite** as the framework, `npm run build` as the build command, and `dist` as the output directory. The default `/` route is the company website; `/?view=demo` opens the phone-framed app demo.

The current version includes receipt splitting, a MYR-funded fiat wallet and staking-only crypto demonstrations. Luno integration is planned, not connected. Gemini scanning and live market prices require the local backend; they are not included as hosted APIs in a static Vercel deployment. Never commit `.env.local` or API keys.

## Original proof of concept

JomBit is a polished proof-of-concept for group expenses and everyday fintech. Its hero flow turns a restaurant receipt into an editable, item-level split, keeps a running group ledger, simplifies the group’s debts, and records a demo settlement. The same local demo also shows a multi-currency fiat wallet, internal cross-border transfers, crypto trading and staking, and future prepaid cards.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local address printed by the development server. Use `npm test` for the calculation tests and `npm run build` for a production build.

## What genuinely works locally

- First-run profile setup and browser persistence under the `jombit-demo-state-v1` storage key
- Group creation, mock members, expense editing and deletion
- Receipt item assignment to one or many members
- Even item splitting with deterministic cent-level rounding
- Proportional SST/tax and service-charge allocation
- Group net balances derived from expenses and settlements
- Debt simplification by matching the largest debtors and creditors
- Settlement records that immediately update the ledger
- Fiat top-ups, static-rate currency exchange and JomBit-to-JomBit transfers
- Crypto portfolio calculations plus buy, sell, stake and unstake actions
- Virtual-card state, payment-source preference, freeze control and physical-card fees
- Transaction history and a full Reset Demo action

The seeded groups, expenses, balances and history use the same data structures as new records. Refreshing the browser preserves the current demo state.

## Simulated services

JomBit does not connect to any bank, payment network, OCR provider, foreign-exchange feed, crypto exchange, blockchain, custodian or card issuer.

- **Receipt scanning:** choosing an image or **Try the demo receipt** runs a short local animation and returns an editable Malaysian restaurant sample. It is demo OCR, not arbitrary image recognition.
- **DuitNow settlement:** **Generate Payment QR** renders a local QR containing a safe `jombit-demo://pay?...` payload. It is not a valid PayNet/DuitNow QR. **Mark as Paid — Demo** records only a local settlement.
- **Fiat and FX:** top-ups, transfers and exchanges update the local demo ledger. Rates are a static table clearly labelled as demo rates.
- **Crypto:** prices and APYs are fictional static demo values. Orders only move amounts between the local fiat and crypto records.
- **JomBit Card:** card creation, controls and orders are presentation state only. The displayed card deliberately has no usable payment number.

## Resetting the presentation

Open **Profile** and choose **Reset Demo**. This restores the original sample groups, expenses, wallet balances, crypto holdings and card state, and returns to onboarding.

## Important notice

JomBit is not a real wallet, bank, cryptocurrency exchange or payment application. No real money, crypto, settlement or card transaction occurs anywhere in this project.
