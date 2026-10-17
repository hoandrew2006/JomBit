import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("receipt item names keep the flexible desktop column and mobile layout", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.editable-item\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*25px minmax\(0, 1fr\) 70px 120px 44px;/s);
  assert.match(css, /\.editable-item\s+\.grow\s*\{\s*width:\s*100%;\s*\}/);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*\.editable-item\s*\{[^}]*grid-template-columns:\s*25px 1fr 70px;/);
});
