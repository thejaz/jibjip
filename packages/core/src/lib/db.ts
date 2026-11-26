"use client";

import { runtimeProfile } from "../runtime";
import { clarityWeek } from "./clarity.ts";
import { normalizeChartExclusions } from "./charts.ts";
import { completeClarityReview, normalizeClarity, type ClarityReviewContext } from "./clarity.ts";
import Dexie, { type EntityTable } from "dexie";
import { normalizeCategoryGroup, renamedCategoryGroup } from "./category-groups";
import { AppError } from "./app-error";
import { assertActivityContextUnchanged, assertTransactionsUnchanged, type ActivityContext } from "./transaction-edit";
import { splitGroups } from "./splits";
import { categoryTranslationPlan, categoriesForLocale, mergeBuiltInCurrencies, mergeCategoryTemplates } from "./catalogs";
import { titleCaseCategoryLabel, titleCaseCategoryName } from "./category-names";
import { categoryCanBePermanentlyDeleted, categoryNameIsAvailable, categoryTransactionUpdates, mergeOtherIncomeCategory } from "./catalog-management";
import { normalizeSeedData } from "./data-normalization";
import { normalizeInterfaceLocale, type InterfaceLocale } from "./i18n/config";
import { mergeOfflineBaselineRates } from "./rates";
import { planRateUpdates, rateId } from "./rate-history";
import { normalizeSetupDraft, normalizeSetupStep } from "./setup";
import {
  isProtectedMainWallet,
  reinterpretWalletTransactionCurrencies,
  walletCurrencyChangeRequiresConfirmation,
} from "./wallets";
import { signedBalanceAmount } from "./finance";
import { CONFIGURABLE_TRANSACTION_TYPES, isConfigurableTransactionType, isTransactionTypeCategoryLabel, normalizeTypeReportability, transactionTypeLabel, type ConfigurableTransactionType } from "./transaction-types";
import {
  CURRENT_DATA_VERSION,
  normalizeMotionLevel,
  CURRENT_SETUP_VERSION,
  normalizeUnchartedStatus,
  sanitizeUnchartedEntry,
} from "./types";
import type {
  AppSettings,
  AppSnapshot,
  Category,
  Currency,
  Rate,
  SeedData,
  SetupDraft,
  SetupStep,
  Transaction,
  UnchartedEntry,
  Wallet,
} from "./types";

const RUNTIME_PROFILE = runtimeProfile();
const STARTER_SEED_VERSION = 2;
const SHOULD_BOOTSTRAP_STARTER_SEED =
  RUNTIME_PROFILE === "personal" || RUNTIME_PROFILE === "public";
const DATABASE_NAME =
  RUNTIME_PROFILE === "development"
    ? "jibjip-development-v2"
    : "mwatch-local-v1";

interface SettingRow {
  key: string;
  value: unknown;
}

class JibjipDatabase extends Dexie {
  currencies!: EntityTable<Currency, "code">;
  wallets!: EntityTable<Wallet, "id">;
  categories!: EntityTable<Category, "id">;
  rates!: EntityTable<Rate, "id">;
  transactions!: EntityTable<Transaction, "id">;
  uncharted!: EntityTable<UnchartedEntry, "id">;
  settings!: EntityTable<SettingRow, "key">;

  constructor() {
    // Personal and public installations share the current local database name.
    // Development uses a separate name as a second guard against touching personal data.
    super(DATABASE_NAME);
    this.version(2).stores({
      currencies: "code,name,kind,builtIn,archived",
      wallets: "id,name,currency,archived",
      categories: "id,name,scope,archived,templateKey,system",
      rates: "id,[baseCurrency+quoteCurrency],quoteCurrency,effectiveDate",
      transactions:
        "id,date,walletId,operation,direction,categoryId,category,linkId,sourceKey",
      uncharted: "id,date,status,currency,sourceKey",
      settings: "key",
    });
  }
}

export const db = new JibjipDatabase();

