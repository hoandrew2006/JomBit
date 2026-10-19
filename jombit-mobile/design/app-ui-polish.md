# App UI polish

## Direction

This pass refines the existing JomBit interface rather than redesigning it. It keeps the cyan and charcoal palette, rounded fintech surfaces, shared logo components and Lucide icon set.

The intended result is a calmer hierarchy: the receipt action stays prominent, money summaries scan quickly, supporting cards sit on quieter layered surfaces, and the fixed navigation reads as a stable app control rather than another content card.

## Interaction decisions

- Interactive controls keep a minimum 44px touch target where space is tight.
- Authentication uses one dominant submit action with a quieter account-mode switch, so sign-in and sign-up do not compete visually.
- Authentication offers a secondary **Explore the demo** action. It opens a standardized sample workspace without an account, while every newly created account begins empty.
- Passwords can be revealed with a labelled icon control, and authentication errors use plain, actionable copy with a non-colour icon cue.
- Profile content uses one narrow settings column; the prototype explanation is a quiet information card and reset remains visually separate from routine actions.
- Hover treatments run only on devices that support a precise pointer; touch feedback uses the pressed state.
- The active bottom-navigation item exposes `aria-current="page"`.
- Opening a modal locks background scrolling and restores it on close.
- Motion remains short and is removed when the user prefers reduced motion.
- On narrow screens, home-screen groups stack instead of leaving a card clipped beyond the viewport.
- MYR sends collect the recipient's account-holder name, bank name and account number instead of selecting a sample JomBit contact. The review and saved activity retain only the final four account-number digits; the complete number is never written to app state.

## Review evidence

The home screen was measured at 390px, 1440px and 1728px with Better Design's spacing inspection. After fixes, the review reported no critical or serious findings. Moderate findings are limited to legacy spacing values that form part of the current JomBit visual rhythm.

The authentication screen was rendered and inspected at 390px, 1440px and 1728px. Its final automated spacing report could not be returned because the Better Design free-query quota was exhausted after capture.

## Product-language pass

- “Preview mode” is the single global status label; core receipt and group flows use direct product language.
- Safety context stays close to wallet, settlement, staking and card actions where a test balance could otherwise be mistaken for real money.
- Seed activity reads like normal account history. Technical words such as “demo”, “mock” and “simulated” are kept out of routine buttons and titles.
- Roadmap copy appears only where a provider or feature is genuinely not connected, including Luno staking and card issuing.
- Home activity contains real ledger entries only; the previous hard-coded wallet row was removed.
