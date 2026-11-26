import Decimal from "decimal.js";

/** SVG geometry only: exact totals/values stay with the report and its labels. */
export function donutArcs(values: readonly Decimal[], total: Decimal, radius = 44) {
  const circumference = 2 * Math.PI * radius;
  if (!total.isFinite() || total.lte(0)) return [];
  let preceding = new Decimal(0);
  const positiveCount = values.filter(value => value.isFinite() && value.gt(0)).length;
  return values.map(value => {
    const length = value.isFinite() && value.gt(0)
      ? value.div(total).mul(circumference).toNumber() : 0;
    // Small slices retain at least 88% of their real arc; never invent a minimum share.
    const gap = positiveCount > 1 ? Math.min(1.8, length * .12) : 0;
    const start = preceding.div(total).mul(circumference).toNumber();
    if (value.isFinite() && value.gt(0)) preceding = preceding.plus(value);
    return { length, visible: Math.max(0, length - gap), offset: -(start + gap / 2), circumference };
  });
}
