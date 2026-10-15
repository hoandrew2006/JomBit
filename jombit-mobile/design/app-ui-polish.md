# App UI polish

## Direction

This pass refines the existing JomBit interface rather than redesigning it. It keeps the cyan and charcoal palette, rounded fintech surfaces, shared logo components and Lucide icon set.

The intended result is a calmer hierarchy: the receipt action stays prominent, money summaries scan quickly, supporting cards sit on quieter layered surfaces, and the fixed navigation reads as a stable app control rather than another content card.

## Interaction decisions

- Interactive controls keep a minimum 44px touch target where space is tight.
- Hover treatments run only on devices that support a precise pointer; touch feedback uses the pressed state.
- The active bottom-navigation item exposes `aria-current="page"`.
- Opening a modal locks background scrolling and restores it on close.
- Motion remains short and is removed when the user prefers reduced motion.
- On narrow screens, home-screen groups stack instead of leaving a card clipped beyond the viewport.

## Review evidence

The home screen was measured at 390px, 1440px and 1728px with Better Design's spacing inspection. After fixes, the review reported no critical or serious findings. Moderate findings are limited to legacy spacing values that form part of the current JomBit visual rhythm.
