"use client";

import Decimal from "decimal.js";
import { rateKey, validRate } from "./rate-history.ts";
import { splitGroups } from "./splits.ts";
import { signedBalanceAmount } from "./finance.ts";
import { AppError, type AppErrorKey } from "./app-error.ts";
import { normalizeSeedData } from "./data-normalization.ts";
import { cleanCategoryName, titleCaseCategoryLabel, titleCaseCategoryName } from "./category-names.ts";
import { CSV_TRANSACTION_COLUMNS, CSV_TEXT_ENCODING, CSV_TEXT_ENCODING_COLUMN } from "./csv-format.ts";
import {
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  CURRENT_DATA_VERSION,
} from "./types.ts";
import type {
  Category,
  Direction,
  Operation,
  SeedData,
  Transaction,
  Wallet,
} from "./types.ts";
import { isConfigurableTransactionType, normalizeTypeReportability, transactionTypeLabel, type ConfigurableTransactionType } from "./transaction-types.ts";

const now = () => new Date().toISOString();

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${hash(value)}_${hash(value.split("").reverse().join(""))}`;
}

function importedId(prefix: string, rowNumber: number): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}_${rowNumber}_${random}`;
}

export function parseBackup(text: string): SeedData {
  let candidate: Partial<SeedData> & Record<string, unknown>;
  try {
    candidate = JSON.parse(text) as Partial<SeedData> & Record<string, unknown>;
  } catch {
    throw new AppError("error.invalidBackup", "This is not a valid jibjip Full backup.");
  }
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new AppError("error.invalidBackup", "This is not a valid JIBJIP full backup.");
  }
  if (candidate.source?.kind === "jibjip-starter") {
    throw new AppError(
      "error.starterNotBackup",
      "Starter data is installed automatically and is not a full backup.",
    );
  }
  if (
    candidate.version !== CURRENT_DATA_VERSION ||
    candidate.source?.kind !== "jibjip-backup" ||
    !Array.isArray(candidate.wallets) ||
    !Array.isArray(candidate.currencies) ||
    !Array.isArray(candidate.categories) ||
    !Array.isArray(candidate.rates) ||
    !Array.isArray(candidate.transactions) ||
    !candidate.settings
  ) {
    throw new AppError("error.invalidBackup", "This is not a valid jibjip Full backup.");
  }
  splitGroups(candidate.transactions as Transaction[]);
  const normalized = normalizeSeedData(candidate);
  validateBackupForRestore(normalized);
  return normalized;
}

function restoreError(): never {
  throw new AppError("error.invalidBackup", "This Full backup is corrupt or internally inconsistent.");
}

function isPositiveDecimal(value: unknown): boolean {
  try {
    const decimal = new Decimal(String(value));
    return decimal.isFinite() && decimal.gt(0);
  } catch {
    return false;
  }
}

function validateUniqueIds(rows: readonly unknown[], field: string): void {
  const values = new Set<string>();
  for (const row of rows) {
    const value = row !== null && typeof row === "object"
      ? (row as Record<string, unknown>)[field]
      : undefined;
    if (typeof value !== "string" || !value || values.has(value)) restoreError();
    values.add(value);
  }
}

/** Reject corruption that Dexie would otherwise silently overwrite during restore. */
function validateBackupForRestore(seed: SeedData): void {
  const { currencies, wallets, categories, rates, transactions, uncharted } = seed;
  validateUniqueIds(currencies, "code");
  validateUniqueIds(wallets, "id");
  validateUniqueIds(categories, "id");
  validateUniqueIds(rates, "id");
  validateUniqueIds(transactions, "id");
  validateUniqueIds(uncharted, "id");

  const currencyCodes = new Set(currencies.map((currency) => currency.code));
  const walletIds = new Set(wallets.map((wallet) => wallet.id));
  const categoryIds = new Set(categories.map((category) => category.id));
  const ratePairs = new Set<string>();
  for (const wallet of wallets) {
    if (typeof wallet.currency !== "string" || !currencyCodes.has(wallet.currency)) restoreError();
  }
  for (const rate of rates) {
    const pair = rateKey(rate);
    if (
      !validRate(rate) ||
      rate.baseCurrency !== "EUR" ||
      rate.quoteCurrency === "EUR" ||
      typeof rate.quoteCurrency !== "string" ||
      !currencyCodes.has(rate.quoteCurrency) ||
      !isPositiveDecimal(rate.value) ||
      ratePairs.has(pair)
    ) restoreError();
    ratePairs.add(pair);
  }
  for (const transaction of transactions) {
    if (!walletIds.has(transaction.walletId) || !isPositiveDecimal(transaction.amount) || typeof transaction.currency !== "string" || !currencyCodes.has(transaction.currency)) restoreError();
    if (
      transaction.reportable === true &&
      !isConfigurableTransactionType(transaction.operation) &&
      (typeof transaction.categoryId !== "string" || !categoryIds.has(transaction.categoryId))
    ) restoreError();
  }
  splitGroups(transactions);
  for (const entry of uncharted) {
    if (typeof entry.currency !== "string" || !currencyCodes.has(entry.currency)) restoreError();
  }
}