async function ensureReferenceCatalogs(): Promise<void> {
  const setupState = await db.settings.get("setupState");
  const [currencies, categories, rates, transactions, localeRow] = await Promise.all([
    db.currencies.toArray(),
    db.categories.toArray(),
    db.rates.toArray(),
    db.transactions.toArray(),
    db.settings.get("locale"),
  ]);
  const locale = localeRow?.value === "fa" ? "fa" : "en";
  const mergedCurrencies = mergeBuiltInCurrencies(currencies);
  const mergedCategories = setupState?.value === "uninitialized"
    ? categories
    : mergeCategoryTemplates(categories, locale);
  const mergedRates = mergeOfflineBaselineRates(rates);
  const currencyByCode = new Map(currencies.map((currency) => [currency.code, currency]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const mergedCategoryById = new Map(mergedCategories.map((category) => [category.id, category]));
  const currenciesToPut = mergedCurrencies.filter((currency) =>
    JSON.stringify(currencyByCode.get(currency.code)) !== JSON.stringify(currency)
  );
  const categoriesToPut = mergedCategories.filter((category) =>
    JSON.stringify(categoryById.get(category.id)) !== JSON.stringify(category)
  );
  const migrationTimestamp = new Date().toISOString();
  const transactionsToPut = transactions.flatMap((transaction) => {
    if (!transaction.categoryId) return [];
    const previousCategory = categoryById.get(transaction.categoryId);
    const nextCategory = mergedCategoryById.get(transaction.categoryId);
    if (!previousCategory || !nextCategory) return [];
    const categoryChanged = transaction.category !== nextCategory.name;
    const reportabilityChanged = previousCategory.defaultReportable !== nextCategory.defaultReportable;
    return categoryChanged || reportabilityChanged
      ? [{
          ...transaction,
          category: nextCategory.name,
          reportable: reportabilityChanged ? nextCategory.defaultReportable : transaction.reportable,
          updatedAt: migrationTimestamp,
        }]
      : [];
  });
  const rateById = new Map(rates.map((rate) => [rate.id, rate]));
  const mergedRateIds = new Set(mergedRates.map((rate) => rate.id));
  const ratesToDelete = rates
    .filter((rate) => !mergedRateIds.has(rate.id))
    .map((rate) => rate.id);
  const ratesToPut = mergedRates.filter((rate) =>
    JSON.stringify(rateById.get(rate.id)) !== JSON.stringify(rate),
  );
  if (currenciesToPut.length === 0 && categoriesToPut.length === 0 && ratesToDelete.length === 0 && ratesToPut.length === 0 && transactionsToPut.length === 0) return;
  await db.transaction("rw", [db.currencies, db.categories, db.rates, db.transactions], async () => {
    if (currenciesToPut.length > 0) await db.currencies.bulkPut(currenciesToPut);
    if (categoriesToPut.length > 0) await db.categories.bulkPut(categoriesToPut);
    if (ratesToDelete.length > 0) await db.rates.bulkDelete(ratesToDelete);
    if (ratesToPut.length > 0) await db.rates.bulkPut(ratesToPut);
    if (transactionsToPut.length > 0) await db.transactions.bulkPut(transactionsToPut);
  });
}

async function migrateOtherIncomeCategory(): Promise<void> {
  const [categories, transactions] = await Promise.all([
    db.categories.toArray(),
    db.transactions.toArray(),
  ]);
  const merged = mergeOtherIncomeCategory(categories, transactions);
  if (!merged.changed) return;
  const originalTransactions = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const transactionsToPut = merged.transactions.filter((transaction) =>
    originalTransactions.get(transaction.id) !== transaction
  );
  await db.transaction("rw", [db.categories, db.transactions], async () => {
    if (merged.removedCategoryIds.length > 0) await db.categories.bulkDelete(merged.removedCategoryIds);
    await db.categories.bulkPut(merged.categories);
    if (transactionsToPut.length > 0) await db.transactions.bulkPut(transactionsToPut);
  });
}

async function migrateActivityTypeMetadata(): Promise<void> {
  const [categories, transactions, typeReportabilityRow] = await Promise.all([
    db.categories.toArray(), db.transactions.toArray(), db.settings.get("typeReportability"),
  ]);
  const legacyTypeCategories = categories.filter((category) => {
    if (
      category.templateKey !== null &&
      CONFIGURABLE_TRANSACTION_TYPES.includes(category.templateKey as ConfigurableTransactionType)
    ) return true;
    if (!isTransactionTypeCategoryLabel(category.name)) return false;
    return !transactions.some((transaction) =>
      transaction.categoryId === category.id && !isConfigurableTransactionType(transaction.operation)
    );
  });
  const typeReportability = normalizeTypeReportability(typeReportabilityRow?.value);
  for (const category of legacyTypeCategories) {
    const operation = category.templateKey as ConfigurableTransactionType;
    // A legacy backup has no separate type setting; preserve its category toggle.
    typeReportability[operation] = category.defaultReportable;
  }
  const toPut = transactions.flatMap((transaction) => {
    if (!isConfigurableTransactionType(transaction.operation)) return [];
    const reportable = typeReportability[transaction.operation];
    const category = transactionTypeLabel(transaction.operation);
    return transaction.categoryId === null && transaction.category === category && transaction.reportable === reportable
      ? []
      : [{ ...transaction, categoryId: null, category, reportable }];
  });
  if (legacyTypeCategories.length === 0 && toPut.length === 0 && typeReportabilityRow !== undefined) return;
  await db.transaction("rw", [db.categories, db.transactions, db.settings], async () => {
    if (legacyTypeCategories.length > 0) await db.categories.bulkDelete(legacyTypeCategories.map((category) => category.id));
    if (toPut.length > 0) await db.transactions.bulkPut(toPut);
    await db.settings.put({ key: "typeReportability", value: typeReportability });
  });
}

async function migrateMissingBalanceAmounts(): Promise<void> {
  const migrated = (await db.transactions
    .filter(
      (transaction) =>
        transaction.affectsBalance && transaction.balanceAmount === undefined,
    )
    .toArray())
    .map((transaction) => ({
      ...transaction,
      balanceAmount: signedBalanceAmount(transaction.amount, transaction.direction),
    }));
  if (migrated.length > 0) await db.transactions.bulkPut(migrated);
}

async function normalizeUnchartedEntries(): Promise<void> {
  const entries = await db.uncharted.toArray();
  const changed = entries
    .map((entry) => {
      const status = normalizeUnchartedStatus(entry.status);
      const record = entry as UnchartedEntry & Record<string, unknown>;
      const hasRemovedFields = "wallet" in record || "type" in record || "category" in record;
      const sanitized = sanitizeUnchartedEntry(entry);
      return entry.status === status && entry.amount === sanitized.amount && !hasRemovedFields
        ? null
        : sanitized;
    })
    .filter((entry): entry is UnchartedEntry => entry !== null);
  if (changed.length > 0) await db.uncharted.bulkPut(changed);
}

export const DEFAULT_SETTINGS: AppSettings = {
  clarity: { enabled: true, awards: [] },
  dataVersion: CURRENT_DATA_VERSION,
  setupVersion: 0,
  setupState: "uninitialized",
  mainWalletId: null,
  setupStep: 1,
  setupDraft: null,
  reportingCurrency: "EUR",
  locale: "en",
  showJalali: true,
  starterSeedVersion: 0,
  irrDisplayUnit: "IRR",
  textSize: "medium",
  motion: "subtle",
  startPage: "overview",
  overviewWalletIds: null,
  overviewPinnedWalletIds: [null, null, null],
  overviewHiddenCurrencies: [],
  chartExcludedCategoryIds: [],
  defaultWalletId: null,
  typeReportability: { transfer: false, exchange: false, adjustment: false },
};

async function normalizeSettings(): Promise<void> {
  const [rows, wallets, rates] = await Promise.all([
    db.settings.toArray(),
    db.wallets.toArray(),
    db.rates.toArray(),
  ]);
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const walletIds = new Set(wallets.map((wallet) => wallet.id));
  const activeWalletIds = new Set(
    wallets.filter((wallet) => !wallet.archived).map((wallet) => wallet.id),
  );
  const rateCurrencies = new Set(rates.map((rate) => rate.quoteCurrency));
  const reportingCurrency = stored.get("reportingCurrency");
  const locale = stored.get("locale");
  const showJalali = stored.get("showJalali");
  const starterSeedVersion = stored.get("starterSeedVersion");
  const irrDisplayUnit = stored.get("irrDisplayUnit");
  const textSize = stored.get("textSize");
  const startPage = stored.get("startPage");
  const overviewWalletIds = stored.get("overviewWalletIds");
  const overviewPinnedWalletIds = stored.get("overviewPinnedWalletIds");
  const overviewHiddenCurrencies = stored.get("overviewHiddenCurrencies");
  const defaultWalletId = stored.get("defaultWalletId");
  const dataVersion = stored.get("dataVersion");
  const setupVersion = stored.get("setupVersion");
  const setupState = stored.get("setupState");
  const mainWalletId = stored.get("mainWalletId");
  const setupStep = stored.get("setupStep");
  const setupDraft = stored.get("setupDraft");
  const typeReportability = stored.get("typeReportability");
  const normalizedPinnedWalletIds = Array.isArray(overviewPinnedWalletIds)
    ? overviewPinnedWalletIds
        .slice(0, 3)
        .map((id) => (typeof id === "string" && walletIds.has(id) ? id : null))
    : [];
  while (normalizedPinnedWalletIds.length < 3) normalizedPinnedWalletIds.push(null);
  const seenPinnedWalletIds = new Set<string>();
  const uniquePinnedWalletIds = normalizedPinnedWalletIds.map((id) => {
    if (id === null || seenPinnedWalletIds.has(id)) return null;
    seenPinnedWalletIds.add(id);
    return id;
  });
  const normalizedOverviewWalletIds: string[] | null = overviewWalletIds === null
    ? null
    : Array.isArray(overviewWalletIds)
      ? [...new Set<string>((overviewWalletIds as unknown[]).filter(
          (id): id is string => typeof id === "string" && walletIds.has(id),
        ))]
      : DEFAULT_SETTINGS.overviewWalletIds;
  const normalizedHiddenCurrencies = Array.isArray(overviewHiddenCurrencies)
    ? [...new Set<string>((overviewHiddenCurrencies as unknown[]).filter(
        (currency): currency is string => typeof currency === "string" && /^[A-Z][A-Z0-9]{2,7}$/.test(currency),
      ))].sort((left, right) => left.localeCompare(right))
    : DEFAULT_SETTINGS.overviewHiddenCurrencies;
  const normalizedMainWalletId =
    typeof mainWalletId === "string" && activeWalletIds.has(mainWalletId)
      ? mainWalletId
      : null;
  const normalizedSetupVersion =
    typeof setupVersion === "number" && Number.isInteger(setupVersion) && setupVersion >= 0
      ? setupVersion
      : 0;
  const normalizedSetupState =
    setupState === "complete" &&
    normalizedSetupVersion >= CURRENT_SETUP_VERSION &&
    normalizedMainWalletId
      ? "complete"
      : wallets.length > 0
        ? "upgrade-required"
        : "uninitialized";
  const normalized: AppSettings = {
    clarity: normalizeClarity(stored.get("clarity")),
    dataVersion:
      typeof dataVersion === "number" && Number.isInteger(dataVersion) && dataVersion >= CURRENT_DATA_VERSION
        ? dataVersion
        : CURRENT_DATA_VERSION,
    setupVersion: normalizedSetupVersion,
    setupState: normalizedSetupState,
    mainWalletId: normalizedMainWalletId,
    setupStep: normalizeSetupStep(setupStep),
    setupDraft: setupDraft === null || setupDraft === undefined
      ? null
      : normalizeSetupDraft(setupDraft, {
          locale: normalizeInterfaceLocale(locale),
          reportingCurrency: typeof reportingCurrency === "string" ? reportingCurrency : "EUR",
          showJalali: typeof showJalali === "boolean" ? showJalali : true,
          irrDisplayUnit: irrDisplayUnit === "TMN" || irrDisplayUnit === "HTM" || irrDisplayUnit === "MTM" ? irrDisplayUnit : "IRR",
        }),
    reportingCurrency:
      typeof reportingCurrency === "string" && (reportingCurrency === "EUR" || rateCurrencies.has(reportingCurrency))
        ? reportingCurrency
        : DEFAULT_SETTINGS.reportingCurrency,
    locale: normalizeInterfaceLocale(locale),
    showJalali: typeof showJalali === "boolean" ? showJalali : DEFAULT_SETTINGS.showJalali,
    starterSeedVersion:
      typeof starterSeedVersion === "number" &&
      Number.isInteger(starterSeedVersion) &&
      starterSeedVersion >= 0
        ? starterSeedVersion
        : DEFAULT_SETTINGS.starterSeedVersion,
    irrDisplayUnit:
      irrDisplayUnit === "IRR" || irrDisplayUnit === "TMN" || irrDisplayUnit === "HTM" || irrDisplayUnit === "MTM"
        ? irrDisplayUnit
        : DEFAULT_SETTINGS.irrDisplayUnit,
    textSize:
      textSize === "small" || textSize === "medium" || textSize === "large"
        ? textSize
        : DEFAULT_SETTINGS.textSize,
    startPage: startPage === "transactions" ? "transactions" : "overview",
    motion: normalizeMotionLevel(stored.get("motion")),
    overviewWalletIds: normalizedOverviewWalletIds,
    overviewPinnedWalletIds: uniquePinnedWalletIds,
    overviewHiddenCurrencies: normalizedHiddenCurrencies,
    chartExcludedCategoryIds: normalizeChartExclusions(stored.get("chartExcludedCategoryIds")),
    defaultWalletId:
      typeof defaultWalletId === "string" && activeWalletIds.has(defaultWalletId)
        ? defaultWalletId
        : DEFAULT_SETTINGS.defaultWalletId,
    typeReportability: normalizeTypeReportability(typeReportability),
  };
  const changed = (Object.entries(normalized) as [keyof AppSettings, AppSettings[keyof AppSettings]][])
    .filter(([key, value]) => JSON.stringify(stored.get(key)) !== JSON.stringify(value))
    .map(([key, value]) => ({ key, value }));
  if (changed.length > 0) await db.transaction("rw", db.settings, async () => {
    // A review/toggle in another window may have committed since this read.
    const current = await db.settings.get("clarity");
    const safeChanges = changed.map(row => row.key === "clarity"
      ? { key: row.key, value: normalizeClarity(current?.value) } : row);
    await db.settings.bulkPut(safeChanges);
  });
}

function cleanCategoryName(name: string): string {
  return titleCaseCategoryName(name);
}

function categoryKey(name: string): string {
  return cleanCategoryName(name).toLocaleLowerCase("en");
}

function categoryNameScore(name: string): number {
  return cleanCategoryName(name)
    .split(" ")
    .reduce((score, word, index) => {
      if (!/[A-Za-z]/.test(word)) return score;
      const titleCase = /^[A-Z][a-z]/.test(word);
      const shortAcronym = /^[A-Z]+$/.test(word) && word.length <= 4;
      return score + (index === 0 && /^[A-Z]/.test(word) ? 20 : 0) + (titleCase ? 5 : shortAcronym ? 4 : 0);
    }, 0);
}

export function canonicalCategoryName(name: string, categories: Category[]): string {
  const cleaned = cleanCategoryName(name);
  const existing = categories.find((category) => categoryKey(category.name) === categoryKey(cleaned));
  return existing?.name ?? cleaned;
}

export async function normalizeCategoryCasing(): Promise<void> {
  const [categories, transactions] = await Promise.all([
    db.categories.toArray(),
    db.transactions.toArray(),
  ]);
  const namesByKey = new Map<string, string[]>();
  for (const name of [
    ...categories.map((category) => category.name),
    ...transactions.map((transaction) => transaction.category),
  ]) {
    const cleaned = cleanCategoryName(name);
    if (!cleaned) continue;
    const key = categoryKey(cleaned);
    const names = namesByKey.get(key) ?? [];
    if (!names.includes(cleaned)) names.push(cleaned);
    namesByKey.set(key, names);
  }
  const canonicalNames = new Map(
    [...namesByKey].map(([key, names]) => [
      key,
      names.reduce((preferred, candidate) =>
        categoryNameScore(candidate) > categoryNameScore(preferred) ? candidate : preferred,
      ),
    ]),
  );
  const categoriesByKey = new Map<string, Category[]>();
  for (const category of categories) {
    const key = categoryKey(category.name);
    categoriesByKey.set(key, [...(categoriesByKey.get(key) ?? []), category]);
  }
  const categoriesToDelete: string[] = [];
  const categoriesToPut: Category[] = [];
  const mergedCategoryIds = new Map<string, string>();
  const canonicalCategoryByKey = new Map<string, Category>();
  for (const [key, matches] of categoriesByKey) {
    const canonicalName = titleCaseCategoryName(canonicalNames.get(key) ?? cleanCategoryName(matches[0].name));
    const keeper = matches.reduce((preferred, candidate) =>
      cleanCategoryName(candidate.name) === canonicalName ? candidate : preferred,
    );
    const scopes = new Set(matches.map((category) => category.scope));
    const normalizedCategory: Category = {
      ...keeper,
      name: canonicalName,
      scope: scopes.size > 1 ? "both" : keeper.scope,
      archived: matches.every((category) => category.archived),
    };
    if (JSON.stringify(keeper) !== JSON.stringify(normalizedCategory)) categoriesToPut.push(normalizedCategory);
    canonicalCategoryByKey.set(key, normalizedCategory);
    for (const category of matches) {
      if (category.id === keeper.id) continue;
      categoriesToDelete.push(category.id);
      mergedCategoryIds.set(category.id, keeper.id);
    }
  }
  const transactionsToPut = transactions
    .map((transaction) => {
      const canonicalCategory = canonicalCategoryByKey.get(categoryKey(transaction.category));
      const categoryId = transaction.categoryId
        ? mergedCategoryIds.get(transaction.categoryId) ?? transaction.categoryId
        : canonicalCategory?.id ?? null;
      const category = canonicalCategory?.name ?? titleCaseCategoryLabel(transaction.category, transaction.operation);
      return transaction.category !== category || transaction.categoryId !== categoryId
        ? { ...transaction, category, categoryId }
        : null;
    })
    .filter((transaction): transaction is Transaction => transaction !== null);

  if (categoriesToDelete.length === 0 && transactionsToPut.length === 0 && categoriesToPut.every((category) => {
    const original = categories.find((candidate) => candidate.id === category.id);
    return original?.name === category.name && original.scope === category.scope && original.archived === category.archived;
  })) return;

  await db.transaction("rw", [db.categories, db.transactions], async () => {
    if (categoriesToDelete.length > 0) await db.categories.bulkDelete(categoriesToDelete);
    if (categoriesToPut.length > 0) await db.categories.bulkPut(categoriesToPut);
    if (transactionsToPut.length > 0) await db.transactions.bulkPut(transactionsToPut);
  });
}

export async function replaceDatabase(seed: SeedData): Promise<void> {
  const upgraded = normalizeSeedData(seed);
  await db.transaction(
    "rw",
    [
      db.currencies,
      db.wallets,
      db.categories,
      db.rates,
      db.transactions,
      db.uncharted,
      db.settings,
    ],
    async () => {
      await Promise.all([
        db.currencies.clear(),
        db.wallets.clear(),
        db.categories.clear(),
        db.rates.clear(),
        db.transactions.clear(),
        db.uncharted.clear(),
        db.settings.clear(),
      ]);
      await db.currencies.bulkPut(upgraded.currencies);
      await db.wallets.bulkPut(upgraded.wallets);
      await db.categories.bulkPut(upgraded.categories);
      await db.rates.bulkPut(upgraded.rates);
      await db.transactions.bulkPut(upgraded.transactions);
      await db.uncharted.bulkPut(
        upgraded.uncharted.map((entry) => sanitizeUnchartedEntry(entry)),
      );
      await db.settings.bulkPut(
        Object.entries({
          ...upgraded.settings,
          starterSeedVersion: STARTER_SEED_VERSION,
        }).map(([key, value]) => ({
          key: key as keyof AppSettings,
          value,
        })),
      );
    },
  );
  await migrateMissingBalanceAmounts();
  await migrateOtherIncomeCategory();
  await ensureReferenceCatalogs();
  await migrateActivityTypeMetadata();
  await Promise.all([normalizeCategoryCasing(), normalizeSettings()]);
}

export async function eraseLocalData(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.currencies,
      db.wallets,
      db.categories,
      db.rates,
      db.transactions,
      db.uncharted,
      db.settings,
    ],
    async () => {
      await Promise.all([
        db.currencies.clear(),
        db.wallets.clear(),
        db.categories.clear(),
        db.rates.clear(),
        db.transactions.clear(),
        db.uncharted.clear(),
        db.settings.clear(),
      ]);
      await db.settings.bulkPut(Object.entries({ ...DEFAULT_SETTINGS, starterSeedVersion: STARTER_SEED_VERSION })
        .map(([key, value]) => ({ key: key as keyof AppSettings, value })));
      // A fresh setup must work immediately, without a reload to recreate its reference catalog.
      await ensureReferenceCatalogs();
    },
  );
}

