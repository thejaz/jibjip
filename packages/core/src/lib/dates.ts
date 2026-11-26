/** Calendar dates follow the device's local day. Audit timestamps remain UTC. */
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Clamp month/year subtraction to the last valid day instead of rolling forward. */
export function rollingPeriodStart(period: "30d" | "3m" | "6m" | "1y" | "3y", end: string): string {
  const date = new Date(`${end}T12:00:00`);
  if (period === "30d") date.setDate(date.getDate() - 29);
  else {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() - ({ "3m": 3, "6m": 6, "1y": 12, "3y": 36 }[period]));
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
  }
  return localDate(date);
}
