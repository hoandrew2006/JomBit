# JomBit website refresh

## Design read and audit

Brand-preserving consumer fintech marketing site: friendly, credible, product-led.
Existing React, native CSS and Lucide remain in place. No framework migration.
Design variance 5, motion intensity 4, visual density 4: a modest evolution of the
existing split hero, section reveals and medium-density page.

Preserve the JomBit wordmark, cyan identity, existing purple crypto chapter,
paper-receipt walkthrough, Malaysian voice, section anchors, navigation labels,
metadata and financial-service disclaimers. These established brand surfaces
take precedence over Taste Skill's defaults for a new site. No new theme toggle,
photography, invented social proof or live financial claims is introduced.

The audit found Arial throughout, a forced three-line hero, a separate illustrative
phone interface, decorative orbiting crypto tokens and repeated equal-card rows.
The refresh uses self-hosted Manrope, a shorter hero, a shared app component,
shared crypto position details and asymmetric feature layouts. Real component
previews serve the product story without generated screenshots or stock imagery.

## Preview boundaries

- `GroupLedgerHero` is shared with the app. Its marketing link opens the sample
  walkthrough; it does not request camera access.
- `CryptoHoldingFacts` is shared with the app. Website holdings come from seed
  data and prices from the existing static demo price map.
- Marketing previews never load the app state provider, read local storage,
  fetch market prices, execute trades or call Gemini.
- “Try the demo” opens `?view=demo`. The store QR section remains coming soon.
- Existing keyboard tabs, focus rings and reduced-motion behavior remain intact.

## Validation

Run `npm test` and `npm run build`. The self-contained export must include the
font as a data URL, not a network font dependency. Automated render tests cover
section targets, accessible preview controls, dates, unknown history and privacy.

Browser-based visual checks and Lighthouse require a connected browser and
remain a separate check if browser tooling is unavailable. Review at 1440, 1024,
768, 390 and 320px, particularly the headline, navigation and crypto price pairs.
