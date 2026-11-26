import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUILT_IN_CURRENCIES } from "../packages/core/src/lib/catalogs.ts";
import { OFFLINE_BASELINE_RATES } from "../packages/core/src/lib/rates.ts";
import { CURRENT_DATA_VERSION } from "../packages/core/src/lib/types.ts";

const generatedAt = "2026-07-23T00:00:00.000Z";
const seed = {
  version: CURRENT_DATA_VERSION,
  generatedAt,
  source: {
    filename: "jibjip-starter-seed.json",
    kind: "jibjip-starter",
  },
  settings: {
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
    starterSeedVersion: 2,
    irrDisplayUnit: "IRR",
    textSize: "medium",
    motion: "subtle",
    startPage: "overview",
    overviewWalletIds: null,
    overviewPinnedWalletIds: [null, null, null],
    overviewHiddenCurrencies: [],
    chartExcludedCategoryIds: [],
    defaultWalletId: null,
  },
  currencies: BUILT_IN_CURRENCIES,
  wallets: [],
  categories: [],
  rates: OFFLINE_BASELINE_RATES,
  transactions: [],
  uncharted: [],
};

writeFileSync(
  resolve("packages/core/assets/data/jibjip-starter-seed.json"),
  `${JSON.stringify(seed, null, 2)}\n`,
  "utf8",
);
