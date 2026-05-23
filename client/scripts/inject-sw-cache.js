import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, "..", "dist");

// Read the built index.html and extract asset URLs
const html = readFileSync(resolve(dist, "index.html"), "utf-8");

const assetUrls = [];
const scriptRe = /<script[^>]+src="([^"]+)"[^>]*>/gi;
const styleRe = /<link[^>]+href="([^"]+)"[^>]*rel="stylesheet"[^>]*>/gi;

let m;
while ((m = scriptRe.exec(html)) !== null) {
  const url = m[1];
  if (url.startsWith("/assets/")) assetUrls.push(url);
}
while ((m = styleRe.exec(html)) !== null) {
  const url = m[1];
  if (url.startsWith("/assets/")) assetUrls.push(url);
}

if (!assetUrls.length) {
  console.log("inject-sw-cache: no asset URLs found in index.html, skipping");
  process.exit(0);
}

// Read sw.js and inject into cache.addAll([...])
const swPath = resolve(dist, "sw.js");
let sw = readFileSync(swPath, "utf-8");

const addAllRe = /(cache\.addAll\s*\(\s*\[)([^\]]*)(\]\s*\))/s;
const match = sw.match(addAllRe);
if (!match) {
  console.log("inject-sw-cache: could not find cache.addAll([...]) in sw.js");
  process.exit(0);
}

const existingEntries = match[2]
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const existingPaths = new Set(
  existingEntries.map((e) => {
    try {
      return JSON.parse(e);
    } catch {
      return null;
    }
  }).filter(Boolean),
);

const newEntries = assetUrls.filter((url) => !existingPaths.has(url));
if (!newEntries.length) {
  console.log("inject-sw-cache: all assets already in pre-cache list");
  process.exit(0);
}

const indent = "        ";
const entriesStr = newEntries
  .sort()
  .map((url) => `${indent}"${url}"`)
  .join(",\n");

sw = sw.replace(
  addAllRe,
  `$1$2,\n${entriesStr}\n$3`,
);

writeFileSync(swPath, sw, "utf-8");
console.log(`inject-sw-cache: added ${newEntries.length} assets to sw.js pre-cache`);
