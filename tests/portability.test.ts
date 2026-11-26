import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync, gunzipSync } from "node:zlib";
import { AppError } from "../packages/core/src/lib/app-error.ts";
import { createBackupFile, MAX_BACKUP_BYTES, parseBackupFile } from "../packages/core/src/lib/snapshot-file.ts";
import { parseBackup, parseTransactionCsv, transactionCsv } from "../packages/core/src/lib/portability.ts";
import { CSV_TEXT_ENCODING, CSV_TEXT_ENCODING_COLUMN } from "../packages/core/src/lib/csv-format.ts";
import { categoriesForLocale } from "../packages/core/src/lib/catalogs.ts";
import type { Category, Transaction, Wallet } from "../packages/core/src/lib/types.ts";

const timestamp = "2026-07-18T12:00:00.000Z";
const wallet: Wallet = {
  id: "wallet-main",
  name: "Main",
  code: "main",
  currency: "EUR",
  archived: false,
  createdAt: timestamp,
};
const categories: Category[] = [
  {
    id: "category-salary",
    name: "Salary",
    scope: "income",
    archived: false,
    templateKey: null,
    system: false,
    color: "#258042",
    icon: "briefcase-business",
    defaultReportable: true,
  },
];

function backup(kind = "jibjip-backup") {
  return {
    version: 2,
    generatedAt: timestamp,
    source: { filename: "backup.json", kind },
    currencies: [{
      code: "EUR",
      name: "Euro",
      symbol: "€",
      kind: "fiat",
      fractionDigits: 2,
      builtIn: true,
      archived: false,
    }],
    wallets: [wallet],
    categories,
    rates: [],
    transactions: [] as Array<Record<string, unknown>>,
    uncharted: [],
    settings: {
      dataVersion: 2,
      setupVersion: 0,
      setupState: "upgrade-required",
      mainWalletId: null,
      setupStep: 1,
      setupDraft: null,
      reportingCurrency: "EUR",
      locale: "en",
      showJalali: true,
      starterSeedVersion: 2,
      irrDisplayUnit: "IRR",
      textSize: "medium",
      overviewWalletIds: null,
      overviewPinnedWalletIds: [null, null, null],
      overviewHiddenCurrencies: [],
      defaultWalletId: null,
    },
  };
}

function appErrorKey(callback: () => unknown): string | undefined {
  try {
    callback();
    return undefined;
  } catch (reason) {
    assert.ok(reason instanceof AppError);
    return reason.key;
  }
}

function csvTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "synthetic-export", date: "2026-01-02", walletId: wallet.id,
    operation: "transaction", direction: "income", categoryId: categories[0].id,
    category: "Salary", amount: "12.5", balanceAmount: "12.5", currency: "EUR",
    note: "Synthetic note", reportable: true, affectsBalance: true, linkId: null,
    createdAt: timestamp, updatedAt: timestamp, ...overrides,
  };
}

function completeBackup() {
  const seed = parseBackup(JSON.stringify(backup()));
  seed.currencies.push({ ...seed.currencies[0], code: "USD", name: "US dollar", symbol: "$" });
  seed.categories[0].group = "Work";
  seed.transactions = [0, 1].map(index => csvTransaction({
    id: `split-${index}`, amount: "123456789012345.0123456789", balanceAmount: "123456789012345.0123456789",
    note: "Synthetic فارسی العربية\n=literal text", sourceKey: `synthetic-${index}`,
    split: { id: "split-payment", index: index + 1, count: 2, total: "246913578024690.0246913578", note: "Two lines" },
  }));
  seed.rates = [{ id: "manual-usd", baseCurrency: "EUR", quoteCurrency: "USD", value: "1.234567890123456789",
    effectiveDate: "2026-07-01", granularity: "monthly", source: "Synthetic monthly average", method: "manual",
    locked: true, sampleCount: 31, sourceUrl: "https://example.com/rates", createdAt: timestamp, fetchedAt: timestamp }];
  seed.uncharted = [{ id: "later", date: "2026-07-18", currency: "EUR", amount: "12.5", note: "Synthetic later",
    status: "open", statusUpdate: "", createdAt: timestamp, updatedAt: timestamp }];
  seed.settings.clarity = { enabled: false, awards: [{ period: "2026-07-13", task: "balance", completedAt: timestamp }] };
  seed.settings.startPage = "transactions";
  return seed;
}

