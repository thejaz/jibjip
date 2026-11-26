import { build } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const directory = resolve("work/database-qa");
mkdirSync(directory, { recursive: true });
await build({ configFile: false, publicDir: false, define: { __JIBJIP_RUNTIME_PROFILE__: JSON.stringify("development") },
  build: { outDir: directory, emptyOutDir: true, lib: { entry: resolve("tests/database-browser.ts"), formats: ["es"], fileName: () => "checks.js" } } });
writeFileSync(resolve(directory, "index.html"), '<!doctype html><html lang="en"><meta charset="utf-8"><title>JIBJIP synthetic database checks</title><h1>Synthetic database checks</h1><p>Only http://127.0.0.1:4333 and its disposable development database are allowed.</p><button>Run database checks</button><pre role="status">Ready</pre><script type="module" src="./checks.js"></script></html>');
