import { DATA_COLORS } from "./colors.ts";
import type { InterfaceLocale } from "./i18n/config.ts";
import type { Category, Currency } from "./types.ts";
import { defaultCategoryGroup } from "./category-groups.ts";

export const BUILT_IN_CURRENCIES: readonly Currency[] = [
  { code: "USD", name: "US dollar", symbol: "$", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "EUR", name: "Euro", symbol: "€", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "GBP", name: "British pound", symbol: "£", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "CHF", name: "Swiss franc", symbol: "CHF", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "CAD", name: "Canadian dollar", symbol: "CA$", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "AUD", name: "Australian dollar", symbol: "A$", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "JPY", name: "Japanese yen", symbol: "¥", kind: "fiat", fractionDigits: 0, builtIn: true, archived: false },
  { code: "CNY", name: "Chinese yuan", symbol: "¥", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "INR", name: "Indian rupee", symbol: "₹", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "CZK", name: "Czech koruna", symbol: "Kč", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "SEK", name: "Swedish krona", symbol: "kr", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "NOK", name: "Norwegian krone", symbol: "kr", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "DKK", name: "Danish krone", symbol: "kr", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "PLN", name: "Polish zloty", symbol: "zł", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "HUF", name: "Hungarian forint", symbol: "Ft", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "RON", name: "Romanian leu", symbol: "lei", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "ISK", name: "Icelandic krona", symbol: "kr", kind: "fiat", fractionDigits: 0, builtIn: true, archived: false },
  { code: "UAH", name: "Ukrainian hryvnia", symbol: "₴", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "RSD", name: "Serbian dinar", symbol: "din", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "RUB", name: "Russian ruble", symbol: "₽", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "TRY", name: "Turkish lira", symbol: "₺", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "AED", name: "UAE dirham", symbol: "د.إ", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "SAR", name: "Saudi riyal", symbol: "ر.س", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "IRR", name: "Iranian rial", symbol: "﷼", kind: "fiat", fractionDigits: 0, builtIn: true, archived: false },
  { code: "AFN", name: "Afghan afghani", symbol: "؋", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "AMD", name: "Armenian dram", symbol: "֏", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "AZN", name: "Azerbaijani manat", symbol: "₼", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "IQD", name: "Iraqi dinar", symbol: "ع.د", kind: "fiat", fractionDigits: 3, builtIn: true, archived: false },
  { code: "PKR", name: "Pakistani rupee", symbol: "₨", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "TMT", name: "Turkmenistan manat", symbol: "m", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "BRL", name: "Brazilian real", symbol: "R$", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "EGP", name: "Egyptian pound", symbol: "E£", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "ETB", name: "Ethiopian birr", symbol: "Br", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "IDR", name: "Indonesian rupiah", symbol: "Rp", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "ZAR", name: "South African rand", symbol: "R", kind: "fiat", fractionDigits: 2, builtIn: true, archived: false },
  { code: "BTC", name: "Bitcoin", symbol: "₿", kind: "crypto", fractionDigits: 8, builtIn: true, archived: false },
  { code: "ETH", name: "Ethereum", symbol: "Ξ", kind: "crypto", fractionDigits: 8, builtIn: true, archived: false },
  { code: "USDT", name: "Tether", symbol: "₮", kind: "crypto", fractionDigits: 6, builtIn: true, archived: false },
] as const;

export interface CategoryTemplate {
  key: string;
  names: Record<InterfaceLocale, string>;
  scope: Category["scope"];
  color: string;
  icon: string;
  system: boolean;
  defaultReportable: boolean;
  aliases?: readonly string[];
  /** Former canonical labels that may be upgraded without overwriting authored names. */
  previousNames?: Partial<Record<InterfaceLocale, string | readonly string[]>>;
}