test("gzip backups interoperate with standard tools and preserve the complete V2 snapshot without writes", async () => {
  const seed = completeBackup();
  const before = JSON.stringify(seed);
  const { blob, extension } = await createBackupFile(seed);
  assert.equal(extension, ".json.gz");
  assert.equal(blob.type, "application/gzip");
  assert.equal(gunzipSync(Buffer.from(await blob.arrayBuffer())).toString("utf8"), before);
  assert.deepEqual(await parseBackupFile(blob), parseBackup(before));
  assert.equal(JSON.stringify(seed), before);
});

test("restore detects actual gzip content regardless of filename or MIME and retains legacy JSON", async () => {
  const json = JSON.stringify(completeBackup());
  for (const file of [new Blob([json]), new Blob(["\uFEFF", json], { type: "application/gzip" }),
    new Blob([gzipSync(json)], { type: "application/json" })]) {
    assert.deepEqual(await parseBackupFile(file), parseBackup(json));
  }
});

test("damaged gzip, invalid UTF-8, invalid JSON, and unrelated archives are rejected before restore", async () => {
  const zipped = gzipSync(JSON.stringify(completeBackup()));
  const corrupt = Buffer.from(zipped); corrupt[corrupt.length - 8] ^= 0xff;
  for (const input of [zipped.subarray(0, zipped.length - 4), corrupt, Buffer.from([0xff, 0xfe]),
    Buffer.from("PK\x03\x04not gzip"), gzipSync("not JSON"), Buffer.from("null"), Buffer.from("[]"), gzipSync("42")]) {
    await assert.rejects(parseBackupFile(new Blob([input])), (reason: unknown) => reason instanceof AppError && reason.key === "error.invalidBackup");
  }
});

test("compressed restores use the same starter and financial-consistency validation as JSON", async () => {
  const starter = JSON.stringify(backup("jibjip-starter"));
  await assert.rejects(parseBackupFile(new Blob([gzipSync(starter)])), (reason: unknown) => reason instanceof AppError && reason.key === "error.starterNotBackup");
  const seed = completeBackup(); seed.transactions.pop();
  await assert.rejects(parseBackupFile(new Blob([gzipSync(JSON.stringify(seed))])));
});

test("legacy browsers export plain JSON and can still restore it", async () => {
  const original = globalThis.CompressionStream;
  try {
    Object.defineProperty(globalThis, "CompressionStream", { configurable: true, writable: true, value: undefined });
    const seed = completeBackup();
    const result = await createBackupFile(seed);
    assert.equal(result.extension, ".json");
    assert.equal(result.blob.type, "application/json");
    assert.deepEqual(await parseBackupFile(result.blob), parseBackup(JSON.stringify(seed)));
  } finally { globalThis.CompressionStream = original; }
});

test("missing decompression support explains recovery and never exports an unreadable backup", async () => {
  const original = globalThis.DecompressionStream;
  try {
    Object.defineProperty(globalThis, "DecompressionStream", { configurable: true, writable: true, value: undefined });
    const seed = completeBackup();
    assert.equal((await createBackupFile(seed)).extension, ".json");
    await assert.rejects(parseBackupFile(new Blob([gzipSync(JSON.stringify(seed))])),
      (reason: unknown) => reason instanceof AppError && reason.key === "error.backupCompressionUnsupported");
  } finally { globalThis.DecompressionStream = original; }
});

test("restore rejects oversized files and gzip expansion before parsing", async () => {
  const tooLarge = new Blob();
  Object.defineProperty(tooLarge, "size", { value: MAX_BACKUP_BYTES + 1 });
  const isSizeError = (reason: unknown) => reason instanceof AppError && reason.key === "error.backupTooLarge";
  await assert.rejects(parseBackupFile(tooLarge), isSizeError);
  const bomb = gzipSync(Buffer.alloc(MAX_BACKUP_BYTES + 1, 32));
  await assert.rejects(parseBackupFile(new Blob([bomb])), isSizeError);
});

