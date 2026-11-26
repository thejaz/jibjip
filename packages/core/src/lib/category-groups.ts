import type { Category } from "./types.ts";
import type { InterfaceLocale } from "./i18n/config.ts";

/** Group names are authored metadata, independent of transaction category identities. */
export const DEFAULT_CATEGORY_GROUPS = [
  { en: "Income", fa: "درآمد", keys: ["freelance", "grants", "salary", "rental-income", "interest-income", "other-income"] },
  { en: "Work & Learning", fa: "کار و یادگیری", keys: ["business", "tools-equipment", "education"] },
  { en: "Home & Bills", fa: "خانه و قبوض", keys: ["home", "rent", "utilities", "phone-internet", "subscriptions"] },
  { en: "Food & Groceries", fa: "غذا و خواربار", keys: ["food-drink", "groceries", "coffee"] },
  { en: "Transport & Travel", fa: "حمل‌ونقل و سفر", keys: ["transport", "taxi", "rideshare", "travel"] },
  { en: "Health & Personal Care", fa: "سلامت و مراقبت شخصی", keys: ["medical-care", "pharmacy-supplements", "personal-care", "sport-fitness", "clothing"] },
  { en: "Leisure & Social", fa: "تفریح و معاشرت", keys: ["entertainment", "personal-projects", "social-activities", "intoxicants"] },
  { en: "Giving & Support", fa: "هدایا و حمایت", keys: ["gifts", "charity", "support-others"] },
  { en: "Finance & Administration", fa: "امور مالی و اداری", keys: ["insurance", "investments", "loan-received", "loan-repayments", "taxes", "government-administration", "service-fees"] },
  { en: "Temporary Funds", fa: "وجوه موقت", keys: ["temporary-advances", "temporary-funds-disbursed", "temporary-received-funds", "reimbursements-received"] },
  { en: "Other", fa: "سایر", keys: ["other-expenses"] },
] as const;

export function normalizeCategoryGroup(value: unknown): string | null {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") || null : null;
}

export function defaultCategoryGroup(key: string, locale: InterfaceLocale): string | null {
  return DEFAULT_CATEGORY_GROUPS.find((group) => (group.keys as readonly string[]).includes(key))?.[locale] ?? null;
}

export function groupCategories<T>(items: T[], groupFor: (item: T) => string | null | undefined, locale: string) {
  const groups = new Map<string | null, T[]>();
  for (const item of items) {
    const name = normalizeCategoryGroup(groupFor(item));
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }
  return [...groups].sort(([a], [b]) => a === null ? 1 : b === null ? -1 : a.localeCompare(b, locale))
    .map(([name, members]) => ({ name, members }));
}

export function renamedCategoryGroup(categories: Category[], from: string, to: string): Category[] {
  const name = normalizeCategoryGroup(to);
  return categories.filter((category) => category.group === from).map((category) => ({ ...category, group: name }));
}
