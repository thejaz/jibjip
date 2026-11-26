import assert from "node:assert/strict";
import test from "node:test";
import { amountInputEdit, asciiDigits, groupAmountInput, normalizeNumericInput } from "../packages/core/src/lib/numeric-input.ts";
import { amountInWords, amountReadout } from "../packages/core/src/lib/amount-words.ts";
import {
  buildLinkedActivityChanges,
  groupTransactionActivities,
} from "../packages/core/src/lib/activity.ts";
import {
  amountForDisplayInput,
  amountForStorage,
  convert,
  convertWithRateFallback,
  editedBalanceAmount,
  formatMoney,
  latestRate,
  rateOnOrBefore,
  reportTotalWithMissing,
  signedBalanceAmount,
  walletBalance,
} from "../packages/core/src/lib/finance.ts";
import type { Rate, Transaction, Wallet } from "../packages/core/src/lib/types.ts";

const timestamp = "2026-07-14T12:00:00.000Z";

test("amount grouping preserves exact digits, decimal drafts, and logical caret positions", () => {
  assert.deepEqual(amountInputEdit("1234", 4), { value: "1234", display: "1,234", caret: 5 });
  assert.deepEqual(amountInputEdit("1,2345", 6), { value: "12345", display: "12,345", caret: 6 });
  assert.deepEqual(amountInputEdit("1,9234", 3), { value: "19234", display: "19,234", caret: 2 });
  for (const value of ["", ".", "1.", "-1", "+1", "0.000001", "1e6", "invalid"]) assert.equal(groupAmountInput(value), value);
  assert.equal(groupAmountInput("1234567.0800"), "1,234,567.0800");
  const precise = "9007199254740993.123456789";
  const formatted = groupAmountInput(precise);
  assert.equal(amountInputEdit(formatted, formatted.length, true).value, precise);
  assert.equal(amountForStorage(formatted, "EUR", "IRR").toString(), precise);
});

test("pasted mixed numerals group correctly while malformed separators remain invalid", () => {
  const pasted = amountInputEdit("۱۲۳٬٤٥٦٫۷۸", 10, true);
  assert.equal(pasted.value, "123456.78");
  assert.equal(pasted.display, "123,456.78");
  for (const text of ["۱۲٬۳۴", "۱٫۲٫۳", "12x3", "1 234"]) {
    const result = amountInputEdit(text, text.length, true);
    assert.throws(() => amountForStorage(result.value, "EUR", "IRR"));
  }
});

test("English and Persian words handle zero, exact large integers, signs, and decimals", () => {
  assert.equal(amountInWords("10000", "en"), "ten thousand");
  assert.equal(amountInWords("۱۰٬۰۰۰", "fa"), "ده هزار");
  assert.equal(amountInWords("1234567", "en"), "one million two hundred thirty-four thousand five hundred sixty-seven");
  assert.equal(amountInWords("1234567", "fa"), "یک میلیون و دویست و سی و چهار هزار و پانصد و شصت و هفت");
  assert.equal(amountInWords("0", "fa"), "صفر");
  assert.equal(amountInWords("-12.05", "en"), "minus twelve point zero five");
  assert.equal(amountInWords("12.05", "fa"), "دوازده ممیز صفر پنج");
  assert.match(amountInWords("9007199254740993", "en")!, /nine hundred ninety-three$/);
  assert.equal(amountInWords("1e6", "en"), "one million");
});

test("amount readouts use the actual selected rial unit and localized currency names", () => {
  assert.equal(amountReadout("10000", "IRR", "IRR", "en"), "ten thousand rials");
  assert.equal(amountReadout("10000", "IRR", "IRR", "fa"), "ده هزار ریال");
  assert.equal(amountReadout("10000", "IRR", "TMN", "fa"), "ده هزار تومان");
  assert.equal(amountReadout("1", "IRR", "HTM", "fa"), "هزار تومان");
  assert.equal(amountReadout("1", "IRR", "MTM", "en"), "one million tomans");
  assert.equal(amountReadout("1", "EUR", "IRR", "en"), "one euro");
  assert.equal(amountReadout("10000", "EUR", "IRR", "fa"), "ده هزار یورو");
  assert.equal(amountReadout("2", "TOKEN", "IRR", "fa"), "دو TOKEN");
});

