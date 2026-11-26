import type { Category, Direction, Operation, Transaction } from "./types.ts";

export interface VisibleCategoryOption {
  key: string;
  name: string;
  categoryId: string | null;
  activity: boolean;
  operation: Operation | null;
  direction: Direction | null;
  count: number;
}

function normalizedName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function activityKey(transaction: Transaction): string {
  return `activity:${transaction.operation}:${transaction.direction}:${normalizedName(transaction.category)}`;
}

function sortOptions(left: VisibleCategoryOption, right: VisibleCategoryOption): number {
  return left.name.localeCompare(right.name, "en", { sensitivity: "base", numeric: true }) ||
    Number(left.activity) - Number(right.activity) ||
    left.key.localeCompare(right.key, "en");
}

/**
 * Return categories used by ordinary income/expense transactions. Fixed
 * transaction types are deliberately excluded even though their postings keep
 * a denormalized compatibility label for CSV exchange.
 */
export function visibleCategoryOptions(
  categories: Category[],
  transactions: Transaction[],
): VisibleCategoryOption[] {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const categoriesByName = new Map(
    categories.map((category) => [normalizedName(category.name), category]),
  );
  const options = new Map<string, VisibleCategoryOption>();

  for (const category of categories) {
    const count = transactions.filter((transaction) =>
      transaction.operation === "transaction" && (
        transaction.categoryId === category.id ||
        (transaction.categoryId === null &&
        normalizedName(transaction.category) === normalizedName(category.name))
      )
    ).length;
    if (count > 0) {
      options.set(`category:${category.id}`, {
        key: `category:${category.id}`,
        name: category.name,
        categoryId: category.id,
        activity: false,
        operation: null,
        direction: null,
        count,
      });
    }
  }

  for (const transaction of transactions) {
    if (transaction.operation !== "transaction") continue;
    const name = transaction.category.trim();
    if (!name) continue;
    const managed = transaction.categoryId
      ? categoriesById.get(transaction.categoryId)
      : categoriesByName.get(normalizedName(name));
    if (managed) continue;

    const key = activityKey(transaction);
    const existing = options.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    options.set(key, {
      key,
      name,
      categoryId: null,
      activity: true,
      operation: transaction.operation,
      direction: transaction.direction,
      count: 1,
    });
  }

  return [...options.values()].sort(sortOptions);
}

export function visibleCategoryOptionMatches(
  option: VisibleCategoryOption,
  transaction: Transaction,
): boolean {
  if (!option.activity) {
    return transaction.operation === "transaction" && (
      transaction.categoryId === option.categoryId || (
      transaction.categoryId === null &&
      normalizedName(transaction.category) === normalizedName(option.name)
      )
    );
  }
  return activityKey(transaction) === option.key;
}
