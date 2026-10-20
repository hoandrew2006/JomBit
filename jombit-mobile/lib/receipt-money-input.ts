const MONEY_DRAFT = /^\d*(?:\.\d{0,2})?$/;

export function normalizeMoneyDraft(value: string) {
  return value.replace(",", ".").trim();
}

export function isMoneyDraft(value: string) {
  return MONEY_DRAFT.test(normalizeMoneyDraft(value));
}

export function moneyDraftToCents(value: string): number | null {
  const normalized = normalizeMoneyDraft(value);
  if (!normalized || normalized === "." || !MONEY_DRAFT.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.split(".");
  const cents = Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 100_000_000 ? cents : null;
}

export function centsToMoneyDraft(cents: number | null) {
  return cents === null ? "" : (cents / 100).toFixed(2);
}
