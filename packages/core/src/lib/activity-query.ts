import type { TransactionActivity } from "./activity.ts";
import { convertWithRateFallback, type RateResolution } from "./finance.ts";
import { activityAmount } from "./splits.ts";
import type { Rate } from "./types.ts";

export type TransactionSort = "newest" | "oldest" | "amount-high" | "amount-low";

/** Value each payment once at its date; keep unvalued payments last in either direction. */
export function sortActivities(
  activities: readonly TransactionActivity[],
  sort: TransactionSort,
  conversion: { rates: Rate[]; currency: string },
): { activities: TransactionActivity[]; valuations: ReadonlyMap<string, RateResolution | null> } {
  const byValue = sort === "amount-high" || sort === "amount-low";
  const valuations = new Map<string, RateResolution | null>();
  if (byValue) {
    for (const activity of activities) {
      // A split contributes its full total; a paired exchange uses the sent leg once.
      const result = convertWithRateFallback(activityAmount(activity.rows), activity.primary.currency,
        conversion.currency, conversion.rates, activity.primary.date);
      valuations.set(activity.id, result ? { ...result, value: result.value.abs() } : null);
    }
  }
  const sorted = [...activities].sort((a, b) => {
    let primaryOrder: number;
    if (byValue) {
      const aValue = valuations.get(a.id);
      const bValue = valuations.get(b.id);
      if (!aValue && bValue) return 1;
      if (aValue && !bValue) return -1;
      primaryOrder = aValue && bValue
        ? (sort === "amount-low" ? 1 : -1) * aValue.value.comparedTo(bValue.value) : 0;
    } else {
      primaryOrder = (sort === "oldest" ? 1 : -1) * a.primary.date.localeCompare(b.primary.date);
    }
    if (primaryOrder) return primaryOrder;
    const updatedOrder = (sort === "oldest" ? 1 : -1) * a.primary.updatedAt.localeCompare(b.primary.updatedAt);
    return updatedOrder || a.id.localeCompare(b.id);
  });
  return { activities: sorted, valuations };
}
