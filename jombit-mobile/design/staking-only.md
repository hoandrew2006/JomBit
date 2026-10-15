# JomBit staking-only product update

JomBit is not a digital-asset exchange. It never buys, sells or holds crypto, and
crypto never leaves the user's own Luno account. JomBit only shows the user's linked
Luno balances and offers staking through Luno. The app and website simulate this with
sample balances; the earlier trading executor was replaced with a stake/unstake-only
command handler, and earlier simulated buy/sell records are removed when saved data loads.

## Boundaries

- ETH and SOL are the prototype staking subset. BTC is view-only.
- Balances are shown as held in the linked Luno account. No purchase costs, dates or profit/loss.
- Activity is staking only: staked, rewards (illustrative seeded examples) and unstaked.
- Demo stake/unstake actions preserve unit totals and cash.
- Market quotes affect reference valuations only, never staking rewards.
- No APR is displayed or rewards accrued. Immediate local unstaking is not a
  representation of provider processing times.
- JomBit Card is fiat-only; a stored older crypto-source preference is preserved
  in data but no longer offered or used in the card presentation.
- Luno is a planned integration, not a confirmed partnership or active service.
- No Luno API, account-linking, credentials or fund transfers are implemented.

## Provider references checked 8 October 2026

- [Luno staking instructions and regional eligibility](https://guide.luno.com/hc/en-gb/articles/11035626257437-How-do-I-stake-my-crypto-with-Luno)
- [Luno staking rewards and variable estimates](https://guide.luno.com/hc/en-gb/articles/11035602253981-How-do-my-staking-rewards-work)

These establish Luno's own product behavior, not permission or technical
capability for JomBit to execute provider staking. A real integration requires
separate provider discussions, approved technical access and a security review.

## Validation

Ledger tests cover trading rejection, staking conservation, duplicate and competing
confirmations, precision, and removal of earlier buy/sell records on load.
Render tests verify the removal of trading controls, visible planned-integration
disclosures and continued demo staking during reference-price outages.
Browser/device interaction verification remains separate.