export const CATEGORY_TEMPLATES: readonly CategoryTemplate[] = [
  { key: "business", names: { en: "Business", fa: "کسب‌وکار" }, scope: "both", color: DATA_COLORS[4], icon: "briefcase-business", system: false, defaultReportable: true },
  { key: "charity", names: { en: "Charity", fa: "امور خیریه" }, scope: "expense", color: DATA_COLORS[6], icon: "heart-handshake", system: false, defaultReportable: true, aliases: ["Infaq & Zakat"] },
  { key: "clothing", names: { en: "Clothing", fa: "پوشاک" }, scope: "expense", color: DATA_COLORS[17], icon: "shirt", system: false, defaultReportable: true, aliases: ["Apparel"] },
  { key: "coffee", names: { en: "Coffee", fa: "قهوه" }, scope: "expense", color: DATA_COLORS[11], icon: "coffee", system: false, defaultReportable: true },
  { key: "education", names: { en: "Education", fa: "آموزش" }, scope: "expense", color: DATA_COLORS[0], icon: "graduation-cap", system: false, defaultReportable: true, aliases: ["Scholarly"] },
  { key: "entertainment", names: { en: "Entertainment", fa: "سرگرمی" }, scope: "expense", color: DATA_COLORS[8], icon: "clapperboard", system: false, defaultReportable: true },
  { key: "food-drink", names: { en: "Food & Drink", fa: "غذا و نوشیدنی" }, scope: "expense", color: DATA_COLORS[9], icon: "utensils", system: false, defaultReportable: true },
  { key: "freelance", names: { en: "Freelance", fa: "فریلنسری" }, scope: "income", color: DATA_COLORS[1], icon: "laptop", system: false, defaultReportable: true },
  { key: "grants", names: { en: "Grants", fa: "کمک‌هزینه‌ها" }, scope: "income", color: DATA_COLORS[10], icon: "hand-heart", system: false, defaultReportable: true },
  { key: "gifts", names: { en: "Gifts", fa: "هدایا" }, scope: "both", color: DATA_COLORS[12], icon: "gift", system: false, defaultReportable: true },
  { key: "government-administration", names: { en: "Government & Administration", fa: "امور دولتی و اداری" }, scope: "expense", color: DATA_COLORS[13], icon: "landmark", system: false, defaultReportable: true, aliases: ["Bureaucracy"] },
  { key: "groceries", names: { en: "Groceries", fa: "خواربار" }, scope: "expense", color: DATA_COLORS[18], icon: "shopping-basket", system: false, defaultReportable: true },
  { key: "home", names: { en: "Home", fa: "خانه" }, scope: "expense", color: DATA_COLORS[20], icon: "house", system: false, defaultReportable: true },
  { key: "interest-income", names: { en: "Interest Income", fa: "درآمد بهره" }, scope: "income", color: DATA_COLORS[5], icon: "percent", system: false, defaultReportable: true },
  { key: "intoxicants", names: { en: "Intoxicants", fa: "مواد مست‌کننده" }, scope: "expense", color: DATA_COLORS[23], icon: "wine", system: false, defaultReportable: true, aliases: ["Drinks"] },
  { key: "insurance", names: { en: "Insurance", fa: "بیمه" }, scope: "expense", color: DATA_COLORS[7], icon: "shield-check", system: false, defaultReportable: true },
  { key: "investments", names: { en: "Investments", fa: "سرمایه‌گذاری‌ها" }, scope: "expense", color: DATA_COLORS[13], icon: "chart-no-axes-combined", system: false, defaultReportable: true },
  { key: "loan-received", names: { en: "Loan Received", fa: "وام دریافتی" }, scope: "income", color: DATA_COLORS[7], icon: "hand-coins", system: false, defaultReportable: true, aliases: ["Debt Income"] },
  { key: "loan-repayments", names: { en: "Loan Repayments", fa: "بازپرداخت وام" }, scope: "expense", color: DATA_COLORS[2], icon: "receipt", system: false, defaultReportable: true, aliases: ["Debt Payback"] },
  { key: "medical-care", names: { en: "Medical Care", fa: "مراقبت‌های پزشکی" }, scope: "expense", color: DATA_COLORS[3], icon: "stethoscope", system: false, defaultReportable: true, aliases: ["Healthcare"] },
  { key: "other-expenses", names: { en: "Other Expenses", fa: "سایر هزینه‌ها" }, scope: "expense", color: DATA_COLORS[22], icon: "receipt", system: true, defaultReportable: true, aliases: ["Other"] },
  { key: "other-income", names: { en: "Other Income", fa: "سایر درآمدها" }, scope: "income", color: DATA_COLORS[21], icon: "banknote", system: true, defaultReportable: true, aliases: ["Extra Income", "Other income"] },
  { key: "personal-care", names: { en: "Personal Care", fa: "مراقبت شخصی" }, scope: "expense", color: DATA_COLORS[19], icon: "user-round", system: false, defaultReportable: true, aliases: ["Appeal & Care"] },
  { key: "personal-projects", names: { en: "Hobbies", fa: "سرگرمی‌ها" }, scope: "expense", color: DATA_COLORS[4], icon: "folder-kanban", system: false, defaultReportable: true, aliases: ["Projects"], previousNames: { en: "Personal Projects", fa: "پروژه‌های شخصی" } },
  { key: "pharmacy-supplements", names: { en: "Pharmacy & Supplements", fa: "دارو و مکمل‌ها" }, scope: "expense", color: DATA_COLORS[12], icon: "pill", system: false, defaultReportable: true, aliases: ["Medicinal"] },
  { key: "phone-internet", names: { en: "Phone & Internet", fa: "تلفن و اینترنت" }, scope: "expense", color: DATA_COLORS[7], icon: "smartphone", system: false, defaultReportable: true },
  { key: "reimbursements-received", names: { en: "Temporary - Repayment Received", fa: "بازپرداخت‌های دریافتی" }, scope: "income", color: DATA_COLORS[6], icon: "handshake", system: false, defaultReportable: false, previousNames: { en: "Reimbursements Received" } },
  { key: "rental-income", names: { en: "Rental Income", fa: "درآمد اجاره" }, scope: "income", color: DATA_COLORS[0], icon: "house", system: false, defaultReportable: true },
  { key: "rent", names: { en: "Rent", fa: "اجاره" }, scope: "expense", color: DATA_COLORS[15], icon: "key-round", system: false, defaultReportable: true },
  { key: "rideshare", names: { en: "Rideshare", fa: "تاکسی اینترنتی" }, scope: "expense", color: DATA_COLORS[5], icon: "car", system: false, defaultReportable: true },
  { key: "salary", names: { en: "Salary & Wages", fa: "حقوق و دستمزد" }, scope: "income", color: DATA_COLORS[6], icon: "banknote", system: false, defaultReportable: true, previousNames: { en: "Salary", fa: "حقوق" } },
  { key: "service-fees", names: { en: "Service Fees", fa: "هزینه خدمات" }, scope: "expense", color: DATA_COLORS[2], icon: "badge-dollar-sign", system: false, defaultReportable: true, aliases: ["Bills & Fees"] },
  { key: "social-activities", names: { en: "Social Activities", fa: "فعالیت‌های اجتماعی" }, scope: "expense", color: DATA_COLORS[23], icon: "users-round", system: false, defaultReportable: true, aliases: ["Friends & Me"] },
  { key: "sport-fitness", names: { en: "Sport & Fitness", fa: "ورزش و تناسب اندام" }, scope: "expense", color: DATA_COLORS[1], icon: "dumbbell", system: false, defaultReportable: true, aliases: ["Sportiva"] },
  { key: "subscriptions", names: { en: "Subscriptions", fa: "اشتراک‌ها" }, scope: "expense", color: DATA_COLORS[8], icon: "repeat", system: false, defaultReportable: true },
  { key: "support-others", names: { en: "Support", fa: "حمایت" }, scope: "expense", color: DATA_COLORS[3], icon: "hand-heart", system: false, defaultReportable: true, previousNames: { en: "Support for Others", fa: "حمایت از دیگران" } },
  { key: "taxes", names: { en: "Taxes", fa: "مالیات" }, scope: "expense", color: DATA_COLORS[15], icon: "landmark", system: false, defaultReportable: true },
  { key: "taxi", names: { en: "Taxi", fa: "تاکسی" }, scope: "expense", color: DATA_COLORS[20], icon: "car-taxi-front", system: false, defaultReportable: true },
  { key: "temporary-advances", names: { en: "Temporary - Paid for Others", fa: "پرداخت‌های موقت" }, scope: "expense", color: DATA_COLORS[5], icon: "hand-coins", system: false, defaultReportable: false, aliases: ["Temporary", "Temporary Advances"], previousNames: { en: ["Temporary Advances", "Temporary Advances Given"] } },
  { key: "temporary-funds-disbursed", names: { en: "Temporary - Funds Spent", fa: "وجوه موقت پرداخت‌شده" }, scope: "expense", color: DATA_COLORS[7], icon: "banknote-arrow-up", system: false, defaultReportable: false, previousNames: { en: "Temporary Funds Disbursed" } },
  { key: "temporary-received-funds", names: { en: "Temporary - Funds Received", fa: "وجوه موقت دریافتی" }, scope: "income", color: DATA_COLORS[14], icon: "wallet-cards", system: false, defaultReportable: false, aliases: ["Temporary Received Funds"], previousNames: { en: ["Temporary Received Funds", "Temporary Funds Received"] } },
  { key: "tools-equipment", names: { en: "Tools & Equipment", fa: "ابزار و تجهیزات" }, scope: "expense", color: DATA_COLORS[21], icon: "hammer", system: false, defaultReportable: true, aliases: ["Tools & Gears"] },
  { key: "transport", names: { en: "Transport", fa: "حمل‌ونقل" }, scope: "expense", color: DATA_COLORS[5], icon: "bus-front", system: false, defaultReportable: true },
  { key: "travel", names: { en: "Travel", fa: "سفر" }, scope: "expense", color: DATA_COLORS[0], icon: "plane", system: false, defaultReportable: true },
  { key: "utilities", names: { en: "Utilities", fa: "قبوض خدماتی" }, scope: "expense", color: DATA_COLORS[2], icon: "plug-zap", system: false, defaultReportable: true },
] as const;

