import type { ForeignCurrency } from "@/lib/fiat-ledger";

// Inline SVG flags: emoji flags do not render on Windows, and inline art needs no network.
// Decorative only, because the country name is always shown beside the flag.
const flags: Record<ForeignCurrency, React.ReactNode> = {
  SGD: <>
    <rect width="30" height="20" fill="#fff" />
    <rect width="30" height="10" fill="#ef3340" />
    <circle cx="6.6" cy="5" r="3.9" fill="#fff" />
    <circle cx="8.1" cy="5" r="3.6" fill="#ef3340" />
    <g fill="#fff">
      <polygon points="9.60,2.65 9.76,3.13 10.27,3.13 9.85,3.43 10.01,3.92 9.60,3.62 9.19,3.92 9.35,3.43 8.93,3.13 9.44,3.13" />
      <polygon points="11.26,3.86 11.42,4.34 11.93,4.34 11.52,4.64 11.68,5.13 11.26,4.83 10.85,5.13 11.01,4.64 10.60,4.34 11.11,4.34" />
      <polygon points="10.63,5.82 10.79,6.30 11.29,6.30 10.88,6.60 11.04,7.08 10.63,6.78 10.22,7.08 10.37,6.60 9.96,6.30 10.47,6.30" />
      <polygon points="8.57,5.82 8.73,6.30 9.24,6.30 8.83,6.60 8.98,7.08 8.57,6.78 8.16,7.08 8.32,6.60 7.91,6.30 8.41,6.30" />
      <polygon points="7.94,3.86 8.09,4.34 8.60,4.34 8.19,4.64 8.35,5.13 7.94,4.83 7.52,5.13 7.68,4.64 7.27,4.34 7.78,4.34" />
    </g>
  </>,
  THB: <>
    <rect width="30" height="20" fill="#a51931" />
    <rect y="3.33" width="30" height="13.34" fill="#f4f5f8" />
    <rect y="6.67" width="30" height="6.66" fill="#2d2a4a" />
  </>,
  IDR: <>
    <rect width="30" height="20" fill="#fff" />
    <rect width="30" height="10" fill="#ce1126" />
  </>,
};

export function CountryFlag({ currency }: { currency: ForeignCurrency }) {
  return <svg className="country-flag" viewBox="0 0 30 20" width="30" height="20" aria-hidden="true" focusable="false">{flags[currency]}</svg>;
}
