import assert from "node:assert/strict";
import test from "node:test";
import { transactionIndex } from "../packages/core/src/lib/transaction-index.ts";
import { walletBalance, formatMoney, jalaliDate } from "../packages/core/src/lib/finance.ts";
import { groupTransactionActivities } from "../packages/core/src/lib/activity.ts";
import { sortActivities } from "../packages/core/src/lib/activity-query.ts";
import { assertActivityContextUnchanged, type ActivityContext } from "../packages/core/src/lib/transaction-edit.ts";
import type { Rate, Transaction } from "../packages/core/src/lib/types.ts";

function row(id: string, patch: Partial<Transaction> = {}): Transaction {
  return { id, walletId: "wallet", currency: "EUR", date: "2026-01-01", operation: "transaction", direction: "expense",
    categoryId: "food", category: "Food", amount: "0.1", balanceAmount: "-0.1", reportable: true, affectsBalance: true,
    linkId: null, note: "synthetic", createdAt: "2026-01-01T12:00:00Z", updatedAt: "2026-01-01T12:00:00Z", ...patch };
}

function rate(currency: string, date: string, value: string, patch: Partial<Rate> = {}): Rate {
  return { id: `${currency}-${date}`, baseCurrency: "EUR", quoteCurrency: currency, value,
    effectiveDate: date, source: "Synthetic reference", method: "manual", createdAt: "2026-01-01T12:00:00Z", ...patch };
}

const euroSort = { rates: [], currency: "EUR" };

test("shared wallet summaries preserve exact imported deltas, exclusions, counts, and unresolved categories", () => {
  const rows = [row("one"), row("two", { amount: "0.2", balanceAmount: "-0.2" }),
    row("three", { amount: "999", balanceAmount: "0.000000000000000001", direction: "income" }),
    row("excluded", { affectsBalance: false, categoryId: null }),
    row("legacy", { walletId: "legacy", balanceAmount: undefined, direction: "in", amount: "12", operation: "adjustment" })];
  const original = structuredClone(rows);
  assert.equal(walletBalance("wallet", rows).toString(), "-0.299999999999999999");
  assert.equal(walletBalance("legacy", rows).toString(), "12");
  assert.equal(walletBalance("missing", rows).toString(), "0");
  const index = transactionIndex(rows);
  assert.equal(index.walletCounts.get("wallet"), 4);
  assert.equal(index.categoryCounts.get("food"), 3);
  assert.equal(index.unresolvedCategoryCounts.get("food"), 1);
  assert.equal(index.operationCounts.get("adjustment"), 1);
  assert.deepEqual(rows, original);
  assert.equal(walletBalance("wallet", rows.map(r => r.id === "one" ? { ...r, balanceAmount: "-1" } : r)).toString(), "-1.199999999999999999");
});

test("many wallet lookups traverse one immutable snapshot only once", () => {
  let visits = 0;
  const rows = Array.from({ length: 1000 }, (_, i) => {
    const record = row(String(i), { walletId: `wallet-${i % 25}` });
    return new Proxy(record, { get(target, key, receiver) {
      if (key === "walletId") visits++;
      return Reflect.get(target, key, receiver);
    } });
  });
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < 25; i++) assert.equal(walletBalance(`wallet-${i}`, rows).toString(), "-4");
  }
  assert.ok(visits <= rows.length * 4, `Expected one indexing pass, observed ${visits} wallet reads`);
});

test("activity ordering preserves exact decimal amounts, split totals, ties, and input order", () => {
  const rows = [row("a", { amount: "9007199254740992.01" }), row("b", { amount: "9007199254740992.02" }),
    row("c", { date: "2025-12-31", amount: "1" }), row("d", { date: "2026-01-02", amount: "1" })];
  const activities = groupTransactionActivities(rows);
  assert.deepEqual(sortActivities(activities, "amount-low", euroSort).activities.map(a => a.id), ["c", "d", "a", "b"]);
  assert.deepEqual(sortActivities(activities, "amount-high", euroSort).activities.map(a => a.id), ["b", "a", "c", "d"]);
  assert.deepEqual(sortActivities(activities, "oldest", euroSort).activities.map(a => a.id), ["c", "a", "b", "d"]);
  assert.deepEqual(sortActivities(activities, "newest", euroSort).activities.map(a => a.id), ["d", "a", "b", "c"]);
  assert.deepEqual(activities.map(a => a.id), rows.map(r => r.id));
  const split = [row("line-a", { amount: "4", balanceAmount: "-4", split: { id: "split", index: 1, count: 2, total: "12", note: "" } }),
    row("line-b", { amount: "8", balanceAmount: "-8", split: { id: "split", index: 2, count: 2, total: "12", note: "" } })];
  assert.equal(sortActivities(groupTransactionActivities([...split, row("single", { amount: "10" })]), "amount-high", euroSort).activities[0].id, "split:split");
});

