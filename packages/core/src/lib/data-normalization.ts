import { normalizeChartExclusions } from "./charts.ts";
import { normalizeClarity } from "./clarity.ts";
import {
  CURRENT_DATA_VERSION,
  normalizeMotionLevel,
  CURRENT_SETUP_VERSION,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  sanitizeUnchartedEntry,
} from "./types.ts";
import { normalizeSetupDraft, normalizeSetupStep } from "./setup.ts";
import { normalizeCategoryGroup } from "./category-groups.ts";
import { normalizeRateRows } from "./rates.ts";
import { mergeOtherIncomeCategory } from "./catalog-management.ts";
import { titleCaseCategoryLabel, titleCaseCategoryName } from "./category-names.ts";
import {
  CONFIGURABLE_TRANSACTION_TYPES,
  isConfigurableTransactionType,
  isTransactionTypeCategoryLabel,
  normalizeTypeReportability,
  transactionTypeLabel,
  type ConfigurableTransactionType,
} from "./transaction-types.ts";
import type {
  AppSettings,
  Category,
  Currency,
  CurrencyKind,
  SeedData,
  SetupState,
  Transaction,
  Wallet,
} from "./types.ts";

type UnknownRecord = Record<string, unknown>;

const CURRENCY_CODE = /^[A-Z][A-Z0-9]{2,7}$/;
const CRYPTO_CODES = new Set(["BTC", "ETH", "USDT"]);

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? value as UnknownRecord : {};
}

