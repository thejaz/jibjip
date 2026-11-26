import assert from "node:assert/strict";
import test from "node:test";
import { BUILT_IN_CURRENCIES } from "../packages/core/src/lib/catalogs.ts";
import {
  OFFLINE_BASELINE_RATES,
  acceptedProposalRate,
  fetchRateProposals,
  mergeOfflineBaselineRates,
  normalizeRateRows,
} from "../packages/core/src/lib/rates.ts";
import type { Rate } from "../packages/core/src/lib/types.ts";

const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json" },
});

test("offline baseline covers every built-in currency with visible provenance", () => {
  assert.deepEqual(
    OFFLINE_BASELINE_RATES.map((rate) => rate.quoteCurrency),
    BUILT_IN_CURRENCIES.filter((currency) => currency.code !== "EUR").map((currency) => currency.code),
  );
  assert.ok(OFFLINE_BASELINE_RATES.every((rate) =>
    /^\d{4}-\d{2}-\d{2}$/.test(rate.effectiveDate) &&
    rate.source.length > 4 &&
    Number(rate.value) > 0
  ));
  assert.match(OFFLINE_BASELINE_RATES.find((rate) => rate.quoteCurrency === "IRR")?.source ?? "", /TGJU.*open market/i);
  assert.equal(OFFLINE_BASELINE_RATES.find((rate) => rate.quoteCurrency === "USDT")?.value, "1.14462575316374558");
});

test("baseline merge fills only missing currencies and never replaces personal rates", () => {
  const personal: Rate[] = [{
    id: "personal-usd",
    baseCurrency: "EUR",
    quoteCurrency: "USD",
    value: "9.99",
    effectiveDate: "2026-07-18",
    source: "manual personal value",
    method: "manual",
    createdAt: "2026-07-18T00:00:00.000Z",
  }];
  const merged = mergeOfflineBaselineRates(personal);
  assert.equal(merged.length, BUILT_IN_CURRENCIES.length - 1);
  assert.deepEqual(merged.find((rate) => rate.quoteCurrency === "USD"), personal[0]);
  assert.equal(merged.filter((rate) => rate.quoteCurrency === "USD").length, 1);
});

test("provider chain returns source-attributed proposals without mutating current rates", async () => {
  const existing = OFFLINE_BASELINE_RATES.map((rate) => ({ ...rate }));
  const before = JSON.stringify(existing);
  const urls: string[] = [];
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    urls.push(url);
    if (url.includes("providers=ECB")) return response([
      { date: "2026-07-20", base: "EUR", quote: "GBP", rate: 0.86 },
      { date: "2026-07-20", base: "EUR", quote: "BRL", rate: 5.8 },
      { date: "2026-07-20", base: "EUR", quote: "IDR", rate: 20400 },
      { date: "2026-07-20", base: "EUR", quote: "ZAR", rate: 18.7 },
    ]);
    if (url.includes("frankfurter")) return response([
      { date: "2026-07-20", base: "EUR", quote: "AED", rate: 4.3 },
      { date: "2026-07-20", base: "EUR", quote: "EGP", rate: 58.4 },
      { date: "2026-07-20", base: "EUR", quote: "ETB", rate: 183 },
    ]);
    if (url.includes("api.tgju")) return response({ data: [["2,200,000", "2,000,000", "2,300,000", "2,250,000", "", "", "2026/07/20"]] });
    if (url.includes("coingecko")) return response({
      bitcoin: { eur: 50000, last_updated_at: 1784505600 },
      tether: { eur: 0.875, last_updated_at: 1784505600 },
    });
    return response({}, 404);
  };
  const result = await fetchRateProposals(
    ["GBP", "AED", "IRR", "BTC", "USDT", "BRL", "ZAR", "EGP", "ETB", "IDR"],
    existing,
    fetcher,
    new Date("2026-07-20T12:00:00.000Z"),
  );
  assert.equal(JSON.stringify(existing), before);
  assert.deepEqual(result.unavailable, []);
  assert.equal(result.proposals.find((item) => item.quoteCurrency === "GBP")?.provider, "ECB");
  assert.equal(result.proposals.find((item) => item.quoteCurrency === "AED")?.provider, "Frankfurter");
  for (const currency of ["BRL", "IDR", "ZAR"]) assert.equal(result.proposals.find((item) => item.quoteCurrency === currency)?.provider, "ECB");
  for (const currency of ["EGP", "ETB"]) assert.equal(result.proposals.find((item) => item.quoteCurrency === currency)?.provider, "Frankfurter");
  assert.equal(result.proposals.find((item) => item.quoteCurrency === "AED")?.fallback, true);
  assert.equal(result.proposals.find((item) => item.quoteCurrency === "IRR")?.value, "2250000");
  assert.equal(result.proposals.find((item) => item.quoteCurrency === "BTC")?.value, "0.00002");
  assert.equal(result.proposals.find((item) => item.quoteCurrency === "USDT")?.provider, "CoinGecko");
  assert.ok(urls.every((url) => !/wallet|transaction|note|balance|backup/i.test(url)));
});