export interface CsvTransactionImport {
  transactions: Transaction[];
  categories: Category[];
}

function csvError(
  rowNumber: number,
  key: AppErrorKey,
  message: string,
  values: Record<string, string | number> = {},
): never {
  throw new AppError(key, `CSV row ${rowNumber}: ${message}`, { row: rowNumber, ...values });
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function findCsvWallet(value: string, code: string, wallets: Wallet[], rowNumber: number): Wallet {
  const wallet = resolveCsvWallet(value, code, wallets, rowNumber);
  if (wallet.archived) {
    csvError(
      rowNumber,
      "error.csvWalletArchived",
      `wallet “${wallet.name}” is archived. Restore it before importing.`,
      { wallet: wallet.name },
    );
  }
  return wallet;
}

function resolveCsvWallet(value: string, code: string, wallets: Wallet[], rowNumber: number): Wallet {
  // Codes are unique, so an exported code survives duplicate or renamed wallet names.
  if (code) {
    const normalizedCode = code.toLocaleLowerCase("en");
    const byCode = wallets.filter((wallet) => wallet.code.toLocaleLowerCase("en") === normalizedCode);
    if (byCode.length === 1) return byCode[0];
  }
  if (!value) csvError(rowNumber, "error.csvWalletRequired", "Wallet is required.");
  const exactName = wallets.filter((wallet) => wallet.name === value);
  if (exactName.length === 1) return exactName[0];
  const exactCode = wallets.filter((wallet) => wallet.code === value);
  if (exactCode.length === 1) return exactCode[0];
  const normalized = value.toLocaleLowerCase("en");
  const insensitive = wallets.filter(
    (wallet) =>
      wallet.name.toLocaleLowerCase("en") === normalized ||
      wallet.code.toLocaleLowerCase("en") === normalized,
  );
  if (insensitive.length === 1) return insensitive[0];
  if (insensitive.length > 1 || exactName.length > 1 || exactCode.length > 1) {
    csvError(
      rowNumber,
      "error.csvWalletAmbiguous",
      `wallet “${value}” is ambiguous.`,
      { wallet: value },
    );
  }
  csvError(
    rowNumber,
    "error.csvWalletMissing",
    `wallet “${value}” does not exist in jibjip.`,
    { wallet: value },
  );
}

function parseCsvTable(text: string): string[][] {
  if (!text.trim()) throw new AppError("error.csvEmpty", "The CSV file is empty.");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let justClosedQuote = false;

  const finishField = () => {
    row.push(field);
    field = "";
    justClosedQuote = false;
  };
  const finishRow = () => {
    finishField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        justClosedQuote = true;
      } else {
        field += character;
      }
      continue;
    }

    if (justClosedQuote && character !== "," && character !== "\r" && character !== "\n") {
      throw new AppError(
        "error.csvMalformed",
        "The CSV contains text after a closing quote.",
      );
    }
    if (character === '"') {
      if (field.length > 0) {
        throw new AppError(
          "error.csvMalformed",
          "The CSV contains a quotation mark inside an unquoted field.",
        );
      }
      quoted = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      finishRow();
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new AppError("error.csvMalformed", "The CSV contains an unterminated quoted field.");
  }
  if (field.length > 0 || row.length > 0) finishRow();

  return rows.filter((candidate) =>
    candidate.some((value) => value.trim() !== ""),
  );
}