const applicationTables = () => [db.currencies, db.wallets, db.categories, db.rates, db.transactions, db.uncharted, db.settings];

// Initialization is serialized by IndexedDB across windows, including every migration read/write.
async function prepareLocalData(): Promise<"existing" | "empty" | "needs-seed"> {
  const [
    existingTransactions,
    existingWallets,
    existingCategories,
    existingRates,
    existingUncharted,
    existingSettings,
    starterSeedVersionRow,
  ] = await Promise.all([
    db.transactions.count(),
    db.wallets.count(),
    db.categories.count(),
    db.rates.count(),
    db.uncharted.count(),
    db.settings.count(),
    db.settings.get("starterSeedVersion"),
  ]);
  const hasApplicationData =
    existingTransactions > 0 ||
    existingWallets > 0 ||
    existingCategories > 0 ||
    existingRates > 0 ||
    existingUncharted > 0;
  const handledStarterVersion =
    typeof starterSeedVersionRow?.value === "number"
      ? starterSeedVersionRow.value
      : 0;

  if (
    hasApplicationData ||
    handledStarterVersion >= STARTER_SEED_VERSION ||
    (RUNTIME_PROFILE === "personal" && existingSettings > 0)
  ) {
    if (RUNTIME_PROFILE === "public" && hasApplicationData && handledStarterVersion < STARTER_SEED_VERSION) {
      await db.settings.put({
        key: "starterSeedVersion",
        value: STARTER_SEED_VERSION,
      });
    }
    await ensureReferenceCatalogs();
    await migrateMissingBalanceAmounts();
    await migrateOtherIncomeCategory();
    await migrateActivityTypeMetadata();
    await Promise.all([normalizeCategoryCasing(), normalizeUnchartedEntries(), normalizeSettings()]);
    return "existing";
  }
  if (!SHOULD_BOOTSTRAP_STARTER_SEED) {
    await ensureReferenceCatalogs();
    await normalizeSettings();
    return "empty";
  }
  return "needs-seed";
}

