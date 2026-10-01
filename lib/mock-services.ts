import type { CryptoAsset, Currency, ExpenseItem } from "./models";

export const DEMO_FX_IN_MYR: Record<Currency, number> = {
  MYR: 1,
  SGD: 3.46,
  THB: 0.129,
  IDR: 0.000279,
};

export const DEMO_CRYPTO_PRICES_MYR: Record<CryptoAsset, number> = {
  BTC: 428_500,
  ETH: 14_250,
  SOL: 715,
};

export const DEMO_APY: Partial<Record<CryptoAsset, number>> = {
  ETH: 3.2,
  SOL: 5.8,
};

export function convertCurrencyCents(
  amountCents: number,
  from: Currency,
  to: Currency,
) {
  const inMyr = (amountCents / 100) * DEMO_FX_IN_MYR[from];
  return Math.round((inMyr / DEMO_FX_IN_MYR[to]) * 100);
}

export function demoRate(from: Currency, to: Currency) {
  return DEMO_FX_IN_MYR[from] / DEMO_FX_IN_MYR[to];
}

export async function mockDelay(ms = 650) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function demoReceiptItems(): ExpenseItem[] {
  return [
    {
      id: `item-${Date.now()}-1`,
      name: "Nasi Lemak Rendang",
      quantity: 2,
      unitCents: 1890,
      allocation: { memberIds: [] },
    },
    {
      id: `item-${Date.now()}-2`,
      name: "Char Kuey Teow",
      quantity: 1,
      unitCents: 1650,
      allocation: { memberIds: [] },
    },
    {
      id: `item-${Date.now()}-3`,
      name: "Satay Sharing Platter",
      quantity: 1,
      unitCents: 2800,
      allocation: { memberIds: [] },
    },
    {
      id: `item-${Date.now()}-4`,
      name: "Iced Teh Tarik",
      quantity: 3,
      unitCents: 480,
      allocation: { memberIds: [] },
    },
  ];
}

export function demoPaymentPayload(
  toId: string,
  amountCents: number,
  currency: Currency,
) {
  return `jombit-demo://pay?to=${encodeURIComponent(toId)}&amount=${(
    amountCents / 100
  ).toFixed(2)}&currency=${currency}`;
}

