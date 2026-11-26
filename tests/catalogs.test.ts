import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CATEGORY_GROUPS, groupCategories, renamedCategoryGroup } from "../packages/core/src/lib/category-groups.ts";
import * as Lucide from "lucide-react";
import {
  BUILT_IN_CURRENCIES,
  CATEGORY_TEMPLATES,
  categoryTranslationPlan,
  categoriesForLocale,
  mergeBuiltInCurrencies,
  mergeCategoryTemplates,
} from "../packages/core/src/lib/catalogs.ts";
import {
  categoryCanBePermanentlyDeleted,
  categoryNameIsAvailable,
  categoryTransactionUpdates,
  mergeOtherIncomeCategory,
} from "../packages/core/src/lib/catalog-management.ts";
import {
  visibleCategoryOptions,
} from "../packages/core/src/lib/category-visibility.ts";
import { titleCaseCategoryLabel, titleCaseCategoryName } from "../packages/core/src/lib/category-names.ts";
import { isTransactionTypeCategoryLabel } from "../packages/core/src/lib/transaction-types.ts";
import { DATA_COLORS } from "../packages/core/src/lib/colors.ts";
import type { Category, Currency, Transaction } from "../packages/core/src/lib/types.ts";

test("every built-in category belongs to exactly one sensible localized group", () => {
  const keys = DEFAULT_CATEGORY_GROUPS.flatMap((group) => [...group.keys]);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual([...keys].sort(), CATEGORY_TEMPLATES.map((template) => template.key).sort());
  for (const locale of ["en", "fa"] as const) {
    assert.ok(categoriesForLocale(locale).every((category) => typeof category.group === "string" && category.group.length > 0));
  }
  assert.equal(categoriesForLocale("en").find((category) => category.templateKey === "coffee")?.group, "Food & Groceries");
});

test("legacy groups are assigned once while custom groups and explicit ungrouping survive", () => {
  const legacy = categoriesForLocale("en").map((category) => {
    const copy = { ...category };
    delete copy.group;
    return copy;
  });
  const grouped = mergeCategoryTemplates(legacy, "en");
  assert.ok(grouped.every((category) => category.group));
  const custom = { ...grouped[0], group: "My work" };
  const ungrouped = { ...grouped[1], group: null };
  const again = mergeCategoryTemplates([custom, ungrouped, ...grouped.slice(2)], "fa");
  assert.equal(again[0].group, "My work");
  assert.equal(again[1].group, null);
  assert.equal(again[2].group, grouped[2].group);
  assert.equal(again[0].id, custom.id);
});

test("renaming groups includes archived categories and changes no other category metadata", () => {
  const categories = categoriesForLocale("en");
  categories.find((category) => category.templateKey === "coffee")!.archived = true;
  const changed = renamedCategoryGroup(categories, "Food & Groceries", "  Everyday   food  ");
  assert.equal(changed.length, 3);
  for (const category of changed) {
    const original = categories.find((item) => item.id === category.id)!;
    assert.deepEqual(category, { ...original, group: "Everyday food" });
  }
  assert.ok(categories.some((category) => category.group === "Food & Groceries"));
  const buckets = groupCategories([...changed, { ...categories[0], group: null }], (category) => category.group, "en");
  assert.equal(buckets.at(-1)?.name, null);
});

const requestedCurrencyCodes = [
  "USD", "EUR", "GBP", "CHF", "CAD", "AUD", "JPY", "CNY", "INR", "CZK", "SEK",
  "NOK", "DKK", "PLN", "HUF", "RON", "ISK", "UAH", "RSD", "RUB", "TRY", "AED",
  "SAR", "IRR", "AFN", "AMD", "AZN", "IQD", "PKR", "TMT", "BRL", "EGP", "ETB", "IDR", "ZAR", "BTC", "ETH", "USDT",
];

