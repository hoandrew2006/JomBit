# Wallet → Insights

An expense-tracking view in the Wallet, next to Fiat, Crypto and Card. The layout borrows from common banking "insights" screens; the styling uses JomBit's dark surfaces, with cyan for money in, coral for spend and green for sample staking rewards.

## Decisions

- **What counts** is defined once in `lib/insights.ts` and documented in AGENTS.md → Business rules. The UI only displays it.
- **Spend is the user's share.** If the user pays a RM120 group bill and their share is RM50, Insights shows RM50. Settle-ups the user pays repay shares that are already counted, so they are not spend; settle-ups paid to the user are Repayments in Money in.
- **Crypto payments (19 Oct 2026):** one spend entry for the MYR the recipient received, in its normal category, with a "Paid with [coin]" badge and the crypto amount. The conversion fee is a separate **Fees** entry. The MYR converted from crypto is part of the payment, never money in. Crypto payments are hidden from the MYR wallet history because they are paid from crypto.
- **Money in = all money entering the wallet (19 Oct 2026):** Top-ups, Received from others, Repayments (settle-ups paid to the user) and Staking rewards, shown as four sources on the Summary screen. Never labelled "Income".
- **Not spend:** settle-ups the user paid and bank withdrawals.
- **Transfers to friends are not spend** (decided with the founders, 18 Oct 2026). Neither are conversions between the user's own balances or crypto price changes.
- **Staking rewards are sample records.** Demo staking still accrues nothing. The seeded "Sample staking reward" records are valued at the reference price recorded on the day. They carry no MYR amount, so they never appear in MYR wallet history.
- **MYR on the transaction day.** Expenses store `myrRate` when saved (the live rate when available, otherwise the demo rate). There is no historical rate feed, so an expense saved today with an older date uses today's rate.
- **Periods** use Malaysia time. Weeks run Monday–Sunday. A month is split into Monday–Sunday weeks, clipped to the month. Future buckets are drawn as an empty dashed baseline.
- **Mini charts on tiles** show daily bars for a week or month, and monthly bars for a year.
- **Categories** are optional fields on records. Older saved state gets a merchant-based suggestion without migration. A user's choice is stored on the expense or wallet record.
- **Balances follow the history (19 Oct 2026):** demo balances are opening balances from about three months ago plus all the demo activity (`applyHistory()` in `lib/balance-effects.ts`). Crypto payments reduce the coin's available balance, sample rewards add to it, and a test checks running balances never go negative.
- **Repayments count under "Group" (19 Oct 2026).** New settle-ups store their group so the group name can be shown.
- **Demo data** (`lib/seed-activity.ts`) generates about 92 days of fictional activity relative to today. A fixed pseudo-random sequence produces the same data for the same day. It includes:
  - personal payments in every category
  - shared KL meals, some paid by friends
  - a THB Phuket trip with day rates
  - money received from friends, top-ups, repayments, a bank withdrawal, a transfer, weekly crypto payments with conversion fees, and one settle-up the user paid

## Not done

- Not tested on a real phone. Checked in desktop Chromium at 390px width.
- No historical FX feed. No budgets or alerts.