export function parseTransactionCsv(
  text: string,
  wallets: Wallet[],
  existingCategories: Category[],
  typeReportability: Record<ConfigurableTransactionType, boolean> = normalizeTypeReportability(undefined),
): CsvTransactionImport {
  const table = parseCsvTable(text);
  if (table.length === 0) throw new AppError("error.csvEmpty", "The CSV file is empty.");
  const headers = (table[0] ?? []).map((value, index) =>
    value.replace(index === 0 ? /^\uFEFF/ : /$^/, "").trim(),
  );
  const duplicateHeaders = headers.filter(
    (header, index) => header && headers.indexOf(header) !== index,
  );
  if (duplicateHeaders.length > 0) {
    const columns = [...new Set(duplicateHeaders)].join(", ");
    throw new AppError(
      "error.csvDuplicateColumns",
      `The CSV has duplicate columns: ${columns}.`,
      { columns },
    );
  }
  const missingColumns = CSV_TRANSACTION_COLUMNS.filter(
    (column) => !headers.includes(column),
  );
  if (missingColumns.length > 0) {
    const columns = missingColumns.join(", ");
    throw new AppError(
      "error.csvMissingColumns",
      `The CSV is missing required columns: ${columns}.`,
      { columns },
    );
  }

  const columnIndex = new Map(headers.map((header, index) => [header, index]));
  const textEncodingIndex = columnIndex.get(CSV_TEXT_ENCODING_COLUMN);
  const categoryByKey = new Map(
    existingCategories.map((category) => [cleanCategoryName(category.name).toLocaleLowerCase("en"), category]),
  );
  const importedCategoryScopes = new Map<string, Set<"income" | "expense">>();
  const importedCategoryNames = new Map<string, string>();
  const transactions: Transaction[] = [];
  const timestamp = now();
  const importedSplitIds = new Map<string, string>();
  const importedLinks = new Map<string, { rowNumber: number; indexes: number[] }>();
  const operationDirections: Partial<Record<Operation, Direction[]>> = {
    transaction: ["income", "expense"],
    transfer: ["in", "out"],
    exchange: ["in", "out"],
    adjustment: ["in", "out"],
  };
  const valueAt = (row: string[], column: string) =>
    (row[columnIndex.get(column) ?? -1] ?? "").trim();

  table.slice(1).forEach((inputRow, index) => {
    const rowNumber = index + 2;
    if (inputRow.length !== headers.length) throw new AppError("error.csvMalformed", "CSV row length does not match its header.");
    if (textEncodingIndex !== undefined && inputRow[textEncodingIndex] !== CSV_TEXT_ENCODING) {
      csvError(rowNumber, "error.csvTextEncoding", "Unsupported CSV text encoding. Keep the Text Encoding column unchanged.");
    }
    // Remove exactly the guard added by our marked exporter, before interpreting any field.
    // Legacy files keep literal apostrophes, including notes that resemble guarded formulas.
    const row = textEncodingIndex === undefined ? inputRow : inputRow.map(value => value.startsWith("'") ? value.slice(1) : value);
    const date = valueAt(row, "Date");
    const walletName = valueAt(row, "Wallet");
    const operationText = valueAt(row, "Operation").toLocaleLowerCase("en");
    const directionText = valueAt(row, "Direction").toLocaleLowerCase("en");
    const categoryText = cleanCategoryName(valueAt(row, "Category"));
    const amountValue = valueAt(row, "Amount");
    const currency = valueAt(row, "Currency").toUpperCase();
    const note = row[columnIndex.get("Note") ?? -1] ?? "";
    const readBoolean = (column: string, fallback: boolean) => {
      const value = valueAt(row, column);
      if (!value) return fallback;
      if (value !== "true" && value !== "false") throw new AppError("error.csvMalformed", "Invalid CSV boolean.");
      return value === "true";
    };
    const splitId = valueAt(row, "Split ID");
    const splitValues = ["Split Part", "Split Count", "Split Total", "Split Note"].map(c => valueAt(row, c));
    if (!splitId && splitValues.some(Boolean)) throw new AppError("error.splitInvalid", "Split ID is missing.");
    if (splitId && !importedSplitIds.has(splitId)) importedSplitIds.set(splitId, importedId("split", rowNumber));

    if (!validIsoDate(date)) {
      csvError(rowNumber, "error.csvDate", "Date must be a valid YYYY-MM-DD date.");
    }
    const wallet = findCsvWallet(walletName, valueAt(row, "Wallet Code"), wallets, rowNumber);
    const operation = operationText as Operation;
    if (!operationDirections[operation]) {
      const operations = Object.keys(operationDirections).join(", ");
      csvError(
        rowNumber,
        "error.csvOperation",
        `Operation must be one of ${operations}.`,
        { operations },
      );
    }
    if (!operationDirections[operation]!.includes(directionText as Direction)) {
      csvError(
        rowNumber,
        "error.csvDirection",
        `Direction “${directionText}” is not valid for operation “${operation}.”`,
        { direction: directionText, operation },
      );
    }
    const direction = directionText as Direction;
    if (!categoryText) {
      csvError(rowNumber, "error.csvCategoryRequired", "Category is required.");
    }
    let amount: Decimal;
    try {
      amount = new Decimal(amountValue);
    } catch {
      csvError(
        rowNumber,
        "error.csvAmountFormat",
        "Amount must be a decimal number without currency symbols or separators.",
      );
    }
    if (!amount.isFinite() || amount.lte(0)) {
      csvError(rowNumber, "error.csvAmountPositive", "Amount must be greater than zero.");
    }
    if (!currency) {
      csvError(rowNumber, "error.csvCurrencyRequired", "Currency is required.");
    }
    if (currency !== wallet.currency) {
      csvError(
        rowNumber,
        "error.csvCurrencyMismatch",
        `Currency must be ${wallet.currency}, the native currency of wallet “${wallet.name}.”`,
        { currency: wallet.currency, wallet: wallet.name },
      );
    }

    const reportable = operation === "transaction"
      ? readBoolean("Reportable", categoryByKey.get(categoryText.toLocaleLowerCase("en"))?.defaultReportable ?? true)
      : isConfigurableTransactionType(operation) && typeReportability[operation];
    const affectsBalance = readBoolean("Affects Balance", true);
    const balanceAmount = valueAt(row, "Balance Amount") || signedBalanceAmount(amount, direction);
    try { if (!new Decimal(balanceAmount).isFinite()) throw new Error(); }
    catch { throw new AppError("error.csvAmountFormat", "Invalid balance amount.", { row: rowNumber }); }
    const categoryKey = categoryText.toLocaleLowerCase("en");
    const category = isConfigurableTransactionType(operation)
      ? transactionTypeLabel(operation)
      : titleCaseCategoryLabel(categoryByKey.get(categoryKey)?.name ?? categoryText, operation);
    if (operation === "transaction") {
      const scopes = importedCategoryScopes.get(categoryKey) ?? new Set<"income" | "expense">();
      scopes.add(direction as "income" | "expense");
      importedCategoryScopes.set(categoryKey, scopes);
      importedCategoryNames.set(categoryKey, category);
    }
    const linkId = valueAt(row, "Link ID");
    if (linkId) {
      const group = importedLinks.get(linkId) ?? { rowNumber, indexes: [] };
      group.indexes.push(transactions.length);
      importedLinks.set(linkId, group);
    }
    transactions.push({
      id: importedId("tx", rowNumber),
      date,
      walletId: wallet.id,
      operation,
      direction,
      categoryId: operation === "transaction" ? categoryByKey.get(categoryKey)?.id ?? null : null,
      category,
      amount: amount.toString(),
      balanceAmount,
      ...(splitId ? { split: {
        id: importedSplitIds.get(splitId)!, index: Number(valueAt(row, "Split Part")),
        count: Number(valueAt(row, "Split Count")), total: valueAt(row, "Split Total"),
        note: row[columnIndex.get("Split Note") ?? -1] ?? "",
      } } : {}),
      currency,
      note,
      reportable,
      affectsBalance,
      linkId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  // Remap complete transfer/exchange pairs per import. A wallet-filtered export can
  // contain one leg only; that leg stays an independent unlinked movement.
  for (const [linkId, { rowNumber, indexes }] of importedLinks) {
    const rows = indexes.map((index) => transactions[index]);
    const principals = rows.filter((row) => row.operation === "transfer" || row.operation === "exchange");
    if (principals.length < 2) continue;
    const [first, second] = principals;
    const out = principals.find((row) => row.direction === "out");
    const incoming = principals.find((row) => row.direction === "in");
    if (
      principals.length !== 2 || first.operation !== second.operation || !out || !incoming ||
      first.date !== second.date || out.walletId === incoming.walletId ||
      (first.operation === "transfer") !== (out.currency === incoming.currency)
    ) {
      csvError(rowNumber, "error.csvLinkInvalid", `linked rows “${linkId}” are incomplete or inconsistent.`, { link: linkId });
    }
    // Only the two principal legs share the link; deleting the pair must never remove
    // another row that merely reused its Link ID, so such rows import unlinked.
    const remapped = importedId(first.operation, rowNumber);
    for (const index of indexes) {
      const row = transactions[index];
      if (row.operation === "transfer" || row.operation === "exchange") transactions[index] = { ...row, linkId: remapped };
    }
  }

  splitGroups(transactions);
  if (transactions.length === 0) {
    throw new AppError(
      "error.csvNoRows",
      "The CSV contains headers but no transaction rows.",
    );
  }

  const categories: Category[] = [...importedCategoryScopes].flatMap(
    ([key, scopes]): Category[] => {
    const existing = categoryByKey.get(key);
    const importedScope: Category["scope"] =
      scopes.size > 1 ? "both" : ([...scopes][0] ?? "expense");
    if (existing) {
      const scope = existing.scope === importedScope ? existing.scope : "both";
      const name = titleCaseCategoryName(existing.name);
      return scope === existing.scope && name === existing.name ? [] : [{ ...existing, name, scope }];
    }
    const name = importedCategoryNames.get(key);
    if (!name) throw new AppError("error.csvMalformed", "Imported category is missing.");
    return [{
      id: stableId("category", name),
      name: titleCaseCategoryName(name),
      scope: importedScope,
      archived: false,
      templateKey: null,
      system: false,
      color: DEFAULT_CATEGORY_COLOR,
      icon: DEFAULT_CATEGORY_ICON,
      defaultReportable: true,
    }];
  });
  const categoriesByName = new Map(
    [...existingCategories, ...categories].map((category) => [
      cleanCategoryName(category.name).toLocaleLowerCase("en"),
      category,
    ]),
  );
  return {
    transactions: transactions.map((transaction) => ({
      ...transaction,
      categoryId: transaction.operation === "transaction"
        ? categoriesByName.get(cleanCategoryName(transaction.category).toLocaleLowerCase("en"))?.id ?? null
        : null,
    })),
    categories,
  };
}

const CSV_NUMERIC_COLUMNS = new Set(["Amount", "Balance Amount", "Split Part", "Split Count", "Split Total"]);
const CSV_DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
// Protect control/format/whitespace prefixes conservatively, including BOM and bidi marks.
// Doubling a literal leading apostrophe keeps the marked encoding reversible.
const CSV_TEXT_GUARD = /^[\s\p{Cc}\p{Cf}'=+\-@＝＋－＠]/u;

function csvCell(value: unknown, column: string): string {
  const text = String(value ?? "");
  const numeric = CSV_NUMERIC_COLUMNS.has(column) && text.trim() === text && CSV_DECIMAL.test(text);
  const guarded = !numeric && CSV_TEXT_GUARD.test(text) ? `'${text}` : text;
  return `"${guarded.replaceAll('"', '""')}"`;
}

/** Complete, spreadsheet-safe wallet exports; marked text is lossless on re-import. */
export function transactionCsv(transactions: Transaction[], wallets: Wallet[]): string {
  splitGroups(transactions);
  const byId = new Map(wallets.map(w => [w.id, w]));
  const columns = [...CSV_TRANSACTION_COLUMNS, "Reportable", "Affects Balance", "Balance Amount", "Split ID", "Split Part", "Split Count", "Split Total", "Split Note", "Wallet Code", "Link ID", CSV_TEXT_ENCODING_COLUMN];
  const rows = transactions.map(t => [t.date, byId.get(t.walletId)?.name ?? t.walletId, t.operation,
    t.direction, t.category, t.amount, t.currency, t.note, t.reportable, t.affectsBalance,
    t.balanceAmount ?? signedBalanceAmount(t.amount, t.direction), t.split?.id, t.split?.index,
    t.split?.count, t.split?.total, t.split?.note, byId.get(t.walletId)?.code, t.linkId, CSV_TEXT_ENCODING]);
  return [columns, ...rows].map(row => row.map((value, index) => csvCell(value, columns[index])).join(",")).join("\r\n");
}
