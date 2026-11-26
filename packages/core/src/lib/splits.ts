import Decimal from "decimal.js";
import { AppError } from "./app-error.ts";
import type { Category, Transaction } from "./types.ts";

const Exact = Decimal.clone({ precision: 40 });

function invalid(): never {
  throw new AppError("error.splitInvalid", "The split is incomplete or inconsistent. Check its lines and total.");
}

/** Validate whole groups before persistence/import. Missing lines must never silently flatten. */
export function splitGroups(rows: Transaction[]): Map<string, Transaction[]> {
  const groups = new Map<string, Transaction[]>();
  for (const row of rows) {
    if (row.split === undefined) continue;
    const s = row.split;
    if (!s || typeof s.id !== "string" || !s.id.trim() || typeof s.note !== "string" ||
      !Number.isSafeInteger(s.index) || !Number.isSafeInteger(s.count) || s.count < 2 ||
      s.index < 1 || s.index > s.count || typeof s.total !== "string" ||
      row.operation !== "transaction" || !["income", "expense"].includes(row.direction) ||
      row.linkId || !row.affectsBalance) invalid();
    const group = groups.get(s.id) ?? [];
    group.push(row);
    groups.set(s.id, group);
  }
  for (const group of groups.values()) {
    const first = group[0];
    const s = first.split!;
    if (group.length !== s.count || new Set(group.map(r => r.id)).size !== group.length ||
      new Set(group.map(r => r.split!.index)).size !== s.count) invalid();
    try {
      const total = new Exact(s.total);
      if (!total.isFinite() || !total.gt(0)) invalid();
      let sum = new Exact(0);
      for (const row of group) {
        if (row.date !== first.date || row.walletId !== first.walletId || row.currency !== first.currency ||
          row.direction !== first.direction || row.split!.count !== s.count ||
          row.split!.total !== s.total || row.split!.note !== s.note) invalid();
        const amount = new Exact(row.amount);
        const signed = row.direction === "expense" ? amount.negated() : amount;
        if (!amount.isFinite() || !amount.gt(0) || typeof row.balanceAmount !== "string" ||
          !new Exact(row.balanceAmount).eq(signed)) invalid();
        sum = sum.plus(amount);
      }
      if (!sum.eq(total)) invalid();
    } catch { invalid(); }
    group.sort((a, b) => a.split!.index - b.split!.index);
  }
  return groups;
}

/** Adds grouping only; existing financial fields, IDs, notes, and timestamps stay intact. */
export function attachSplit(rows: Transaction[], id: string, total: string, note = ""): Transaction[] {
  const result = rows.map((row, index) => ({ ...row, split: { id, index: index + 1, count: rows.length, total, note } }));
  splitGroups(result);
  return result;
}

export function activityAmount(rows: Transaction[]): string {
  return rows[0]?.split
    ? rows.reduce((sum, row) => sum.plus(row.amount), new Exact(0)).toString()
    : rows[0]?.amount ?? "0";
}

export function buildSplitRows(input: {
  id: string; date: string; walletId: string; currency: string; direction: "income" | "expense";
  total: string; note: string; timestamp: string;
  lines: { id: string; amount: string; note: string; category: Category }[];
  previous?: Transaction[];
}): Transaction[] {
  const previous = new Map((input.previous ?? []).map(row => [row.id, row]));
  const rows = input.lines.map(line => {
    const old = previous.get(line.id);
    const category = line.category;
    if (category.scope !== "both" && category.scope !== input.direction) invalid();
    const amount = new Exact(line.amount);
    return {
      ...old, id: line.id, date: input.date, walletId: input.walletId, currency: input.currency,
      operation: "transaction" as const, direction: input.direction,
      amount: amount.toString(), balanceAmount: (input.direction === "expense" ? amount.negated() : amount).toString(),
      categoryId: category.id, category: category.name, note: line.note,
      reportable: old?.categoryId === category.id ? old.reportable : category.defaultReportable,
      affectsBalance: true, linkId: null, createdAt: old?.createdAt ?? input.timestamp, updatedAt: input.timestamp,
    };
  });
  return attachSplit(rows, input.id, new Exact(input.total).toString(), input.note);
}