const quoted = (value: string) => `"${value.replaceAll('"', '""')}"`;

test("Full backups retain the start page and older or unsupported values safely use Overview", () => {
  const original = backup();
  for (const page of ["overview", "transactions", undefined, null, "settings", "Transactions", 1]) {
    const restored = parseBackup(JSON.stringify({
      ...original, settings: { ...original.settings, startPage: page },
    }));
    assert.equal(restored.settings.startPage, page === "transactions" ? "transactions" : "overview");
    assert.deepEqual(restored.wallets, original.wallets);
    assert.deepEqual(restored.transactions, original.transactions);
  }
});

test("Full backups retain motion choices and older or unsupported values use Subtle without changing finances", () => {
  const original = backup();
  original.transactions.push({ ...csvTransaction() });
  const baseline = parseBackup(JSON.stringify(original));
  for (const motion of ["off", "subtle", "enhanced", undefined, null, "invalid", false, 1]) {
    const restored = parseBackup(JSON.stringify({ ...original, settings: { ...original.settings, motion } }));
    assert.equal(restored.settings.motion, motion === "off" || motion === "enhanced" ? motion : "subtle");
    assert.deepEqual(restored.wallets, original.wallets);
    assert.deepEqual(restored.transactions, original.transactions);
    assert.deepEqual(restored.categories, baseline.categories);
  }
});

test("CSV export protects formula and invisible prefixes while restoring exact original notes", () => {
  const dangerous = [
    "=2+2", "+SUM(1,2)", "-1+1", "@SUM(1,2)",
    "\t=2+2", "\r=2+2", "\n=2+2", "  =2+2", "\0=2+2",
    "\uFEFF=2+2", "\u200B=2+2", "\u202E=2+2", "\u00A0=2+2",
    "＝2+2", "＋2+2", "－1+1", "＠SUM(1,2)",
    "'literal", "''literal", "'=2+2", "  Keep whitespace  ",
  ];
  for (const note of dangerous) {
    const original = csvTransaction({ note });
    const csv = transactionCsv([original], [wallet]);
    assert.ok(csv.includes(quoted(`'${note}`)), "potentially executable text must have a literal-text guard");
    const first = parseTransactionCsv(csv, [wallet], categories).transactions[0];
    assert.equal(first.note, note);
    const second = parseTransactionCsv(transactionCsv([first], [wallet]), [wallet], categories).transactions[0];
    assert.equal(second.note, note, "repeated round trips must not accumulate guards");
  }
  for (const note of ["", "Ordinary note", "متن فارسی", 'Comma, "quote"\nsecond line']) {
    const csv = transactionCsv([csvTransaction({ note })], [wallet]);
    assert.ok(csv.includes(quoted(note)));
    assert.equal(parseTransactionCsv(csv, [wallet], categories).transactions[0].note, note);
  }
});

test("CSV protects every textual column, including fallback identifiers and formula-like numeric text", () => {
  const original = csvTransaction({ date: "=date", walletId: "=wallet", category: "=category", note: "=note", currency: "=currency" });
  // Defensively cover malformed historic records as well as fields normally constrained by the UI.
  const candidate = { ...original, operation: "=operation", direction: "=direction", amount: "-1+1", balanceAmount: "+1+1" } as unknown as Transaction;
  const csv = transactionCsv([candidate], []);
  for (const cell of ["=date", "=wallet", "=category", "=note", "=currency", "=operation", "=direction", "-1+1", "+1+1"]) {
    assert.ok(csv.includes(quoted(`'${cell}`)), cell);
  }
  const namedWallet = { ...wallet, name: "=wallet" };
  const named = transactionCsv([csvTransaction()], [namedWallet]);
  assert.ok(named.includes(quoted("'=wallet")));
  assert.equal(parseTransactionCsv(named, [namedWallet], categories).transactions[0].walletId, wallet.id);
  const guardedCategory = { ...categories[0], name: "'=2+2" };
  const categorized = transactionCsv([csvTransaction({ category: guardedCategory.name })], [wallet]);
  const restored = parseTransactionCsv(categorized, [wallet], [guardedCategory]).transactions[0];
  assert.equal(restored.categoryId, guardedCategory.id);
  assert.equal(restored.category, guardedCategory.name);
});

