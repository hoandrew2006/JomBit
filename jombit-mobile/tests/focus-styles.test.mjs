import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("form fields use one focus treatment while other controls retain a visible ring", async () => {
  const [mobile, polish, crypto, receipt] = await Promise.all([
    css("src/mobile.css"),
    css("src/app-polish.css"),
    css("src/crypto.css"),
    css("src/receipt-refresh.css"),
  ]);

  assert.match(mobile, /:is\(button, a, summary, \[role="button"\]\):focus-visible/);
  assert.doesNotMatch(mobile, /\.app-view\s+:focus-visible/);
  assert.match(polish, /\.money-input input:focus,[\s\S]*\.auth-input input:focus[\s\S]*box-shadow:\s*none/);
  assert.doesNotMatch(crypto, /crypto-order-form\s+:is\(button, input\):focus-visible/);
  assert.doesNotMatch(receipt, /:is\(input, summary, button\):focus-visible/);
});
