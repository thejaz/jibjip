import Decimal from "decimal.js";
import type { InterfaceLocale } from "./i18n/config";
import type { ConfigurableTransactionType } from "./transaction-types";

export type Direction = "income" | "expense" | "in" | "out";
export type IrrDisplayUnit = "IRR" | "TMN" | "HTM" | "MTM";
export type TextSize = "small" | "medium" | "large";
export type MotionLevel = "off" | "subtle" | "enhanced";
export function normalizeMotionLevel(value: unknown): MotionLevel {
  return value === "off" || value === "enhanced" ? value : "subtle";
}
export type StartPage = "overview" | "transactions";
export type SetupState = "uninitialized" | "upgrade-required" | "complete";
export type SetupStep = 1 | 2 | 3 | 4;
export type CurrencyKind = "fiat" | "crypto" | "custom";
export const CURRENT_DATA_VERSION = 2;
export const CURRENT_SETUP_VERSION = 1;
export const DEFAULT_CATEGORY_COLOR = "#7A8391";
export const DEFAULT_CATEGORY_ICON = "tag";
export const UNCHARTED_STATUSES = ["open", "retrieved"] as const;
export type UnchartedStatus = (typeof UNCHARTED_STATUSES)[number];

export function normalizeUnchartedStatus(value: unknown): UnchartedStatus {
  return String(value ?? "").trim().toLocaleLowerCase("en") === "retrieved"
    ? "retrieved"
    : "open";
}
export type Operation =
  | "transaction"
  | "transfer"
  | "exchange"
  | "fee"
  | "adjustment";

export interface Wallet {
  id: string;
  name: string;
  code: string;
  currency: string;
  archived: boolean;
  createdAt: string;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  kind: CurrencyKind;
  fractionDigits: number;
  builtIn: boolean;
  archived: boolean;
}

export interface Category {
  id: string;
  name: string;
  /** Missing means legacy; null explicitly keeps a category ungrouped. */
  group?: string | null;
  scope: "income" | "expense" | "both";
  archived: boolean;
  /** Stable built-in identity used independently of the user-editable name. */
  templateKey: string | null;
  /** True only when application behavior requires this category to remain. */
  system: boolean;
  color: string;
  icon: string;
  /** Initial reportable value for new transactions using this category. */
  defaultReportable: boolean;
}

export interface Rate {
  id: string;
  baseCurrency: "EUR";
  quoteCurrency: string;
  value: string;
  effectiveDate: string;
  source: string;
  method: "system" | "manual" | "reference" | "automatic";
  createdAt: string;
  /** Missing on older V2 rows means a daily observation. Monthly dates are the first day. */
  granularity?: "daily" | "monthly";
  /** Protect this currency/date/granularity from online updates. */
  locked?: boolean;
  sourceUrl?: string;
  fetchedAt?: string;
  /** Number of daily closes used in a completed-month average. */
  sampleCount?: number;
}

export interface Transaction {
  id: string;
  date: string;
  walletId: string;
  operation: Operation;
  direction: Direction;
  /** Stable category reference for ordinary income/expense entries; fixed types always use null. */
  categoryId: string | null;
  /** Denormalized category or canonical fixed-type label retained for CSV compatibility. */
  category: string;
  amount: string;
  /** Optional signed native-currency balance delta preserved from an import. */
  balanceAmount?: string;
  currency: string;
  note: string;
  reportable: boolean;
  affectsBalance: boolean;
  linkId: string | null;
  /** One ordinary payment, stored as category postings without an extra balance row. */
  split?: { id: string; index: number; count: number; total: string; note: string };
  sourceKey?: string;
  sourceSheet?: string;
  sourceRow?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UnchartedEntry {
  id: string;
  date: string;
  amount: string;
  currency: string;
  note: string;
  status: UnchartedStatus;
  statusUpdate: string;
  sourceKey?: string;
  createdAt: string;
  updatedAt: string;
}

export function normalizeUnchartedAmount(value: unknown): string {
  try {
    return new Decimal(String(value ?? "0").trim() || "0").abs().toString();
  } catch {
    return "0";
  }
}

export function sanitizeUnchartedEntry(entry: UnchartedEntry): UnchartedEntry {
  return {
    id: entry.id,
    date: entry.date,
    amount: normalizeUnchartedAmount(entry.amount),
    currency: entry.currency,
    note: entry.note,
    status: normalizeUnchartedStatus(entry.status),
    statusUpdate: entry.statusUpdate,
    sourceKey: entry.sourceKey,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export interface AppSettings {
  /** Optional local review awards; never derived from transaction volume or imports. */
  clarity: import("./clarity.ts").ClarityState;
  /** Current normalized data-contract version stored in this database. */
  dataVersion: number;
  /** Setup workflow version completed by this installation. */
  setupVersion: number;
  setupState: SetupState;
  /** Required active infrastructure wallet after setup; distinct from defaultWalletId. */
  mainWalletId: string | null;
  /** Last completed wizard step plus persisted draft make setup resumable. */
  setupStep: SetupStep;
  setupDraft: SetupDraft | null;
  reportingCurrency: string;
  /** Persisted interface language; only locales with a complete bundled resource are valid. */
  locale: InterfaceLocale;
  showJalali: boolean;
  /** Approved starter-data version already handled for this browser database. */
  starterSeedVersion: number;
  /** Display-only scaling for amounts whose persisted currency remains IRR. */
  irrDisplayUnit: IrrDisplayUnit;
  /** User-selected interface text scale. */
  textSize: TextSize;
  /** App-wide visual effects; device reduced-motion preferences always take priority. */
  motion: MotionLevel;
  /** Page shown on launch; changing it does not navigate the current session. */
  startPage: StartPage;
  /** Null means every active wallet is shown on the Overview. */
  overviewWalletIds: string[] | null;
  /** Three locally persisted wallet shortcuts shown on the Overview. */
  overviewPinnedWalletIds: Array<string | null>;
  /** Native currencies intentionally hidden from the Overview currency-balances panel. */
  overviewHiddenCurrencies: string[];
  /** Categories hidden only from Charts; report exclusions still take precedence. */
  chartExcludedCategoryIds: string[];
  /** Active wallet preselected when starting a new transaction. */
  defaultWalletId: string | null;
  /** Reporting inclusion for nonincome/expense transaction types. */
  typeReportability: Record<ConfigurableTransactionType, boolean>;
}

export interface SetupDraft {
  locale: InterfaceLocale;
  mainWalletName: string;
  mainWalletCode: string;
  mainWalletCurrency: string;
  rateOverrides: Record<string, SetupRateOverride>;
  reportingCurrency: string;
  showJalali: boolean;
  irrDisplayUnit: IrrDisplayUnit;
}

export interface SetupRateOverride {
  value: string;
  effectiveDate: string;
  source: string;
  method: "manual" | "automatic";
  sourceUrl?: string;
  fetchedAt?: string;
}

export interface SeedData {
  version: number;
  generatedAt: string;
  source: { filename: string; kind: string };
  settings: AppSettings;
  currencies: Currency[];
  wallets: Wallet[];
  categories: Category[];
  rates: Rate[];
  transactions: Transaction[];
  uncharted: UnchartedEntry[];
}

export interface AppSnapshot {
  settings: AppSettings;
  currencies: Currency[];
  wallets: Wallet[];
  categories: Category[];
  rates: Rate[];
  transactions: Transaction[];
  uncharted: UnchartedEntry[];
}
