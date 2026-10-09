import type { ExpenseItem } from "./models";

export function receiptReviewError(input: {
  merchant: string; date: string; items: ExpenseItem[]; taxCents: number; serviceCents: number;
  aiScan: boolean; receiptCurrency: string; groupCurrency: string; printedTotalCents: number | null; reviewed: boolean;
}): string {
  if (!input.merchant.trim()) return "Add a merchant name before continuing.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date) return "Check and enter a valid receipt date.";
  const validCents = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 100_000_000;
  if (!input.items.length || input.items.length > 100) return "Add between 1 and 100 receipt items.";
  if (input.items.some((item) => !item.name.trim() || !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || item.quantity > 10000 || !validCents(item.unitCents))) return "Every item needs a name, whole-number quantity and valid non-negative price.";
  if (!validCents(input.taxCents) || !validCents(input.serviceCents)) return "Check the tax and service charge amounts.";
  const total = input.items.reduce((sum, item) => sum + item.quantity * item.unitCents, 0) + input.taxCents + input.serviceCents;
  if (!validCents(total) || total <= 0) return "The receipt must have a valid positive total.";
  if (input.aiScan) {
    if (input.receiptCurrency !== input.groupCurrency) return "The receipt currency must match the group. Choose the right group or correct the detected currency; no currency conversion is performed.";
    if (input.printedTotalCents === null || !validCents(input.printedTotalCents)) return "Enter the printed total from the receipt.";
    if (input.printedTotalCents !== total) return "Items plus tax and service must match the printed total. Check discounts, prices and rounding before continuing.";
    if (!input.reviewed) return "Confirm that you checked the extracted details against your receipt.";
  }
  return "";
}