const LEGACY_SYSTEM_CATEGORY_ICONS: Readonly<Record<string, string>> = {
  "other-expenses": "circle-ellipsis",
  "other-income": "wallet-cards",
};

function normalizedName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function categoriesForLocale(locale: InterfaceLocale): Category[] {
  return CATEGORY_TEMPLATES.map((template) => ({
    id: `category-${template.key}`,
    name: template.names[locale],
    group: defaultCategoryGroup(template.key, locale),
    scope: template.scope,
    archived: false,
    templateKey: template.key,
    system: template.system,
    color: template.color,
    icon: template.icon,
    defaultReportable: template.defaultReportable,
  }));
}

export interface CategoryTranslationChange {
  id: string;
  name: string;
}

/**
 * Build an explicit translation plan for unmodified built-in category names.
 * A user-renamed category keeps its authored name even when it still carries a
 * stable template identity.
 */
export function categoryTranslationPlan(
  categories: Category[],
  locale: InterfaceLocale,
): CategoryTranslationChange[] {
  const templates = new Map(CATEGORY_TEMPLATES.map((template) => [template.key, template]));
  return categories.flatMap((category) => {
    if (!category.templateKey) return [];
    const template = templates.get(category.templateKey);
    if (!template) return [];
    const recognizedNames = new Set([template.names.en, template.names.fa]);
    const name = template.names[locale];
    return recognizedNames.has(category.name) && category.name !== name
      ? [{ id: category.id, name }]
      : [];
  });
}

