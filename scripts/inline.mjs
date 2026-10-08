import { readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
const dist = resolve("dist");
let html = await readFile(resolve(dist, "index.html"), "utf8");
const consumed = [];
async function inline(pattern, wrap) {
  const match = html.match(pattern);
  if (!match) throw new Error(`Missing Vite output: ${pattern}`);
  const file = resolve(dist, match[1]);
  if (!file.startsWith(dist + sep)) throw new Error("Output path escaped dist");
  const content = await readFile(file, "utf8");
  html = html.replace(match[0], () => wrap(content));
  consumed.push(file);
}
await inline(
  /<script[^>]*src="([^\"]+)"[^>]*><\/script>/,
  (js) =>
    `<script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script>`,
);
await inline(
  /<link[^>]*href="([^\"]+\.css)"[^>]*>/,
  (css) => `<style>${css}</style>`,
);
await writeFile(resolve(dist, "index.html"), html, "utf8");
for (const file of consumed) await unlink(file);
console.log(
  `Self-contained offline HTML: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KiB`,
);