const approvedPersonalCategoryNames = [
  "Business", "Charity", "Clothing", "Coffee", "Education", "Entertainment", "Food & Drink", "Freelance",
  "Gifts", "Government & Administration", "Grants", "Groceries", "Hobbies", "Home", "Insurance",
  "Interest Income", "Intoxicants", "Investments", "Loan Received", "Loan Repayments", "Medical Care",
  "Other Expenses", "Other Income", "Personal Care", "Pharmacy & Supplements", "Phone & Internet",
  "Rental Income", "Temporary - Repayment Received", "Rent", "Rideshare", "Salary & Wages", "Service Fees",
  "Social Activities", "Sport & Fitness", "Subscriptions", "Support", "Taxi", "Taxes", "Temporary - Paid for Others",
  "Temporary - Funds Spent", "Temporary - Funds Received", "Tools & Equipment", "Transport", "Travel", "Utilities",
];

const approvedPalette: ReadonlySet<string> = new Set(DATA_COLORS);

const iconExportName = (icon: string) => icon
  .split("-")
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join("");

test("built-in currency catalog exactly matches the approved codes", () => {
  assert.deepEqual(BUILT_IN_CURRENCIES.map(({ code }) => code), requestedCurrencyCodes);
  assert.equal(new Set(requestedCurrencyCodes).size, BUILT_IN_CURRENCIES.length);
  assert.ok(BUILT_IN_CURRENCIES.every((currency) =>
    currency.builtIn &&
    !currency.archived &&
    currency.name.length > 0 &&
    currency.symbol.length > 0 &&
    currency.fractionDigits >= 0 &&
    currency.fractionDigits <= 18
  ));
  assert.equal(BUILT_IN_CURRENCIES.find(({ code }) => code === "USDT")?.code.length, 4);
});