test("word previews omit invalid or excessively long input without limiting stored amounts", () => {
  for (const value of ["", "NaN", "Infinity", "12,34", "0x10", "1e99999999", "0.0000000000000000001", "1".repeat(129)]) {
    assert.equal(amountInWords(value, "en"), null);
  }
  assert.equal(amountReadout("1e99999999", "EUR", "IRR", "en"), null);
  assert.equal(amountForStorage("1e30", "EUR", "IRR").toString(), "1e+30");
  assert.equal(amountInWords("1e30", "en"), null);
});

test("mixed Persian, Arabic, and ASCII numeric input retains exact canonical values", () => {
  assert.equal(asciiDigits("۰١2۳٤5۶٧8۹"), "0123456789");
  assert.equal(normalizeNumericInput("۱۲۳٬٤٥٦٫۷۸"), "123456.78");
  assert.equal(amountForStorage(" ۱۲۳٬٤٥٦٫۷۸ ", "EUR", "IRR").toString(), "123456.78");
  assert.equal(amountForStorage("۱2٣٫۴۵", "IRR", "TMN").toString(), "1234.5");
  assert.equal(amountForStorage("۹۰۰۷۱۹۹۲۵۴۷۴۰۹۹۳٫۱۲۳۴۵۶۷۸۹", "EUR", "IRR").toString(), "9007199254740993.123456789");
  assert.equal(amountForStorage("−١۲٫۳", "EUR", "IRR").toString(), "-12.3");
});

test("malformed numeric separators and mixed-in text are rejected without guessing", () => {
  for (const value of ["۱۲٬۳۴", "۱٫۲٫۳", "۱۲x۳", "۱,۲۳۴,۵۶", "۱ ۲۳۴"]) {
    assert.throws(() => amountForStorage(value, "EUR", "IRR"), value);
  }
  assert.equal(normalizeNumericInput("1,234.50"), "1234.50");
  assert.equal(amountForStorage("۱٫۲e۳", "EUR", "IRR").toString(), "1200");
});
const eurWallet: Wallet = { id: "eur", name: "EUR", code: "eur", currency: "EUR", archived: false, createdAt: timestamp };
const usdWallet: Wallet = { id: "usd", name: "USD", code: "usd", currency: "USD", archived: false, createdAt: timestamp };
const rates: Rate[] = [
  { id: "usd-rate", baseCurrency: "EUR", quoteCurrency: "USD", value: "2", effectiveDate: "2026-01-01", source: "test", method: "manual", createdAt: timestamp },
];

function idFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-${++index}`;
}

test("historical exchange valuation never falls forward to a future rate", () => {
  assert.equal(rateOnOrBefore(rates, "USD", "2025-12-31"), null);
  assert.equal(rateOnOrBefore(rates, "USD", "2026-01-01")?.toString(), "2");
  assert.equal(latestRate(rates, "USD", "2025-12-31"), null);
  assert.equal(latestRate(rates, "USD", "2026-01-01")?.toString(), "2");
  assert.equal(rateOnOrBefore(rates, "EUR", "1900-01-01")?.toString(), "1");
});

test("dated conversions use the nearest saved rate when no prior rate exists", () => {
  const conversion = convertWithRateFallback("10", "USD", "EUR", rates, "2025-12-31");
  assert.equal(conversion?.value.toString(), "5");
  assert.equal(conversion?.usedFallback, true);
  assert.equal(convert("10", "USD", "EUR", rates, "2025-12-31")?.toString(), "5");

  const current = convertWithRateFallback("10", "USD", "EUR", rates, "2026-01-02");
  assert.equal(current?.value.toString(), "5");
  assert.equal(current?.usedFallback, false);
});

test("editing an imported amount or direction updates its signed balance delta", () => {
  const imported: Transaction = {
    id: "imported",
    date: "2026-01-01",
    walletId: "usd",
    operation: "exchange",
    direction: "out",
    categoryId: null,
    category: "Exchange (OUT)",
    amount: "20",
    balanceAmount: "-20",
    currency: "USD",
    note: "",
    reportable: false,
    affectsBalance: true,
    linkId: null,
    sourceSheet: "usd",
    sourceRow: 2,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  assert.equal(editedBalanceAmount(imported, "25", "out"), "-25");
  assert.equal(editedBalanceAmount(imported, "20", "in"), "20");
  assert.equal(editedBalanceAmount(imported, "20", "out"), "-20");
  assert.equal(signedBalanceAmount("20", "income"), "20");
  assert.equal(signedBalanceAmount("20", "expense"), "-20");
});

test("synthetic IRR opening balance is reduced by the signed expense", () => {
  // Invented labels and simple amounts; never copy an owner's records into fixtures.
  const walletId = "synthetic-irr-wallet";
  const expense: Transaction = {
    id: "synthetic-irr-expense",
    date: "2026-01-02",
    walletId,
    operation: "transaction",
    direction: "expense",
    categoryId: "synthetic-food",
    category: "Food",
    amount: "250",
    balanceAmount: signedBalanceAmount("250", "expense"),
    currency: "IRR",
    note: "Synthetic expense",
    reportable: true,
    affectsBalance: true,
    linkId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const openingBalance: Transaction = {
    ...expense,
    id: "synthetic-irr-opening",
    direction: "income",
    amount: "1000",
    balanceAmount: "1000",
  };

  assert.equal(expense.balanceAmount, "-250");
  assert.equal(walletBalance(walletId, [openingBalance, expense]).toString(), "750");
});

test("IRR input representations round-trip through canonical storage exactly", () => {
  assert.equal(amountForStorage("125", "IRR", "TMN").toString(), "1250");
  assert.equal(amountForStorage("1.25", "IRR", "HTM").toString(), "12500");
  assert.equal(amountForStorage("2", "IRR", "MTM").toString(), "20000000");
  assert.equal(amountForStorage("12.34", "EUR", "MTM").toString(), "12.34");

  assert.equal(amountForDisplayInput("1250", "IRR", "TMN"), "125");
  assert.equal(amountForDisplayInput("12500", "IRR", "HTM"), "1.25");
  assert.equal(amountForDisplayInput("20000000", "IRR", "MTM"), "2");
  assert.equal(amountForDisplayInput("12.34", "EUR", "MTM"), "12.34");
});

test("linked exchange creation uses its type reporting setting", () => {
  const changes = buildLinkedActivityChanges({
    kind: "exchange",
    date: "2026-07-14",
    fromWallet: usdWallet,
    toWallet: eurWallet,
    sentAmount: "20",
    receivedAmount: "11",
    note: "synthetic",
    timestamp,
    linkId: "exchange-1",
    reportable: false,
    createId: idFactory(),
  });
  assert.deepEqual(changes.rowsToPut.map((row) => row.operation), ["exchange", "exchange"]);
  assert.deepEqual(changes.rowsToPut.map((row) => row.direction), ["out", "in"]);
  assert.deepEqual(changes.rowsToPut.map((row) => row.balanceAmount), ["-20", "11"]);
  assert.ok(changes.rowsToPut.every((row) => !row.reportable && row.affectsBalance && row.categoryId === null && row.category === "Exchange"));
  assert.deepEqual(changes.rowIdsToDelete, []);
});

test("linked exchange editing rewrites only the pair and preserves legacy extras", () => {
  const created = buildLinkedActivityChanges({
    kind: "exchange",
    date: "2026-07-14",
    fromWallet: usdWallet,
    toWallet: eurWallet,
    sentAmount: "20",
    receivedAmount: "11",
    note: "synthetic",
    timestamp,
    linkId: "exchange-1",
    reportable: false,
    createId: idFactory(),
  }).rowsToPut;
  const legacyAdjustment: Transaction = {
    ...created[1],
    id: "legacy-adjustment",
    operation: "adjustment",
    direction: "income",
    category: "Exchange gain",
    categoryId: "category-exchange-gain",
    amount: "1",
    currency: "EUR",
    reportable: true,
    affectsBalance: false,
  };
  const edited = buildLinkedActivityChanges({
    kind: "exchange",
    date: "2025-12-31",
    fromWallet: usdWallet,
    toWallet: eurWallet,
    sentAmount: "30",
    receivedAmount: "15",
    note: "edited",
    timestamp: "2026-07-14T13:00:00.000Z",
    linkId: "exchange-1",
    reportable: false,
    existingRows: [...created, legacyAdjustment],
    createId: idFactory(),
  });
  assert.equal(edited.rowsToPut.length, 2);
  assert.deepEqual(edited.rowsToPut.map((row) => row.amount), ["30", "15"]);
  assert.deepEqual(edited.rowsToPut.map((row) => row.balanceAmount), ["-30", "15"]);
  assert.deepEqual(edited.rowIdsToDelete, []);
});

test("linked transfers persist exact signed deltas on creation and editing", () => {
  const input = {
    kind: "transfer" as const,
    date: "2026-07-14",
    fromWallet: eurWallet,
    toWallet: { ...eurWallet, id: "eur-2" },
    sentAmount: "123456789012345678.123456",
    receivedAmount: "123456789012345678.123456",
    note: "synthetic",
    timestamp,
    linkId: "transfer-precise",
    reportable: false,
    createId: idFactory(),
  };
  const created = buildLinkedActivityChanges(input).rowsToPut;
  assert.deepEqual(created.map((row) => row.balanceAmount), [
    "-123456789012345678.123456", "123456789012345678.123456",
  ]);
  const edited = buildLinkedActivityChanges({
    ...input, existingRows: created, sentAmount: "0.000001", receivedAmount: "0.000001",
  }).rowsToPut;
  assert.deepEqual(edited.map((row) => row.balanceAmount), ["-0.000001", "0.000001"]);
  assert.equal(walletBalance(eurWallet.id, edited).toString(), "-0.000001");
  assert.equal(walletBalance("eur-2", edited).toString(), "0.000001");
});

test("only complete linked exchanges collapse into one displayed activity", () => {
  const linked = buildLinkedActivityChanges({
    kind: "exchange",
    date: "2026-07-14",
    fromWallet: usdWallet,
    toWallet: eurWallet,
    sentAmount: "20",
    receivedAmount: "11",
    note: "synthetic",
    timestamp,
    linkId: "exchange-1",
    reportable: false,
    createId: idFactory(),
  }).rowsToPut;
  const unlinked = { ...linked[0], id: "legacy-out", linkId: null };
  const legacyAdjustment: Transaction = {
    ...linked[1], id: "legacy-adjustment", operation: "adjustment", direction: "income",
    categoryId: "category-exchange-gain", category: "Exchange gain", reportable: true,
    affectsBalance: false,
  };
  const activities = groupTransactionActivities([...linked, legacyAdjustment, unlinked]);
  assert.equal(activities.length, 3);
  assert.equal(activities[0].rows.length, 2);
  assert.equal(activities[0].exchangeOut?.amount, "20");
  assert.equal(activities[0].exchangeIn?.amount, "11");
  assert.equal(activities[1].primary.id, "legacy-adjustment");
  assert.equal(activities[2].primary.id, "legacy-out");
});

test("same-currency exchanges are rejected in favor of transfers", () => {
  assert.throws(() => buildLinkedActivityChanges({
    kind: "exchange",
    date: "2026-07-14",
    fromWallet: eurWallet,
    toWallet: { ...eurWallet, id: "eur-2" },
    sentAmount: "10",
    receivedAmount: "10",
    note: "",
    timestamp,
    linkId: "exchange-2",
    reportable: false,
    createId: idFactory(),
  }), /Use a transfer/);
});

test("30-day totals name currencies excluded for missing rates", () => {
  const row = (currency: string): Transaction => ({
    id: currency, date: "2026-01-02", walletId: "w", operation: "transaction", direction: "expense",
    categoryId: "c", category: "Food", amount: "5", balanceAmount: "-5", currency, note: "",
    reportable: true, affectsBalance: true, linkId: null, createdAt: "2026-01-02T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z",
  });
  const total = reportTotalWithMissing([row("EUR"), row("ZZZ")], "expense", "EUR", []);
  assert.equal(total.value.toString(), "5");
  assert.deepEqual(total.missing, ["ZZZ"]);
  const usdRate = { id: "usd", baseCurrency: "EUR", quoteCurrency: "USD", value: "1.1", effectiveDate: "2026-01-02",
    source: "Synthetic", method: "manual", createdAt: "2026-01-02T00:00:00Z" } as Rate;
  assert.deepEqual(reportTotalWithMissing([row("USD")], "expense", "ZZZ", [usdRate]).missing, ["ZZZ"],
    "an unrated reporting currency is named instead of the rated transaction currency");
});

test("currency formatting keeps every digit of large amounts", () => {
  assert.equal(formatMoney("12345678901234567.89", "EUR"), "€12,345,678,901,234,567.89");
});
