import assert from "node:assert/strict";
import test from "node:test";
import { attachSplit, buildSplitRows, splitGroups, activityAmount } from "../packages/core/src/lib/splits.ts";
import { groupTransactionActivities } from "../packages/core/src/lib/activity.ts";
import { parseBackup, parseTransactionCsv, transactionCsv } from "../packages/core/src/lib/portability.ts";
import { categoriesForLocale, BUILT_IN_CURRENCIES } from "../packages/core/src/lib/catalogs.ts";
import { amountForStorage, reportTotal, walletBalance } from "../packages/core/src/lib/finance.ts";
import type { Transaction, Wallet } from "../packages/core/src/lib/types.ts";

const categories = categoriesForLocale("en");
const wallet: Wallet = { id: "w", name: "Test wallet", code: "test", currency: "EUR", archived: false, createdAt: "2026-01-01" };
const personal = categories.find(c => c.templateKey === "groceries")!;
const temporary = categories.find(c => c.templateKey === "temporary-advances")!;
const base = () => buildSplitRows({ id: "s", date: "2026-01-02", walletId: wallet.id, currency: "EUR", direction: "expense", total: "0.3", note: 'Payment, "test"\nsecond line', timestamp: "2026-01-02T00:00:00Z", lines: [
  { id: "a", amount: "0.1", note: "  Keep whitespace  ", category: personal },
  { id: "b", amount: "0.2", note: "Someone else's part", category: temporary },
] });

test("one split activity counts exact postings once; temporary lines remain out of reports", () => {
  const rows = base();
  assert.equal(groupTransactionActivities(rows).length, 1);
  assert.equal(activityAmount(rows), "0.3");
  assert.equal(walletBalance(wallet.id, rows).toString(), "-0.3");
  assert.equal(reportTotal(rows, "expense", "EUR", []).toString(), "0.1");
});

test("attaching approved records changes grouping only, not identities or financial history", () => {
  const rows = base().map(row => { const copy = { ...row }; delete copy.split; return copy; });
  const grouped = attachSplit(rows, "migration", "0.3");
  grouped.forEach((row, i) => { const copy = { ...row }; delete copy.split; assert.deepEqual(copy, rows[i]); });
  assert.deepEqual(attachSplit(grouped, "migration", "0.3"), grouped);
});

test("CSV round trip retains grouping, exact amounts, multiline notes, and reporting flags with fresh IDs", () => {
  const rows = base();
  const csv = transactionCsv(rows, [wallet]);
  const first = parseTransactionCsv(csv, [wallet], categories).transactions;
  const second = parseTransactionCsv(csv, [wallet], categories).transactions;
  assert.notEqual(first[0].split!.id, rows[0].split!.id);
  assert.notEqual(first[0].split!.id, second[0].split!.id);
  assert.equal(first[0].split!.id, first[1].split!.id);
  for (let i = 0; i < rows.length; i++) {
    for (const field of ["amount", "balanceAmount", "currency", "date", "note", "reportable", "categoryId", "affectsBalance"] as const) assert.equal(first[i][field], rows[i][field]);
    assert.equal(first[i].split!.note, rows[i].split!.note);
  }
  assert.equal(groupTransactionActivities(first).length, 1);
});

test("native Full backup restores complete splits and rejects missing parts", () => {
  const envelope = { version: 2, generatedAt: "2026-01-02", source: { kind: "jibjip-backup" }, currencies: BUILT_IN_CURRENCIES,
    wallets: [wallet], categories, rates: [], transactions: base(), uncharted: [], settings: {} };
  assert.deepEqual(parseBackup(JSON.stringify(envelope)).transactions, envelope.transactions);
  assert.throws(() => parseBackup(JSON.stringify({ ...envelope, transactions: base().slice(0, 1) })));
});