test("value ordering compares mixed currencies at each transaction date and reacts to new rates or currency", () => {
  const rows = [row("irr-old", { amount: "10000000", currency: "IRR" }),
    row("irr-new", { amount: "12000000", currency: "IRR", date: "2026-02-01" }),
    row("eur", { amount: "20", date: "2026-02-01" }), row("usd", { amount: "30", currency: "USD" })];
  const rates = [rate("IRR", "2026-01-01", "1000000"), rate("IRR", "2026-02-01", "2000000"),
    rate("USD", "2026-01-01", "2"), rate("USD", "2026-02-01", "1")];
  const before = structuredClone({ rows, rates });
  const activities = groupTransactionActivities(rows);
  const high = sortActivities(activities, "amount-high", { rates, currency: "EUR" });
  assert.deepEqual(high.activities.map(a => a.id), ["eur", "usd", "irr-old", "irr-new"]);
  assert.deepEqual([...high.valuations.values()].map(value => value?.value.toString()), ["10", "6", "20", "15"]);
  assert.deepEqual(sortActivities(activities, "amount-low", { rates, currency: "EUR" }).activities.map(a => a.id),
    ["irr-new", "irr-old", "usd", "eur"]);
  assert.deepEqual(sortActivities(activities, "amount-high", { rates, currency: "USD" }).activities.map(a => a.id),
    ["usd", "eur", "irr-old", "irr-new"]);
  const updatedRates = rates.map(r => r.id === "IRR-2026-01-01" ? { ...r, value: "100000" } : r);
  assert.equal(sortActivities(activities, "amount-high", { rates: updatedRates, currency: "EUR" }).activities[0].id, "irr-old");
  assert.deepEqual({ rows, rates }, before);
});

test("missing conversions stay last in both directions, including a missing reporting-currency rate", () => {
  const activities = groupTransactionActivities([row("missing-large", { amount: "999999999999", currency: "XYZ" }),
    row("small", { amount: "0" }), row("large", { amount: "10" }),
    row("missing-small", { amount: "0.00000001", currency: "ABC" })]);
  const high = sortActivities(activities, "amount-high", euroSort);
  const low = sortActivities(activities, "amount-low", euroSort);
  assert.deepEqual(high.activities.map(a => a.id), ["large", "small", "missing-large", "missing-small"]);
  assert.deepEqual(low.activities.map(a => a.id), ["small", "large", "missing-large", "missing-small"]);
  assert.equal(high.valuations.get("missing-large"), null);
  const missingBase = sortActivities(activities, "amount-low", { rates: [], currency: "XYZ" });
  assert.equal(missingBase.activities[0].id, "missing-large");
  assert.equal(missingBase.valuations.get("large"), null);
});

test("sorting retains monthly and estimated rate quality and skips rate lookup for date sorting", () => {
  const rates = [rate("IRR", "2026-01-01", "1000000", { granularity: "monthly", sampleCount: 20 })];
  const activities = groupTransactionActivities([row("monthly", { amount: "10000000", currency: "IRR", date: "2026-01-20" }),
    row("estimate", { amount: "5000000", currency: "IRR", date: "2026-03-01" }), row("native", { amount: "7" })]);
  const sorted = sortActivities(activities, "amount-high", { rates, currency: "EUR" });
  assert.deepEqual(sorted.activities.map(a => a.id), ["monthly", "native", "estimate"]);
  assert.equal(sorted.valuations.get("monthly")?.quality, "monthly");
  assert.equal(sorted.valuations.get("estimate")?.quality, "estimate");
  const unreadableRates = new Proxy(rates, { get() { throw new Error("Date sorting must not read rates"); } });
  const dates = sortActivities(activities, "oldest", { rates: unreadableRates, currency: "IRR" });
  assert.deepEqual(dates.activities.map(a => a.id), ["native", "monthly", "estimate"]);
  assert.equal(dates.valuations.size, 0);
});

