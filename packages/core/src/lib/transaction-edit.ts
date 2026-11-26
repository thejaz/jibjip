import { AppError } from "./app-error.ts";
import type { AppSnapshot, Category, Transaction } from "./types.ts";

/** Use the stored, possibly Farsi, system fallback rather than inventing a generic category. */
export function fallbackCategoryName(categories: readonly Category[], direction: "income" | "expense"): string {
  const key = direction === "income" ? "other-income" : "other-expenses";
  return categories.find(row => row.templateKey === key && row.system)?.name ?? (direction === "income" ? "Other Income" : "Other Expenses");
}

/** A note/date/amount edit must not reset an imported per-transaction choice. */
export function editedReportability(original: Transaction, category: Category): boolean {
  const sameCategory = original.categoryId
    ? original.categoryId === category.id
    : original.category === category.name;
  return sameCategory ? original.reportable : category.defaultReportable;
}

/** Compare the complete activity inside the write transaction before updating it. */
export function assertTransactionsUnchanged(expected: readonly Transaction[], current: readonly Transaction[]): void {
  const byId = new Map(current.map(row => [row.id, row]));
  if (expected.length !== current.length || expected.some(row => JSON.stringify(row) !== JSON.stringify(byId.get(row.id)))) {
    throw new AppError("error.splitStale", "Transaction changed. Close and reopen it before saving.");
  }
}

export type ActivityContext = Pick<AppSnapshot, "wallets" | "categories" | "settings">;

/** A background refresh must never reinterpret a draft or overwrite changed catalog metadata. */
export function assertActivityContextUnchanged(expected: ActivityContext, current: ActivityContext): void {
  const signature = (context: ActivityContext) => JSON.stringify({
    wallets: [...context.wallets].sort((a, b) => a.id.localeCompare(b.id)),
    categories: [...context.categories].sort((a, b) => a.id.localeCompare(b.id)),
    irrDisplayUnit: context.settings.irrDisplayUnit,
    typeReportability: context.settings.typeReportability,
  });
  if (signature(expected) !== signature(current)) {
    throw new AppError("error.activityContextChanged", "Wallets, categories, or amount units changed. Close and reopen this draft before saving.");
  }
}
