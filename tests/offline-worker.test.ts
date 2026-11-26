import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { OFFLINE_SHELL_PATHS, stampServiceWorkerCache } from "../packages/core/src/lib/release-cache.ts";

const origin = "https://app.example";
const assets = ["/assets/app-test.js", "/assets/home-test.css"];
function fixture() {
  const files = new Map([...OFFLINE_SHELL_PATHS, ...assets].map(url => [url, `release A ${url}`]));
  const integrity = Object.fromEntries([...files].map(([url, body]) => [url, `sha256-${createHash("sha256").update(body).digest("base64")}`]));
  const source = stampServiceWorkerCache(readFileSync("packages/core/assets/sw.js", "utf8"), "a".repeat(16), assets, integrity);
  const stores = new Map<string, Map<string, Response>>();
  const events: Record<string, (event: unknown) => void> = {};
  let offline = false;
  const network = async (request: Request) => {
    if (offline) throw new Error("Disconnected");
    const path = new URL(request.url).pathname;
    const body = files.get(path);
    if (body === undefined) return new Response("Not found", {status: 404});
    if (request.integrity !== integrity[path] || `sha256-${createHash("sha256").update(body).digest("base64")}` !== request.integrity) throw Error("Integrity mismatch");
    return new Response(body);
  };
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        addAll: async (requests: Request[]) => {
          const responses = await Promise.all(requests.map(network));
          if (responses.some(r => !r.ok)) throw Error("Bad response");
          requests.forEach((request, i) => store.set(new URL(request.url).pathname, responses[i]));
        },
        match: async (path: string) => store.get(path)?.clone(),
        put: async (path: string, response: Response) => { store.set(path, response); },
      };
    },
  };
  runInNewContext(source, {self: {location: {origin}, addEventListener: (name: string, action: (event: unknown) => void) => events[name] = action}, caches, fetch: network, Request: class extends Request {constructor(path: string, init: RequestInit) { super(new URL(path, origin), init); }}, Response, URL, Set, Promise});
  const lifetime = async (name: string) => { let pending: Promise<void> | undefined; events[name]({waitUntil: (value: Promise<void>) => pending = value}); await pending; };
  const request = async (path: string, mode = "navigate", method = "GET") => {
    let response: Promise<Response> | undefined;
    events.fetch({request: {url: new URL(path, origin).href, method, mode}, respondWith: (value: Promise<Response>) => response = value});
    return response;
  };
  return {files, stores, lifetime, request, setOffline: () => offline = true};
}

test("offline restart serves all routes, query hints, setup seed, and license", async () => {
  const f = fixture(); await f.lifetime("install"); f.setOffline();
  assert.equal(await (await f.request("/app/?lang=fa&build=test"))?.text(), "release A /app/");
  assert.equal(await (await f.request("/"))?.text(), "release A /");
  assert.equal(await (await f.request("/about/?lang=fa"))?.text(), "release A /about/");
  assert.equal(await (await f.request("/data/jibjip-starter-seed.json", "cors"))?.text(), "release A /data/jibjip-starter-seed.json");
  assert.equal(await (await f.request("/LICENSE.txt", "cors"))?.text(), "release A /LICENSE.txt");
});
test("a changed live site cannot mix its HTML or artwork into a running cached release", async () => {
  const f = fixture(); await f.lifetime("install"); f.files.set("/app/", "release B");
  assert.equal(await (await f.request("/app/"))?.text(), "release A /app/");
});
test("a partial, tampered, or failed download preserves previous and unrelated caches", async () => {
  const f = fixture(); f.stores.set("jibjip-" + "b".repeat(16), new Map()); f.stores.set("another-app", new Map());
  f.files.set("/app/", "login page or half-deployed HTML");
  await assert.rejects(f.lifetime("install"), /Integrity/);
  assert.deepEqual([...f.stores.keys()], ["jibjip-" + "b".repeat(16), "another-app"]);
});
test("activation cleans only owned obsolete release caches", async () => {
  const f = fixture(); await f.lifetime("install");
  f.stores.set("jibjip-" + "b".repeat(16), new Map()); f.stores.set("another-app", new Map()); f.stores.set("jibjip-user-content", new Map());
  await f.lifetime("activate");
  assert.deepEqual([...f.stores.keys()], ["jibjip-" + "a".repeat(16), "another-app", "jibjip-user-content"]);
});
test("financial-like paths, health requests, remote requests, and mutations bypass the shell", async () => {
  const f = fixture();
  for (const path of ["/data/private.json", "/__jibjip_health__", "/backup.json", "https://rates.example/quote"]) assert.equal(await f.request(path, "cors"), undefined);
  assert.equal(await f.request("/app/", "navigate", "POST"), undefined);
});
test("an evicted file is recovered only with matching integrity; offline failure is explicit", async () => {
  const f = fixture(); await f.lifetime("install"); f.stores.get("jibjip-" + "a".repeat(16))!.delete("/app/");
  assert.equal(await (await f.request("/app/"))?.text(), "release A /app/");
  f.stores.get("jibjip-" + "a".repeat(16))!.delete("/app/"); f.files.set("/app/", "release B");
  assert.equal((await f.request("/app/"))?.status, 503);
});