function categoryKey(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function normalizeCurrencyCode(value: unknown): string {
  const code = String(value ?? "").trim().toUpperCase();
  return CURRENCY_CODE.test(code) ? code : "";
}

function defaultCurrency(code: string): Currency {
  const kind: CurrencyKind = CRYPTO_CODES.has(code) ? "crypto" : "custom";
  return {
    code,
    name: code,
    symbol: code,
    kind,
    fractionDigits: code === "IRR" || code === "JPY" ? 0 : kind === "crypto" ? 8 : 2,
    builtIn: false,
    archived: false,
  };
}

function normalizeCurrency(value: unknown): Currency | null {
  const candidate = record(value);
  const code = normalizeCurrencyCode(candidate.code);
  if (!code) return null;
  const kind: CurrencyKind = candidate.kind === "fiat" || candidate.kind === "crypto" || candidate.kind === "custom"
    ? candidate.kind
    : CRYPTO_CODES.has(code) ? "crypto" : "custom";
  const fractionDigits = typeof candidate.fractionDigits === "number" &&
    Number.isInteger(candidate.fractionDigits) &&
    candidate.fractionDigits >= 0 &&
    candidate.fractionDigits <= 18
    ? candidate.fractionDigits
    : defaultCurrency(code).fractionDigits;
  return {
    code,
    name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : code,
    symbol: typeof candidate.symbol === "string" && candidate.symbol.trim() ? candidate.symbol.trim() : code,
    kind,
    fractionDigits,
    builtIn: candidate.builtIn === true,
    archived: candidate.archived === true,
  };
}

function normalizeCategory(value: unknown): Category {
  const candidate = record(value);
  const scope: Category["scope"] = candidate.scope === "income" || candidate.scope === "both"
    ? candidate.scope
    : "expense";
  return {
    id: String(candidate.id ?? ""),
    name: titleCaseCategoryName(String(candidate.name ?? "")),
    ...(candidate.group === undefined ? {} : { group: normalizeCategoryGroup(candidate.group) }),
    scope,
    archived: candidate.archived === true,
    templateKey: typeof candidate.templateKey === "string" && candidate.templateKey.trim()
      ? candidate.templateKey.trim()
      : null,
    system: candidate.system === true,
    color: typeof candidate.color === "string" && /^#[0-9A-F]{6}$/i.test(candidate.color)
      ? candidate.color.toUpperCase()
      : DEFAULT_CATEGORY_COLOR,
    icon: typeof candidate.icon === "string" && candidate.icon.trim()
      ? candidate.icon.trim()
      : DEFAULT_CATEGORY_ICON,
    defaultReportable: candidate.defaultReportable !== false,
  };
}

function normalizeTransaction(
  value: unknown,
  categoriesById: Map<string, Category>,
  categoriesByName: Map<string, Category>,
): Transaction {
  const candidate = record(value) as unknown as Transaction;
  if (isConfigurableTransactionType(candidate.operation)) {
    return {
      ...candidate,
      categoryId: null,
      category: transactionTypeLabel(candidate.operation),
    };
  }
  const referenced = typeof candidate.categoryId === "string"
    ? categoriesById.get(candidate.categoryId)
    : undefined;
  const named = categoriesByName.get(categoryKey(candidate.category));
  return {
    ...candidate,
    categoryId: referenced?.id ?? named?.id ?? null,
    category: referenced?.name ?? named?.name ?? titleCaseCategoryLabel(String(candidate.category ?? ""), candidate.operation),
  };
}

function normalizeSetupState(
  value: unknown,
  setupVersion: number,
  mainWalletId: string | null,
  wallets: Wallet[],
): SetupState {
  if (value === "complete" && setupVersion >= CURRENT_SETUP_VERSION && mainWalletId) return "complete";
  if (wallets.length > 0) return "upgrade-required";
  return "uninitialized";
}

function normalizeSettings(value: unknown, wallets: Wallet[]): AppSettings {
  const candidate = record(value);
  const walletIds = new Set(wallets.map((wallet) => wallet.id));
  const activeWalletIds = new Set(wallets.filter((wallet) => !wallet.archived).map((wallet) => wallet.id));
  const requestedMainWalletId = typeof candidate.mainWalletId === "string" && activeWalletIds.has(candidate.mainWalletId)
    ? candidate.mainWalletId
    : null;
  const setupVersion = typeof candidate.setupVersion === "number" &&
    Number.isInteger(candidate.setupVersion) &&
    candidate.setupVersion >= 0
    ? candidate.setupVersion
    : 0;
  const overviewWalletIds = candidate.overviewWalletIds === null
    ? null
    : Array.isArray(candidate.overviewWalletIds)
      ? [...new Set(candidate.overviewWalletIds.filter(
          (id): id is string => typeof id === "string" && walletIds.has(id),
        ))]
      : null;
  const pinned = Array.isArray(candidate.overviewPinnedWalletIds)
    ? candidate.overviewPinnedWalletIds.slice(0, 3).map((id) =>
        typeof id === "string" && walletIds.has(id) ? id : null
      )
    : [];
  while (pinned.length < 3) pinned.push(null);
  const seenPinned = new Set<string>();
  const overviewPinnedWalletIds = pinned.map((id) => {
    if (id === null || seenPinned.has(id)) return null;
    seenPinned.add(id);
    return id;
  });
  const overviewHiddenCurrencies = Array.isArray(candidate.overviewHiddenCurrencies)
    ? [...new Set(candidate.overviewHiddenCurrencies
        .map(normalizeCurrencyCode)
        .filter(Boolean))].sort((left, right) => left.localeCompare(right))
    : [];
  const defaultWalletId = typeof candidate.defaultWalletId === "string" &&
    activeWalletIds.has(candidate.defaultWalletId)
    ? candidate.defaultWalletId
    : null;
  const starterSeedVersion = typeof candidate.starterSeedVersion === "number" &&
    Number.isInteger(candidate.starterSeedVersion) &&
    candidate.starterSeedVersion >= 0
    ? candidate.starterSeedVersion
    : 0;
  return {
    dataVersion: CURRENT_DATA_VERSION,
    clarity: normalizeClarity(candidate.clarity),
    setupVersion,
    setupState: normalizeSetupState(candidate.setupState, setupVersion, requestedMainWalletId, wallets),
    mainWalletId: requestedMainWalletId,
    setupStep: normalizeSetupStep(candidate.setupStep),
    setupDraft: candidate.setupDraft === null || candidate.setupDraft === undefined
      ? null
      : normalizeSetupDraft(candidate.setupDraft, candidate as Partial<AppSettings>),
    reportingCurrency: normalizeCurrencyCode(candidate.reportingCurrency) || "EUR",
    locale: candidate.locale === "fa" ? "fa" : "en",
    showJalali: typeof candidate.showJalali === "boolean" ? candidate.showJalali : true,
    starterSeedVersion,
    irrDisplayUnit:
      candidate.irrDisplayUnit === "TMN" ||
      candidate.irrDisplayUnit === "HTM" ||
      candidate.irrDisplayUnit === "MTM"
        ? candidate.irrDisplayUnit
        : "IRR",
    textSize:
      candidate.textSize === "small" || candidate.textSize === "large"
        ? candidate.textSize
        : "medium",
    startPage: candidate.startPage === "transactions" ? "transactions" : "overview",
    motion: normalizeMotionLevel(candidate.motion),
    overviewWalletIds,
    overviewPinnedWalletIds,
    overviewHiddenCurrencies,
    chartExcludedCategoryIds: normalizeChartExclusions(candidate.chartExcludedCategoryIds),
    defaultWalletId,
    typeReportability: normalizeTypeReportability(candidate.typeReportability),
  };
}

/**
 * Normalizes a current V2 data envelope without changing financial amounts or
 * source files. Structural validation remains the caller's job.
 */
export function normalizeSeedData(value: unknown): SeedData {
  const candidate = record(value);
  if (candidate.version !== CURRENT_DATA_VERSION) {
    throw new Error(`Unsupported jibjip data version: ${String(candidate.version ?? "missing")}.`);
  }
  const wallets = Array.isArray(candidate.wallets) ? candidate.wallets as Wallet[] : [];
  const settings = normalizeSettings(candidate.settings, wallets);
  const sourceTransactions = Array.isArray(candidate.transactions)
    ? candidate.transactions.map((transaction) => record(transaction) as unknown as Transaction)
    : [];
  const allCategories = Array.isArray(candidate.categories)
    ? candidate.categories.map(normalizeCategory)
    : [];
  const categories = allCategories.filter((category) => {
    if (
      category.templateKey !== null &&
      CONFIGURABLE_TRANSACTION_TYPES.includes(category.templateKey as ConfigurableTransactionType)
    ) return false;
    if (!isTransactionTypeCategoryLabel(category.name)) return true;
    return sourceTransactions.some((transaction) =>
      transaction.categoryId === category.id && !isConfigurableTransactionType(transaction.operation)
    );
  });
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const categoriesByName = new Map(categories.map((category) => [categoryKey(category.name), category]));
  const normalizedTransactions = sourceTransactions.length > 0
    ? sourceTransactions.map((transaction) => {
        const normalized = normalizeTransaction(transaction, categoriesById, categoriesByName);
        return isConfigurableTransactionType(normalized.operation)
          ? { ...normalized, reportable: settings.typeReportability[normalized.operation] }
          : normalized;
      })
    : [];
  const otherIncomeMerge = mergeOtherIncomeCategory(categories, normalizedTransactions);
  const migratedCategories = otherIncomeMerge.categories;
  const transactions = otherIncomeMerge.transactions;

  const currencyCodes = new Set<string>();
  const collectCode = (value: unknown) => {
    const code = normalizeCurrencyCode(value);
    if (code) currencyCodes.add(code);
  };
  wallets.forEach((wallet) => collectCode(wallet.currency));
  (Array.isArray(candidate.rates) ? candidate.rates : []).forEach((rate) => {
    const row = record(rate);
    collectCode(row.baseCurrency);
    collectCode(row.quoteCurrency);
  });
  transactions.forEach((transaction) => collectCode(transaction.currency));
  (Array.isArray(candidate.uncharted) ? candidate.uncharted : []).forEach((entry) => collectCode(record(entry).currency));
  collectCode(record(candidate.settings).reportingCurrency);

  const currenciesByCode = new Map<string, Currency>();
  if (Array.isArray(candidate.currencies)) {
    for (const value of candidate.currencies) {
      const currency = normalizeCurrency(value);
      if (currency) currenciesByCode.set(currency.code, currency);
    }
  }
  for (const code of currencyCodes) {
    if (!currenciesByCode.has(code)) currenciesByCode.set(code, defaultCurrency(code));
  }

  return {
    version: CURRENT_DATA_VERSION,
    generatedAt: String(candidate.generatedAt ?? new Date(0).toISOString()),
    source: {
      filename: typeof record(candidate.source).filename === "string"
        ? String(record(candidate.source).filename)
        : "jibjip-data.json",
      kind: typeof record(candidate.source).kind === "string"
        ? String(record(candidate.source).kind)
        : "unknown",
    },
    settings,
    currencies: [...currenciesByCode.values()].sort((left, right) => left.code.localeCompare(right.code)),
    wallets,
    categories: migratedCategories,
    rates: normalizeRateRows(Array.isArray(candidate.rates) ? candidate.rates as SeedData["rates"] : []),
    transactions,
    uncharted: Array.isArray(candidate.uncharted)
      ? (candidate.uncharted as SeedData["uncharted"]).map(sanitizeUnchartedEntry)
      : [],
  };
}