test("CSV split text is guarded without changing notes, totals, signed deltas, or numeric metadata", () => {
  const originals = base().map((row, index) => ({ ...row, note: index ? "'literal line" : "\u200B=2+2",
    split: { ...row.split!, id: "=split-id", note: "\t=common-note" } }));
  const csv = transactionCsv(originals, [wallet]);
  assert.ok(csv.includes('"\'=split-id"'));
  assert.ok(csv.includes('"\'\t=common-note"'));
  assert.ok(csv.includes('"-0.1"'));
  assert.ok(csv.includes('"1","2","0.3"'));
  const restored = parseTransactionCsv(csv, [wallet], categories).transactions;
  assert.equal(groupTransactionActivities(restored).length, 1);
  assert.equal(restored[0].split!.note, originals[0].split.note);
  for (let index = 0; index < originals.length; index++) {
    assert.equal(restored[index].note, originals[index].note);
    assert.equal(restored[index].amount, originals[index].amount);
    assert.equal(restored[index].balanceAmount, originals[index].balanceAmount);
    assert.equal(restored[index].split!.index, originals[index].split.index);
    assert.equal(restored[index].split!.count, originals[index].split.count);
    assert.equal(restored[index].split!.total, originals[index].split.total);
  }
});

test("incomplete CSV splits and partial export fail instead of flattening", () => {
  const csv = transactionCsv(base(), [wallet]);
  // Notes contain newlines, so remove the entire last quoted record by its date marker.
  const cut = csv.lastIndexOf('\r\n"2026-01-02"');
  assert.throws(() => parseTransactionCsv(csv.slice(0, cut), [wallet], categories));
  assert.throws(() => transactionCsv(base().slice(0, 1), [wallet]));
});

test("reject inconsistent metadata, repeated line numbers, mixed wallets, and incorrect signed deltas", () => {
  const changes: ((row: Transaction) => void)[] = [
    r => { r.walletId = "other"; }, r => { r.date = "2026-02-01"; }, r => { r.currency = "IRR"; },
    r => { r.direction = "income"; }, r => { r.balanceAmount = "0.2"; }, r => { r.amount = "0"; },
    r => { r.operation = "exchange"; }, r => { r.linkId = "link"; }, r => { r.affectsBalance = false; },
    r => { r.split!.index = 1; }, r => { r.split!.count = 3; }, r => { r.split!.total = "0.4"; },
    r => { r.split!.note = "inconsistent"; }, r => { r.id = "a"; },
  ];
  for (const change of changes) { const rows = base(); change(rows[1]); assert.throws(() => splitGroups(rows)); }
});

test("incomplete stored groups remain visible as individual records", () => {
  const rows = base().slice(0, 1);
  assert.equal(groupTransactionActivities(rows)[0].id, rows[0].id);
});

test("editing preserves original IDs, source metadata, creation times, and reporting overrides", () => {
  const previous = base(); previous[0].sourceRow = 12; previous[0].reportable = false;
  const edited = buildSplitRows({ id: "s", date: "2026-01-03", walletId: "w", currency: "EUR", direction: "expense", total: "0.4", note: "edited", timestamp: "2026-01-03", previous,
    lines: [{ id: "a", amount: "0.2", note: "first", category: personal }, { id: "b", amount: "0.2", note: "second", category: temporary }] });
  assert.equal(edited[0].sourceRow, 12); assert.equal(edited[0].createdAt, previous[0].createdAt);
  assert.equal(edited[0].reportable, false); assert.equal(edited[0].balanceAmount, "-0.2");
});

test("IRR display scaling is exact before allocating split postings", () => {
  const lines = ["0.1", "0.2"].map(v => amountForStorage(v, "IRR", "TMN").toString());
  const rows = buildSplitRows({ id: "irr", date: "2026-01-02", walletId: "w", currency: "IRR", direction: "expense", total: "3", note: "", timestamp: "now", lines: lines.map((amount, i) => ({ id: String(i), amount, category: personal, note: "" })) });
  assert.equal(activityAmount(rows), "3");
});

test("legacy CSV remains importable and respects temporary category defaults", () => {
  const csv = 'Date,Wallet,Operation,Direction,Category,Amount,Currency,Note\n2026-01-02,Test wallet,transaction,expense,Temporary - Paid for Others,5,EUR,test';
  const row = parseTransactionCsv(csv, [wallet], categories).transactions[0];
  assert.equal(row.split, undefined); assert.equal(row.reportable, false); assert.equal(row.balanceAmount, "-5");
});