test("value sorting counts split totals and exchange source legs once, without balance-delta or report filters", () => {
  const split = { id: "split", count: 2, total: "24000000", note: "Synthetic payment" };
  const rows = [row("line-a", { amount: "10000000", balanceAmount: "-10000000", currency: "IRR", split: { ...split, index: 1 } }),
    row("line-b", { amount: "14000000", balanceAmount: "-14000000", currency: "IRR", split: { ...split, index: 2 } }),
    row("exchange-out", { amount: "10", operation: "exchange", direction: "out", linkId: "pair", categoryId: null }),
    row("exchange-in", { amount: "90000000", currency: "IRR", walletId: "destination", operation: "exchange", direction: "in", linkId: "pair", categoryId: null }),
    row("ordinary", { amount: "21", currency: "USD", balanceAmount: "-999", reportable: false })];
  const activities = groupTransactionActivities(rows);
  const rates = [rate("IRR", "2026-01-01", "2000000"), rate("USD", "2026-01-01", "2")];
  const before = structuredClone({ rows, rates });
  const result = sortActivities(activities, "amount-high", { rates, currency: "EUR" });
  assert.deepEqual(result.activities.map(a => a.id), ["split:split", "ordinary", "exchange:pair"]);
  assert.equal(result.valuations.get("split:split")?.value.toString(), "12");
  assert.equal(result.valuations.get("exchange:pair")?.value.toString(), "10");
  assert.deepEqual({ rows, rates }, before);
});

test("malformed exchange links keep every posting visible", () => {
  const outgoing = row("out", { operation: "exchange", direction: "out", linkId: "exchange", categoryId: null });
  const incoming = row("in", { operation: "exchange", direction: "in", linkId: "exchange", categoryId: null, walletId: "other", currency: "USD" });
  assert.equal(groupTransactionActivities([outgoing, incoming]).length, 1);
  for (const rows of [
    [outgoing, incoming, { ...incoming, id: "extra" }],
    [outgoing, { ...incoming, walletId: outgoing.walletId }],
    [outgoing, { ...incoming, currency: outgoing.currency }],
    [outgoing, { ...incoming, date: "2026-02-01" }],
  ]) {
    const activities = groupTransactionActivities(rows);
    assert.equal(activities.length, rows.length);
    assert.deepEqual(activities.flatMap(a => a.rows.map(r => r.id)).sort(), rows.map(r => r.id).sort());
  }
});

test("formatter reuse preserves Latin digits, locale, currency precision, and Jalali numbering", () => {
  for (const locale of ["en", "fa"]) {
    for (const currency of ["EUR", "USD", "JPY"]) {
      const digits = currency === "JPY" ? 0 : 2;
      const expected = new Intl.NumberFormat(locale, { numberingSystem: "latn", style: "currency", currency,
        notation: "standard", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(1234.56);
      assert.equal(formatMoney("1234.56", currency, false, "IRR", locale), expected);
      assert.equal(formatMoney("1234.56", currency, false, "IRR", locale), expected);
    }
    assert.match(formatMoney("12345", "IRR", false, "TMN", locale), /1,234\.5 TMN/);
  }
  assert.match(jalaliDate("2026-01-01", "fa"), /[0-9]/);
  assert.doesNotMatch(jalaliDate("2026-01-01", "fa", "arabext"), /[0-9]/);
});

test("draft context tolerates presentation changes but rejects changes that reinterpret or overwrite financial data", () => {
  const context = { wallets: [{ id: "wallet", currency: "IRR" }], categories: [{ id: "category", name: "Food" }],
    settings: { irrDisplayUnit: "TMN", typeReportability: { transfer: false, exchange: false, adjustment: false }, locale: "en" } } as ActivityContext;
  assert.doesNotThrow(() => assertActivityContextUnchanged(context, structuredClone(context)));
  assert.doesNotThrow(() => assertActivityContextUnchanged(context, { ...context, settings: { ...context.settings, locale: "fa" } }));
  assert.throws(() => assertActivityContextUnchanged(context, { ...context, settings: { ...context.settings, irrDisplayUnit: "IRR" } }));
  assert.throws(() => assertActivityContextUnchanged(context, { ...context, wallets: [] }));
  assert.throws(() => assertActivityContextUnchanged(context, { ...context, categories: context.categories.map(c => ({ ...c, name: "Changed" })) }));
});
