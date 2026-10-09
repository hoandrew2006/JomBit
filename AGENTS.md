# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, and any other) and for humans working in this repository. Read this whole file before making changes.

## What JomBit is

JomBit is a Malaysian consumer-fintech **prototype**: split a restaurant receipt item by item, keep a running group ledger, simplify who owes whom, and settle up. Around that core it demonstrates a MYR fiat wallet, demo crypto staking (ETH/SOL), and a planned prepaid card.

**Nothing here moves real money.** Payments, FX, transfers, staking and cards are simulated in the browser. The only real outside services are optional and local-only:

- **Gemini** (Google) reads approved receipt photos through either the loopback-only local API or protected Vercel functions. Keys stay server-side.
- **CoinGecko** supplies read-only crypto reference prices.

Luno integration is *planned, not connected*. Do not write code, copy or docs that implies a live partnership, real balances, real returns, store listings, regulatory approval or customer numbers.

## Repository layout

The repo holds **two separate apps**. Almost all current work happens in `jombit-mobile/`.

```
JomBit/
├── jombit-mobile/          ← CURRENT app + marketing website (work here)
│   ├── index.html          Vite entry HTML
│   ├── src/
│   │   ├── main.tsx        Picks the view from the URL: website, phone demo, or bare app
│   │   ├── PhonePreview.tsx Phone-frame wrapper for the demo
│   │   └── website/        Marketing site (MarketingSite.tsx, content.ts, walkthrough, FAQ, CSS)
│   ├── app/
│   │   ├── components/     The app's screens: Home, Groups, ExpenseFlow, ReceiptCamera,
│   │   │                   Settlement, Wallet, FiatWallet, CryptoDesk, Profile, Onboarding, ui.tsx
│   │   └── globals.css
│   ├── lib/                Business logic (no UI)
│   │   ├── models.ts       All data types (AppState, Expense, Group, WalletTransaction…)
│   │   ├── calculations.ts Item splitting, tax/service allocation, balances, debt simplification
│   │   ├── fiat-ledger.ts  MYR wallet commands (deposit, send, convert legacy balances)
│   │   ├── crypto-ledger.ts Stake/unstake commands (buy/sell is deliberately rejected)
│   │   ├── state.tsx       React context; saves state to browser localStorage
│   │   ├── seed.ts         Sample demo data
│   │   ├── receipt-client.ts / receipt-review.ts  Photo prep + calls to the local scan API
│   │   ├── crypto-market.ts, mock-services.ts, staking-config.ts
│   ├── server/             Shared API logic used by Vite middleware and protected Vercel functions
│   │   ├── receipt-api.mjs   POST /api/receipt/scan → Gemini (key stays server-side)
│   │   ├── receipt-schema.mjs Validation of Gemini's answer
│   │   └── crypto-market.mjs GET /api/crypto/quotes → CoinGecko, cached
│   ├── tests/              Node built-in test runner (*.test.mjs)
│   ├── scripts/            package-demo.mjs (makes self-contained HTML), export-deliverables.ps1
│   ├── design/             Design notes and product decisions (read before UI/product changes)
│   ├── public/             Static assets (logo, og.png, font licence)
│   ├── .env.example        Template for the private .env.local (no real values)
│   ├── GEMINI-SETUP.md     How to switch on real receipt scanning
│   └── vercel.json         Vite hosting and receipt-function configuration
│
├── (repo root)             ← OLDER proof of concept, kept for reference only
│   ├── app/, lib/, tests/  Next.js-style app built with vinext on Cloudflare Workers
│   ├── worker/, db/, drizzle/, examples/, build/, .openai/   Hosting scaffold (database unused)
│   └── package.json        "jombit-poc"
└── README.md               Overview of both apps
```

Do not change the root proof of concept unless the task explicitly asks for it.

## Tech stack (`jombit-mobile/`)

- **Language:** TypeScript (strict), plus plain `.mjs` for the server middleware and tests.
- **UI:** React 19, rendered client-side. No Next.js, no router — `src/main.tsx` reads the URL query.
- **Build/dev tool:** Vite 8 with `@vitejs/plugin-react`.
- **Styling:** hand-written CSS files (no Tailwind in this app); Manrope font bundled locally via `@fontsource-variable/manrope`.
- **Icons/QR:** `lucide-react`, `qrcode.react`.
- **State:** a single `AppState` object in React context, persisted to `localStorage` under `jombit-mobile-demo-state-v1`. No database, no user accounts.
- **Money:** stored as integer **cents** (`amountCents`, `unitCents`). Never use floating-point currency amounts.
- **Backend:** Vite middleware stays loopback-only. Receipt scanning also has public Vercel functions gated by exact origin, consent, upload validation and short-burst protection. Crypto prices remain local-only.
- **Tests:** Node's built-in test runner (`node --test`) with `--experimental-strip-types` so tests import `.ts` files directly. Some tests server-render React components to HTML.
- **Hosting:** Vercel (root directory `jombit-mobile`, framework Vite, output `dist`) serves the website/app and receipt functions. CoinGecko middleware remains local-only.
- **Node:** 22.13 or newer.

