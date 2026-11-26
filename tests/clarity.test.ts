import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { CLARITY_TASKS, clarityProgress, clarityReviewContext, clarityReviewRows, clarityWeek, completeClarityReview, normalizeClarity, type ClarityState } from "../packages/core/src/lib/clarity.ts";
import { normalizeSeedData } from "../packages/core/src/lib/data-normalization.ts";
import { parseBackup, parseTransactionCsv } from "../packages/core/src/lib/portability.ts";
import type { AppSnapshot, Transaction } from "../packages/core/src/lib/types.ts";

const now = new Date("2026-10-17T12:00:00");
const day = "2026-10-17";
const state = (): ClarityState => ({ enabled: true, awards: [] });
function fixture(): AppSnapshot {
  const snapshot = normalizeSeedData(JSON.parse(readFileSync(new URL("../packages/core/assets/data/jibjip-starter-seed.json", import.meta.url), "utf8")));
  snapshot.wallets = [{ id: "main", name: "Everyday", code: "main", currency: "EUR", archived: false, createdAt: now.toISOString() }];
  snapshot.categories = [{ id: "other", name: "Other Expenses", group: "Other", scope: "expense", archived: false, templateKey: "other-expenses", system: true, color: "#938878", icon: "receipt", defaultReportable: true }];
  snapshot.transactions = [{ id: "payment", walletId: "main", date: day, currency: "EUR", amount: "12", balanceAmount: "-12", operation: "transaction", direction: "expense", categoryId: "other", category: "Other Expenses", note: "Synthetic", affectsBalance: true, reportable: true, linkId: null, createdAt: now.toISOString(), updatedAt: now.toISOString() }];
  return snapshot;
}

test("week boundaries use local Mondays across years and leap dates", () => {
  for (const [date, monday] of [["2026-10-18", "2026-10-12"], ["2026-10-19", "2026-10-19"], ["2027-01-01", "2026-12-28"], ["2024-02-29", "2024-02-26"]]) assert.equal(clarityWeek(date), monday);
});

test("new and missing settings enable Clarity without inventing points; saved opt-outs survive", () => {
  for (const value of [undefined, null, {}, { enabled: "false" }]) {
    assert.deepEqual(normalizeClarity(value), { enabled: true, awards: [] });
  }
  assert.deepEqual(fixture().settings.clarity, { enabled: true, awards: [] });
  assert.deepEqual(normalizeClarity({ enabled: false, awards: [] }), { enabled: false, awards: [] });
});

test("only three explicit reviews earn 30 weekly points; repeated calls and toggles cannot add more", () => {
  const snapshot = fixture();
  const before = JSON.stringify(snapshot);
  let current = state();
  for (const task of CLARITY_TASKS) {
    const context = clarityReviewContext(snapshot, task, "main", day);
    const first = completeClarityReview(current, context, snapshot, now);
    assert.equal(first.awarded, true);
    current = first.state;
    assert.equal(completeClarityReview(current, context, snapshot, now).awarded, false);
    current = { ...current, enabled: false };
    assert.throws(() => completeClarityReview(current, context, snapshot, now));
    current.enabled = true;
    assert.equal(completeClarityReview(current, context, snapshot, now).awarded, false);
  }
  assert.deepEqual(clarityProgress(current, day), { total: 30, weekly: 30, completed: ["balance", "categories", "transactions"] });
  assert.equal(JSON.stringify(snapshot), before);
  const next = completeClarityReview(current, clarityReviewContext(snapshot, "transactions", null, "2026-10-19"), snapshot, new Date("2026-10-19T12:00:00"));
  assert.equal(clarityProgress(next.state, "2026-10-19").weekly, 10);
  assert.equal(clarityProgress(next.state, "2026-10-19").total, 40);
  assert.equal(completeClarityReview(next.state, clarityReviewContext(snapshot, "transactions", null, day), snapshot, now).awarded, false);
});

test("edits, deletions, and imports invalidate pending reviews but never recreate earned awards", () => {
  for (const mutation of [
    (snapshot: AppSnapshot) => { snapshot.transactions[0].amount = "13"; },
    (snapshot: AppSnapshot) => { snapshot.transactions = []; },
    (snapshot: AppSnapshot) => { snapshot.transactions.push({ ...snapshot.transactions[0], id: "imported" }); },
  ]) {
    const snapshot = fixture();
    const context = clarityReviewContext(snapshot, "transactions", null, day);
    const earned = completeClarityReview(state(), context, snapshot, now).state;
    mutation(snapshot);
    assert.throws(() => completeClarityReview(state(), context, snapshot, now), /changed/);
    assert.equal(completeClarityReview(earned, clarityReviewContext(snapshot, "transactions", null, day), snapshot, now).awarded, false);
    assert.equal(clarityProgress(earned, day).total, 10);
  }
});

test("category and wallet edits reject stale reviews; stale local dates cannot claim another week", () => {
  const snapshot = fixture();
  const category = clarityReviewContext(snapshot, "categories", null, day);
  snapshot.categories[0].name = "Changed";
  assert.throws(() => completeClarityReview(state(), category, snapshot, now));
  const balance = clarityReviewContext(snapshot, "balance", "main", day);
  snapshot.wallets[0].currency = "USD";
  assert.throws(() => completeClarityReview(state(), balance, snapshot, now));
  snapshot.wallets[0].archived = true;
  assert.throws(() => clarityReviewContext(snapshot, "balance", "main", day));
  assert.throws(() => completeClarityReview(state(), category, snapshot, new Date("2026-10-19T12:00:00")));
});

