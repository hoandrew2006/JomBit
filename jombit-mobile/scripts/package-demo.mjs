import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
let html = await readFile(resolve(dist, "index.html"), "utf8");
const script = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
const stylesheet = html.match(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
if (!script || !stylesheet) throw new Error("Expected one bundled script and stylesheet.");
const js = await readFile(resolve(dist, script[1]), "utf8");
const css = await readFile(resolve(dist, stylesheet[1]), "utf8");
// Embed every referenced logo/icon file so the HTML works with no network or neighbouring files.
const brandFiles = new Map();
async function inlineBrandAssets(text) {
  for (const path of new Set(text.match(/\.\/brand\/[\w.-]+\.(?:png|ico)/g) ?? [])) {
    if (!brandFiles.has(path)) {
      const type = path.endsWith(".ico") ? "image/x-icon" : "image/png";
      brandFiles.set(path, `data:${type};base64,${(await readFile(resolve(dist, path))).toString("base64")}`);
    }
    text = text.replaceAll(path, brandFiles.get(path));
  }
  return text;
}
const fontLicense = await readFile(resolve(dist, "manrope-license.txt"), "utf8");
// Keep the bundled font license with either independently shared HTML file.
html = html.replace("</head>", () => `<script type="text/plain" id="jombit-font-license">${fontLicense.replace(/<\/script/gi, "<\\/script")}</script>\n</head>`);
const inlineJs = await inlineBrandAssets(js);
html = html.replace(script[0], () => `<script type="module">${inlineJs.replace(/<\/script/gi, "<\\/script")}</script>`);
html = html.replace(stylesheet[0], () => `<style>${css}</style>`);
// A web app manifest cannot load from a local file; the favicons and touch icon are embedded instead.
html = await inlineBrandAssets(html.replace(/\s*<link rel="manifest"[^>]*>/, ""));
await writeFile(resolve(dist, "JomBit.html"), html);
await writeFile(resolve(dist, "JomBit-app-demo.html"), html.replace('<html lang="en">', '<html lang="en" data-jombit-view="demo">'));
console.log("Created dist/JomBit.html — a self-contained JomBit website you can open directly.");