let initialization: Promise<"existing" | "seeded" | "empty"> | undefined;
export function initializeLocalData(): Promise<"existing" | "seeded" | "empty"> {
  if (initialization) return initialization;
  initialization = (async () => {
    const result = await db.transaction("rw", applicationTables(), prepareLocalData);
    if (result !== "needs-seed") return result;
    // Fetch outside IndexedDB; a transaction cannot be kept open over a network request.
    try {
      const response = await fetch("/data/jibjip-starter-seed.json", { cache: "no-store" });
      if (!response.ok) return "empty" as const;
      const seed = normalizeSeedData(await response.json());
      return await db.transaction("rw", applicationTables(), async () => {
        // Another window may have completed setup while this request was in flight.
        const current = await prepareLocalData();
        if (current !== "needs-seed") return current;
        const preservedSettings = Object.fromEntries((await db.settings.toArray())
          .filter(row => row.key !== "starterSeedVersion").map(row => [row.key, row.value])) as Partial<AppSettings>;
        await replaceDatabase({ ...seed, settings: { ...seed.settings, ...preservedSettings, starterSeedVersion: STARTER_SEED_VERSION } });
        return "seeded" as const;
      });
    } catch {
      return "empty" as const;
    }
  })().finally(() => { initialization = undefined; });
  return initialization;
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  // A backup/report must not mix stores from opposite sides of a concurrent write.
  return db.transaction("r", [db.currencies, db.wallets, db.categories, db.rates, db.transactions, db.uncharted, db.settings], async () => {
    const [currencies, wallets, categories, rates, transactions, uncharted, settingRows] =
      await Promise.all([
        db.currencies.toArray(),
        db.wallets.toArray(),
        db.categories.toArray(),
        db.rates.toArray(),
        db.transactions.toArray(),
        db.uncharted.toArray(),
        db.settings.toArray(),
      ]);
    const settings = { ...DEFAULT_SETTINGS };
    for (const row of settingRows) {
      Object.assign(settings, { [row.key]: row.value });
    }
    return { currencies, wallets, categories, rates, transactions, uncharted, settings };
  });
}