test("BRICS additions use canonical fiat metadata", () => {
  assert.deepEqual(
    BUILT_IN_CURRENCIES.filter(({ code }) => ["BRL", "EGP", "ETB", "IDR", "ZAR"].includes(code)),
    [
      { code: "BRL", name: "Brazilian real", symbol: "R$", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
      { code: "EGP", name: "Egyptian pound", symbol: "E£", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
      { code: "ETB", name: "Ethiopian birr", symbol: "Br", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
      { code: "IDR", name: "Indonesian rupiah", symbol: "Rp", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
      { code: "ZAR", name: "South African rand", symbol: "R", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
    ],
  );
});

test("category templates contain the approved personal baseline and protected fallbacks", () => {
  const ordinaryNames = CATEGORY_TEMPLATES
    .filter((template) => !template.system)
    .map((template) => template.names.en)
    .sort();
  assert.deepEqual(ordinaryNames, approvedPersonalCategoryNames
    .filter((name) => name !== "Other Expenses" && name !== "Other Income")
    .sort());
  assert.deepEqual(
    CATEGORY_TEMPLATES.filter((template) => template.system).map((template) => template.key),
    ["other-expenses", "other-income"],
  );
  assert.equal(CATEGORY_TEMPLATES.some((template) => template.names.en === "Extra Income"), false);
  assert.ok(CATEGORY_TEMPLATES.every((template) =>
    template.names.en.length > 0 &&
    template.names.en === titleCaseCategoryName(template.names.en) &&
    template.names.fa.length > 0 &&
    approvedPalette.has(template.color) &&
    iconExportName(template.icon) in Lucide
  ));
});

test("category casing uses title case while preserving movement direction tokens", () => {
  assert.equal(titleCaseCategoryName("  other   income "), "Other Income");
  assert.equal(titleCaseCategoryName("phone & internet"), "Phone & Internet");
  assert.equal(titleCaseCategoryName("support for others"), "Support for Others");
  assert.equal(titleCaseCategoryName("سایر درآمدها"), "سایر درآمدها");
  assert.equal(titleCaseCategoryLabel("transfer (OUT)", "transfer"), "transfer (OUT)");
});

test("locale materialization stores Farsi names only when Farsi is selected", () => {
  const english = categoriesForLocale("en");
  const farsi = categoriesForLocale("fa");
  assert.equal(english.length, CATEGORY_TEMPLATES.length);
  assert.equal(farsi.length, CATEGORY_TEMPLATES.length);
  assert.equal(english.find(({ templateKey }) => templateKey === "salary")?.name, "Salary & Wages");
  assert.equal(farsi.find(({ templateKey }) => templateKey === "salary")?.name, CATEGORY_TEMPLATES.find(({ key }) => key === "salary")?.names.fa);
  assert.ok(farsi.every((category) => category.templateKey !== null));
});

test("temporary funds and reimbursements are out of reports by default", () => {
  const categories = categoriesForLocale("en");
  for (const templateKey of ["temporary-advances", "temporary-funds-disbursed", "temporary-received-funds", "reimbursements-received"]) {
    assert.equal(categories.find((category) => category.templateKey === templateKey)?.defaultReportable, false);
  }
});

test("canonical temporary-funds renames preserve identities and add disbursed funds", () => {
  const existing = categoriesForLocale("en").map((category) =>
    category.templateKey === "temporary-advances"
      ? { ...category, name: "Temporary Advances" }
      : category.templateKey === "temporary-received-funds"
        ? { ...category, name: "Temporary Received Funds" }
        : category,
  ).filter((category) => category.templateKey !== "temporary-funds-disbursed");
  const merged = mergeCategoryTemplates(existing, "en");

  assert.equal(merged.find(({ templateKey }) => templateKey === "temporary-advances")?.name, "Temporary - Paid for Others");
  assert.equal(merged.find(({ templateKey }) => templateKey === "temporary-received-funds")?.name, "Temporary - Funds Received");
  assert.equal(merged.find(({ templateKey }) => templateKey === "temporary-funds-disbursed")?.name, "Temporary - Funds Spent");
  assert.equal(merged.find(({ templateKey }) => templateKey === "temporary-funds-disbursed")?.defaultReportable, false);
});

test("temporary category renames are ASCII, preserve metadata, and run only once", () => {
  const previousNames: Record<string, string> = {
    "temporary-advances": "Temporary Advances Given",
    "temporary-received-funds": "Temporary Funds Received",
    "temporary-funds-disbursed": "Temporary Funds Disbursed",
    "reimbursements-received": "Reimbursements Received",
  };
  const existing = categoriesForLocale("en").map((category) => previousNames[category.templateKey!]
    ? {...category, name: previousNames[category.templateKey!], group: "Authored group", archived: true, defaultReportable: true}
    : category);
  const merged = mergeCategoryTemplates(existing, "fa");
  for (const before of existing.filter((category) => previousNames[category.templateKey!])) {
    const after = merged.find(({id}) => id === before.id)!;
    assert.match(after.name, /^Temporary - [\x20-\x7E]+$/);
    assert.deepEqual({...after, name: before.name}, before);
    const customized = {...before, name: "My own category name"};
    assert.deepEqual(mergeCategoryTemplates([customized], "en").find(({id}) => id === before.id), customized);
    const unidentified = {...before, templateKey: null};
    const recognized = mergeCategoryTemplates([unidentified], "en");
    assert.equal(recognized.find(({id}) => id === before.id)?.templateKey, before.templateKey);
    assert.equal(recognized.filter(({templateKey}) => templateKey === before.templateKey).length, 1);
  }
  assert.deepEqual(mergeCategoryTemplates(merged, "fa"), merged);
});

test("catalog merging preserves custom data and prefers canonical Other Income over its legacy alias", () => {
  const existingCategories: Category[] = [
    { id: "extra", name: "Extra Income", scope: "income", archived: false, templateKey: null, system: false, color: "#616161", icon: "tag", defaultReportable: true },
    { id: "other", name: "Other Income", scope: "income", archived: false, templateKey: null, system: false, color: "#616161", icon: "tag", defaultReportable: true },
    { id: "custom", name: "My Custom", scope: "expense", archived: true, templateKey: null, system: false, color: "#A71256", icon: "star", defaultReportable: false },
  ];
  const merged = mergeCategoryTemplates(existingCategories, "en");
  assert.equal(merged.find(({ id }) => id === "other")?.templateKey, "other-income");
  assert.equal(merged.find(({ id }) => id === "extra")?.templateKey, null);
  assert.deepEqual(merged.find(({ id }) => id === "custom"), existingCategories[2]);

  const customCurrency: Currency = { code: "PTS", name: "Points", symbol: "pt", kind: "custom", fractionDigits: 0, builtIn: false, archived: true };
  const currencies = mergeBuiltInCurrencies([customCurrency]);
  assert.deepEqual(currencies.find(({ code }) => code === "PTS"), customCurrency);
  assert.equal(currencies.find(({ code }) => code === "USDT")?.builtIn, true);
});

test("protected fallback categories are restored when an older database archived them", () => {
  const existing = categoriesForLocale("en").map((category) =>
    category.templateKey === "other-expenses" || category.templateKey === "other-income"
      ? { ...category, archived: true, system: false }
      : category,
  );
  const merged = mergeCategoryTemplates(existing, "en");
  assert.deepEqual(
    merged.filter((category) => category.templateKey === "other-expenses" || category.templateKey === "other-income")
      .map(({ templateKey, archived, system }) => ({ templateKey, archived, system })),
    [
      { templateKey: "other-expenses", archived: false, system: true },
      { templateKey: "other-income", archived: false, system: true },
    ],
  );
});

test("legacy expense fallback aliases receive the canonical name without changing identity or group choices", () => {
  const fallback = categoriesForLocale("en").find(row => row.templateKey === "other-expenses")!;
  const legacy = { ...fallback, id: "synthetic-legacy-other", name: "Other", group: null };
  const merged = mergeCategoryTemplates([legacy], "fa");
  assert.equal(merged.find(row => row.id === legacy.id)?.name, "Other Expenses");
  assert.equal(merged.find(row => row.id === legacy.id)?.group, null);
  assert.equal(merged.filter(row => row.templateKey === "other-expenses").length, 1);
  assert.deepEqual(mergeCategoryTemplates(merged, "fa"), merged);
});

test("default reconciliation preserves an intentionally separate Other and never adopts an income Other as expenses", () => {
  const catalog = categoriesForLocale("en");
  const custom: Category = { ...catalog[0], id: "synthetic-authored-other", name: "Other", scope: "expense", group: null, system: false, templateKey: null };
  const merged = mergeCategoryTemplates([...catalog, custom], "en");
  assert.deepEqual(merged.find(row => row.id === custom.id), custom);
  assert.equal(merged.filter(row => row.templateKey === "other-expenses").length, 1);
  const incomeOther = { ...custom, scope: "income" as const };
  const upgraded = mergeCategoryTemplates([incomeOther], "en");
  assert.deepEqual(upgraded.find(row => row.id === custom.id), incomeOther);
  assert.equal(upgraded.find(row => row.templateKey === "other-expenses")?.name, "Other Expenses");
});

test("protected fallback categories upgrade their legacy icons", () => {
  const existing = categoriesForLocale("en").map((category) =>
    category.templateKey === "other-expenses" ? { ...category, icon: "circle-ellipsis" } :
    category.templateKey === "other-income" ? { ...category, icon: "wallet-cards" } : category,
  );
  const merged = mergeCategoryTemplates(existing, "en");
  assert.equal(merged.find(({ templateKey }) => templateKey === "other-expenses")?.icon, "receipt");
  assert.equal(merged.find(({ templateKey }) => templateKey === "other-income")?.icon, "banknote");
});

test("canonical category renames upgrade only their former canonical names", () => {
  const existing = categoriesForLocale("en").map((category) =>
    category.templateKey === "salary" ? { ...category, name: "Salary" } :
    category.templateKey === "support-others" ? { ...category, name: "My support" } : category,
  );
  const merged = mergeCategoryTemplates(existing, "en");
  assert.equal(merged.find(({ templateKey }) => templateKey === "salary")?.name, "Salary & Wages");
  assert.equal(merged.find(({ templateKey }) => templateKey === "support-others")?.name, "My support");
});

test("explicit category translation changes only recognized unmodified template names", () => {
  const categories = categoriesForLocale("en");
  const salary = categories.find((category) => category.templateKey === "salary")!;
  const renamed = { ...categories.find((category) => category.templateKey === "rent")!, name: "My rent" };
  const custom: Category = { id: "custom", name: "Custom", scope: "expense", archived: false, templateKey: null, system: false, color: "#616161", icon: "tag", defaultReportable: true };
  const plan = categoryTranslationPlan([salary, renamed, custom], "fa");
  assert.deepEqual(plan, [{ id: salary.id, name: CATEGORY_TEMPLATES.find((template) => template.key === "salary")!.names.fa }]);
  assert.deepEqual(categoryTranslationPlan([{ ...salary, name: "Authored salary" }], "fa"), []);
});

test("category metadata changes preserve financial fields while relabeling and changing reporting", () => {
  const previous: Category = { id: "category-temp", name: "Temporary Advances Given", scope: "expense", archived: false, templateKey: "temporary-advances", system: false, color: "#E1C339", icon: "arrow-up-from-line", defaultReportable: true };
  const next = { ...previous, name: "Advances", defaultReportable: false };
  const transaction: Transaction = { id: "tx-1", date: "2026-07-19", walletId: "wallet", operation: "transaction", direction: "expense", categoryId: previous.id, category: previous.name, amount: "123.45", currency: "EUR", note: "private", reportable: true, affectsBalance: true, linkId: null, createdAt: "created", updatedAt: "old" };
  const updates = categoryTransactionUpdates([transaction], previous, next, "updated");
  assert.equal(updates[0].category, "Advances");
  assert.equal(updates[0].reportable, false);
  assert.equal(updates[0].amount, transaction.amount);
  assert.equal(updates[0].note, transaction.note);
  assert.equal(updates[0].currency, transaction.currency);
});

test("only unused custom categories qualify for permanent deletion", () => {
  const custom: Category = { id: "custom", name: "Custom", scope: "expense", archived: false, templateKey: null, system: false, color: "#616161", icon: "tag", defaultReportable: true };
  assert.equal(categoryCanBePermanentlyDeleted(custom, 0), true);
  assert.equal(categoryCanBePermanentlyDeleted({ ...custom, archived: true }, 0), true);
  assert.equal(categoryCanBePermanentlyDeleted(custom, 1), false);
  assert.equal(categoryCanBePermanentlyDeleted({ ...custom, templateKey: "salary" }, 0), false);
  assert.equal(categoryCanBePermanentlyDeleted({ ...custom, system: true }, 0), false);
  assert.equal(categoryNameIsAvailable([custom], "other", " custom "), false);
});

test("category options exclude fixed transaction types", () => {
  const categories = categoriesForLocale("en");
  const salary = categories.find((category) => category.templateKey === "salary")!;
  const transaction = (id: string, operation: Transaction["operation"], direction: Transaction["direction"], categoryId: string | null, category: string): Transaction => ({
    id,
    date: "2026-07-19",
    walletId: "wallet",
    operation,
    direction,
    categoryId,
    category,
    amount: "1",
    currency: "EUR",
    note: "",
    reportable: operation === "transaction",
    affectsBalance: true,
    linkId: null,
    createdAt: "created",
    updatedAt: "updated",
  });
  const rows = [
    transaction("salary", "transaction", "income", salary.id, salary.name),
    transaction("transfer-out", "transfer", "out", null, "Transfer (OUT)"),
    transaction("transfer-in", "transfer", "in", null, "Transfer (IN)"),
    transaction("exchange-out", "exchange", "out", null, "Exchange (OUT)"),
    transaction("adjustment-in", "adjustment", "in", null, "Adjustment (IN)"),
  ];
  const options = visibleCategoryOptions(categories, rows);
  for (const operation of ["transfer", "exchange", "adjustment"] as const) {
    assert.equal(options.some((option) => option.operation === operation), false);
  }
  assert.equal(options.some((option) => /^(Transfer|Exchange|Adjustment)/.test(option.name)), false);
  assert.equal(options.find((option) => option.name === "Salary & Wages")?.activity, false);
  assert.equal(isTransactionTypeCategoryLabel("Transfer (OUT)"), true);
  assert.equal(isTransactionTypeCategoryLabel("Adjustment"), true);
  assert.equal(isTransactionTypeCategoryLabel("Salary"), false);
});

test("Extra Income is combined into canonical Other Income without changing financial data", () => {
  const other: Category = { id: "other", name: "Other Income", scope: "income", archived: false, templateKey: null, system: false, color: "#258042", icon: "wallet-cards", defaultReportable: true };
  const extra: Category = { id: "extra", name: "Extra Income", scope: "income", archived: false, templateKey: null, system: false, color: "#616161", icon: "tag", defaultReportable: true };
  const baseTransaction: Transaction = { id: "tx", date: "2026-07-19", walletId: "wallet", operation: "transaction", direction: "income", categoryId: extra.id, category: extra.name, amount: "123.4500", balanceAmount: "123.4500", currency: "EUR", note: "synthetic note", reportable: true, affectsBalance: true, linkId: null, createdAt: "created", updatedAt: "updated" };
  const merged = mergeOtherIncomeCategory([extra, other], [baseTransaction]);
  assert.equal(merged.categories.length, 1);
  assert.equal(merged.categories[0].id, other.id);
  assert.equal(merged.categories[0].name, "Other Income");
  assert.equal(merged.categories[0].templateKey, "other-income");
  assert.equal(merged.categories[0].system, true);
  assert.deepEqual(merged.removedCategoryIds, [extra.id]);
  assert.equal(merged.transactions[0].categoryId, other.id);
  assert.equal(merged.transactions[0].category, "Other Income");
  assert.equal(merged.transactions[0].amount, baseTransaction.amount);
  assert.equal(merged.transactions[0].balanceAmount, baseTransaction.balanceAmount);
  assert.equal(merged.transactions[0].currency, baseTransaction.currency);
  assert.equal(merged.transactions[0].note, baseTransaction.note);
  assert.equal(merged.transactions[0].updatedAt, baseTransaction.updatedAt);
});


test("purpose-based defaults keep income distinct and preserve saved groups", () => {
  for (const locale of ["en", "fa"] as const) {
    const defaults = categoriesForLocale(locale);
    const education = defaults.find(c => c.templateKey === "education")!;
    const leisure = defaults.filter(c => ["entertainment", "personal-projects", "social-activities", "intoxicants"].includes(c.templateKey!));
    const workGroup = locale === "en" ? "Work & Learning" : "کار و یادگیری";
    const incomeGroup = locale === "en" ? "Income" : "درآمد";
    assert.equal(education.group, workGroup);
    assert.ok(defaults.filter(c => ["business", "tools-equipment"].includes(c.templateKey!)).every(c => c.group === workGroup));
    assert.ok(defaults.filter(c => ["freelance", "grants", "salary", "rental-income", "interest-income", "other-income"].includes(c.templateKey!)).every(c => c.group === incomeGroup));
    const groups = new Map<string, number>();
    for (const category of defaults) {
      assert.ok(category.group);
      groups.set(category.group, (groups.get(category.group) ?? 0) + 1);
    }
    assert.equal(groups.size, 11);
    assert.deepEqual([...groups].filter(([, size]) => size === 1).map(([name]) => name), [locale === "en" ? "Other" : "سایر"]);
    assert.ok(leisure.every(c => c.group === (locale === "en" ? "Leisure & Social" : "تفریح و معاشرت")));
    for (const group of ["My authored group", "Learning", "Learning & Leisure", "Work & Income", null]) {
      const existing = { ...education, group };
      const merged = mergeCategoryTemplates([existing], locale).find(c => c.id === education.id)!;
      assert.deepEqual(merged, existing);
    }
  }
});