export function mergeBuiltInCurrencies(existing: Currency[]): Currency[] {
  const byCode = new Map(existing.map((currency) => [currency.code, currency]));
  for (const currency of BUILT_IN_CURRENCIES) byCode.set(currency.code, { ...currency });
  return [...byCode.values()].sort((left, right) => left.code.localeCompare(right.code));
}

export function mergeCategoryTemplates(
  existing: Category[],
  locale: InterfaceLocale,
): Category[] {
  const result = existing.map((category) => ({ ...category }));
  const claimedIds = new Set<string>();
  for (const template of CATEGORY_TEMPLATES) {
    let match = result.find((category) => category.templateKey === template.key);
    if (!match) {
      const canonicalNames = new Set([
        template.names.en,
        template.names.fa,
        ...Object.values(template.previousNames ?? {}).flat(),
      ].map(normalizedName));
      match = result.find((category) =>
        category.templateKey === null &&
        !claimedIds.has(category.id) &&
        canonicalNames.has(normalizedName(category.name))
      );
      if (!match && template.aliases) {
        const aliases = new Set(template.aliases.map(normalizedName));
        match = result.find((category) =>
          category.templateKey === null &&
          !claimedIds.has(category.id) &&
          (!template.system || category.scope === template.scope) &&
          aliases.has(normalizedName(category.name))
        );
      }
    }
    if (match) {
      if (match.group === undefined) match.group = defaultCategoryGroup(template.key, locale);
      claimedIds.add(match.id);
      if (match.templateKey === null) {
        Object.assign(match, {
          templateKey: template.key,
          system: template.system,
          color: template.color,
          icon: template.icon,
          defaultReportable: template.defaultReportable,
        });
      } else if (match.system !== template.system) {
        match.system = template.system;
      }
      if (template.system && match.icon === LEGACY_SYSTEM_CATEGORY_ICONS[template.key]) {
        match.icon = template.icon;
      }
      if (template.system) match.archived = false;
      // English legacy fallback labels acquire the canonical name, keeping their identity.
      if (template.system && template.aliases?.some((alias) => normalizedName(alias) === normalizedName(match.name))) {
        match.name = template.names.en;
      }
      const renamedLocale = (Object.keys(template.previousNames ?? {}) as InterfaceLocale[])
        .find((candidateLocale) => {
          const previous = template.previousNames?.[candidateLocale];
          return Array.isArray(previous) ? previous.includes(match.name) : match.name === previous;
        });
      if (renamedLocale) match.name = template.names[renamedLocale];
      continue;
    }
    result.push({
      id: `category-${template.key}`,
      name: template.names[locale],
      group: defaultCategoryGroup(template.key, locale),
      scope: template.scope,
      archived: false,
      templateKey: template.key,
      system: template.system,
      color: template.color,
      icon: template.icon,
      defaultReportable: template.defaultReportable,
    });
  }
  return result;
}