/** Posting an Uncharted entry and removing its draft either both succeed or both roll back. */
export async function saveActivityDraft(write: () => Promise<void>, promotion?: UnchartedEntry, expectedContext?: ActivityContext): Promise<void> {
  await db.transaction("rw", [db.wallets, db.categories, db.transactions, db.uncharted, db.settings], async () => {
    if (expectedContext) {
      const [wallets, categories, settings] = await Promise.all([db.wallets.toArray(), db.categories.toArray(), db.settings.toArray()]);
      assertActivityContextUnchanged(expectedContext, { wallets, categories,
        settings: { ...DEFAULT_SETTINGS, ...Object.fromEntries(settings.map(row => [row.key, row.value])) } });
    }
    if (promotion && JSON.stringify(await db.uncharted.get(promotion.id)) !== JSON.stringify(promotion)) {
      throw new AppError("error.entryStale", "Entry changed. Close and reopen it before promoting.");
    }
    await write();
    if (promotion) await db.uncharted.delete(promotion.id);
  });
}

/** Call inside the write transaction; includes added or removed linked/split parts. */
export async function assertStoredActivitiesUnchanged(expected: Transaction[]): Promise<void> {
  const ids = new Set(expected.map(row => row.id));
  const splits = new Set(expected.flatMap(row => row.split ? [row.split.id] : []));
  const links = [...new Set(expected.flatMap(row => row.linkId ? [row.linkId] : []))];
  const current = splits.size > 0
    ? (await db.transactions.toArray()).filter(row => ids.has(row.id) || Boolean(row.split && splits.has(row.split.id)) || Boolean(row.linkId && links.includes(row.linkId)))
    : [...new Map([
      ...(await db.transactions.bulkGet([...ids])).filter((row): row is Transaction => row !== undefined),
      ...(links.length ? await db.transactions.where("linkId").anyOf(links).toArray() : []),
    ].map(row => [row.id, row])).values()];
  assertTransactionsUnchanged(expected, current);
  if (splits.size > 0) splitGroups(current);
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  await db.settings.put({ key, value });
}

/** Toggle without overwriting awards saved by another window. */
export async function setClarityEnabled(enabled: boolean): Promise<void> {
  await db.transaction("rw", db.settings, async () => {
    const state = normalizeClarity((await db.settings.get("clarity"))?.value);
    await db.settings.put({ key: "clarity", value: { ...state, enabled } });
  });
}

/** Award at most once per task/week, rechecking the reviewed data atomically. */
export async function awardClarityReview(expected: ClarityReviewContext): Promise<boolean> {
  return db.transaction("rw", [db.settings, db.wallets, db.categories, db.transactions], async () => {
    const [row, reviewRows] = await Promise.all([
      db.settings.get("clarity"),
      // Indexed reads preserve the complete review scope inside this same transaction.
      expected.task === "balance"
        ? db.transactions.where("walletId").equals(expected.walletId ?? "").toArray()
        : db.transactions.where("date").between(clarityWeek(expected.day), expected.day, true, true).toArray(),
    ]);
    const transactions = expected.task === "categories" ? reviewRows.filter(row => row.operation === "transaction") : reviewRows;
    const walletIds = new Set(transactions.map(row => row.walletId));
    if (expected.task === "balance" && expected.walletId) walletIds.add(expected.walletId);
    const categoryIds = expected.task === "categories" ? [...new Set(transactions.flatMap(row => row.categoryId ? [row.categoryId] : []))] : [];
    const [walletRows, categoryRows] = await Promise.all([db.wallets.bulkGet([...walletIds]), db.categories.bulkGet(categoryIds)]);
    const wallets = walletRows.filter((row): row is Wallet => row !== undefined);
    const categories = categoryRows.filter((row): row is Category => row !== undefined);
    const { state, awarded } = completeClarityReview(row?.value, expected, { wallets, categories, transactions });
    if (awarded) await db.settings.put({ key: "clarity", value: state });
    return awarded;
  });
}