test("CSV numeric exemptions preserve exact signed decimals and exponents without admitting formulas", () => {
  for (const value of ["-12.5", "+12.5", "-1.25e+2", "-.125", "-12345678901234567890.0123456789"]) {
    const original = csvTransaction({ direction: "expense", amount: "12345678901234567890.0123456789", balanceAmount: value });
    const csv = transactionCsv([original], [wallet]);
    assert.ok(csv.includes(quoted(value)), "signed financial values remain numeric");
    assert.ok(!csv.includes(quoted(`'${value}`)));
    const restored = parseTransactionCsv(csv, [wallet], categories).transactions[0];
    assert.equal(restored.balanceAmount, value);
    assert.equal(restored.amount, original.amount);
  }
  for (const value of ["-1+1", "+SUM(1,2)", "-1\n", "\t-1", "－1"]) {
    assert.ok(transactionCsv([csvTransaction({ balanceAmount: value })], [wallet]).includes(quoted(`'${value}`)));
  }
});

test("legacy CSV retains literal apostrophes and marked files reject missing, unknown, or mixed encodings", () => {
  const header = "Date,Wallet,Operation,Direction,Category,Amount,Currency,Note";
  for (const note of ["'literal", "''literal", "'=2+2", "=2+2"]) {
    const legacy = `${header}\r\n2026-01-02,Main,transaction,income,Salary,12.5,EUR,${quoted(note)}`;
    assert.equal(parseTransactionCsv(legacy, [wallet], categories).transactions[0].note, note);
  }
  const csv = transactionCsv([csvTransaction(), csvTransaction({ id: "second" })], [wallet]);
  assert.ok(csv.split("\r\n")[0].endsWith(quoted(CSV_TEXT_ENCODING_COLUMN)));
  for (const bad of ["", "unknown-v9", ` ${CSV_TEXT_ENCODING}`]) {
    const changed = csv.replace(quoted(CSV_TEXT_ENCODING), quoted(bad));
    assert.equal(appErrorKey(() => parseTransactionCsv(changed, [wallet], categories)), "error.csvTextEncoding");
  }
  const lastMarker = csv.lastIndexOf(quoted(CSV_TEXT_ENCODING));
  const mixed = csv.slice(0, lastMarker) + quoted("unknown-v9");
  const before = JSON.stringify([wallet, categories]);
  assert.equal(appErrorKey(() => parseTransactionCsv(mixed, [wallet], categories)), "error.csvTextEncoding");
  assert.equal(JSON.stringify([wallet, categories]), before);
});

test("CSV protection never rewrites source records or native Full-backup text", () => {
  const original = csvTransaction({ note: "'=2+2" });
  const before = JSON.stringify(original);
  transactionCsv([original], [wallet]);
  assert.equal(JSON.stringify(original), before);
  const envelope = { ...backup(), transactions: [original] };
  assert.equal(parseBackup(JSON.stringify(envelope)).transactions[0].note, original.note);
});

test("current Full backups remain restorable", () => {
  const restored = parseBackup(JSON.stringify(backup()));
  assert.equal(restored.source.kind, "jibjip-backup");
  assert.equal(restored.version, 2);
  assert.equal(restored.settings.dataVersion, 2);
  assert.equal(restored.settings.setupState, "upgrade-required");
  assert.deepEqual(restored.currencies.map((currency) => currency.code), ["EUR"]);
});

test("Full backups preserve category groups and explicit ungrouping without changing transactions", () => {
  const original = backup();
  for (const group of ["Work & Income", "گروه شخصی", null]) {
    const input = { ...original, categories: original.categories.map((category) => ({ ...category, group })) };
    const restored = parseBackup(JSON.stringify(input));
    assert.equal(restored.categories[0].group, group);
    assert.deepEqual(restored.transactions, input.transactions);
  }
  const legacy = parseBackup(JSON.stringify(original));
  assert.equal(legacy.categories[0].group, undefined);
});

