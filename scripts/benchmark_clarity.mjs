import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { clarityProgress, clarityReviewContext, completeClarityReview, normalizeClarity } from "../packages/core/src/lib/clarity.ts";

const day = "2026-10-17";
const wallet = { id: "synthetic", name: "Synthetic", currency: "EUR", code: "main", archived: false, createdAt: "2026-01-01T00:00:00Z" };
const baseline = { id: "one", walletId: wallet.id, currency: "EUR", amount: "0.1", balanceAmount: "-0.1", operation: "transaction", direction: "expense", categoryId: null, category: "Synthetic", affectsBalance: true, reportable: true, linkId: null, note: "Synthetic", date: day, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
for (const size of [10_000, 100_000]) {
  const snapshot = { transactions: Array.from({ length: size }, (_, i) => ({ ...baseline, id: String(i), walletId: i % 10 === 0 ? wallet.id : "other", date: i < 100 ? day : "2025-01-01" })), wallets: [wallet], categories: [] };
  const before = process.memoryUsage().heapUsed;
  const started = performance.now();
  const context = clarityReviewContext(snapshot, "transactions", null, day);
  const result = completeClarityReview({ enabled: true, awards: [] }, context, snapshot, new Date(`${day}T12:00:00`));
  assert.equal(result.awarded, true);
  assert.equal(clarityProgress(result.state, day).total, 10);
  const balanceContext = clarityReviewContext(snapshot, "balance", wallet.id, day);
  const balance = completeClarityReview(result.state, balanceContext, snapshot, new Date(`${day}T12:00:00`));
  assert.equal(balance.awarded, true);
  console.log(JSON.stringify({ syntheticTransactions: size, elapsedMs: +(performance.now() - started).toFixed(2), heapDeltaMiB: +((process.memoryUsage().heapUsed - before) / 1048576).toFixed(2) }));
}
const awards = [];
const monday = new Date("1990-01-01T12:00:00Z");
for (let week = 0; week < 52 * 40; week++) {
  for (const task of ["transactions", "categories", "balance"]) awards.push({ period: monday.toISOString().slice(0, 10), task, completedAt: monday.toISOString() });
  monday.setUTCDate(monday.getUTCDate() + 7);
}
const started = performance.now();
const state = normalizeClarity({ enabled: false, awards: [...awards, ...awards] });
assert.equal(state.awards.length, awards.length);
assert.equal(state.enabled, false);
assert.equal(clarityProgress(state, day).total, awards.length * 10);
console.log(JSON.stringify({ syntheticHistoryYears: 40, uniqueAwards: awards.length, elapsedMs: +(performance.now() - started).toFixed(2) }));