/** Update a type's reporting choice and keep every existing posting synchronized. */
export async function setTypeReportability(
  operation: ConfigurableTransactionType,
  reportable: boolean,
): Promise<void> {
  await db.transaction("rw", [db.settings, db.transactions], async () => {
    const row = await db.settings.get("typeReportability");
    const next = { ...normalizeTypeReportability(row?.value), [operation]: reportable };
    const transactions = await db.transactions.where("operation").equals(operation).toArray();
    await db.settings.put({ key: "typeReportability", value: next });
    const changed = transactions.filter((transaction) => transaction.reportable !== reportable)
      .map((transaction) => ({ ...transaction, reportable, updatedAt: new Date().toISOString() }));
    if (changed.length > 0) await db.transactions.bulkPut(changed);
  });
}

export async function persistWallet(
  value: Wallet,
  confirmHistoricalCurrencyReinterpretation = false,
): Promise<void> {
  const wallet: Wallet = {
    ...value,
    name: value.name.trim(),
    code: value.code.trim(),
    currency: value.currency.trim().toUpperCase(),
  };
  if (!wallet.name || !wallet.code) {
    throw new AppError("error.walletFieldsRequired", "Wallet name and code are required.");
  }
  await db.transaction("rw", [db.currencies, db.wallets, db.transactions, db.settings], async () => {
    const [existing, currency, wallets, mainWalletRow] = await Promise.all([
      db.wallets.get(wallet.id),
      db.currencies.get(wallet.currency),
      db.wallets.toArray(),
      db.settings.get("mainWalletId"),
    ]);
    if ((!existing || existing.currency !== wallet.currency) && (!currency || currency.archived)) {
      throw new AppError(
        "error.walletCurrencyUnavailable",
        "The selected wallet currency is unavailable.",
        { currency: wallet.currency },
      );
    }
    if (wallets.some((item) => item.id !== wallet.id && item.code.toLocaleLowerCase("en") === wallet.code.toLocaleLowerCase("en"))) {
      throw new AppError("error.walletCodeExists", "Wallet code already exists.", { code: wallet.code });
    }
    if (wallet.archived && isProtectedMainWallet(wallet.id, typeof mainWalletRow?.value === "string" ? mainWalletRow.value : null)) {
      throw new AppError("error.mainWalletProtected", "The main wallet cannot be archived or deleted.");
    }
    const ownedTransactions = existing && existing.currency !== wallet.currency
      ? await db.transactions.where("walletId").equals(wallet.id).toArray()
      : [];
    if (walletCurrencyChangeRequiresConfirmation(existing ?? null, wallet.currency, ownedTransactions.length) && !confirmHistoricalCurrencyReinterpretation) {
      throw new AppError(
        "error.walletCurrencyConfirmationRequired",
        "Explicit confirmation is required before reinterpreting historical wallet amounts.",
      );
    }
    const relabeledTransactions = reinterpretWalletTransactionCurrencies(
      ownedTransactions,
      wallet.id,
      wallet.currency,
    );
    await db.wallets.put(wallet);
    if (relabeledTransactions.length > 0) await db.transactions.bulkPut(relabeledTransactions);
  });
}

export async function setWalletArchived(walletId: string, archived: boolean): Promise<void> {
  await db.transaction("rw", [db.wallets, db.settings], async () => {
    const [wallet, mainWalletRow, defaultWalletRow] = await Promise.all([
      db.wallets.get(walletId),
      db.settings.get("mainWalletId"),
      db.settings.get("defaultWalletId"),
    ]);
    if (!wallet) throw new AppError("error.walletMissing", "Wallet not found.");
    if (archived && isProtectedMainWallet(walletId, typeof mainWalletRow?.value === "string" ? mainWalletRow.value : null)) {
      throw new AppError("error.mainWalletProtected", "The main wallet cannot be archived or deleted.");
    }
    await db.wallets.update(walletId, { archived });
    if (archived && defaultWalletRow?.value === walletId) {
      await db.settings.put({ key: "defaultWalletId", value: null });
    }
    if (archived) await clearWalletShortcuts(walletId);
  });
}

/** Call inside the wallet/settings transaction; shortcuts never keep an inactive wallet. */
async function clearWalletShortcuts(walletId: string): Promise<void> {
  const [pinned, visible] = await Promise.all([
    db.settings.get("overviewPinnedWalletIds"), db.settings.get("overviewWalletIds"),
  ]);
  if (Array.isArray(pinned?.value) && pinned.value.includes(walletId)) {
    await db.settings.put({ key: "overviewPinnedWalletIds", value: pinned.value.map(id => id === walletId ? null : id) });
  }
  if (Array.isArray(visible?.value) && visible.value.includes(walletId)) {
    await db.settings.put({ key: "overviewWalletIds", value: visible.value.filter(id => id !== walletId) });
  }
}

export async function setDefaultWallet(walletId: string): Promise<void> {
  await db.transaction("rw", [db.wallets, db.settings], async () => {
    const wallet = await db.wallets.get(walletId);
    if (!wallet || wallet.archived) throw new AppError("error.walletMissing", "Wallet is no longer available.");
    await db.settings.put({ key: "defaultWalletId", value: walletId });
  });
}

export async function deleteUnchartedEntry(expected: UnchartedEntry): Promise<void> {
  await db.transaction("rw", db.uncharted, async () => {
    if (JSON.stringify(await db.uncharted.get(expected.id)) !== JSON.stringify(expected)) {
      throw new AppError("error.entryStale", "Entry changed. Close and reopen it.");
    }
    await db.uncharted.delete(expected.id);
  });
}

export async function deleteUnusedWallet(walletId: string): Promise<void> {
  await db.transaction("rw", [db.wallets, db.transactions, db.settings], async () => {
    const [wallet, mainWalletRow, transactionCount, defaultWalletRow] = await Promise.all([
      db.wallets.get(walletId),
      db.settings.get("mainWalletId"),
      db.transactions.where("walletId").equals(walletId).count(),
      db.settings.get("defaultWalletId"),
    ]);
    if (!wallet) throw new AppError("error.walletMissing", "Wallet not found.");
    if (isProtectedMainWallet(walletId, typeof mainWalletRow?.value === "string" ? mainWalletRow.value : null)) {
      throw new AppError("error.mainWalletProtected", "The main wallet cannot be archived or deleted.");
    }
    if (transactionCount > 0) {
      throw new AppError("error.walletHasTransactions", "A wallet with transactions must be archived instead of deleted.");
    }
    await db.wallets.delete(walletId);
    if (defaultWalletRow?.value === walletId) {
      await db.settings.put({ key: "defaultWalletId", value: null });
    }
    await clearWalletShortcuts(walletId);
  });
}