The root proof of concept uses vinext (a Vite-based Next.js-compatible framework), Tailwind 4, Cloudflare Workers/Wrangler and Drizzle ORM; its D1 database is not configured.

## How to run and test

All commands run inside `jombit-mobile/`:

```sh
cd jombit-mobile
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # all tests in tests/*.test.mjs
npm run build      # type-check (tsc) + Vite build + self-contained HTML in dist/
npm run preview    # serve the built site at http://127.0.0.1:4173
```

Pages:

- `/` — marketing website
- `/?view=demo` — the app inside a phone frame
- `/?app=1` — the app on its own

Local receipt scanning needs `jombit-mobile/.env.local` (copy `.env.example`); hosted setup uses server-only Vercel variables. See `GEMINI-SETUP.md` and `HOSTED-SCANNING.md`. Tests mock Gemini and CoinGecko and never need a key or network.

On Windows PowerShell, use `npm.cmd` if `npm` is blocked.

Known issue: `package-lock.json` is currently out of sync with `package.json`, so `npm ci` fails; use `npm install`. Fixing the lockfile should be its own small PR.

The old root app: `npm install && npm run dev` / `npm test` at the repo root.

**Before opening a PR, `npm test` and `npm run build` must both pass in `jombit-mobile/`.** If you changed the root app, run its `npm test` and `npm run lint` too. There is no CI yet, so you must run these yourself.

## Rules for every agent (Claude Code, Codex, others)

### 1. Branches and pull requests — never commit to `main`

- Never commit or push directly to `main`. Never force-push `main`.
- Start every task on a new branch from the latest `main` (for example `feature/receipt-tip-field`, `fix/fiat-rounding`). Use the branch your tool assigns if it gives you one.
- Open a pull request into `main` for every change, however small. A human reviews and merges it; agents do not merge their own PRs.
- Keep each PR focused on one thing. Don't mix refactors, dependency upgrades and features.
- Don't rewrite history on a branch someone else is working on.

### 2. Secrets — this repository is PUBLIC

Anything committed can be read by anyone on the internet, forever (even after deletion, it stays in Git history).

- Never put API keys, passwords, tokens, private URLs, personal data or real receipt photos in code, tests, docs, commit messages or PR descriptions.
- Secrets go only in `jombit-mobile/.env.local` (ignored by Git). Add new variable *names* with empty values to `.env.example`.
- Never expose a secret to the browser: no `VITE_`-prefixed secret variables, no keys in `src/`, `app/` or `lib/`. Keys are read only in `server/`.
- Never weaken the `.gitignore` rules for `.env*`.
- Before each commit, check the diff (`git diff --staged`) for anything that looks like a key or personal data.
- If a secret is ever committed, stop and tell the humans immediately: the key must be revoked/rotated at the provider; deleting the file is not enough.

### 3. Explain changes in plain English

The founders are not all engineers. In every PR description (and in your final message to the person you're working with):

- Start with a short plain-English summary: what changed, why, and what a user will notice.
- Avoid jargon, or explain it in a few words when you must use it.
- Say how you checked it (which tests/build you ran and the result) and anything you could **not** check (e.g. "not tested on a real phone").
- Call out risks, follow-ups or anything that needs a human decision.
- Write clear commit messages describing what and why.

### 4. Keep the app honest and safe

- Keep all money, crypto, payments and cards clearly simulated. Do not add real payment, banking, trading or provider integrations without an explicit request and human review.
- Crypto buying and selling is intentionally **not** offered; `crypto-ledger.ts` rejects it. Don't re-add it.
- Keep the local backends loopback-only. Hosted endpoints require exact-origin checks, strict validation and human review; never make provider keys public. Public endpoints also need provider-side quota/billing safeguards.
- Don't break saved demo data: `AppState` is persisted in users' browsers, so changes to `lib/models.ts` must still load older saved state.
- Put business rules in `lib/` with tests in `tests/`; keep components focused on display.
- Use integer cents for money and add tests for any calculation change.
- Preserve accessibility (keyboard controls, focus rings, reduced-motion support) and the existing disclaimers.
- Read the relevant notes in `jombit-mobile/design/` before product or UI changes, and update the README/docs when behaviour changes.
- Don't add new dependencies without a clear reason stated in the PR.
- Edit source files, never generated output (`dist/`, `outputs/`).
