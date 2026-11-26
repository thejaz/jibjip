import assert from "node:assert/strict";
import test from "node:test";
import { OFFLINE_SHELL_PATHS, stampServiceWorkerCache } from "../packages/core/src/lib/release-cache.ts";
const source = 'const CACHE = "jibjip-__JIBJIP_CACHE_VERSION__"; const APP_SHELL = /* __JIBJIP_PRECACHE_MANIFEST__ */ [];';
const assets = ["/assets/home-a.js", "/assets/app-b.js", "/assets/shared-c.css"];
const hashes = Object.fromEntries([...OFFLINE_SHELL_PATHS, ...assets].map(url => [url, `sha256-${"A".repeat(43)}=`]));
test("each generated release has isolated cache and exact integrity for its entire shell", () => {
  const first = stampServiceWorkerCache(source, "a".repeat(16), assets, hashes);
  assert.notEqual(first, stampServiceWorkerCache(source, "b".repeat(16), assets, hashes));
  assert.ok(!first.includes("__JIBJIP_"));
  assert.match(first, /\/app\//);
  assert.match(first, /\/data\/jibjip-starter-seed\.json/);
  assert.match(first, /\/audio\/chick\.mp3/);
});
test("stamping rejects unsafe paths, duplicate bundles, missing, and invalid integrity", () => {
  for (const path of ["https://example.com/app.js", "/data/records.js", "/assets/app.js?secret", "/app/index.html"]) {
    assert.throws(() => stampServiceWorkerCache(source, "a".repeat(16), [path], hashes));
  }
  assert.throws(() => stampServiceWorkerCache(source, "a".repeat(16), [assets[0], assets[0]], hashes));
  assert.throws(() => stampServiceWorkerCache(source, "a".repeat(16), assets, {}));
  assert.throws(() => stampServiceWorkerCache(source, "a".repeat(16), assets, {...hashes, "/": "sha256-invalid"}));
  assert.throws(() => stampServiceWorkerCache(source, "bad", assets, hashes));
  assert.throws(() => stampServiceWorkerCache("", "a".repeat(16), assets, hashes));
});