export async function persistCurrency(value: Currency, existingCode?: string): Promise<void> {
  const currency: Currency = {
    ...value,
    code: value.code.trim().toUpperCase(),
    name: value.name.trim().replace(/\s+/g, " "),
    symbol: value.symbol.trim(),
    builtIn: false,
  };
  if (!/^[A-Z][A-Z0-9]{2,7}$/.test(currency.code)) {
    throw new AppError("error.currencyCodeInvalid", "Currency codes must contain 3 to 8 uppercase letters or digits.");
  }
  if (!currency.name || !currency.symbol || !Number.isInteger(currency.fractionDigits) || currency.fractionDigits < 0 || currency.fractionDigits > 18) {
    throw new AppError("error.currencyFieldsInvalid", "Enter a name, symbol, and decimal precision from 0 to 18.");
  }
  await db.transaction("rw", db.currencies, async () => {
    const existing = await db.currencies.get(currency.code);
    if (existing?.builtIn) {
      throw new AppError("error.currencyBuiltIn", "Built-in currencies cannot be changed or removed.");
    }
    if (existing && existingCode !== currency.code) {
      throw new AppError("error.currencyCodeExists", "A currency with this code already exists.", { currency: currency.code });
    }
    await db.currencies.put({ ...currency, archived: existing?.archived ?? currency.archived });
  });
}

/** Save observations atomically. Online updates never replace manual or locked entries. */
export async function persistRates(values: Rate[], automatic = true): Promise<number> {
  return db.transaction("rw", [db.rates, db.currencies], async () => {
    const codes = new Set(await db.currencies.toCollection().primaryKeys());
    if (values.some(row => !codes.has(row.quoteCurrency))) throw new Error("Unknown rate currency.");
    const plan = planRateUpdates(await db.rates.toArray(), values, automatic);
    if (plan.puts.length) await db.rates.bulkPut(plan.puts);
    return plan.puts.length;
  });
}

export async function persistRate(value: Rate): Promise<void> {
  await persistRates([value], false);
}

export async function setRateLocked(id: string, locked: boolean): Promise<void> {
  await db.transaction("rw", db.rates, async () => {
    const row = await db.rates.get(id);
    if (!row) throw new Error("Rate no longer exists.");
    await db.rates.put({ ...row, locked });
  });
}

async function currencyUsageCount(code: string): Promise<number> {
  const [wallets, uncharted, rates, reportingCurrency] = await Promise.all([
    db.wallets.where("currency").equals(code).count(),
    db.uncharted.where("currency").equals(code).count(),
    db.rates.where("quoteCurrency").equals(code).count(),
    db.settings.get("reportingCurrency"),
  ]);
  return wallets + uncharted + rates + (reportingCurrency?.value === code ? 1 : 0);
}

export async function setCurrencyArchived(code: string, archived: boolean): Promise<void> {
  await db.transaction("rw", [db.currencies, db.wallets, db.uncharted, db.rates, db.settings], async () => {
    const currency = await db.currencies.get(code);
    if (!currency) throw new AppError("error.currencyMissing", "Currency not found.");
    if (currency.builtIn) throw new AppError("error.currencyBuiltIn", "Built-in currencies cannot be changed or removed.");
    if (archived && await currencyUsageCount(code) > 0) {
      throw new AppError("error.currencyInUse", "A currency in use cannot be archived or deleted.");
    }
    await db.currencies.update(code, { archived });
  });
}

export async function deleteUnusedCurrency(code: string): Promise<void> {
  await db.transaction("rw", [db.currencies, db.wallets, db.uncharted, db.rates, db.settings], async () => {
    const currency = await db.currencies.get(code);
    if (!currency) throw new AppError("error.currencyMissing", "Currency not found.");
    if (currency.builtIn) throw new AppError("error.currencyBuiltIn", "Built-in currencies cannot be changed or removed.");
    if (await currencyUsageCount(code) > 0) {
      throw new AppError("error.currencyInUse", "A currency in use cannot be archived or deleted.");
    }
    await db.currencies.delete(code);
  });
}

export async function persistCategory(value: Category): Promise<void> {
  const category: Category = {
    ...value,
    name: titleCaseCategoryName(value.name),
    group: normalizeCategoryGroup(value.group),
    color: value.color.trim().toUpperCase(),
    icon: value.icon.trim(),
  };
  if (!category.name || !/^#[0-9A-F]{6}$/.test(category.color) || !category.icon) {
    throw new AppError("error.categoryFieldsInvalid", "Enter a category name, color, and symbol.");
  }
  await db.transaction("rw", [db.categories, db.transactions], async () => {
    const [existing, categories, transactions] = await Promise.all([
      db.categories.get(category.id),
      db.categories.toArray(),
      db.transactions.toArray(),
    ]);
    if (!categoryNameIsAvailable(categories, category.id, category.name)) {
      throw new AppError("error.categoryNameExists", "A category with this name already exists.", { name: category.name });
    }
    if (isTransactionTypeCategoryLabel(category.name) && existing?.name !== category.name) {
      throw new AppError("error.activityTypeCannotBeCategory", "Fixed transaction types cannot be used as category names.");
    }
    if (existing?.system && (existing.name !== category.name || existing.scope !== category.scope)) {
      throw new AppError("error.categorySystemProtected", "Required system categories cannot be renamed or repurposed.");
    }
    const normalized = existing?.system
      ? { ...category, name: existing.name, scope: existing.scope, archived: false, system: true }
      : category;
    const updatedAt = new Date().toISOString();
    const transactionUpdates = existing
      ? categoryTransactionUpdates(transactions, existing, normalized, updatedAt)
      : [];
    await db.categories.put(normalized);
    if (transactionUpdates.length > 0) await db.transactions.bulkPut(transactionUpdates);
  });
}

export async function renameCategoryGroup(from: string, to: string): Promise<void> {
  await db.transaction("rw", db.categories, async () => {
    const changes = renamedCategoryGroup(await db.categories.toArray(), from, to);
    if (changes.length) await db.categories.bulkPut(changes);
  });
}

export async function setCategoryArchived(categoryId: string, archived: boolean): Promise<void> {
  await db.transaction("rw", db.categories, async () => {
    const category = await db.categories.get(categoryId);
    if (!category) throw new AppError("error.categoryMissing", "Category not found.");
    if (category.system) throw new AppError("error.categorySystemProtected", "Required system categories cannot be archived.");
    await db.categories.update(categoryId, { archived });
  });
}