test("Full backups modernize retired movement labels without changing financial data", () => {
  const current = backup() as ReturnType<typeof backup> & {
    transactions: Array<Record<string, unknown>>;
    settings: ReturnType<typeof backup>["settings"] & { typeReportability: Record<string, boolean> };
  };
  current.categories = [...categories, {
    id: "legacy-transfer-category",
    name: "Transfer (OUT)",
    scope: "expense",
    archived: false,
    templateKey: null,
    system: true,
    color: "#616161",
    icon: "repeat",
    defaultReportable: true,
  }];
  current.settings.typeReportability = { transfer: true, exchange: false, adjustment: false };
  current.transactions = [{
    id: "legacy-transfer",
    date: "2026-07-17",
    walletId: wallet.id,
    operation: "transfer",
    direction: "out",
    categoryId: "legacy-transfer-category",
    category: "Transfer (OUT)",
    amount: "12.3400",
    balanceAmount: "-12.3400",
    currency: "EUR",
    note: "preserve me",
    reportable: false,
    affectsBalance: true,
    linkId: "transfer-link",
    createdAt: timestamp,
    updatedAt: timestamp,
  }];

  const restored = parseBackup(JSON.stringify(current));
  const movement = restored.transactions[0];
  assert.equal(restored.categories.some((category) => category.id === "legacy-transfer-category"), false);
  assert.equal(movement.categoryId, null);
  assert.equal(movement.category, "Transfer");
  assert.equal(movement.reportable, true);
  assert.equal(movement.amount, "12.3400");
  assert.equal(movement.balanceAmount, "-12.3400");
  assert.equal(movement.note, "preserve me");
  assert.equal(movement.linkId, "transfer-link");
  assert.equal(movement.createdAt, timestamp);
  assert.equal(movement.updatedAt, timestamp);
});

test("Full-backup restore rejects unsupported versions", () => {
  const oldVersion = { ...backup(), version: 1 };
  assert.equal(appErrorKey(() => parseBackup(JSON.stringify(oldVersion))), "error.invalidBackup");
});

test("Full backups preserve completed setup and require currency records", () => {
  const current = parseBackup(JSON.stringify(backup()));
  current.settings.setupVersion = 1;
  current.settings.setupState = "complete";
  current.settings.mainWalletId = wallet.id;
  const restored = parseBackup(JSON.stringify(current));

  assert.equal(restored.version, 2);
  assert.equal(restored.settings.setupState, "complete");
  assert.equal(restored.settings.mainWalletId, wallet.id);

  const withoutCurrencies = { ...current } as Record<string, unknown>;
  delete withoutCurrencies.currencies;
  assert.equal(
    appErrorKey(() => parseBackup(JSON.stringify(withoutCurrencies))),
    "error.invalidBackup",
  );
});

test("starter and arbitrary JSON are not restore files", () => {
  assert.equal(
    appErrorKey(() => parseBackup(JSON.stringify(backup("jibjip-starter")))),
    "error.starterNotBackup",
  );
  assert.equal(
    appErrorKey(() => parseBackup(JSON.stringify({ version: 2, source: { kind: "other" } }))),
    "error.invalidBackup",
  );
});

test("Full-backup restore rejects malformed JSON and corruption that could overwrite records", () => {
  assert.equal(appErrorKey(() => parseBackup("not json")), "error.invalidBackup");

  const duplicateTransaction = JSON.parse(JSON.stringify(backup())) as { transactions: Array<Record<string, unknown>> };
  duplicateTransaction.transactions = [
    { id: "same", walletId: wallet.id, amount: "1", currency: "EUR", reportable: false },
    { id: "same", walletId: wallet.id, amount: "2", currency: "EUR", reportable: false },
  ];
  assert.equal(appErrorKey(() => parseBackup(JSON.stringify(duplicateTransaction))), "error.invalidBackup");

  const unknownWallet = JSON.parse(JSON.stringify(backup())) as { transactions: Array<Record<string, unknown>> };
  unknownWallet.transactions = [{ id: "tx", walletId: "missing", amount: "1", currency: "EUR", reportable: false }];
  assert.equal(appErrorKey(() => parseBackup(JSON.stringify(unknownWallet))), "error.invalidBackup");
});

