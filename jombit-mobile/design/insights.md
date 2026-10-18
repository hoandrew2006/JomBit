# Wallet → Insights

An expense-tracking view in the Wallet, next to Fiat, Crypto and Card. The layout borrows from common banking "insights" screens; the styling uses JomBit's dark surfaces, with cyan for money in, coral for spend and green for sample staking rewards.

## Decisions

- **What counts** is defined once in `lib/insights.ts` and documented in AGENTS.md → Business rules. The UI only displays it.
- **Spend is the user's share.** If the user pays a RM120 group bill and their share is RM50, Insights shows RM50. Settle-ups repay shares that are already counted, so they are excluded.
- **Transfers to friends are not spend** (decided with the founders, 18 Oct 2026). Neither are top-ups, conversions between the user's own balances or crypto price changes.
- **Staking rewards are sample records.** Demo staking still accrues nothing. The seeded "Sample staking reward" records are valued at the reference price recorded on the day. They carry no MYR amount, so they never appear in MYR wallet history.
- **MYR on the transaction day.** Expenses store `myrRate` when saved (the live rate when available, otherwise the demo rate). There is no historical rate feed, so an expense saved today with an older date uses today's rate.
- **Periods** use Malaysia time. Weeks run Monday–Sunday. A month is split into Monday–Sunday weeks, clipped to the month. Future buckets are drawn as an empty dashed baseline.
- **Mini charts on tiles** show daily bars for a week or month, and monthly bars for a year.
- **Categories** are optional fields on records. Older saved state gets a merchant-based suggestion without migration. A user's choice is stored on the expense or wallet record.
- **Demo data** (`lib/seed-activity.ts`) generates about 92 days of fictional activity relative to today. A fixed pseudo-random sequence produces the same data for the same day. It includes:
  - personal payments in every category
  - shared KL meals, some paid by friends
  - a THB Phuket trip with day rates
  - money received from friends, top-ups, one transfer and two settle-ups, to show the exclusions

## Not done

- Not tested on a real phone. Checked in desktop Chromium at 390px width.
- No historical FX feed. No budgets or alerts.