export async function deleteUnusedCategory(categoryId: string): Promise<void> {
  await db.transaction("rw", [db.categories, db.transactions], async () => {
    const [category, transactions] = await Promise.all([
      db.categories.get(categoryId),
      db.transactions.toArray(),
    ]);
    if (!category) throw new AppError("error.categoryMissing", "Category not found.");
    const transactionCount = transactions.filter(
      (transaction) => transaction.categoryId === categoryId ||
        (transaction.categoryId === null && categoryKey(transaction.category) === categoryKey(category.name)),
    ).length;
    if (!categoryCanBePermanentlyDeleted(category, transactionCount)) {
      throw new AppError("error.categoryDeleteRestricted", "Only unused custom categories can be permanently deleted.");
    }
    await db.categories.delete(categoryId);
  });
}

export async function translateDefaultCategoryNames(locale: InterfaceLocale): Promise<number> {
  return db.transaction("rw", [db.categories, db.transactions], async () => {
    const [categories, transactions] = await Promise.all([
      db.categories.toArray(),
      db.transactions.toArray(),
    ]);
    const changes = categoryTranslationPlan(categories, locale);
    if (changes.length === 0) return 0;
    const names = new Map(changes.map((change) => [change.id, change.name]));
    const updatedAt = new Date().toISOString();
    await db.categories.bulkPut(categories.map((category) => {
      const name = names.get(category.id);
      return name ? { ...category, name } : category;
    }));
    const transactionUpdates = transactions.flatMap((transaction) => {
      const name = transaction.categoryId ? names.get(transaction.categoryId) : undefined;
      return name ? [{ ...transaction, category: name, updatedAt }] : [];
    });
    if (transactionUpdates.length > 0) await db.transactions.bulkPut(transactionUpdates);
    return changes.length;
  });
}

export async function saveSetupProgress(step: SetupStep, draft: SetupDraft): Promise<void> {
  const normalized = normalizeSetupDraft(draft);
  await db.settings.bulkPut([
    { key: "setupStep", value: step },
    { key: "setupDraft", value: normalized },
    { key: "locale", value: normalized.locale },
  ]);
}

export async function completeInitialSetup(
  draft: SetupDraft,
  walletId: string,
  createdAt: string,
): Promise<void> {
  const normalized = normalizeSetupDraft(draft);
  const [currency, existingWallets, rates] = await Promise.all([
    db.currencies.get(normalized.mainWalletCurrency),
    db.wallets.toArray(),
    db.rates.toArray(),
  ]);
  if (!currency || currency.archived) throw new Error("The selected wallet currency is unavailable.");
  if (!normalized.mainWalletName.trim() || !normalized.mainWalletCode.trim()) throw new Error("Main wallet name and code are required.");
  if (existingWallets.some((wallet) => wallet.code.toLocaleLowerCase("en") === normalized.mainWalletCode.toLocaleLowerCase("en"))) {
    throw new Error("Wallet code already exists.");
  }
  const reportingRate = normalized.reportingCurrency === "EUR" ||
    rates.some((rate) => rate.quoteCurrency === normalized.reportingCurrency);
  if (!reportingRate) throw new Error("The selected reporting currency has no reference rate.");
  const wallet: Wallet = {
    id: walletId,
    name: normalized.mainWalletName,
    code: normalized.mainWalletCode,
    currency: normalized.mainWalletCurrency,
    archived: false,
    createdAt,
  };
  const categories = categoriesForLocale(normalized.locale);
  const rateUpdates = Object.entries(normalized.rateOverrides).flatMap(([currencyCode, override]) => {
    if (currencyCode === "EUR") return [];
    const current = rates
      .filter((rate) => rate.quoteCurrency === currencyCode)
      .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))[0];
    if (!current) return [];
    return [{
      ...current,
      id: rates.find(row => row.quoteCurrency === currencyCode && row.effectiveDate === override.effectiveDate && row.granularity !== "monthly")?.id ?? rateId(currencyCode, override.effectiveDate),
      granularity: "daily" as const,
      locked: override.method === "manual",
      value: override.value,
      effectiveDate: override.effectiveDate,
      source: override.source,
      method: override.method,
      sourceUrl: override.sourceUrl,
      fetchedAt: override.fetchedAt,
      createdAt,
    }];
  });
  await db.transaction("rw", [db.currencies, db.wallets, db.categories, db.rates, db.settings], async () => {
    if ((await db.settings.get("setupState"))?.value === "complete" || await db.wallets.count() > 0) {
      throw new AppError("error.setupChanged", "Setup has already been completed in another window.");
    }
    const current = await db.currencies.get(normalized.mainWalletCurrency);
    if (!current || current.archived) throw new Error("The selected wallet currency is unavailable.");
    await db.wallets.add(wallet);
    await db.categories.bulkPut(categories);
    if (rateUpdates.length > 0) await db.rates.bulkPut(rateUpdates);
    await db.settings.bulkPut([
      { key: "locale", value: normalized.locale },
      { key: "reportingCurrency", value: normalized.reportingCurrency },
      { key: "showJalali", value: normalized.showJalali },
      { key: "irrDisplayUnit", value: normalized.irrDisplayUnit },
      { key: "mainWalletId", value: wallet.id },
      { key: "defaultWalletId", value: wallet.id },
      { key: "setupVersion", value: CURRENT_SETUP_VERSION },
      { key: "setupState", value: "complete" },
      { key: "setupStep", value: 1 },
      { key: "setupDraft", value: null },
    ]);
  });
}

export async function completeUpgradeSetup(mainWalletId: string): Promise<void> {
  // Recheck inside the write so another window cannot archive the chosen wallet first.
  await db.transaction("rw", [db.wallets, db.settings], async () => {
    const [wallet, defaultWalletRow] = await Promise.all([
      db.wallets.get(mainWalletId),
      db.settings.get("defaultWalletId"),
    ]);
    if (!wallet || wallet.archived) throw new Error("Choose an active main wallet.");
    const existingDefault = typeof defaultWalletRow?.value === "string"
      ? await db.wallets.get(defaultWalletRow.value)
      : undefined;
    await db.settings.bulkPut([
      { key: "mainWalletId", value: wallet.id },
      { key: "defaultWalletId", value: existingDefault && !existingDefault.archived ? existingDefault.id : wallet.id },
      { key: "setupVersion", value: CURRENT_SETUP_VERSION },
      { key: "setupState", value: "complete" },
      { key: "setupStep", value: 1 },
      { key: "setupDraft", value: null },
    ]);
  });
}

export async function databaseBackup(): Promise<SeedData> {
  const snapshot = await loadSnapshot();
  splitGroups(snapshot.transactions);
  return {
    version: CURRENT_DATA_VERSION,
    generatedAt: new Date().toISOString(),
    source: { filename: "jibjip-local-backup.json", kind: "jibjip-backup" },
    ...snapshot,
  };
}
