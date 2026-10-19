# Crypto transfers and layout repair

Transfer is a local ledger preview alongside Receive. A recipient label identifies
the outgoing record; it is not an address, network or another user's account.
Review and confirmation are separate. Only available units can be deducted;
staking, MYR and unrelated history are preserved. No provider is contacted.

The existing cyan/charcoal brand and Lucide icons are unchanged. Desktop holdings
and selected-asset details share two columns; phone rows put MYR value underneath
the asset name to avoid crowding. Active tabs use dark text on cyan. The wallet's
entrance animation no longer retains a stacking context that trapped dialogs
behind the navigation.

Validation: 91 automated tests pass. Headless Chrome checks at 390, 1440 and 1728
pixels show eight asset rows and no document horizontal overflow. A 0.01 ETH
preview transfer was entered, reviewed and confirmed in an isolated local wallet;
the persisted record is crypto-transfer. The mobile confirmation screenshot was
checked after repairing the modal layering. Real devices and cloud sync were not
tested. Better Design principles, review rules and separate entry/review copy
checks were used; its measured-spacing review was blocked by the free-query limit.

Group settlements now offer separate Fiat QR and Crypto QR paths. A crypto QR
uses the selected asset's current CoinGecko reference price to express the group
balance as a crypto quantity and records that choice with the settlement. The QR
is a `jombit-demo://crypto-pay` payload, not a blockchain address, and it neither
checks a chain nor moves or reserves a holding. Staked balances are unaffected.
