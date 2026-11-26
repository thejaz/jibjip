import Decimal from "decimal.js";
import { convertWithRateFallback, missingRateCurrency, reportDirection } from "./finance.ts";
import { validRateDate } from "./rate-history.ts";
import { isConfigurableTransactionType } from "./transaction-types.ts";
import type { AppSnapshot, Category } from "./types.ts";

export function normalizeChartExclusions(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === "string" && Boolean(id.trim())))].sort()
    : [];
}

export function validChartRange(start: string, end: string): boolean {
  return validRateDate(start) && validRateDate(end) && start <= end;
}

export type FlowTotal = { income: Decimal; expense: Decimal; net: Decimal; count: number };
const emptyFlow = (): FlowTotal => ({ income: new Decimal(0), expense: new Decimal(0), net: new Decimal(0), count: 0 });

/** All Charts views share one eligibility gate and one dated conversion per posting. */
export function chartAnalysis(snapshot: AppSnapshot, options: { start: string; end: string; walletIds: string[] }) {
  const total = emptyFlow();
  const categories = { income: new Map<string, { id: string; label: string; category?: Category; type?: string; value: Decimal; count: number }>(), expense: new Map<string, { id: string; label: string; category?: Category; type?: string; value: Decimal; count: number }>() };
  const months = new Map<string, FlowTotal>();
  const wallets = new Map<string, FlowTotal>();
  const missing = new Set<string>();
  const fallback = new Set<string>();
  const excluded = new Set(snapshot.settings.chartExcludedCategoryIds);
  const selected = new Set(options.walletIds);
  const byId = new Map(snapshot.categories.map((c) => [c.id, c]));
  const byName = new Map(snapshot.categories.map((c) => [c.name.trim().toLocaleLowerCase("en"), c]));
  const validRange = validChartRange(options.start, options.end);
  if (validRange) {
    // Bound series size even for an unusually long imported history: use years beyond 10 years.
    const monthSpan = (Number(options.end.slice(0, 4)) - Number(options.start.slice(0, 4))) * 12 + Number(options.end.slice(5, 7)) - Number(options.start.slice(5, 7));
    const yearly = monthSpan > 120;
    let year = Number(options.start.slice(0, 4)), month = Number(options.start.slice(5, 7));
    const last = yearly ? options.end.slice(0, 4) : options.end.slice(0, 7);
    for (;;) {
      const key = yearly ? String(year).padStart(4, "0") : `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
      if (key > last) break;
      months.set(key, emptyFlow());
      if (yearly) year += 1;
      else if (++month > 12) { month = 1; year += 1; }
    }
    for (const wallet of snapshot.wallets) if (selected.has(wallet.id)) wallets.set(wallet.id, emptyFlow());
    for (const row of snapshot.transactions) {
      if (!row.reportable || !selected.has(row.walletId) || row.date < options.start || row.date > options.end) continue;
      const direction = reportDirection(row);
      if (!direction) continue;
      const fixed = isConfigurableTransactionType(row.operation);
      const category = fixed ? undefined : byId.get(row.categoryId ?? "") ?? byName.get(row.category.trim().toLocaleLowerCase("en"));
      // Category-wide exclusion wins, including legacy rows with an explicit true flag.
      if (isConfigurableTransactionType(row.operation) && !snapshot.settings.typeReportability[row.operation]) continue;
      if (category && (!category.defaultReportable || excluded.has(category.id))) continue;
      const conversion = convertWithRateFallback(row.amount, row.currency, snapshot.settings.reportingCurrency, snapshot.rates, row.date);
      if (!conversion) { missing.add(missingRateCurrency(row.currency, snapshot.settings.reportingCurrency, snapshot.rates, row.date)); continue; }
      if (conversion.usedFallback) fallback.add(row.currency);
      const value = conversion.value;
      const key = fixed ? `type:${row.operation}` : category?.id ?? `label:${row.category.trim().toLocaleLowerCase("en")}`;
      const item = categories[direction].get(key) ?? { id: key, label: category?.name ?? row.category, category, type: fixed ? row.operation : undefined, value: new Decimal(0), count: 0 };
      item.value = item.value.plus(value); item.count += 1;
      categories[direction].set(key, item);
      for (const flow of [total, months.get(row.date.slice(0, yearly ? 4 : 7)), wallets.get(row.walletId)]) {
        if (!flow) continue;
        flow[direction] = flow[direction].plus(value);
        flow.net = flow.income.minus(flow.expense);
        flow.count += 1;
      }
    }
  }
  return { total, categories, months: [...months].map(([key, flow]) => ({ key, ...flow })), wallets, missing: [...missing].sort(), fallback: [...fallback].sort(), validRange };
}
