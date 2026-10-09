# JomBit Website

An independent company and product website for JomBit, built with React, TypeScript and Vite. The main page explains receipt splitting, group expense tracking, simplified settlements, and the wider fiat wallet, crypto wallet and prepaid-card vision. It includes the company mission, FAQs, and iPhone/Android QR cards that open the deployed web app without installation.

The layout takes inspiration from [Bybit’s product website](https://www.bybit.com/en-GB/): bold introductory copy, product discovery, and QR-led downloads. JomBit adds its own four-step receipt story and dedicated crypto concept chapter. The identity and content are JomBit’s own, developed from the supplied product specification. No founders, customer counts, regulatory approvals or launch dates are invented.

## Website refresh

The opening now leads with “Split the bill. Keep the good vibes.” and a sample walkthrough instead of unavailable store downloads. The four-step walkthrough shares the app's calculation functions: a MYR 88.16 dinner is assigned and split exactly; adding a MYR 24.00 taxi reduces six separate repayments to three suggestions. Play, pause, replay and keyboard step controls work without any upload or external service. Playback pauses when hidden or scrolled out of view; reduced-motion mode uses manual steps.

Crypto has a dedicated navigation link and prominent staking balances, planned Luno integration and stake/unstake concept previews. Fiat, crypto and card availability remain explicitly simulated/planned. Camera/Gemini wording reflects the configured local app; the website itself never uploads receipts. Text, QR captions, mobile navigation, feature tabs and FAQs have improved readability and restrained transitions. No live prices, returns, partnerships or store listings are invented.

## Open without installing anything

Open `dist/JomBit.html` after building, or use the ready-to-open copy at `../outputs/jombit-independent/JomBit.html`. All interface code, styles, icons and QR codes are bundled into the file. The website needs no network connection and makes no external service requests.

The phone-framed app is available separately at `../outputs/jombit-independent/JomBit-app-demo.html`. Manual expense entry and demo staking work offline. Gemini scanning works through the configured local server or Vercel functions; see [HOSTED-SCANNING.md](HOSTED-SCANNING.md). Live crypto reference prices still require the local server.

## Fiat wallet: one MYR balance

Open **Wallet → Fiat**. Deposits are **MYR only**. The main balance is the actual MYR demo balance, not a sum of multiple currencies. SGD, THB and IDR show alternative estimates of the same MYR funds; selecting a country does not buy foreign currency or change balances. The new-profile demo starts with MYR funds and zero separate foreign holdings.

Use **Deposit MYR**, enter an amount, review it, then confirm the simulated deposit. All foreign-currency estimates update automatically. **Send from MYR** or **Send in SGD/THB/IDR** lets you choose a recipient and the currency/amount they receive. Review shows the exact MYR deduction, static demo rate, zero demo fee and expected remaining MYR. Confirmation deducts MYR once, credits the mock recipient and records both sides in transaction history. MYR debits round up to the nearest sen; displayed foreign-currency budgets round down to fit the available MYR. No bank, FX provider or real payment network is contacted.

Existing saved foreign-currency balances are **not erased or automatically converted**. They appear in a separate “Balances from the previous demo” panel. **Review move to MYR** is optional: confirmation converts those old balances at static demo rates, records each conversion and preserves old history. They do not count towards the current MYR spending estimates until converted. Unknown, invalid, duplicate or unaffordable transactions are rejected before changing state. Crypto purchases still use the same MYR balance. The profile's default expense currency does not change the wallet's funding currency.

The interaction takes inspiration from [Touch ’n Go's explanation of its MYR-based wallet](https://support.tngdigital.com.my/hc/en-my/articles/46598983222041-If-I-do-not-close-my-TNG-eWallet-account-and-use-it-during-my-travels-can-I-change-the-currency), but JomBit has no affiliation or integration with it, does not use its rates and does not claim its fees or availability. This implementation remains a local simulation.

## Crypto staking and planned Luno integration

Open **Wallet → Staking**. JomBit does not provide crypto buying or selling, including paper orders. The command layer rejects both actions, not just the UI.

The prototype supports **demo staking and unstaking of existing ETH and SOL holdings**. BTC is view-only. Review an amount before confirming; units move between unstaked and staked balances with no MYR movement. Duplicate confirmations and excessive amounts are rejected against current balances. No rewards accrue and no provider fees or waiting periods are simulated. Instant demo unstaking does not imply instant provider withdrawals.

**Luno integration is planned, not connected. No partnership is confirmed.** There is no account-linking flow, API credential collection, provider request, custody or real staking. Provider approval, technical access, supported assets, fees, variable rewards and unstaking conditions need confirmation before implementation. The informational link opens [Luno’s staking guide](https://guide.luno.com/hc/en-gb/articles/11035626257437-How-do-I-stake-my-crypto-with-Luno). ETH/SOL are the prototype subset, not an exhaustive provider asset list. No APR or returns are promised.

Balances, acquisition dates, average costs and earlier buy/sell history are preserved, not reset or reclassified as Luno transactions. Missing acquisition data stays unknown. Old card-source preferences remain in storage for compatibility but are no longer actionable: the card concept is fiat-only.

CoinGecko reference prices remain read-only valuation data, separate from Luno and staking rewards. They refresh through the loopback-only local middleware. Directly opened HTML and static hosts default to clearly labelled demo prices. Prices can be unavailable without preventing a demo stake, because staking moves units, not cash.

## Camera and Gemini receipt scanning

See [GEMINI-SETUP.md](GEMINI-SETUP.md) for local setup or [HOSTED-SCANNING.md](HOSTED-SCANNING.md) for Vercel setup. The refreshed receipt flow offers camera, photo upload and manual entry, with no demo receipt button. The camera, image preparation, upload consent, editable extraction results and total/currency validation are implemented. A live synthetic receipt scan was verified on 2026-10-02: two item lines, tax, service and the MYR 13.92 total were extracted correctly. Real-device camera testing remains separate. No API key is included in shared source or archives. Use sample/redacted receipts under Google’s free-tier data terms.

## Run

Requires Node.js 22.13 or newer. Run these commands inside this directory:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173.

- `/` — company and product website (the default).
- `/?view=demo` — the interactive app inside a phone presentation.
- `/?app=1` — the interactive app without the presentation frame.

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

## Edit the web app QR codes

Both QR cards and their Open JomBit links use `webAppUrl` in `src/website/content.ts`: `https://jom-bit-6667.vercel.app/?app=1`. This absolute URL opens the full-screen app even when someone scans a local or standalone website preview. Change this one value if the public app address changes, then rebuild and deploy. The existing two-card design is preserved for iPhone and Android; neither card points to an app store. No installation is required. The website and app share one Vercel deployment; `/app` is not configured.

Product tabs, mobile navigation and FAQ accordions work. “Try the demo” opens the phone-framed app. Other calls to action navigate to sections of this informational page; they do not execute financial operations.

The website uses bundled, self-hosted Manrope typography, a shared app component in the hero, and a BTC/ETH/SOL position preview with purchase dates, average costs and paper profit/loss. The preview shares its display component with the app but uses only static sample data: it does not access saved wallets or request live prices. Font data is embedded in the standalone HTML, so no font connection is needed. See [the design notes](design/website-refresh.md) for scope and validation.

After building on Windows, `powershell -ExecutionPolicy Bypass -File scripts/export-deliverables.ps1` refreshes the standalone HTML files and source/static-site ZIPs in `../outputs/jombit-independent`. The source export uses an explicit allowlist and rejects private `.env` files, dependencies and Git history; `.env.example` is safe to include. Edit the source project, not the generated HTML.

## Build and host

```sh
npm run build
npm run preview
```

The build creates the static website in `dist`, plus self-contained `dist/JomBit.html` and `dist/JomBit-app-demo.html`. The marketing website can be hosted statically. Gemini scanning also has public Vercel functions in `api/receipt`; configure the private provider key and exact production origin using [HOSTED-SCANNING.md](HOSTED-SCANNING.md). Live crypto prices still require local middleware. `npm run preview` includes both services for loopback-only local testing. No personal name is specified in source or metadata, and this build does not publish to ChatGPT Sites.

## Social preview

The original generated preview card is saved at `public/og.png`. Set the build environment variable `JOMBIT_SITE_URL` to the final website URL before a hosted production build. The build then includes absolute Open Graph and X image URLs. Without an actual hostname, image metadata is deliberately omitted rather than using a fake URL. This variable does not introduce an API connection.

The card was created using the built-in image-generation tool. Its generation prompt is recorded in `design/social-preview-prompt.txt`. The interface itself uses CSS illustrations and bundled icons.

## Independent runtime

This version has no ChatGPT sign-in, OpenAI SDK, Sites runtime, analytics, or remote font requests. Gemini is called by the backend only after explicit scan consent. Its key is server-only and `.env.local` is ignored by Git and excluded from source archives. CoinGecko is a separate, read-only public market-data integration used when the app's crypto screen selects Live prices. The optional app stores demo ledger data locally under `jombit-mobile-demo-state-v1`; receipt photo retention is opt-in.

## Working demo

Create a group and mock members, choose **Take a photo**, **Choose a photo**, or **Enter manually**, review the receipt, assign people, and save. The group ledger recalculates shares and simplified debts. Demo payment QRs use `jombit-demo://pay` payloads. Fiat, currency exchange, transfers, crypto and card controls update persistent demo state. **Profile → Reset Demo** restores the sample data.

Approved photo scans use Gemini once configured; sample walkthrough data remains confined to the marketing website. Payment processing, FX, crypto staking and card issuance remain simulated. Crypto buying and selling are not offered. Crypto reference prices can be live or explicitly labelled demo values. No real funds or crypto move. Demo settlement QRs are not valid payment-network QRs. Run `npm test` for receipt/calculation tests, fiat/crypto ledger tests, market API tests, and server-rendered website/wallet-screen checks. Browser/device interaction testing is separate.
