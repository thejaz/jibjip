import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { chartAnalysis, normalizeChartExclusions } from "../packages/core/src/lib/charts.ts";
import { normalizeSeedData } from "../packages/core/src/lib/data-normalization.ts";
import { reportTotal, walletBalance } from "../packages/core/src/lib/finance.ts";
import { parseBackup } from "../packages/core/src/lib/portability.ts";
import { rollingPeriodStart } from "../packages/core/src/lib/dates.ts";
import type { AppSnapshot, Category, Transaction } from "../packages/core/src/lib/types.ts";

function fixture(): AppSnapshot {
  const snapshot = normalizeSeedData(JSON.parse(readFileSync(new URL("../packages/core/assets/data/jibjip-starter-seed.json", import.meta.url), "utf8")));
  const stamp = "2025-01-01T12:00:00.000Z";
  snapshot.wallets = ["a", "b"].map((id) => ({ id, name: `Wallet ${id}`, code: id, currency: id === "a" ? "EUR" : "USD", archived: false, createdAt: stamp }));
  snapshot.categories = ["salary", "food", "temporary"].map((id): Category => ({ id, name: id, group: null, scope: "both", archived: false, templateKey: null, system: false, icon: "tag", color: "#258042", defaultReportable: id !== "temporary" }));
  snapshot.rates = ["2", "4"].map((value, index) => ({ id: `usd-${index}`, baseCurrency: "EUR", quoteCurrency: "USD", value, effectiveDate: index ? "2025-02-01" : "2025-01-01", source: "Synthetic", method: "manual", createdAt: stamp }));
  const row = (id: string, walletId: string, categoryId: string, amount: string, direction: "income" | "expense", date = "2025-01-01"): Transaction => ({ id, walletId, categoryId, category: categoryId, amount, balanceAmount: direction === "expense" ? `-${amount}` : amount, direction, date, currency: walletId === "a" ? "EUR" : "USD", operation: "transaction", note: "", reportable: true, affectsBalance: true, linkId: null, createdAt: stamp, updatedAt: stamp });
  snapshot.transactions = [row("salary-a", "a", "salary", "100", "income"), row("salary-b", "b", "salary", "200", "income"), row("food-a", "a", "food", "40", "expense"), row("food-b", "b", "food", "20", "expense", "2025-02-01"), row("temporary", "a", "temporary", "999", "expense"), { ...row("excluded-row", "a", "food", "50", "expense"), reportable: false }];
  return snapshot;
}
const range = { start: "2025-01-01", end: "2025-03-31", walletIds: ["a", "b"] };

test("rolling periods clamp month ends and leap years without dropping February dates", () => {
  assert.equal(rollingPeriodStart("3m", "2025-05-31"), "2025-02-28");
  assert.equal(rollingPeriodStart("1y", "2024-02-29"), "2023-02-28");
  assert.equal(rollingPeriodStart("30d", "2025-03-01"), "2025-01-31");
});

test("income, spending, months, and wallets reconcile using transaction-date rates", () => {
  const result = chartAnalysis(fixture(), range);
  assert.equal(result.total.income.toString(), "200");
  assert.equal(result.total.expense.toString(), "45");
  assert.equal(result.total.net.toString(), "155");
  assert.equal(result.total.count, 4);
  assert.deepEqual(result.months.map((m) => m.net.toString()), ["160", "-5", "0"]);
  assert.deepEqual([...result.wallets.values()].map((w) => w.net.toString()), ["60", "95"]);
  assert.equal(result.categories.income.get("salary")?.value.toString(), "200");
});

