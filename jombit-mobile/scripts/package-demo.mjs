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
const icon = await readFile(resolve(dist, "jombit.svg"), "utf8");
const fontLicense = await readFile(resolve(dist, "manrope-license.txt"), "utf8");
// Keep the bundled font license with either independently shared HTML file.
html = html.replace("</head>", () => `<script type="text/plain" id="jombit-font-license">${fontLicense.replace(/<\/script/gi, "<\\/script")}</script>\n</head>`);
html = html.replace(script[0], () => `<script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script>`);
html = html.replace(stylesheet[0], () => `<style>${css}</style>`);
html = html.replace('href="./jombit.svg"', () => `href="data:image/svg+xml,${encodeURIComponent(icon)}"`);
await writeFile(resolve(dist, "JomBit.html"), html);
await writeFile(resolve(dist, "JomBit-app-demo.html"), html.replace('<html lang="en">', '<html lang="en" data-jombit-view="demo">'));
console.log("Created dist/JomBit.html — a self-contained JomBit website you can open directly.");