test("quiet weeks and valid Other categories are eligible; split size and transaction volume do not affect points", () => {
  const snapshot = fixture();
  const category = completeClarityReview(state(), clarityReviewContext(snapshot, "categories", null, day), snapshot, now);
  assert.equal(clarityProgress(category.state, day).total, 10);
  snapshot.transactions = [];
  assert.equal(completeClarityReview(state(), clarityReviewContext(snapshot, "transactions", null, day), snapshot, now).awarded, true);
  snapshot.transactions = Array.from({ length: 500 }, (_, index) => ({ id: String(index), walletId: "main", date: day }) as Transaction);
  assert.equal(clarityProgress(completeClarityReview(state(), clarityReviewContext(snapshot, "transactions", null, day), snapshot, now).state, day).total, 10);
});

test("Full restore replaces the award ledger, deduplicates entries, and never stacks totals; CSV carries no awards", () => {
  const snapshot = fixture();
  const earned = completeClarityReview(state(), clarityReviewContext(snapshot, "transactions", null, day), snapshot, now).state;
  const envelope = { ...snapshot, version: 2, generatedAt: now.toISOString(), source: { filename: "synthetic.json", kind: "jibjip-backup" }, settings: { ...snapshot.settings, clarity: { ...earned, awards: [...earned.awards, ...earned.awards] } } };
  const restored = parseBackup(JSON.stringify(envelope));
  assert.equal(clarityProgress(restored.settings.clarity, day).total, 10);
  assert.deepEqual(parseBackup(JSON.stringify(envelope)).settings.clarity, restored.settings.clarity);
  const disabled = parseBackup(JSON.stringify({ ...envelope, settings: { ...envelope.settings, clarity: { ...earned, enabled: false } } }));
  assert.deepEqual(disabled.settings.clarity, { ...earned, enabled: false });
  const older = { ...envelope, settings: { ...envelope.settings } };
  delete (older.settings as Partial<typeof older.settings>).clarity;
  assert.deepEqual(parseBackup(JSON.stringify(older)).settings.clarity, { enabled: true, awards: [] });
  assert.deepEqual(restored.transactions, snapshot.transactions);
  const parsed = parseTransactionCsv("Date,Wallet,Operation,Direction,Category,Amount,Currency,Note\n2026-10-17,main,transaction,expense,Other Expenses,5,EUR,Synthetic", snapshot.wallets, snapshot.categories);
  assert.equal(Object.hasOwn(parsed, "settings"), false);
  assert.equal(clarityProgress(earned, day).total, 10);
});

test("invalid and duplicate awards cannot inflate the derived score", () => {
  const award = { period: "2026-10-12", task: "transactions", completedAt: now.toISOString() };
  const input = { enabled: true, total: 99999, awards: [award, award, null, { ...award, task: "unknown" }, { ...award, period: "2026-02-30" }, { ...award, period: "2026-10-13" }] };
  assert.equal(clarityProgress(input, day).total, 10);
});

test("category reviews cover ordinary income/expense only and share their visible scope with stale checks", () => {
  const snapshot = fixture();
  const movement = { ...snapshot.transactions[0], id: "movement", categoryId: null, category: "Transfer", operation: "transfer", direction: "out" } as Transaction;
  snapshot.transactions.push(movement);
  const context = clarityReviewContext(snapshot, "categories", null, day);
  assert.deepEqual(clarityReviewRows(snapshot, "categories", null, day).map(row => row.id), ["payment"]);
  assert.equal(clarityReviewRows(snapshot, "transactions", null, day).length, 2);
  movement.amount = "999";
  assert.equal(completeClarityReview(state(), context, snapshot, now).awarded, true);
  snapshot.transactions[0].category = "Changed category";
  assert.throws(() => completeClarityReview(state(), context, snapshot, now));
  snapshot.transactions = [movement];
  assert.equal(clarityReviewRows(snapshot, "categories", null, day).length, 0);
  assert.equal(completeClarityReview(state(), clarityReviewContext(snapshot, "categories", null, day), snapshot, now).awarded, true);
});

test("review bounds exclude future/older entries while balance reviews retain the complete selected wallet", () => {
  const snapshot = fixture();
  const row = snapshot.transactions[0];
  snapshot.transactions.push({ ...row, id: "older", date: "2026-10-11" }, { ...row, id: "future", date: "2026-10-18" }, { ...row, id: "another-wallet", walletId: "elsewhere" });
  assert.deepEqual(clarityReviewRows(snapshot, "transactions", null, day).map(row => row.id), ["payment", "another-wallet"]);
  assert.deepEqual(clarityReviewRows(snapshot, "balance", "main", day).map(row => row.id), ["payment", "older", "future"]);
  const context = clarityReviewContext(snapshot, "balance", "main", day);
  snapshot.transactions.find(row => row.id === "older")!.amount = "50";
  assert.throws(() => completeClarityReview(state(), context, snapshot, now));
});
