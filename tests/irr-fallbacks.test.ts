import assert from "node:assert/strict";
import test from "node:test";
import { acceptedProposalRate, fetchRateProposals } from "../packages/core/src/lib/rates.ts";
import { fetchRateHistory, IRR_FALLBACK_URLS, parseIrrMirror, planRateUpdates } from "../packages/core/src/lib/rate-history.ts";
import type { Rate } from "../packages/core/src/lib/types.ts";

const now = new Date("2026-07-20T12:00:00Z");
const timestamp = now.toISOString();
const response = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status });
const header = "Open Price,Low Price,High Price,Close Price,Change Amount,Change Percent,Gregorian Date,Persian Date";
const csv = (date = "2026-07-19", close = "2250000") => `${header}\n${[close, close, close, close, "0", "0%", date.replaceAll("-", "/"), "1405/04/28"].join(",")}`;
const primary = (date = "2026/07/19") => ({ recordsTotal: 1, data: [["2200000", "2000000", "2300000", "2250000", "", "", date]] });

test("CSV fallback retains exact rial closes, dates, and provenance without conversion", () => {
  const exact = "2250000.1234567890123456789";
  const row = parseIrrMirror(csv("2026-07-19", exact), timestamp, undefined, IRR_FALLBACK_URLS[1])[0];
  assert.equal(row.value, exact); assert.equal(row.effectiveDate, "2026-07-19");
  assert.equal(row.sourceUrl, IRR_FALLBACK_URLS[1]); assert.match(row.source, /TGJU.*jsDelivr/);
  assert.throws(() => parseIrrMirror(csv().replace("Close Price", "Adjusted Close"), timestamp));
  assert.throws(() => parseIrrMirror(csv("2026-02-30"), timestamp));
  assert.throws(() => parseIrrMirror(`${csv()}\n${csv("2026-07-19", "2300000").split("\n")[1]}`, timestamp));
});

test("healthy IRR primary avoids all fallback requests and leaves saved rows intact", async () => {
  const existing: Rate[] = [{ id: "synthetic-manual", baseCurrency: "EUR", quoteCurrency: "IRR", value: "2000000", effectiveDate: "2026-07-19", source: "Synthetic manual", method: "manual", locked: true, createdAt: timestamp }];
  const before = JSON.stringify(existing); const urls: string[] = [];
  const result = await fetchRateProposals(["IRR", "IRR"], existing, async (input, init) => {
    urls.push(String(input)); assert.equal(init?.credentials, "omit"); assert.equal(init?.referrerPolicy, "no-referrer");
    return response(primary());
  }, now);
  assert.equal(urls.length, 1); assert.equal(result.proposals[0].fallback, false);
  assert.equal(result.proposals[0].value, "2250000"); assert.equal(JSON.stringify(existing), before);
  assert.equal(planRateUpdates(existing, [acceptedProposalRate(result.proposals[0], "incoming", timestamp)]).protectedCount, 1);
});

test("IRR falls back through raw GitHub then jsDelivr and retains the actual source URL", async () => {
  for (const selected of IRR_FALLBACK_URLS) {
    const urls: string[] = [];
    const result = await fetchRateProposals(["IRR"], [], async (input, init) => {
      const url = String(input); urls.push(url);
      assert.equal(init?.credentials, "omit"); assert.equal(init?.referrerPolicy, "no-referrer"); assert.equal(init?.cache, "no-store");
      if (url === selected) return new Response(csv());
      throw new TypeError("Synthetic network failure");
    }, now);
    assert.equal(urls.length, selected === IRR_FALLBACK_URLS[0] ? 2 : 3);
    assert.equal(result.proposals[0].value, "2250000"); assert.equal(result.proposals[0].fallback, true);
    assert.equal(result.proposals[0].effectiveDate, "2026-07-19");
    assert.equal(acceptedProposalRate(result.proposals[0], "accepted", timestamp).sourceUrl, selected);
    assert.deepEqual(result.unavailable, []);
  }
});

test("stale, future and malformed primary or replica values advance the chain", async () => {
  for (const bad of [csv("2026-07-01"), csv("2026-07-21"), "broken"]) {
    const urls: string[] = [];
    const result = await fetchRateProposals(["IRR"], [], async input => {
      const url = String(input); urls.push(url);
      if (url.includes("api.tgju")) return response(primary("2026/07/01"));
      return new Response(url === IRR_FALLBACK_URLS[1] ? csv() : bad);
    }, now);
    assert.deepEqual(urls.slice(1), [...IRR_FALLBACK_URLS]);
    assert.equal(result.proposals[0].sourceUrl, IRR_FALLBACK_URLS[1]);
  }
});

