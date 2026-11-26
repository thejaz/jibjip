import assert from "node:assert/strict";
import test from "node:test";
import Decimal from "decimal.js";
import { CSV_TRANSACTION_COLUMNS } from "../packages/core/src/lib/csv-format.ts";
import { migrationPrompt } from "../packages/core/src/lib/migration-guide.ts";
import { parseTransactionCsv } from "../packages/core/src/lib/portability.ts";
import type { Wallet } from "../packages/core/src/lib/types.ts";

const wallets: Wallet[] = [
  {id: "main", name: "Main", code: "main", currency: "EUR", archived: false, createdAt: "2026-10-17T00:00:00.000Z"},
  {id: "cash", name: "Cash", code: "cash", currency: "EUR", archived: false, createdAt: "2026-10-17T00:00:00.000Z"},
  {id: "rial", name: "Rial", code: "rial", currency: "IRR", archived: false, createdAt: "2026-10-17T00:00:00.000Z"},
];

test("both conversion prompts use the real CSV contract and preserve untranslated operation tokens", () => {
  const header = "Date,Wallet,Operation,Direction,Category,Amount,Currency,Note";
  assert.equal(CSV_TRANSACTION_COLUMNS.join(","), header);
  for (const locale of ["en", "fa"] as const) {
    const prompt = migrationPrompt(locale);
    assert.ok(prompt.split("\n").includes(header));
    for (const token of ["UTF-8", "YYYY-MM-DD", "IRR", "Operation=transaction", "Direction=income/expense", "Operation=transfer/exchange/adjustment", "Direction=in/out", "Category=Transfer/Exchange/Adjustment"]) assert.ok(prompt.includes(token), token);
    assert.doesNotMatch(prompt, /\{columns\}/);
  }
});

test("the guided format imports income, expenses, paired movements, adjustments, and split postings without double-counting", () => {
  const csv = [CSV_TRANSACTION_COLUMNS.join(","),
    '2026-10-01,main,transaction,income,Salary,1000,EUR,Salary',
    '2026-10-02,main,transaction,expense,Food,12.34,EUR,"Lunch, receipt\nsecond line"',
    '2026-10-03,main,transfer,out,Transfer,10,EUR,To cash',
    '2026-10-03,cash,transfer,in,Transfer,10,EUR,From main',
    '2026-10-04,main,exchange,out,Exchange,20,EUR,Actual debit',
    '2026-10-04,rial,exchange,in,Exchange,10000000,IRR,Actual credit',
    '2026-10-05,main,adjustment,in,Adjustment,5,EUR,Recorded balance correction',
    '2026-10-06,main,transaction,expense,Food,2,EUR,Payment part 1',
    '2026-10-06,main,transaction,expense,Transport,3,EUR,Payment part 2',
  ].join("\r\n");
  const imported = parseTransactionCsv(csv, wallets, []);
  assert.equal(imported.transactions.length, 9);
  assert.equal(imported.transactions[1].note, "Lunch, receipt\nsecond line");
  const balances = wallets.map(wallet => imported.transactions.filter(row => row.walletId === wallet.id)
    .reduce((sum, row) => sum.plus(row.balanceAmount ?? "0"), new Decimal(0)).toString());
  assert.deepEqual(balances, ["957.66", "10", "10000000"]);
  for (const row of imported.transactions.filter(row => row.operation !== "transaction")) {
    assert.equal(row.categoryId, null);
    assert.equal(row.reportable, false);
  }
});
