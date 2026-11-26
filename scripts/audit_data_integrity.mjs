import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const CURRENCY = /^[A-Z][A-Z0-9]{2,7}$/;
const DIRECTIONS = {
  transaction: new Set(["income", "expense"]),
  transfer: new Set(["in", "out"]),
  exchange: new Set(["in", "out"]),
  adjustment: new Set(["in", "out"]),
};

function isPositiveDecimal(value) {
  return DECIMAL.test(value) && !/^0(?:\.0+)?$/.test(value) && !value.startsWith("-");
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function hasValidTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function auditSnapshot(seed) {
  const issues = [];
  const add = (code, context = "") => issues.push({ code, context });
  const unique = (rows, field, code) => {
    const seen = new Set();
    for (const row of rows) {
      if (typeof row[field] !== "string" || !row[field]) add(`${code}.missing`);
      else if (seen.has(row[field])) add(`${code}.duplicate`);
      else seen.add(row[field]);
    }
  };

  if (seed.version !== 2) add("seed.version");
  if (!seed.source || !["jibjip-starter", "jibjip-backup"].includes(seed.source.kind)) add("seed.source");
  for (const key of ["wallets", "categories", "rates", "transactions", "uncharted"]) {
    if (!Array.isArray(seed[key])) add(`seed.${key}`);
  }
  if (!Array.isArray(seed.currencies)) add("seed.currencies");
  if (!seed.settings || typeof seed.settings !== "object") add("seed.settings");
  if (issues.length > 0) return { issues, counts: {} };

  const { wallets, categories, rates, transactions, uncharted, settings } = seed;
  const currencies = Array.isArray(seed.currencies) ? seed.currencies : [];
  unique(currencies, "code", "currency.code");
  unique(wallets, "id", "wallet.id");
  unique(wallets, "code", "wallet.code");
  unique(wallets, "name", "wallet.name");
  unique(categories, "id", "category.id");
  unique(rates, "id", "rate.id");
  unique(transactions, "id", "transaction.id");
  unique(uncharted, "id", "uncharted.id");

  const walletsById = new Map(wallets.map((wallet) => [wallet.id, wallet]));
  const currenciesByCode = new Map(currencies.map((currency) => [currency.code, currency]));
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const categoryByKey = new Map();
  const rateCurrencies = new Set();
  const ratePairs = new Set();
  const sourceRows = new Set();
  const sourceKeys = new Set();
  const categoryDirections = new Map();
  const linkGroups = new Map();

  for (const currency of currencies) {
    if (!CURRENCY.test(currency.code)) add("currency.code", currency.code);
    if (typeof currency.name !== "string" || !currency.name.trim()) add("currency.name", currency.code);
    if (typeof currency.symbol !== "string" || !currency.symbol.trim()) add("currency.symbol", currency.code);
    if (!["fiat", "crypto", "custom"].includes(currency.kind)) add("currency.kind", currency.code);
    if (!Number.isInteger(currency.fractionDigits) || currency.fractionDigits < 0 || currency.fractionDigits > 18) add("currency.fractionDigits", currency.code);
    if (typeof currency.builtIn !== "boolean") add("currency.builtIn", currency.code);
    if (typeof currency.archived !== "boolean") add("currency.archived", currency.code);
  }

  for (const wallet of wallets) {
    if (wallet.name !== wallet.name?.trim()) add("wallet.name.whitespace", wallet.code);
    if (wallet.code !== wallet.code?.trim()) add("wallet.code.whitespace", wallet.code);
    if (!CURRENCY.test(wallet.currency)) add("wallet.currency", wallet.code);
    if (!currenciesByCode.has(wallet.currency)) add("wallet.currencyRef", wallet.code);
    if (typeof wallet.archived !== "boolean") add("wallet.archived", wallet.code);
    if (!hasValidTimestamp(wallet.createdAt)) add("wallet.createdAt", wallet.code);
  }

  for (const category of categories) {
    const key = category.name?.trim().toLocaleLowerCase("en");
    if (!key || category.name !== category.name.trim()) add("category.name");
    if (categoryByKey.has(key)) add("category.name.caseDuplicate", key);
    else categoryByKey.set(key, category);
    if (!["income", "expense", "both"].includes(category.scope)) add("category.scope", key);
    if (typeof category.archived !== "boolean") add("category.archived", key);
    if (category.templateKey !== null && typeof category.templateKey !== "string") add("category.templateKey", key);
    if (typeof category.system !== "boolean") add("category.system", key);
    if (!/^#[0-9A-F]{6}$/i.test(category.color)) add("category.color", key);
    if (typeof category.icon !== "string" || !category.icon) add("category.icon", key);
    if (typeof category.defaultReportable !== "boolean") add("category.defaultReportable", key);
  }

  for (const rate of rates) {
    if (rate.baseCurrency !== "EUR") add("rate.baseCurrency", rate.quoteCurrency);
    if (rate.quoteCurrency === "EUR") add("rate.eurSelfPair", rate.quoteCurrency);
    if (!CURRENCY.test(rate.quoteCurrency)) add("rate.quoteCurrency");
    if (!currenciesByCode.has(rate.quoteCurrency)) add("rate.currencyRef", rate.quoteCurrency);
    if (!isPositiveDecimal(rate.value)) add("rate.value", rate.quoteCurrency);
    if (!isIsoDate(rate.effectiveDate)) add("rate.effectiveDate", rate.quoteCurrency);
    if (!hasValidTimestamp(rate.createdAt)) add("rate.createdAt", rate.quoteCurrency);
    if (typeof rate.source !== "string" || !rate.source.trim()) add("rate.source", rate.quoteCurrency);
    if (!["system", "manual", "reference", "automatic"].includes(rate.method)) add("rate.method", rate.quoteCurrency);
    const pair = rate.baseCurrency + ":" + rate.quoteCurrency + ":" + (rate.granularity ?? "daily") + ":" + rate.effectiveDate;
    if (rate.granularity !== undefined && !["daily", "monthly"].includes(rate.granularity)) add("rate.granularity");
    if (rate.granularity === "monthly" && !rate.effectiveDate.endsWith("-01")) add("rate.monthDate");
    if (rate.locked !== undefined && typeof rate.locked !== "boolean") add("rate.locked");
    if (ratePairs.has(pair)) add("rate.duplicatePair", pair);
    ratePairs.add(pair);
    rateCurrencies.add(rate.quoteCurrency);
  }
 for (const currency of new Set(wallets.map((wallet) => wallet.currency))) {
    if (currency !== "EUR" && !rateCurrencies.has(currency)) add("rate.walletCurrencyMissing", currency);
 }
  if (seed.source.kind === "jibjip-starter") {
    for (const currency of currencies.filter((item) => item.builtIn && item.code !== "EUR")) {
      if (!rateCurrencies.has(currency.code)) add("rate.builtInCurrencyMissing", currency.code);
    }
  }

  for (const transaction of transactions) {
    const context = transaction.sourceSheet && transaction.sourceRow
      ? `${transaction.sourceSheet}:${transaction.sourceRow}`
      : transaction.id;
    const wallet = walletsById.get(transaction.walletId);
    if (!wallet) add("transaction.walletRef", context);
    if (!isIsoDate(transaction.date)) add("transaction.date", context);
    if (!DIRECTIONS[transaction.operation]?.has(transaction.direction)) add("transaction.operationDirection", context);
    if (!isPositiveDecimal(transaction.amount)) add("transaction.amount", context);
    if (transaction.balanceAmount !== undefined && !DECIMAL.test(transaction.balanceAmount)) add("transaction.balanceAmount", context);
    if (!CURRENCY.test(transaction.currency)) add("transaction.currency", context);
    if (wallet && transaction.currency !== wallet.currency) add("transaction.walletCurrency", context);
    if (transaction.category !== transaction.category?.trim() || !transaction.category) add("transaction.categoryWhitespace", context);
    if (transaction.note !== transaction.note?.trim()) add("transaction.noteWhitespace", context);
    if (["transfer", "exchange", "adjustment"].includes(transaction.operation)) {
      const expectedCategory = transaction.operation.charAt(0).toUpperCase() + transaction.operation.slice(1);
      if (transaction.categoryId !== null) add("transaction.typeCategoryId", context);
      if (transaction.category !== expectedCategory) add("transaction.typeCategory", context);
    }
    const reportableIsValid = transaction.operation === "transaction"
      ? typeof transaction.reportable === "boolean"
      : ["transfer", "exchange", "adjustment"].includes(transaction.operation) &&
        settings.typeReportability &&
        typeof settings.typeReportability[transaction.operation] === "boolean" &&
        transaction.reportable === settings.typeReportability[transaction.operation];
    if (!reportableIsValid) add("transaction.reportable", context);
    if (transaction.affectsBalance !== true) add("transaction.affectsBalance", context);
    if (!hasValidTimestamp(transaction.createdAt) || !hasValidTimestamp(transaction.updatedAt)) add("transaction.timestamp", context);
    else if (Date.parse(transaction.updatedAt) < Date.parse(transaction.createdAt)) add("transaction.timestampOrder", context);

    if (transaction.operation === "transaction" && transaction.reportable) {
      const key = transaction.category.toLocaleLowerCase("en");
      const category = categoryByKey.get(key);
      if (!category || category.name !== transaction.category) add("transaction.categoryRef", context);
      const referencedCategory = categoriesById.get(transaction.categoryId);
      if (!referencedCategory || referencedCategory.name !== transaction.category) add("transaction.categoryIdRef", context);
      const directions = categoryDirections.get(key) ?? new Set();
      directions.add(transaction.direction);
      categoryDirections.set(key, directions);
    }

    if (transaction.sourceSheet !== undefined || transaction.sourceRow !== undefined || transaction.sourceKey !== undefined) {
      if (!transaction.sourceSheet || !Number.isInteger(transaction.sourceRow) || transaction.sourceRow < 2 || !transaction.sourceKey) {
        add("transaction.sourceMetadata", context);
      } else {
        const sourceRow = `${transaction.sourceSheet}:${transaction.sourceRow}`;
        if (sourceRows.has(sourceRow)) add("transaction.sourceRowDuplicate", sourceRow);
        sourceRows.add(sourceRow);
        if (sourceKeys.has(transaction.sourceKey)) add("transaction.sourceKeyDuplicate", sourceRow);
        sourceKeys.add(transaction.sourceKey);
        if (wallet && wallet.code !== transaction.sourceSheet) add("transaction.sourceWallet", sourceRow);
      }
    }

    if (transaction.balanceAmount !== undefined) {
      const positiveDirection = transaction.direction === "income" || transaction.direction === "in";
      const negative = transaction.balanceAmount.startsWith("-");
      const zero = /^-?0(?:\.0+)?$/.test(transaction.balanceAmount);
      if (!zero && positiveDirection === negative) add("transaction.balanceDirection", context);
    }

    if (transaction.linkId) {
      const rows = linkGroups.get(transaction.linkId) ?? [];
      rows.push(transaction);
      linkGroups.set(transaction.linkId, rows);
    }
  }

  for (const [key, directions] of categoryDirections) {
    const category = categoryByKey.get(key);
    if (!category) continue;
    const requiredScope = directions.size > 1 ? "both" : directions.has("income") ? "income" : "expense";
    if (category.scope !== "both" && category.scope !== requiredScope) add("category.scopeCoverage", key);
  }

  for (const [linkId, rows] of linkGroups) {
    const principal = rows.filter((row) => row.operation === "transfer" || row.operation === "exchange");
    const ins = principal.filter((row) => row.direction === "in");
    const outs = principal.filter((row) => row.direction === "out");
    if (principal.length !== 2 || ins.length !== 1 || outs.length !== 1) add("transaction.linkPair", linkId);
    if (new Set(principal.map((row) => row.operation)).size > 1) add("transaction.linkOperation", linkId);
    if (rows.some((row) => !["transfer", "exchange"].includes(row.operation))) add("transaction.linkMember", linkId);
    if (rows.some((row) => row.date !== rows[0].date)) add("transaction.linkDate", linkId);
    if (ins.length === 1 && outs.length === 1 && principal[0]?.operation === principal[1]?.operation) {
      const inWallet = walletsById.get(ins[0].walletId);
      const outWallet = walletsById.get(outs[0].walletId);
      if (inWallet && outWallet) {
        if (principal[0].operation === "transfer" && inWallet.currency !== outWallet.currency) add("transaction.linkTransferCurrency", linkId);
        if (principal[0].operation === "exchange" && inWallet.currency === outWallet.currency) add("transaction.linkExchangeCurrency", linkId);
      }
    }
  }

  for (const entry of uncharted) {
    const context = entry.sourceKey ?? entry.id;
    if (!isIsoDate(entry.date)) add("uncharted.date", context);
    if (!isPositiveDecimal(entry.amount)) add("uncharted.amount", context);
    if (!CURRENCY.test(entry.currency)) add("uncharted.currency", context);
    if (!currenciesByCode.has(entry.currency)) add("uncharted.currencyRef", context);
    if (entry.note !== entry.note?.trim()) add("uncharted.noteWhitespace", context);
    if (!["open", "retrieved"].includes(entry.status)) add("uncharted.status", context);
    if (entry.statusUpdate !== entry.statusUpdate?.trim()) add("uncharted.statusUpdateWhitespace", context);
    if ("wallet" in entry || "walletId" in entry || "type" in entry || "category" in entry) add("uncharted.legacyField", context);
    if (!hasValidTimestamp(entry.createdAt) || !hasValidTimestamp(entry.updatedAt)) add("uncharted.timestamp", context);
  }

  const settingsChecks = {
    reportingCurrency: CURRENCY.test(settings.reportingCurrency),
    locale: settings.locale === "en" || settings.locale === "fa",
    showJalali: typeof settings.showJalali === "boolean",
    starterSeedVersion:
      Number.isInteger(settings.starterSeedVersion) && settings.starterSeedVersion >= 0,
    irrDisplayUnit: ["IRR", "TMN", "HTM", "MTM"].includes(settings.irrDisplayUnit),
    textSize: ["small", "medium", "large"].includes(settings.textSize),
    motion: settings.motion === undefined || ["off", "subtle", "enhanced"].includes(settings.motion),
    startPage: settings.startPage === undefined || ["overview", "transactions"].includes(settings.startPage),
    overviewWalletIds: settings.overviewWalletIds === null || (
      Array.isArray(settings.overviewWalletIds) &&
      new Set(settings.overviewWalletIds).size === settings.overviewWalletIds.length &&
      settings.overviewWalletIds.every((id) => walletsById.has(id))
    ),
    overviewPinnedWalletIds: settings.overviewPinnedWalletIds === undefined || (
      Array.isArray(settings.overviewPinnedWalletIds) &&
      settings.overviewPinnedWalletIds.length === 3 &&
      new Set(settings.overviewPinnedWalletIds.filter(Boolean)).size === settings.overviewPinnedWalletIds.filter(Boolean).length &&
      settings.overviewPinnedWalletIds.every((id) => id === null || walletsById.has(id))
    ),
    overviewHiddenCurrencies: settings.overviewHiddenCurrencies === undefined || (
      Array.isArray(settings.overviewHiddenCurrencies) &&
      new Set(settings.overviewHiddenCurrencies).size === settings.overviewHiddenCurrencies.length &&
      settings.overviewHiddenCurrencies.every((currency) => CURRENCY.test(currency))
    ),
    chartExcludedCategoryIds: settings.chartExcludedCategoryIds === undefined || (
      Array.isArray(settings.chartExcludedCategoryIds) &&
      new Set(settings.chartExcludedCategoryIds).size === settings.chartExcludedCategoryIds.length &&
      settings.chartExcludedCategoryIds.every((id) => typeof id === "string" && id.trim())
    ),
    defaultWalletId: settings.defaultWalletId === undefined || settings.defaultWalletId === null || (
      typeof settings.defaultWalletId === "string" &&
      walletsById.has(settings.defaultWalletId) &&
      !walletsById.get(settings.defaultWalletId).archived
    ),
    dataVersion: settings.dataVersion === 2,
    setupVersion: Number.isInteger(settings.setupVersion) && settings.setupVersion >= 0,
    setupState: ["uninitialized", "upgrade-required", "complete"].includes(settings.setupState),
    mainWalletId: settings.mainWalletId === null || (
      typeof settings.mainWalletId === "string" &&
      walletsById.has(settings.mainWalletId) &&
      !walletsById.get(settings.mainWalletId).archived
    ),
    setupStep: [1, 2, 3, 4].includes(settings.setupStep),
    setupDraft: settings.setupDraft === null || (
      typeof settings.setupDraft === "object" &&
      ["en", "fa"].includes(settings.setupDraft.locale) &&
      typeof settings.setupDraft.mainWalletName === "string" &&
      typeof settings.setupDraft.mainWalletCode === "string"
    ),
    typeReportability: seed.source.kind === "jibjip-starter"
      ? (settings.typeReportability === undefined || (
        typeof settings.typeReportability === "object" &&
        ["transfer", "exchange", "adjustment"].every((operation) =>
          typeof settings.typeReportability[operation] === "boolean",
        )
      ))
      : settings.typeReportability !== null &&
        typeof settings.typeReportability === "object" &&
        ["transfer", "exchange", "adjustment"].every((operation) =>
          typeof settings.typeReportability[operation] === "boolean",
        ),
  };
  for (const [key, valid] of Object.entries(settingsChecks)) {
    if (!valid) add(`settings.${key}`);
  }
  if (settings.reportingCurrency !== "EUR" && !rateCurrencies.has(settings.reportingCurrency)) add("settings.reportingRate");

  return {
    issues,
    counts: {
      wallets: wallets.length,
      currencies: currencies.length,
      categories: categories.length,
      rates: rates.length,
      transactions: transactions.length,
      uncharted: uncharted.length,
      linkedGroups: linkGroups.size,
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const paths = process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : ["packages/core/assets/data/jibjip-starter-seed.json"];
  let failed = false;
  for (const path of paths) {
    const result = auditSnapshot(JSON.parse(readFileSync(resolve(path), "utf8")));
    const issueCounts = Object.fromEntries(
      [...new Set(result.issues.map((issue) => issue.code))]
        .sort()
        .map((code) => [code, result.issues.filter((issue) => issue.code === code).length]),
    );
    console.log(JSON.stringify({ path, counts: result.counts, issueCounts }));
    if (result.issues.length > 0) failed = true;
  }
  if (failed) process.exitCode = 1;
}