test("old archives remain usable for history but cannot masquerade as a current rate", async () => {
  const fetcher = async () => new Response(csv("2024-01-01"));
  const latest = await fetchRateProposals(["IRR"], [], fetcher, now);
  assert.deepEqual(latest.proposals, []); assert.equal(latest.unavailable[0].quoteCurrency, "IRR");
  const history = await fetchRateHistory(["IRR"], "2024-01-01", "2024-01-02", { fetcher, now });
  assert.equal(history.rows[0].value, "2250000"); assert.equal(history.mirrorUsed, true);
  assert.deepEqual(history.unavailable, []);
});

test("historical IRR uses the second host after corrupt CSV and preserves locked/manual dates", async () => {
  const urls: string[] = [];
  const result = await fetchRateHistory(["IRR"], "2026-07-19", "2026-07-20", { now, fetcher: async (input, init) => {
    const url = String(input); urls.push(url);
    assert.equal(init?.credentials, "omit"); assert.equal(init?.referrerPolicy, "no-referrer");
    return url === IRR_FALLBACK_URLS[1] ? new Response(`${csv()}\n${csv("2026-07-20", "2300000").split("\n")[1]}`) : new Response("broken");
  } });
  assert.deepEqual(urls.slice(1), [...IRR_FALLBACK_URLS]); assert.equal(result.rows.length, 2);
  assert.equal(result.mirrorUsed, true); assert.deepEqual(result.unavailable, []);
  const protectedRows = result.rows.map((row, i) => i ? { ...row, method: "manual" as const } : { ...row, locked: true });
  assert.equal(planRateUpdates(protectedRows, result.rows).protectedCount, 2);
});

test("all IRR sources unavailable reports failure without a fabricated or saved rate", async () => {
  const result = await fetchRateHistory(["IRR"], "2026-07-19", "2026-07-20", { now, fetcher: async () => response({}, 503) });
  assert.deepEqual(result.rows, []); assert.deepEqual(result.unavailable, ["IRR"]); assert.equal(result.mirrorUsed, false);
});

test("a timed-out archive request aborts and advances to the next host", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let startBackup!: () => void;
  const backupStarted = new Promise<void>(resolve => { startBackup = resolve; });
  let timedOut = false;
  const resultPromise = fetchRateHistory(["IRR"], "2026-07-19", "2026-07-20", { now, fetcher: async (input, init) => {
    if (String(input) === IRR_FALLBACK_URLS[0]) return await new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => { timedOut = true; reject(new DOMException("Timed out", "AbortError")); }, { once: true });
      startBackup();
    });
    return String(input) === IRR_FALLBACK_URLS[1] ? new Response(csv()) : response({}, 503);
  } });
  await backupStarted;
  context.mock.timers.tick(12_001);
  const result = await resultPromise;
  assert.equal(timedOut, true); assert.equal(result.rows[0].sourceUrl, IRR_FALLBACK_URLS[1]);
});

test("IRR history cancellation stops before another provider is contacted", async () => {
  const controller = new AbortController(); let requests = 0;
  await assert.rejects(fetchRateHistory(["IRR"], "2026-07-19", "2026-07-20", { now, signal: controller.signal, fetcher: async () => {
    requests++; controller.abort(); throw new DOMException("Canceled", "AbortError");
  } }), { name: "AbortError" });
  assert.equal(requests, 1);
});

test("rate fetching works without newer AbortSignal convenience methods", async () => {
  const properties = ["timeout", "any"] as const;
  const original = properties.map(name => Object.getOwnPropertyDescriptor(AbortSignal, name)!);
  try {
    for (const name of properties) Object.defineProperty(AbortSignal, name, { value: undefined, configurable: true });
    const result = await fetchRateHistory(["IRR"], "2026-07-19", "2026-07-20", { now, fetcher: async () => response(primary()) });
    assert.equal(result.rows[0].value, "2250000");
  } finally { properties.forEach((name, i) => Object.defineProperty(AbortSignal, name, original[i])); }
});
