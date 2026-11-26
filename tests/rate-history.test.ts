import assert from "node:assert/strict";
import test from "node:test";
import { convertWithRateFallback, netWorth, walletBalance } from "../packages/core/src/lib/finance.ts";
import { fetchRateHistory, monthlyAverages, parseTgjuHistory, planRateUpdates, rateId, resolveRate, validRate } from "../packages/core/src/lib/rate-history.ts";
import { parseBackup } from "../packages/core/src/lib/portability.ts";
import { mergeOfflineBaselineRates } from "../packages/core/src/lib/rates.ts";
import type { AppSnapshot, Rate, Transaction } from "../packages/core/src/lib/types.ts";

const timestamp = "2024-03-15T00:00:00.000Z";
const row = (date: string, value: string, extra: Partial<Rate> = {}): Rate => ({ id: rateId("USD", date), baseCurrency: "EUR", quoteCurrency: "USD", effectiveDate: date, value, method: "automatic", source: "Synthetic reference", createdAt: timestamp, ...extra });

test("present-day wallet valuation can advance its date without changing balances or saved rates", () => {
  const snapshot = { wallets: [{id: "synthetic-usd", currency: "USD", archived: false}],
    transactions: [{id: "synthetic-income", walletId: "synthetic-usd", currency: "USD", amount: "100", balanceAmount: "100", affectsBalance: true, direction: "income"}],
    rates: [row("2024-03-14", "2"), row("2024-03-15", "4")], settings: {reportingCurrency: "EUR"} } as AppSnapshot;
  const before = JSON.stringify(snapshot);
  assert.equal(netWorth(snapshot, "2024-03-14").value.toString(), "50");
  assert.equal(netWorth(snapshot, "2024-03-15").value.toString(), "25");
  assert.equal(JSON.stringify(snapshot), before);
});

test("gap estimates use the most recent covered period, including monthly-only history", () => {
  const monthly = row("2024-01-01", "3", { id: "monthly", granularity: "monthly" });
  const rows = [row("2023-06-01", "1"), row("2024-01-05", "2"), monthly];
  assert.equal(resolveRate(rows, "USD", "2024-02-10")?.rate.value, "3");
  assert.equal(resolveRate(rows, "USD", "2024-02-10")?.quality, "estimate");
  assert.equal(resolveRate([...rows, row("2024-02-09", "4")], "USD", "2024-02-10")?.rate.value, "4");
  assert.equal(resolveRate([monthly], "USD", "2024-01-15")?.quality, "monthly");
});

test("different incoming dates cannot reuse one database id and silently overwrite history", () => {
  assert.throws(() => planRateUpdates([], [row("2024-01-01", "2", { id: "duplicate" }), row("2024-01-02", "3", { id: "duplicate" })]));
});

test("daily, previous trading day, monthly, and estimates are selected and disclosed", () => {
  const rows = [row("2024-01-05", "2"), row("2024-01-01", "3", { id: "monthly", granularity: "monthly" }), row("2024-03-10", "4")];
  assert.equal(resolveRate(rows, "USD", "2024-01-05")?.quality, "daily");
  assert.equal(resolveRate(rows, "USD", "2024-01-07")?.rate.value, "2");
  assert.equal(resolveRate(rows, "USD", "2024-01-07")?.quality, "previous");
  assert.equal(resolveRate(rows, "USD", "2024-01-20")?.quality, "monthly");
  assert.equal(resolveRate(rows, "USD", "2024-02-01")?.quality, "estimate");
  assert.equal(resolveRate(rows, "USD", "2023-12-01")?.quality, "estimate");
  assert.equal(resolveRate(rows, "GBP", "2024-01-05"), null);
});

test("cross-currency conversions use both currencies on the transaction date, without changing postings", () => {
  const rows = [row("2024-01-05", "2"), row("2024-01-05", "100000", { id: "irr", quoteCurrency: "IRR" }), row("2024-03-10", "4")];
  assert.equal(convertWithRateFallback("100000", "IRR", "USD", rows, "2024-01-05")?.value.toString(), "2");
  assert.equal(convertWithRateFallback("2", "USD", "IRR", rows, "2024-01-05")?.value.toString(), "100000");
  const transaction = { id: "t", walletId: "w", amount: "10", balanceAmount: "-7", affectsBalance: true, currency: "USD", date: "2024-01-05", direction: "expense" } as Transaction;
  const before = JSON.stringify(transaction);
  convertWithRateFallback(transaction.amount, transaction.currency, "EUR", rows, transaction.date);
  assert.equal(walletBalance("w", [transaction]).toString(), "-7");
  assert.equal(JSON.stringify(transaction), before);
});