test("chart-only exclusion leaves reports and native balances unchanged; category and row exclusions win", () => {
  const snapshot = fixture();
  const before = JSON.stringify(snapshot.transactions);
  const reportBefore = reportTotal(snapshot.transactions, "expense", "EUR", snapshot.rates).toString();
  const balanceBefore = walletBalance("a", snapshot.transactions).toString();
  snapshot.settings.chartExcludedCategoryIds = ["food"];
  const result = chartAnalysis(snapshot, range);
  assert.equal(result.total.expense.toString(), "0");
  assert.equal(result.total.income.toString(), "200");
  assert.equal(JSON.stringify(snapshot.transactions), before);
  assert.equal(reportTotal(snapshot.transactions, "expense", "EUR", snapshot.rates).toString(), reportBefore);
  assert.equal(walletBalance("a", snapshot.transactions).toString(), balanceBefore);
});

test("wallet and inclusive date filters, invalid ranges, missing, and estimated rates remain consistent", () => {
  const snapshot = fixture();
  assert.equal(chartAnalysis(snapshot, { ...range, walletIds: ["b"], start: "2025-02-01", end: "2025-02-01" }).total.expense.toString(), "5");
  for (const start of ["", "2025-02-30", "2025-04-01"]) assert.equal(chartAnalysis(snapshot, { ...range, start }).validRange, false);
  assert.equal(chartAnalysis(snapshot, { ...range, walletIds: [] }).total.count, 0);
  snapshot.transactions[1].currency = "AUD";
  snapshot.transactions[3].date = "2025-03-01";
  const result = chartAnalysis(snapshot, range);
  assert.deepEqual(result.missing, ["AUD"]);
  assert.deepEqual(result.fallback, ["USD"]);
  assert.equal(result.total.income.toString(), "100");
});

test("split postings count once each and fixed types follow their report setting", () => {
  const snapshot = fixture();
  const first = snapshot.transactions[2];
  first.split = { id: "split", index: 1, count: 2, total: "1039", note: "" };
  snapshot.transactions[4].split = { ...first.split, index: 2 };
  snapshot.transactions.push({ ...first, split: undefined, id: "transfer", categoryId: null, category: "Transfer", operation: "transfer", direction: "out", amount: "10", balanceAmount: "-10" });
  assert.equal(chartAnalysis(snapshot, range).total.expense.toString(), "45");
  snapshot.settings.typeReportability.transfer = true;
  const result = chartAnalysis(snapshot, range);
  assert.equal(result.total.expense.toString(), "55");
  assert.equal(result.categories.expense.get("type:transfer")?.value.toString(), "10");
});

test("Full backups preserve independent exclusions, and older backups default to none", () => {
  const snapshot = fixture();
  snapshot.settings.chartExcludedCategoryIds = ["food"];
  const envelope = { ...snapshot, version: 2, generatedAt: "2025-03-31T12:00:00.000Z", source: { kind: "jibjip-backup", filename: "synthetic.json" } };
  assert.deepEqual(parseBackup(JSON.stringify(envelope)).settings.chartExcludedCategoryIds, ["food"]);
  const legacy = JSON.parse(JSON.stringify(envelope));
  delete legacy.settings.chartExcludedCategoryIds;
  assert.deepEqual(parseBackup(JSON.stringify(legacy)).settings.chartExcludedCategoryIds, []);
  assert.deepEqual(normalizeChartExclusions(["food", "food", false, null, ""]), ["food"]);
});

test("archived wallets remain analyzable and category renames retain stable exclusions", () => {
  const snapshot = fixture();
  snapshot.wallets[1].archived = true;
  snapshot.categories[1].name = "Renamed category";
  snapshot.settings.chartExcludedCategoryIds = ["food"];
  const result = chartAnalysis(snapshot, { ...range, walletIds: ["b"] });
  assert.equal(result.total.income.toString(), "100");
  assert.equal(result.total.expense.toString(), "0");
});

test("long histories use complete yearly buckets without changing totals", () => {
  const result = chartAnalysis(fixture(), { ...range, start: "2000-01-01" });
  assert.equal(result.months.length, 26);
  assert.ok(result.months.every((row) => row.key.length === 4));
  assert.equal(result.months.at(-1)?.net.toString(), result.total.net.toString());
});