test("CSV import preserves quoted commas, quotation marks, and line breaks", () => {
  const csv = [
    "\uFEFFDate,Wallet,Operation,Direction,Category,Amount,Currency,Note",
    "2026-07-18,Main,transaction,expense,Food & Drink,12.50,EUR,\"line one, \"\"quoted\"\"",
    "line two\"",
  ].join("\r\n");
  const result = parseTransactionCsv(csv, [wallet], categories);

  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].amount, "12.5");
  assert.equal(result.transactions[0].categoryId, result.categories[0].id);
  assert.equal(result.transactions[0].note, 'line one, "quoted"\r\nline two');
  assert.deepEqual(
    result.categories.map(({ name, scope }) => ({ name, scope })),
    [{ name: "Food & Drink", scope: "expense" }],
  );
});

test("CSV category whitespace reuses bilingual fallbacks without creating an unused Other", () => {
  for (const locale of ["en", "fa"] as const) {
    const catalog = categoriesForLocale(locale);
    const fallback = catalog.find(row => row.templateKey === "other-expenses")!;
    fallback.defaultReportable = false;
    const before = JSON.stringify(catalog);
    const categoryName = fallback.name.replaceAll(" ", "   ");
    const csv = `Date,Wallet,Operation,Direction,Category,Amount,Currency,Note\n2026-01-01,Main,transaction,expense,${categoryName},12.50,EUR,Synthetic note`;
    const result = parseTransactionCsv(csv, [wallet], catalog);
    assert.deepEqual(result.categories, []);
    assert.equal(result.transactions[0].categoryId, fallback.id);
    assert.equal(result.transactions[0].category, fallback.name);
    assert.equal(result.transactions[0].reportable, false);
    assert.equal(result.transactions[0].balanceAmount, "-12.5");
    assert.equal(result.transactions[0].note, "Synthetic note");
    assert.equal(JSON.stringify(catalog), before);
  }
});

test("CSV spacing variants create one linked custom category and preserve deliberate Other categories", () => {
  const header = "Date,Wallet,Operation,Direction,Category,Amount,Currency,Note";
  const csv = [header,
    "2026-01-01,Main,transaction,expense,Example   Category,1,EUR,Synthetic one",
    "2026-01-02,Main,transaction,income,example category,2,EUR,Synthetic two",
  ].join("\n");
  const result = parseTransactionCsv(csv, [wallet], categoriesForLocale("en"));
  assert.equal(result.categories.length, 1);
  assert.equal(result.categories[0].name, "Example Category");
  assert.equal(result.categories[0].scope, "both");
  assert.ok(result.transactions.every(row => row.categoryId === result.categories[0].id));
  assert.deepEqual(parseTransactionCsv(transactionCsv(result.transactions, [wallet]), [wallet], result.categories).categories, []);

  const explicitOther = parseTransactionCsv(`${header}\n2026-01-01,Main,transaction,expense,Other,1,EUR,Synthetic`, [wallet], categoriesForLocale("en"));
  assert.equal(explicitOther.categories[0].name, "Other");
  assert.equal(explicitOther.categories[0].templateKey, null);
  assert.equal(explicitOther.transactions[0].categoryId, explicitOther.categories[0].id);
});

test("CSV validation rejects duplicate columns and malformed quoting", () => {
  const duplicate = [
    "Date,Wallet,Operation,Direction,Category,Amount,Currency,Note,Note",
    "2026-07-18,Main,transaction,expense,Food,1,EUR,,",
  ].join("\n");
  assert.equal(
    appErrorKey(() => parseTransactionCsv(duplicate, [wallet], categories)),
    "error.csvDuplicateColumns",
  );

  const malformed = [
    "Date,Wallet,Operation,Direction,Category,Amount,Currency,Note",
    "2026-07-18,Main,transaction,expense,Food,1,EUR,\"unfinished",
  ].join("\n");
  assert.equal(
    appErrorKey(() => parseTransactionCsv(malformed, [wallet], categories)),
    "error.csvMalformed",
  );
});

