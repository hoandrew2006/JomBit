import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { centsToMoneyDraft, isMoneyDraft, moneyDraftToCents, normalizeMoneyDraft } from "../lib/receipt-money-input.ts";

test("receipt money drafts allow natural decimal typing without floating-point currency", () => {
  assert.equal(moneyDraftToCents("1"), 100);
  assert.equal(moneyDraftToCents("1."), 100);
  assert.equal(moneyDraftToCents("1.2"), 120);
  assert.equal(moneyDraftToCents("1.23"), 123);
  assert.equal(moneyDraftToCents("0.01"), 1);
  assert.equal(moneyDraftToCents(""), null);
});

test("receipt money drafts reject negative values, extra decimals and unsafe totals", () => {
  assert.equal(isMoneyDraft("-1"), false);
  assert.equal(isMoneyDraft("1.234"), false);
  assert.equal(moneyDraftToCents("1000000.01"), null);
  assert.equal(moneyDraftToCents("12abc"), null);
});

test("receipt money drafts accept a mobile decimal comma and format committed cents", () => {
  assert.equal(normalizeMoneyDraft(" 12,30 "), "12.30");
  assert.equal(moneyDraftToCents("12,30"), 1230);
  assert.equal(centsToMoneyDraft(1230), "12.30");
  assert.equal(centsToMoneyDraft(null), "");
});

test("receipt amounts use typed decimal fields instead of browser stepper controls", async () => {
  const source = await readFile(new URL("../app/components/ExpenseFlow.tsx", import.meta.url), "utf8");
  assert.match(source, /type="text" inputMode="decimal"/);
  assert.equal(source.match(/<ReceiptMoneyInput/g)?.length, 4);
  assert.doesNotMatch(source, /Unit price[^\n]+input type="number"/);
  assert.doesNotMatch(source, /SST \/ tax[^\n]+input type="number"/);
  assert.doesNotMatch(source, /Service charge[^\n]+input type="number"/);
  assert.doesNotMatch(source, /Printed grand total[^\n]+input type="number"/);
});
