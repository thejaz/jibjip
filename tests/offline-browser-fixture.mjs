/** Isolated, synthetic two-release server for manual browser/offline regression checks.
 * Run after build:public: node --experimental-strip-types tests/offline-browser-fixture.mjs
 * Choose A, broken-B, or B in work/offline-qa/control.json. Never uses the daily origin.
 */
import { createServer } from "node:http";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { OFFLINE_SHELL_PATHS, stampServiceWorkerCache } from "../packages/core/src/lib/release-cache.ts";
const root = resolve("work/public-candidate");
const output = resolve("work/offline-qa");
const control = resolve(output, "control.json");
mkdirSync(output, {recursive: true});
writeFileSync(control, JSON.stringify({release: process.argv[2] ?? "A"}));
const sourceFiles = new Map();
function walk(directory) {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else sourceFiles.set("/" + relative(root, path).replaceAll("\\", "/"), readFileSync(path));
  }
}
walk(root);
function release(label) {
  const files = new Map(sourceFiles);
  for (const url of OFFLINE_SHELL_PATHS.filter(path => path.endsWith("/"))) {
    const html = files.get(`${url}index.html`);
    if (!html) throw new Error(`Missing fixture entry: ${url}index.html`);
    files.set(url, html);
  }
  const probe = `/assets/qa-release-${label}.js`;
  files.set(probe, Buffer.from(`document.documentElement.dataset.qaRelease=${JSON.stringify(label)};`));
  for (const [url, file] of [["/", "/index.html"], ["/app/", "/app/index.html"]]) {
    const html = Buffer.from(files.get(file).toString().replace("</head>", `<script type="module" src="${probe}"></script></head>`));
    files.set(url, html); files.set(file, html);
  }
  const assets = [...files.keys()].filter(path => /^\/assets\/[^/]+\.(js|css)$/.test(path)).sort();
  const integrity = Object.fromEntries([...OFFLINE_SHELL_PATHS, ...assets].map(url => [url, `sha256-${createHash("sha256").update(files.get(url)).digest("base64")}`]));
  const worker = readFileSync("packages/core/assets/sw.js", "utf8");
  const fingerprint = createHash("sha256").update(JSON.stringify(integrity)).update(worker).digest("hex").slice(0, 16);
  files.set("/sw.js", Buffer.from(stampServiceWorkerCache(worker, fingerprint, assets, integrity)));
  return files;
}
const releases = {A: release("A"), B: release("B")};
let selectedRelease = "A";
const types = {".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".webmanifest":"application/manifest+json", ".svg":"image/svg+xml", ".png":"image/png", ".woff2":"font/woff2", ".ico":"image/x-icon"};
createServer((request, response) => {
  // Editors can briefly truncate the control file while saving. Keep the last
  // valid phase instead of crashing in the middle of an integrity download.
  try {
    const next = JSON.parse(readFileSync(control, "utf8")).release;
    if (["A", "broken-B", "B"].includes(next)) selectedRelease = next;
  } catch { /* Retain the last complete control value. */ }
  const phase = selectedRelease;
  const url = new URL(request.url, "http://localhost:4326");
  const path = url.pathname === "/app" ? "/app/" : url.pathname;
  const files = releases[phase === "A" ? "A" : "B"];
  const body = phase === "broken-B" && path === "/assets/qa-release-B.js" ? Buffer.from("incomplete deployment") : files.get(path);
  response.writeHead(body ? 200 : 404, {"Cache-Control":"no-store", "Content-Type": path.endsWith("/") || path.endsWith(".html") ? "text/html; charset=utf-8" : Object.entries(types).find(([ext]) => path.endsWith(ext))?.[1] ?? "text/plain"});
  response.end(body ?? "Not found");
}).listen(4326, "127.0.0.1", () => console.log("Synthetic offline test server ready at http://localhost:4326 (A / broken-B / B)."));