test("USDT parity is used only as a clearly marked fallback", async () => {
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes("providers=ECB")) return response([{ date: "2026-07-20", base: "EUR", quote: "USD", rate: 1.2 }]);
    if (url.includes("coingecko")) return response({}, 503);
    return response([]);
  };
  const result = await fetchRateProposals(
    ["USD", "USDT"],
    [],
    fetcher,
    new Date("2026-07-20T12:00:00.000Z"),
  );
  const tether = result.proposals.find((item) => item.quoteCurrency === "USDT");
  assert.equal(tether?.value, "1.2");
  assert.equal(tether?.provider, "USD-parity");
  assert.equal(tether?.fallback, true);
  assert.match(tether?.source ?? "", /1 USDT = 1 USD/);
});

test("invalid primary fiat dates do not prevent a valid fallback", async () => {
  for (const date of ["2026-02-30", "2026-07-21", "2026-07-01"]) {
    const result = await fetchRateProposals(["USD"], [], async input => response([
      { date: String(input).includes("providers=ECB") ? date : "2026-07-17", base: "EUR", quote: "USD", rate: "1.25" },
    ]), new Date("2026-07-20T12:00:00Z"));
    assert.equal(result.proposals[0]?.effectiveDate, "2026-07-17");
    assert.equal(result.proposals[0]?.provider, "Frankfurter");
  }
});

test("complete primary fiat coverage needs no fallback request", async () => {
  const urls: string[] = [];
  const result = await fetchRateProposals(["USD"], [], async input => {
    urls.push(String(input));
    return response([{ date: "2026-07-17", base: "EUR", quote: "USD", rate: "1.25" }]);
  }, new Date("2026-07-20T12:00:00Z"));
  assert.equal(result.proposals.length, 1);
  assert.equal(urls.length, 1);
});

test("USDT parity retains its USD observation date and provenance", async () => {
  const existing: Rate[] = [{ id: "saved-usd", baseCurrency: "EUR", quoteCurrency: "USD", value: "1.25",
    effectiveDate: "2026-07-17", source: "Synthetic USD observation", sourceUrl: "https://example.com/rates",
    method: "manual", locked: true, createdAt: "2026-07-17T00:00:00Z" }];
  const before = JSON.stringify(existing);
  const result = await fetchRateProposals(["USDT"], existing, async () => response({}, 503), new Date("2026-07-20T12:00:00Z"));
  assert.equal(result.proposals[0]?.effectiveDate, "2026-07-17");
  assert.equal(result.proposals[0]?.sourceUrl, "https://example.com/rates");
  assert.match(result.proposals[0]?.source ?? "", /Synthetic USD observation/);
  assert.equal(JSON.stringify(existing), before);
});

test("stale, future, and monthly USD observations cannot become current USDT parity", async () => {
  for (const fields of [{ effectiveDate: "2026-07-01" }, { effectiveDate: "2026-07-21" },
    { effectiveDate: "2026-07-01", granularity: "monthly" as const }]) {
    const existing: Rate[] = [{ id: "saved-usd", baseCurrency: "EUR", quoteCurrency: "USD", value: "1.25",
      source: "Synthetic", method: "reference", createdAt: "2026-07-01T00:00:00Z", ...fields }];
    const now = fields.granularity ? "2026-07-03T12:00:00Z" : "2026-07-20T12:00:00Z";
    const result = await fetchRateProposals(["USDT"], existing, async () => response({}, 503), new Date(now));
    assert.deepEqual(result.proposals, []);
    assert.equal(result.unavailable[0]?.quoteCurrency, "USDT");
  }
});

test("invalid crypto timestamps stay unavailable without discarding other valid quotes", async () => {
  for (const timestamp of [undefined, 0, -1, "broken", 1e20, Date.parse("2026-07-01") / 1000, Date.parse("2026-07-21") / 1000]) {
    const result = await fetchRateProposals(["BTC", "ETH"], [], async () => response({
      bitcoin: { eur: "50000", last_updated_at: timestamp },
      ethereum: { eur: "2500", last_updated_at: 1784505600 },
    }), new Date("2026-07-20T12:00:00Z"));
    assert.deepEqual(result.proposals.map(row => row.quoteCurrency), ["ETH"]);
    assert.equal(result.unavailable[0]?.quoteCurrency, "BTC");
  }
});

test("accepted proposals become new automatic rows only after explicit conversion", () => {
  const item = {
    quoteCurrency: "USD",
    value: "1.234500",
    effectiveDate: "2026-07-20",
    source: "European Central Bank via Frankfurter",
    provider: "ECB" as const,
    fallback: false,
    currentValue: "1.2",
    changePercent: "2.875",
  };
  const row = acceptedProposalRate(item, "accepted-id", "2026-07-20T12:00:00.000Z");
  assert.equal(row.id, "accepted-id");
  assert.equal(row.value, "1.2345");
  assert.equal(row.method, "automatic");
});

test("rate normalization removes EUR self-rates and preserves every historical date", () => {
  const rows: Rate[] = [
    { id: "usd-manual", baseCurrency: "EUR", quoteCurrency: "USD", value: "1", effectiveDate: "2026-07-01", source: "manual", method: "manual", createdAt: "2026-07-01T00:00:00.000Z" },
    { id: "usd-reference", baseCurrency: "EUR", quoteCurrency: "USD", value: "1.14", effectiveDate: "2026-07-15", source: "reference", method: "reference", createdAt: "2026-07-15T00:00:00.000Z" },
    { id: "eur-self", baseCurrency: "EUR", quoteCurrency: "EUR", value: "1", effectiveDate: "2026-07-15", source: "system", method: "system", createdAt: "2026-07-15T00:00:00.000Z" },
  ];
  assert.deepEqual(normalizeRateRows(rows), [rows[0], rows[1]]);
});
