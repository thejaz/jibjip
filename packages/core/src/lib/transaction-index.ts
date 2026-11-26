import Decimal from "decimal.js";
import type { Transaction } from "./types.ts";

interface TransactionIndex {
  balances: ReadonlyMap<string, Decimal>;
  walletCounts: ReadonlyMap<string, number>;
  categoryCounts: ReadonlyMap<string, number>;
  unresolvedCategoryCounts: ReadonlyMap<string, number>;
  operationCounts: ReadonlyMap<string, number>;
}

const indexes = new WeakMap<readonly Transaction[], TransactionIndex>();
const Exact = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

/** Snapshots are immutable. A new transaction array gets a new, single-pass index. */
export function transactionIndex(transactions: readonly Transaction[]): TransactionIndex {
  const cached = indexes.get(transactions);
  if (cached) return cached;
  const balances = new Map<string, Decimal>();
  const walletCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const unresolvedCategoryCounts = new Map<string, number>();
  const operationCounts = new Map<string, number>();
  const count = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
  for (const row of transactions) {
    count(walletCounts, row.walletId);
    count(operationCounts, row.operation);
    if (row.operation === "transaction") {
      if (row.categoryId) count(categoryCounts, row.categoryId);
      else count(unresolvedCategoryCounts, row.category.toLocaleLowerCase("en"));
    }
    if (!row.affectsBalance) continue;
    const delta = row.balanceAmount !== undefined
      ? new Exact(row.balanceAmount)
      : new Exact(row.amount).mul(row.direction === "income" || row.direction === "in" ? 1 : -1);
    balances.set(row.walletId, (balances.get(row.walletId) ?? new Exact(0)).plus(delta));
  }
  const index = { balances, walletCounts, categoryCounts, unresolvedCategoryCounts, operationCounts };
  indexes.set(transactions, index);
  return index;
}
