import type { Category, Transaction } from "./types.ts";

const OTHER_INCOME_TEMPLATE_KEY = "other-income";
const OTHER_INCOME_ENGLISH = "Other Income";
const OTHER_INCOME_FARSI = "سایر درآمدها";
const OTHER_INCOME_COLOR = "#258042";
const OTHER_INCOME_ICON = "banknote";
const OTHER_INCOME_RECOGNIZED_NAMES = new Set([
  "extra income",
  "other income",
  OTHER_INCOME_FARSI,
]);

function normalizedName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function categoryNameIsAvailable(
  categories: Category[],
  categoryId: string,
  name: string,
): boolean {
  const normalized = normalizedName(name);
  return normalized.length > 0 && !categories.some(
    (category) => category.id !== categoryId && normalizedName(category.name) === normalized,
  );
}

export function categoryTransactionUpdates(
  transactions: Transaction[],
  previous: Category,
  next: Category,
  updatedAt: string,
): Transaction[] {
  const rename = previous.name !== next.name;
  const reportingChanged = previous.defaultReportable !== next.defaultReportable;
  if (!rename && !reportingChanged) return [];
  return transactions
    .filter((transaction) => transaction.categoryId === next.id)
    .map((transaction) => ({
      ...transaction,
      category: rename ? next.name : transaction.category,
      reportable: reportingChanged ? next.defaultReportable : transaction.reportable,
      updatedAt,
    }));
}

export function categoryCanBePermanentlyDeleted(
  category: Category,
  transactionCount: number,
): boolean {
  return !category.system && category.templateKey === null && transactionCount === 0;
}

export interface OtherIncomeMergeResult {
  categories: Category[];
  transactions: Transaction[];
  removedCategoryIds: string[];
  changed: boolean;
}

/** Canonicalize the one approved semantic category merge without touching money or notes. */
export function mergeOtherIncomeCategory(
  categories: Category[],
  transactions: Transaction[],
): OtherIncomeMergeResult {
  const matches = categories.filter((category) =>
    category.templateKey === OTHER_INCOME_TEMPLATE_KEY ||
    OTHER_INCOME_RECOGNIZED_NAMES.has(normalizedName(category.name))
  );
  if (matches.length === 0) {
    return { categories, transactions, removedCategoryIds: [], changed: false };
  }
  const keeper = [...matches].sort((left, right) => {
    const score = (category: Category) =>
      category.templateKey === OTHER_INCOME_TEMPLATE_KEY ? 0 :
      normalizedName(category.name) === "other income" ? 1 :
      normalizedName(category.name) === OTHER_INCOME_FARSI ? 2 : 3;
    return score(left) - score(right);
  })[0];
  const keeperNameIsAuthored = keeper.templateKey === OTHER_INCOME_TEMPLATE_KEY &&
    !OTHER_INCOME_RECOGNIZED_NAMES.has(normalizedName(keeper.name));
  const canonicalName = keeperNameIsAuthored
    ? keeper.name
    : matches.some((category) => normalizedName(category.name) === OTHER_INCOME_FARSI)
      ? OTHER_INCOME_FARSI
      : OTHER_INCOME_ENGLISH;
  const matchIds = new Set(matches.map((category) => category.id));
  const removedCategoryIds = matches.filter((category) => category.id !== keeper.id).map((category) => category.id);
  const scopes = new Set(matches.map((category) => category.scope));
  const keeperWasCanonicalTemplate = keeper.templateKey === OTHER_INCOME_TEMPLATE_KEY;
  const canonicalCategory: Category = {
    ...keeper,
    name: canonicalName,
    scope: scopes.size === 1 ? keeper.scope : "both",
    archived: false,
    templateKey: OTHER_INCOME_TEMPLATE_KEY,
    system: true,
    color: keeperWasCanonicalTemplate ? keeper.color : OTHER_INCOME_COLOR,
    icon: keeperWasCanonicalTemplate ? keeper.icon : OTHER_INCOME_ICON,
    defaultReportable: keeperWasCanonicalTemplate ? keeper.defaultReportable : true,
  };
  const nextCategories = categories.flatMap((category) => {
    if (category.id === keeper.id) return [canonicalCategory];
    return matchIds.has(category.id) ? [] : [category];
  });
  const nextTransactions = transactions.map((transaction) => {
    const recognizedLabel = OTHER_INCOME_RECOGNIZED_NAMES.has(normalizedName(transaction.category));
    if (!matchIds.has(transaction.categoryId ?? "") && !recognizedLabel) return transaction;
    if (transaction.categoryId === keeper.id && transaction.category === canonicalName) return transaction;
    return { ...transaction, categoryId: keeper.id, category: canonicalName };
  });
  const changed = removedCategoryIds.length > 0 ||
    keeper.name !== canonicalCategory.name ||
    keeper.scope !== canonicalCategory.scope ||
    keeper.archived !== canonicalCategory.archived ||
    keeper.templateKey !== canonicalCategory.templateKey ||
    nextTransactions.some((transaction, index) => transaction !== transactions[index]);
  return { categories: nextCategories, transactions: nextTransactions, removedCategoryIds, changed };
}
