import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

// A screen animation that keeps its end state ("both" or "forwards") leaves a transform on the screen,
// which makes fixed pop-ups (Modal) position inside the screen instead of the viewport.
test("Screen entrance animations never hold a transform that would trap pop-ups", () => {
  const files = ["app/globals.css", ...readdirSync(new URL("../src/", import.meta.url)).filter((name) => name.endsWith(".css")).map((name) => `src/${name}`)];
  for (const file of files) {
    const css = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    for (const rule of css.match(/[^{}]*\.screen[^{}]*\{[^}]*animation[^}]*\}/g) ?? []) {
      assert.doesNotMatch(rule, /animation[^;]*\b(both|forwards)\b|animation-fill-mode:\s*(both|forwards)/, `${file}: ${rule.trim()}`);
    }
  }
});
