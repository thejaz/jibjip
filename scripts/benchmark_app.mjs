// Reproducible synthetic workload. Reports timings; never opens a browser database.
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import Decimal from "decimal.js";
import { walletBalance, formatMoney } from "../packages/core/src/lib/finance.ts";
import { groupTransactionActivities } from "../packages/core/src/lib/activity.ts";
import { sortActivities } from "../packages/core/src/lib/activity-query.ts";
import { activityAmount } from "../packages/core/src/lib/splits.ts";
import { transactionIndex } from "../packages/core/src/lib/transaction-index.ts";

const records = Array.from({ length: 20000 }, (_, i) => ({
  id: `synthetic-${i}`, walletId: `wallet-${i % 100}`, operation: "transaction", direction: "expense",
  currency: "EUR", categoryId: "category", category: "Synthetic", amount: `${1 + ((i * 7919) % 10000)}.01`,
  balanceAmount: `-${1 + ((i * 7919) % 10000)}.01`, affectsBalance: true, reportable: true,
  date: "2026-01-01", updatedAt: "2026-01-01T12:00:00Z", linkId: null,
}));
const wallets = Array.from({ length: 100 }, (_, i) => `wallet-${i}`);
function measure(work) {
  const times = [];
  let result;
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    result = work();
    times.push(performance.now() - start);
  }
  return { milliseconds: Number(times.sort((a, b) => a - b)[2].toFixed(2)), result };
}
function report(name, before, after) {
  assert.deepEqual(after.result, before.result);
  console.log(`${name}: before ${before.milliseconds} ms; after ${after.milliseconds} ms (median of 5, identical results).`);
}
const oldWallets = measure(() => wallets.map(id => records.reduce((total, row) => row.walletId === id && row.affectsBalance ? total.plus(row.balanceAmount) : total, new Decimal(0)).toString()));
const newWallets = measure(() => {
  // Include building a fresh index, not just warm cache lookups.
  const snapshot = [...records];
  return wallets.map(id => walletBalance(id, snapshot).toString());
});
report("20,000 postings / 100 wallet balances", oldWallets, newWallets);
const activities = groupTransactionActivities(records);
const oldSort = measure(() => [...activities].sort((a, b) => new Decimal(activityAmount(a.rows)).abs().comparedTo(new Decimal(activityAmount(b.rows)).abs()) || a.id.localeCompare(b.id)).map(a => a.id));
const newSort = measure(() => sortActivities(activities, "amount-low", { rates: [], currency: "EUR" }).activities.map(a => a.id));
report("20,000 activity amount sort", oldSort, newSort);
const amounts = records.slice(0, 500).map(row => row.amount);
const oldFormat = measure(() => amounts.map(value => new Intl.NumberFormat("fa", { numberingSystem: "latn", style: "currency", currency: "EUR", notation: "standard", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))));
const newFormat = measure(() => amounts.map(value => formatMoney(value, "EUR", false, "IRR", "fa")));
report("500 Persian money labels", oldFormat, newFormat);

// Archived items with no history force the old per-item scan to traverse every row.
const archivedRows = Array.from({ length: 100000 }, (_, i) => ({ ...records[i % records.length], id: `archive-${i}` }));
const archivedWallets = Array.from({ length: 100 }, (_, i) => `wallet-${i}`);
const archivedCategories = Array.from({ length: 100 }, (_, i) => i ? `unused-${i}` : "category");
const previousChoices = measure(() => ({
  wallets: archivedWallets.filter(id => archivedRows.some(row => row.walletId === id)),
  categories: archivedCategories.filter(id => archivedRows.some(row => row.categoryId === id)),
}));
const indexedChoices = measure(() => {
  const index = transactionIndex([...archivedRows]);
  return { wallets: archivedWallets.filter(id => index.walletCounts.has(id)), categories: archivedCategories.filter(id => index.categoryCounts.has(id)) };
});
report("100,000 postings / archived Charts choices (fresh index)", previousChoices, indexedChoices);
transactionIndex(archivedRows);
const cachedChoices = measure(() => {
  const index = transactionIndex(archivedRows);
  return { wallets: archivedWallets.filter(id => index.walletCounts.has(id)), categories: archivedCategories.filter(id => index.categoryCounts.has(id)) };
});
report("100,000 postings / archived Charts choices (shared index)", previousChoices, cachedChoices);