test("CSV validation does not mutate existing wallets or categories", () => {
  const walletsBefore = JSON.stringify([wallet]);
  const categoriesBefore = JSON.stringify(categories);
  const invalid = [
    "Date,Wallet,Operation,Direction,Category,Amount,Currency,Note",
    "not-a-date,Main,transaction,expense,Food,1,EUR,",
  ].join("\n");

  assert.equal(
    appErrorKey(() => parseTransactionCsv(invalid, [wallet], categories)),
    "error.csvDate",
  );
  assert.equal(JSON.stringify([wallet]), walletsBefore);
  assert.equal(JSON.stringify(categories), categoriesBefore);
});

test("CSV imports unpaired balance-changing adjustments and rejects retired fee rows", () => {
  const adjustment = [
    "Date,Wallet,Operation,Direction,Category,Amount,Currency,Note",
    "2026-07-18,Main,adjustment,out,Adjustment (OUT),12.50,EUR,Count correction",
  ].join("\n");
  const result = parseTransactionCsv(adjustment, [wallet], categories);
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].operation, "adjustment");
  assert.equal(result.transactions[0].direction, "out");
  assert.equal(result.transactions[0].categoryId, null);
  assert.equal(result.transactions[0].category, "Adjustment");
  assert.equal(result.transactions[0].reportable, false);
  assert.equal(result.transactions[0].affectsBalance, true);
  assert.equal(result.categories.length, 0);
  const legacyFee = adjustment.replace("adjustment,out,Adjustment (OUT)", "fee,expense,Exchange fee");
  assert.equal(appErrorKey(() => parseTransactionCsv(legacyFee, [wallet], categories)), "error.csvOperation");
});

test("CSV wallet codes and linked pairs survive a round-trip", () => {
  const twin: Wallet = { ...wallet, id: "wallet-twin", code: "twin" };
  const usd: Wallet = { ...wallet, id: "wallet-usd", name: "Dollars", code: "usd", currency: "USD" };
  const wallets = [wallet, twin, usd];
  const leg = (overrides: Partial<Transaction>) => csvTransaction({
    operation: "exchange", categoryId: null, category: "Exchange", reportable: false, linkId: "exchange_synthetic", ...overrides,
  });
  const rows = [
    csvTransaction({ id: "named", walletId: twin.id }),
    leg({ id: "out", direction: "out", amount: "10", balanceAmount: "-10" }),
    leg({ id: "in", walletId: usd.id, direction: "in", amount: "11", balanceAmount: "11", currency: "USD" }),
  ];
  const imported = parseTransactionCsv(transactionCsv(rows, wallets), wallets, categories).transactions;
  assert.equal(imported[0].walletId, twin.id, "a duplicate wallet name resolves by its exported code");
  assert.ok(imported[1].linkId && imported[1].linkId === imported[2].linkId, "both legs stay linked");
  assert.notEqual(imported[1].linkId, "exchange_synthetic", "link IDs are remapped per import");

  const intruder = csvTransaction({ id: "intruder", linkId: "exchange_synthetic" });
  const joined = parseTransactionCsv(transactionCsv([...rows.slice(1), intruder], wallets), wallets, categories).transactions;
  assert.ok(joined[0].linkId && joined[0].linkId === joined[1].linkId, "the pair stays linked");
  assert.equal(joined[2].linkId, null, "a nonprincipal row reusing the Link ID imports unlinked");

  const lone = parseTransactionCsv(transactionCsv([rows[1]], wallets), wallets, categories).transactions;
  assert.equal(lone[0].linkId, null, "a wallet-filtered single leg imports unlinked");

  const broken = transactionCsv([rows[1], { ...rows[2], date: "2026-01-03" }], wallets);
  assert.equal(appErrorKey(() => parseTransactionCsv(broken, wallets, categories)), "error.csvLinkInvalid");

  const archived = [{ ...wallet, archived: true }, twin, usd];
  assert.equal(appErrorKey(() => parseTransactionCsv(transactionCsv([csvTransaction()], wallets), archived, categories)), "error.csvWalletArchived");
});