test("history append, refresh, and re-fetch protect manual and locked dates", () => {
  const rows = [row("2024-01-01", "2", { locked: true }), row("2024-01-02", "3", { method: "manual" }), row("2024-01-03", "4")];
  const input = [row("2024-01-01", "9"), row("2024-01-02", "9"), row("2024-01-03", "5"), row("2024-01-04", "6")];
  const plan = planRateUpdates(rows, input);
  assert.equal(plan.protectedCount, 2); assert.equal(plan.puts.length, 2);
  assert.equal(planRateUpdates([...rows.slice(0, 2), ...plan.puts], input).puts.length, 0);
  assert.equal(planRateUpdates(rows, [row("2024-01-01", "7", { method: "manual", locked: true })], false).puts[0].value, "7");
  assert.throws(() => planRateUpdates(rows, [row("2024-01-04", "6", { id: rows[0].id })]));
  assert.throws(() => planRateUpdates(rows, [input[0], input[0]]));
  assert.equal(mergeOfflineBaselineRates(rows).filter(r => r.quoteCurrency === "USD").length, 3);
});

test("invalid dates, periods, precision, and values cannot enter the history", () => {
  assert.equal(validRate(row("2024-02-30", "2")), false);
  assert.equal(validRate(row("2024-02-02", "2", { granularity: "monthly" })), false);
  for (const value of ["0", "-1", "NaN", "Infinity"]) assert.equal(validRate(row("2024-02-01", value)), false);
  const tiny = row("2024-02-01", "0.00000000000000000123456789");
  assert.equal(planRateUpdates([], [tiny]).puts[0].value, tiny.value);
});

test("TGJU uses the close and recorded Gregorian date, and rejects incomplete or conflicting archives", () => {
  const data = [["100", "90", "130", "120", "", "", "2024/01/01", "1402/10/11"]];
  assert.equal(parseTgjuHistory({ recordsTotal: 1, data }, timestamp)[0].value, "120");
  assert.equal(parseTgjuHistory({ recordsTotal: 1, data }, timestamp)[0].effectiveDate, "2024-01-01");
  assert.throws(() => parseTgjuHistory({ recordsTotal: 2, data }, timestamp));
  assert.throws(() => parseTgjuHistory({ recordsTotal: 2, data: [...data, ["100", "90", "130", "125", "", "", "2024/01/01"]] }, timestamp));
  const diagnostics = { rejected: 0 };
  assert.equal(parseTgjuHistory({ recordsTotal: 2, data: [...data, ["100", "90", "130", "140", "", "", "2024/01/02"]] }, timestamp, diagnostics).length, 1);
  assert.equal(diagnostics.rejected, 1);
});

test("monthly averages are exact sampled means with bounded coverage, never incomplete current months", () => {
  const rows = Array.from({ length: 31 }, (_, index) => row(`2024-01-${String(index + 1).padStart(2, "0")}`, index % 2 ? "2" : "1"));
  assert.equal(monthlyAverages(rows, "2024-01-31").length, 0);
  const monthly = monthlyAverages(rows, "2024-02-01")[0];
  assert.equal(monthly.sampleCount, 31); assert.equal(monthly.granularity, "monthly");
  assert.equal(monthly.value, "1.4838709677419354839");
  assert.equal(monthlyAverages(rows.slice(0, 5), "2024-02-01").length, 0);
});

test("fetching requests only public whole-year series, validates boundaries, and reports unsupported crypto", async () => {
  const urls: string[] = [];
  const result = await fetchRateHistory(["USD", "BTC"], "2024-01-05", "2024-01-20", {
    now: new Date(timestamp), fetcher: async (input, init) => {
      const url = String(input); urls.push(url);
      assert.equal(init?.credentials, "omit"); assert.equal(init?.referrerPolicy, "no-referrer");
      return new Response(JSON.stringify([{ date: "2024-01-05", base: "EUR", quote: "USD", rate: 2 }]));
    },
  });
  assert.equal(result.rows.length, 1); assert.deepEqual(result.unavailable, ["BTC"]);
  assert.ok(urls[0].includes("from=2024-01-01")); assert.ok(!urls[0].includes("2024-01-05"));
  await assert.rejects(fetchRateHistory(["USD"], "2024-02-30", "2024-03-10"));
});

test("native V2 backups retain old and new observations, provenance, locks, and exact values", () => {
  const rates = [row("2024-01-01", "1.234567890123456789", { method: "manual", locked: true }), row("2024-02-01", "2", { granularity: "monthly", sourceUrl: "https://example.com/rates", sampleCount: 20 })];
  const data = { version: 2, source: { kind: "jibjip-backup", filename: "synthetic.json" }, generatedAt: timestamp,
    currencies: [], wallets: [], categories: [], transactions: [], uncharted: [], rates, settings: { setupState: "uninitialized" } };
  assert.deepEqual(parseBackup(JSON.stringify(data)).rates, rates);
  assert.throws(() => parseBackup(JSON.stringify({ ...data, rates: [...rates, { ...rates[0], id: "duplicate" }] })));
});
