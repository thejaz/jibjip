"use client";

import { asciiDigits, normalizeNumericInput } from "../lib/numeric-input";
import { transactionIndex } from "../lib/transaction-index";
import { sortActivities, type TransactionSort } from "../lib/activity-query";
import { dateFormatter } from "../lib/i18n/formatters";
import { Dialog } from "./Dialog";
import { AmountInput } from "./AmountInput";
import { SearchField } from "./SearchField";
import { ChoicePicker, type PickerChoice } from "./ChoicePicker";
import { CommandDialog, ShortcutsDialog, ShortcutKeys, modifierLabel, type AppCommand } from "./KeyboardTools";
import { shortcutIntent } from "../lib/keyboard";
import { ConfirmationProvider, useConfirmation } from "./Confirmation";
import { DATA_COLORS, mixColor, tonalBadgeStyle } from "../lib/colors";
import { NavigationDrawer } from "./NavigationDrawer";
import { useLogoSound } from "./useLogoSound";
import { chartAnalysis } from "../lib/charts";
import { localDate, rollingPeriodStart } from "../lib/dates";
import { subscribeLocalDay } from "../lib/local-day";
import { assertTransactionsUnchanged, editedReportability, fallbackCategoryName } from "../lib/transaction-edit";
import { saveActivityDraft } from "../lib/db";

import {
  Archive,
  ArrowDownToLine,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpFromLine,
  ArrowUpRight,
  BadgeDollarSign,
  Banknote,
  BanknoteArrowUp,
  BriefcaseBusiness,
  BusFront,
  Car,
  CarTaxiFront,
  Check,
  ChartPie,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleEllipsis,
  CircleHelp,
  Clapperboard,
  Coffee,
  Coins,
  Copy,
  Database,
  Download,
  Dumbbell,
  FileSpreadsheet,
  FolderKanban,
  Gift,
  GraduationCap,
  Hammer,
  HandCoins,
  HandHeart,
  Handshake,
  HeartHandshake,
  House,
  Info,
  KeyRound,
  Keyboard,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  ListFilter,
  Pencil,
  Percent,
  Pill,
  Plane,
  PlugZap,
  Plus,
  Receipt,
  Repeat,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Star,
  Split,
  Stethoscope,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Upload,
  UserRound,
  UsersRound,
  Utensils,
  WalletCards,
  Wine,
  WifiOff,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import Decimal from "decimal.js";
import { liveQuery, type Subscription } from "dexie";
import { buildSplitRows, splitGroups, activityAmount } from "../lib/splits";
import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  lazy,
  Suspense,
  useEffect,
  useDeferredValue,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AppError, translatedErrorMessage } from "../lib/app-error";
import { APP_VERSION } from "../lib/app-version";
import { registerOfflineShell } from "../lib/offline";
import { AppAccess } from "./AppAccess";
import { MigrationGuide } from "./MigrationGuide";
import { ClarityPoints, ClaritySetting } from "./ClarityPoints";
import { MotionSettings, useMotionPreference } from "./MotionSettings";
import { MoneyAmount } from "./MoneyAmount";
import { DonutChart } from "./DonutChart";
import { groupCategories } from "../lib/category-groups";
import { brandWordmarkUrl } from "../lib/brand";
import { BUILT_IN_CURRENCIES, categoryTranslationPlan } from "../lib/catalogs";
import {
  visibleCategoryOptionMatches,
  visibleCategoryOptions,
  type VisibleCategoryOption,
} from "../lib/category-visibility";
import {
  I18nProvider,
  Trans,
  translate,
  useI18n,
  type InterfaceLocale,
  type TranslationKey,
} from "../lib/i18n";
import {
  buildLinkedActivityChanges,
  groupTransactionActivities,
  transactionRowsForActivities,
  type LinkedActivityKind,
  type TransactionActivity,
} from "../lib/activity";
import {
  assertStoredActivitiesUnchanged,
  canonicalCategoryName,
  databaseBackup,
  db,
  deleteUnusedCategory,
  deleteUnusedCurrency,
  deleteUnusedWallet,
  deleteUnchartedEntry,
  eraseLocalData,
  initializeLocalData,
  loadSnapshot,
  persistCategory,
  renameCategoryGroup,
  persistCurrency,
  persistRate,
  persistRates,
  setRateLocked,
 persistWallet,
  replaceDatabase,
  setCategoryArchived,
  setCurrencyArchived,
  setSetting,
  setTypeReportability,
  setWalletArchived,
  setDefaultWallet,
  translateDefaultCategoryNames,
} from "../lib/db";
import { categoryCanBePermanentlyDeleted } from "../lib/catalog-management";
import {
  amountForDisplayInput,
  amountForStorage,
  convert,
  convertWithRateFallback,
  editedBalanceAmount,
  formatMoney,
  gregorianDateFromJalali,
  jalaliDate,
  jalaliIsoDate,
  irrDisplayDecimalPlaces,
  money,
  netWorth,
  reportDirection,
  missingRateCurrency,
  reportTotalWithMissing,
  signedBalanceAmount,
  transactionSign,
  uid,
  walletBalance,
} from "../lib/finance";
import { normalizeTypeReportability, CONFIGURABLE_TRANSACTION_TYPES, isConfigurableTransactionType, isTransactionTypeCategoryLabel, transactionTypeLabel } from "../lib/transaction-types";
import { currentRateRows, rateId, resolveRate, validRate, validRateDate } from "../lib/rate-history";
import {
  acceptedProposalRate,
  fetchRateProposals,
  type RateFetchResult,
  type RateProposal,
} from "../lib/rates";
import {
  CURRENT_DATA_VERSION,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  normalizeUnchartedStatus,
} from "../lib/types";
import {
  chooseNewTransactionWalletId, movementDestinationWallets,
  isProtectedMainWallet,
  walletCurrencyChangeRequiresConfirmation,
} from "../lib/wallets";
import type {
  AppSnapshot,
  AppSettings,
  Category,
  Currency,
  CurrencyKind,
  Direction,
  IrrDisplayUnit,
  Rate,
  TextSize,
  Transaction,
  UnchartedEntry,
  Wallet,
} from "../lib/types";

const AboutView = lazy(() => import("./AboutView").then(module => ({ default: module.AboutView })));
const RateHistoryDialog = lazy(() => import("./RateHistoryDialog"));
const SetupWizard = lazy(() => import("./SetupWizard").then(module => ({ default: module.SetupWizard })));

type View = "overview" | "charts" | "transactions" | "wallets" | "currency" | "uncharted" | "settings" | "about";
type RollingSpendingPeriod = "30d" | "3m" | "6m" | "1y" | "3y";
type SpendingPeriod = RollingSpendingPeriod | "all" | "custom";
type CashflowPeriod = "6m" | "1y" | "3y";
const TRANSACTION_PAGE_SIZES = [50, 100, 200, 500] as const;
type TransactionPageSize = (typeof TRANSACTION_PAGE_SIZES)[number];
const TRANSACTION_PAGE_SIZE_STORAGE_KEY = "jibjip.transactions.pageSize";
type TransactionDialogState = {
  transaction?: Transaction;
  duplicate?: Transaction;
  batch?: Transaction[];
  batchCount?: number;
  promote?: UnchartedEntry;
  walletId?: string;
} | null;

const WALLET_CHART_COLORS = DATA_COLORS;

const CATEGORY_ICON_COMPONENTS: Record<string, LucideIcon> = {
  "arrow-down-to-line": ArrowDownToLine,
  "arrow-up-from-line": ArrowUpFromLine,
  "badge-dollar-sign": BadgeDollarSign,
  banknote: Banknote,
  "banknote-arrow-up": BanknoteArrowUp,
  "briefcase-business": BriefcaseBusiness,
  "bus-front": BusFront,
  car: Car,
  "car-taxi-front": CarTaxiFront,
  "circle-ellipsis": CircleEllipsis,
  clapperboard: Clapperboard,
  coffee: Coffee,
  dumbbell: Dumbbell,
  "folder-kanban": FolderKanban,
  gift: Gift,
  "graduation-cap": GraduationCap,
  hammer: Hammer,
  "hand-coins": HandCoins,
  "hand-heart": HandHeart,
  handshake: Handshake,
  "heart-handshake": HeartHandshake,
  house: House,
  "key-round": KeyRound,
  landmark: Landmark,
  percent: Percent,
  pill: Pill,
  plane: Plane,
  "plug-zap": PlugZap,
  receipt: Receipt,
  repeat: Repeat,
  "rotate-ccw": RotateCcw,
  shirt: Shirt,
  "shopping-basket": ShoppingBasket,
  smartphone: Smartphone,
  stethoscope: Stethoscope,
  tag: Tag,
  "trending-down": TrendingDown,
  "trending-up": TrendingUp,
  "user-round": UserRound,
  "users-round": UsersRound,
  utensils: Utensils,
  "wallet-cards": WalletCards,
  wine: Wine,
  wrench: Wrench,
};

const CATEGORY_ICON_LABELS: Record<string, TranslationKey> = {
  "tag": "icons.tag",
  "banknote": "icons.banknote",
  "briefcase-business": "icons.briefcase-business",
  "shopping-basket": "icons.shopping-basket",
  "house": "icons.house",
  "car": "icons.car",
  "plane": "icons.plane",
  "gift": "icons.gift",
  "heart-handshake": "icons.heart-handshake",
  "stethoscope": "icons.stethoscope",
  "graduation-cap": "icons.graduation-cap",
  "coffee": "icons.coffee",
  "wallet-cards": "icons.wallet-cards",
  "hand-coins": "icons.hand-coins",
  "banknote-arrow-up": "icons.banknote-arrow-up",
  "handshake": "icons.handshake",
  "circle-ellipsis": "icons.circle-ellipsis",
  "repeat": "icons.repeat",
  "wrench": "icons.wrench",
};
const CATEGORY_ICON_CHOICES = Object.keys(CATEGORY_ICON_LABELS);

function CategorySymbol({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = CATEGORY_ICON_COMPONENTS[name] ?? Tag;
  return <Icon size={size} aria-hidden="true" />;
}


function CategoryVisual({ category, name, size = 18 }: { category?: Pick<Category, "color" | "icon">; name: string; size?: number }) {
  const color = category?.color ?? categoryChartColor(name);
  return (
    <span
      className="category-visual"
      aria-hidden="true"
      style={tonalBadgeStyle(color)}
    >
      <CategorySymbol name={category?.icon ?? DEFAULT_CATEGORY_ICON} size={size} />
    </span>
  );
}

const OVERVIEW_RECENT_ACTIVITY_LIMIT = 20;

function compareCategoryNames(left: string, right: string): number {
  return left.localeCompare(right, "en", { sensitivity: "base", numeric: true });
}

function categoryForName(name: string, categories: Category[]): Category | undefined {
  const key = name.trim().toLocaleLowerCase("en");
  return categories.find((category) =>
    category.name.trim().toLocaleLowerCase("en") === key
  );
}

function CategoryPicker({ categories, value, direction, placeholder, onChange }: {
  categories: Category[]; value: string; direction: "income" | "expense";
  placeholder: string; onChange: (value: string) => void;
}) {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState("");
  const selected = categoryForName(value, categories);
  const available = categories.filter(category =>
    (!category.archived && (category.scope === "both" || category.scope === direction)) || category.id === selected?.id,
  ).sort((a, b) => compareCategoryNames(a.name, b.name));
  const needle = query.trim().toLocaleLowerCase("en");
  const filtered = available.filter(category => `${category.name} ${category.group ?? ""}`.toLocaleLowerCase("en").includes(needle));
  const choices: PickerChoice[] = groupCategories(filtered, category => category.group, locale).flatMap(group =>
    group.members.map(category => ({ key: category.id, label: category.name, group: group.name ?? t("groups.ungrouped"),
      content: <><CategoryVisual category={category} name={category.name} /><span>{category.name}</span></>,
    })),
  );
  if (needle && !available.some(category => category.name.toLocaleLowerCase("en") === needle || category.group?.toLocaleLowerCase("en") === needle)) {
    choices.push({ key: `custom:${query}`, label: query.trim(), custom: true,
      content: <><CategoryVisual name={query.trim()} /><span>{t("keyboard.createCategory", { name: query.trim() })}</span></> });
  }
  const displayName = value.trim() || placeholder;
  return <ChoicePicker choices={choices} value={selected?.id ?? value} label={placeholder} selectedLabel={displayName}
    query={query} onQueryChange={setQuery} onChoose={choice => onChange(choice.label)} triggerClass={`category-picker-trigger${value.trim() ? "" : " is-empty"}`}>
    <CategoryVisual category={selected ?? (value.trim() ? undefined : { color: DEFAULT_CATEGORY_COLOR, icon: DEFAULT_CATEGORY_ICON })} name={displayName} />
    <span>{displayName}</span><ChevronDown size={16} aria-hidden="true" />
  </ChoicePicker>;
}

function CategoryFilterPicker({ categories, options, value, allLabel, historicalLabel, onChange }: {
  categories: Category[]; options: VisibleCategoryOption[]; value: string; allLabel: string; historicalLabel: string;
  onChange: (value: string) => void;
}) {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState("");
  const selected = options.find(option => option.key === value);
  const selectedCategory = selected?.categoryId ? categories.find(category => category.id === selected.categoryId) : selected ? categoryForName(selected.name, categories) : undefined;
  const needle = query.trim().toLocaleLowerCase("en");
  const filtered = options.filter(option => option.name.toLocaleLowerCase("en").includes(needle));
  const choices: PickerChoice[] = needle ? [] : [{ key: "", label: allLabel,
    content: <><CategoryVisual category={{ color: DEFAULT_CATEGORY_COLOR, icon: DEFAULT_CATEGORY_ICON }} name={allLabel} /><span>{allLabel}</span></> }];
  choices.push(...groupCategories(filtered, option => categories.find(category => category.id === option.categoryId)?.group, locale).flatMap(group => group.members.map(option => {
    const category = option.categoryId ? categories.find(row => row.id === option.categoryId) : categoryForName(option.name, categories);
    return { key: option.key, label: option.name, group: group.name ?? t("groups.ungrouped"),
      content: <><CategoryVisual category={category} name={option.name} /><span>{option.name}{option.activity ? ` · ${historicalLabel}` : ""}</span></> };
  })));
  return <ChoicePicker choices={choices} value={value} label={allLabel} selectedLabel={selected?.name ?? allLabel}
    query={query} onQueryChange={setQuery} className="category-picker category-filter-picker" triggerClass={`category-picker-trigger${selected ? "" : " is-empty"}`} onChoose={choice => onChange(choice.key)}>
    <CategoryVisual category={selectedCategory ?? { color: DEFAULT_CATEGORY_COLOR, icon: DEFAULT_CATEGORY_ICON }} name={selected?.name ?? allLabel} />
    <span>{selected?.name ?? allLabel}</span><ChevronDown size={16} aria-hidden="true" />
  </ChoicePicker>;
}

const CHART_PERIOD_OPTIONS: Array<{ value: SpendingPeriod; labelKey: TranslationKey }> = [
  { value: "30d", labelKey: "charts.past30Days" },
  { value: "3m", labelKey: "charts.past3Months" },
  { value: "6m", labelKey: "charts.past6Months" },
  { value: "1y", labelKey: "charts.pastYear" },
  { value: "3y", labelKey: "charts.past3Years" },
  { value: "all", labelKey: "charts.allTime" },
  { value: "custom", labelKey: "charts.customPeriod" },
];

function ChartPeriodPicker({ period, onChange }: { period: SpendingPeriod; onChange: (period: SpendingPeriod) => void }) {
  const { t } = useI18n();
  const selected = CHART_PERIOD_OPTIONS.find(option => option.value === period) ?? CHART_PERIOD_OPTIONS[0];
  return <div className="chart-filter-control"><span>{t("charts.period")}</span><ChoicePicker
    choices={CHART_PERIOD_OPTIONS.map(option => ({ key: option.value, label: t(option.labelKey), content: <><span>{t(option.labelKey)}</span>{option.value === period && <Check size={15} aria-hidden="true" />}</> }))}
    value={period} label={t("charts.period")} selectedLabel={t(selected.labelKey)} onChoose={choice => onChange(choice.key as SpendingPeriod)}
    className="chart-period-picker" triggerClass="chart-period-picker-trigger" menuClass="chart-period-picker-menu" optionClass="chart-period-picker-option">
    <span>{t(selected.labelKey)}</span><ChevronDown size={16} aria-hidden="true" />
  </ChoicePicker></div>;
}

function prepareTransactionCategory(
  name: string,
  direction: "income" | "expense",
  categories: Category[],
): { category: Category; needsPut: boolean } {
  const canonicalName = canonicalCategoryName(name.trim() || fallbackCategoryName(categories, direction), categories);
  if (isTransactionTypeCategoryLabel(canonicalName)) {
    throw new AppError("error.activityTypeCannotBeCategory", "Fixed transaction types cannot be used as category names.");
  }
  const existing = categoryForName(canonicalName, categories);
  if (!existing) {
    return {
      category: {
        id: uid("category"),
        name: canonicalName,
        scope: direction,
        archived: false,
        templateKey: null,
        system: false,
        color: DEFAULT_CATEGORY_COLOR,
        icon: DEFAULT_CATEGORY_ICON,
        defaultReportable: true,
      },
      needsPut: true,
    };
  }
  const scope = existing.scope === direction || existing.scope === "both"
    ? existing.scope
    : "both";
  const category = scope === existing.scope && !existing.archived
    ? existing
    : { ...existing, scope, archived: false };
  return { category, needsPut: category !== existing };
}

const EMPTY_SNAPSHOT: AppSnapshot = {
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
  },
  currencies: [],
  wallets: [],
  categories: [],
  rates: [],
  transactions: [],
  uncharted: [],
};

const NAVIGATION: Array<{
  id: View;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", labelKey: "nav.overview", icon: LayoutDashboard },
  { id: "charts", labelKey: "nav.charts", icon: ChartPie },
  { id: "transactions", labelKey: "nav.transactions", icon: ArrowLeftRight },
  { id: "uncharted", labelKey: "nav.uncharted", icon: CircleHelp },
  { id: "wallets", labelKey: "nav.wallets", icon: WalletCards },
  { id: "currency", labelKey: "nav.currency", icon: Coins },
  { id: "settings", labelKey: "nav.settings", icon: Settings2 },
  { id: "about", labelKey: "nav.about", icon: Info },
];

const RATE_METHOD_LABEL_KEYS: Record<Rate["method"], TranslationKey> = {
  system: "settings.methodSystem",
  manual: "settings.methodManual",
  reference: "settings.methodReference",
  automatic: "settings.methodAutomatic",
};

const DIRECTION_LABEL_KEYS: Record<Direction, TranslationKey> = {
  income: "activity.directionIncome",
  expense: "activity.directionExpense",
  in: "activity.directionIn",
  out: "activity.directionOut",
};

const BACKUP_FILE_ACCEPT = ".json,.gz,application/json,application/gzip,application/x-gzip";

function downloadFile(filename: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Keep the URL alive while browsers hand the download to their file manager.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function isoToday() {
  return localDate();
}

function initialTransactionPageSize(): TransactionPageSize {
  if (typeof window === "undefined") return TRANSACTION_PAGE_SIZES[0];
  try {
    const stored = Number(window.localStorage.getItem(TRANSACTION_PAGE_SIZE_STORAGE_KEY));
    return TRANSACTION_PAGE_SIZES.includes(stored as TransactionPageSize)
      ? stored as TransactionPageSize
      : TRANSACTION_PAGE_SIZES[0];
  } catch {
    return TRANSACTION_PAGE_SIZES[0];
  }
}

function titleFor(view: View, t: (key: TranslationKey) => string) {
  return {
    overview: t("page.overview"),
    charts: t("page.charts"),
    transactions: t("page.transactions"),
    wallets: t("page.wallets"),
    currency: t("page.currency"),
    uncharted: t("page.uncharted"),
    settings: t("page.settings"),
    about: t("page.about"),
  }[view];
}

function OverviewBalanceEquivalent({
  amount,
  from,
  to,
  rates,
  irrDisplayUnit,
}: {
  amount: Decimal.Value;
  from: string;
  to: string;
  rates: Rate[];
  irrDisplayUnit: IrrDisplayUnit;
}) {
  const { t } = useI18n();
  if (from === to) return null;
  const converted = convertWithRateFallback(amount, from, to, rates);
  const quality = converted?.quality === "estimate" ? t("history.estimate")
    : converted?.quality === "monthly" ? t("history.monthlyUsed")
    : converted?.quality === "previous" ? t("history.previousUsed") : null;

  return (
    <span className="overview-balance-equivalent">
      {converted ? (
        <>
          <span className="overview-balance-equivalent-value" dir="ltr">
            <span aria-hidden="true">≈ </span>
            <span className="visually-hidden">{t("overview.equivalent")} </span>
            <MoneyAmount amount={converted.value} currency={to} irrDisplayUnit={irrDisplayUnit} />
          </span>
          {quality && <span className="overview-balance-equivalent-quality">{quality}</span>}
        </>
      ) : <span>{t("wallets.inReportingCurrency", { currency: to })} · {t("wallets.rateUnavailable")}</span>}
    </span>
  );
}

function normalizeJalaliDraftInput(value: string) {
  return value
    .replace(/^(\d{4}[-/.])0(?=\d{2}[-/.])/, "$1")
    .replace(/^(\d{4}[-/.]\d{1,2}[-/.])0(?=\d{2}$)/, "$1");
}

function EntryDateField({
  value,
  onChange,
  showJalali,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  showJalali: boolean;
  label?: string;
}) {
  const { t } = useI18n();
  const fieldLabel = label ?? t("date.date");
  const [jalaliDraft, setJalaliDraft] = useState<string | null>(null);
  const displayedJalali = jalaliDraft ?? jalaliIsoDate(value);
  const convertedDraft = jalaliDraft === null ? value : gregorianDateFromJalali(jalaliDraft);
  const invalidJalali = jalaliDraft !== null && jalaliDraft.trim().length >= 8 && !convertedDraft;

  const changeGregorian = (nextValue: string) => {
    setJalaliDraft(null);
    onChange(nextValue);
  };
  const changeJalali = (nextValue: string) => {
    const editableValue = normalizeJalaliDraftInput(asciiDigits(nextValue));
    setJalaliDraft(editableValue);
    const converted = gregorianDateFromJalali(editableValue);
    if (converted) {
      onChange(converted);
    }
  };
  const finishJalaliEdit = () => {
    if (jalaliDraft !== null && gregorianDateFromJalali(jalaliDraft)) {
      setJalaliDraft(null);
    }
  };

  return (
    <div className="form-date-field">
      <label>
        <span>{t("date.gregorian", { label: fieldLabel })}</span>
        <input required type="date" value={value} onChange={(event) => changeGregorian(event.target.value)} />
      </label>
      {showJalali && (
        <label className="jalali-date-input">
          <span>{t("date.jalali", { label: fieldLabel })}</span>
          <input
            aria-invalid={invalidJalali}
            inputMode="numeric"
            placeholder="1405-04-23"
            value={displayedJalali}
            onChange={(event) => changeJalali(event.target.value)}
            onBlur={finishJalaliEdit}
          />
          <small className={invalidJalali ? "invalid" : ""}>
            {invalidJalali
              ? t("date.invalidJalali")
              : t("date.storedGregorian", { date: value })}
          </small>
        </label>
      )}
    </div>
  );
}

function groupByCurrency<T extends { currency: string; name: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  const orderedItems = [...items].sort(
    (left, right) =>
      left.currency.localeCompare(right.currency) ||
      left.name.localeCompare(right.name, undefined, { sensitivity: "base", numeric: true }),
  );
  for (const item of orderedItems) {
    const group = groups.get(item.currency) ?? [];
    group.push(item);
    groups.set(item.currency, group);
  }
  return [...groups.entries()].map(([currency, groupedItems]) => ({ currency, items: groupedItems }));
}

function walletsByCurrency(wallets: Wallet[]) {
  return groupByCurrency(wallets).map((group) => ({ currency: group.currency, wallets: group.items }));
}

function currencyBadgeCode(currency: string) {
  return currency.trim().toUpperCase();
}

function currencyPaletteColor(index: number) {
  const base = WALLET_CHART_COLORS[index % WALLET_CHART_COLORS.length];
  const cycle = Math.floor(index / WALLET_CHART_COLORS.length);
  if (cycle === 0) return base;
  const amount = Math.min(0.68, 0.18 + Math.floor((cycle - 1) / 2) * 0.08);
  return mixColor(base, cycle % 2 === 1 ? "#FFFFFF" : "#000000", amount);
}

function currencyAccentColor(currency: string, currencies: Currency[] = []) {
  const code = currencyBadgeCode(currency);
  const availableCodes = new Set(currencies.map((item) => currencyBadgeCode(item.code)));
  const builtInCodes = BUILT_IN_CURRENCIES
    .map((item) => item.code)
    .filter((item) => availableCodes.size === 0 || availableCodes.has(item));
  const userAddedCodes = currencies
    .filter((item) => !item.builtIn)
    .map((item) => currencyBadgeCode(item.code))
    .sort((left, right) => left.localeCompare(right));
  const orderedCodes = [...builtInCodes, ...userAddedCodes];
  const fallbackIndex = [...code].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 0);
  const orderedIndex = orderedCodes.indexOf(code);
  const paletteIndex = orderedIndex >= 0 ? orderedIndex : fallbackIndex;
  return currencyPaletteColor(paletteIndex);
}

function CurrencyBadge({ currency, currencies, large = false, style }: { currency: string; currencies?: Currency[]; large?: boolean; style?: { boxShadow?: string } }) {
  return <span className={`currency-avatar${large ? " large" : ""}`} style={{ ...tonalBadgeStyle(currencyAccentColor(currency, currencies)), ...style }}>{currencyBadgeCode(currency)}</span>;
}

function CurrencyDot({ currency, currencies }: { currency: string; currencies?: Currency[] }) {
  return <i className="currency-dot" style={{ backgroundColor: currencyAccentColor(currency, currencies) }} />;
}

function WalletOptionGroups({ wallets, transactions, irrDisplayUnit }: { wallets: Wallet[]; transactions: Transaction[]; irrDisplayUnit: IrrDisplayUnit }) {
  const { locale } = useI18n();
  return walletsByCurrency(wallets).map((group) => (
    <optgroup label={group.currency} key={group.currency}>
      {group.wallets.map((wallet) => (
        <option key={wallet.id} value={wallet.id}>{wallet.name} · {formatMoney(walletBalance(wallet.id, transactions), wallet.currency, false, irrDisplayUnit, locale)}</option>
      ))}
    </optgroup>
  ));
}

function useSettingWriter(onError: (message: string) => void) {
  const { t } = useI18n();
  return async <K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<boolean> => {
    try { await setSetting(key, value); return true; }
    catch { onError(t("error.settingsSave")); return false; }
  };
}

export function JibjipApp() {
  return (
    <I18nProvider>
      <ConfirmationProvider><JibjipAppContent /></ConfirmationProvider>
    </I18nProvider>
  );
}

function JibjipAppContent() {
  const { locale, t, tp, formatDate, formatNumber, setLocale } = useI18n();
  const today = useSyncExternalStore(subscribeLocalDay, localDate, localDate);
  const requestConfirmation = useConfirmation();
  const [snapshot, setSnapshot] = useState<AppSnapshot>(EMPTY_SNAPSHOT);
  const requestedSetupLocale = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const requested = new URLSearchParams(window.location.search).get("lang");
    return requested === "en" || requested === "fa" ? requested : undefined;
  }, []);
  const initialSetupLocale = snapshot.settings.setupState === "uninitialized"
    ? snapshot.settings.setupDraft?.locale ?? requestedSetupLocale : undefined;
  const interfaceLocale = initialSetupLocale ?? snapshot.settings.locale;
  const [view, setView] = useState<View>("overview");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [searchRequest, setSearchRequest] = useState(0);
  const handledSearchRequest = useRef(0);
  const previousView = useRef<View>("overview");
  const [transactionDialog, setTransactionDialog] =
    useState<TransactionDialogState>(null);
  const [walletDialog, setWalletDialog] = useState<Wallet | null | undefined>(undefined);
  const restoreInput = useRef<HTMLInputElement>(null);
  const backupPending = useRef(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const csvImportInput = useRef<HTMLInputElement>(null);
  const translationRef = useRef(t);
  useMotionPreference(snapshot.settings.motion);
  const logoSound = useLogoSound(() => selectView("overview"));

  useEffect(() => {
    if (loading || snapshot.settings.setupState !== "complete") return;
    const keydown = (event: KeyboardEvent) => {
      const intent = shortcutIntent(event);
      if (!intent || intent === "submit" || event.defaultPrevented) return;
      event.preventDefault();
      const modal = document.querySelector("dialog[open]");
      if (modal && !modal.querySelector(".command-dialog, .shortcuts-dialog")) return;
      if (intent === "commands") { setShortcutsOpen(false); setCommandsOpen(open => !open); }
      else { setCommandsOpen(false); setShortcutsOpen(open => !open); }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [loading, snapshot.settings.setupState]);

  useEffect(() => {
    if (loading || snapshot.settings.setupState !== "complete") return;
    if (searchRequest !== handledSearchRequest.current && view === "transactions") {
      document.getElementById("transaction-search")?.focus(); handledSearchRequest.current = searchRequest;
    } else if (previousView.current !== view && !document.querySelector("dialog[open]")) {
      document.getElementById("page-title")?.focus({ preventScroll: true });
    }
    previousView.current = view;
  }, [view, searchRequest, loading, snapshot.settings.setupState]);

  useEffect(() => {
    translationRef.current = t;
  }, [t]);

  useEffect(() => {
    setLocale(interfaceLocale);
  }, [setLocale, interfaceLocale]);

  useEffect(() => {
    let active = true;
    let subscription: Subscription | undefined;
    const fail = (reason: unknown) => {
      if (!active) return;
      setError(translatedErrorMessage(reason, translationRef.current, "error.localOpenFailed"));
      setLoading(false);
    };
    void initializeLocalData().then(result => {
      if (!active) return;
      let first = true;
      subscription = liveQuery(loadSnapshot).subscribe({
        next: nextSnapshot => {
          if (!active) return;
          setSnapshot(nextSnapshot);
          if (first) {
            first = false;
            setView(nextSnapshot.settings.startPage);
            setLoading(false);
            if (result === "seeded") setNotice(translationRef.current("notice.starterReady"));
          }
        },
        error: fail,
      });
    }).catch(fail);
    registerOfflineShell();
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const handleRestore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const { parseBackupFile } = await import("../lib/snapshot-file");
      const seed = await parseBackupFile(file);
      requestConfirmation({
        title: t("settings.restoreBackup"), description: t("notice.replaceConfirm"),
        confirmLabel: t("dialog.restoreBackup"), errorKey: "error.restoreFailed",
        onConfirm: async () => {
          await replaceDatabase(seed);
          await initializeLocalData();
          setNotice(t("notice.restored", {
            transactions: tp("common.transactions", seed.transactions.length, { count: formatNumber(seed.transactions.length) }),
          }));
          setView(seed.settings.startPage);
        },
      });
    } catch (reason) {
      setError(translatedErrorMessage(reason, t, "error.restoreFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleCsvImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const { parseTransactionCsv } = await import("../lib/portability");
      const csv = await file.text();
      const preview = parseTransactionCsv(csv, snapshot.wallets, snapshot.categories, snapshot.settings.typeReportability);
      const imported = await db.transaction("rw", [db.wallets, db.categories, db.transactions, db.settings], async () => {
        const [wallets, categories, typeRow] = await Promise.all([
          db.wallets.toArray(), db.categories.toArray(), db.settings.get("typeReportability"),
        ]);
        const typeReportability = normalizeTypeReportability(typeRow?.value);
        const catalogsUnchanged = JSON.stringify([wallets, categories, typeReportability]) ===
          JSON.stringify([snapshot.wallets, snapshot.categories, snapshot.settings.typeReportability]);
        const parsed = catalogsUnchanged ? preview : parseTransactionCsv(csv, wallets, categories, typeReportability);
        if (parsed.categories.length > 0) await db.categories.bulkPut(parsed.categories);
        await db.transactions.bulkAdd(parsed.transactions);
        return parsed;
      });
      setNotice(
        t("notice.csvImported", {
          transactions: `CSV ${tp("common.transactions", imported.transactions.length, {
            count: formatNumber(imported.transactions.length),
          })}`,
        }),
      );
    } catch (reason) {
      setError(translatedErrorMessage(reason, t, "error.csvImportFailed"));
    } finally {
      setLoading(false);
    }
  };

  const exportBackup = async () => {
    if (backupPending.current) return;
    backupPending.current = true;
    setExportingBackup(true);
    try {
      const backup = await databaseBackup();
      const { createBackupFile } = await import("../lib/snapshot-file");
      const { blob, extension } = await createBackupFile(backup);
      downloadFile(
        `jibjip-backup-${isoToday()}${extension}`,
        blob,
        blob.type,
      );
      setNotice(t("notice.backupDownloaded"));
    } catch (reason) { setError(translatedErrorMessage(reason, t, "error.exportFailed")); }
    finally { backupPending.current = false; setExportingBackup(false); }
  };

  const purgeLocalData = () => requestConfirmation({
    title: t("settings.eraseLocalData"), description: t("notice.eraseLocalDataConfirm"),
    confirmLabel: t("settings.eraseLocalData"), errorKey: "error.eraseLocalDataFailed",
    onConfirm: async () => {
      await eraseLocalData();
      setError(null);
      setNotice(t("notice.localDataErased"));
    },
  });

  const exportCsv = async (walletIds: string[]) => {
    try {
      const { transactionCsv } = await import("../lib/portability");
      const selectedWalletIds = new Set(walletIds);
      const transactions = snapshot.transactions.filter(t => selectedWalletIds.has(t.walletId));
      downloadFile(
        `jibjip-transactions-${isoToday()}.csv`,
        transactionCsv(transactions, snapshot.wallets),
        "text/csv;charset=utf-8",
      );
      setNotice(t("notice.exported", {
        transactions: tp("common.transactions", transactions.length, {
          count: formatNumber(transactions.length),
        }),
        wallets: tp("common.wallets", walletIds.length, {
          count: formatNumber(walletIds.length),
        }),
      }));
    } catch (reason) { setError(translatedErrorMessage(reason, t, "error.exportFailed")); }
  };

  const setReportingCurrency = async (currency: string) => {
    try { await setSetting("reportingCurrency", currency); }
    catch { setError(t("error.settingsSave")); }
  };

  const selectView = (next: View) => {
    setView(next);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const hasWallets = snapshot.wallets.length > 0;
  const hasActiveWallets = snapshot.wallets.some((wallet) => !wallet.archived);
  const showReportingCurrency = hasWallets && (view === "overview" || view === "charts" || view === "transactions" || view === "wallets");
  const showAddTransaction = hasActiveWallets && (view === "overview" || view === "transactions");
  const showAddWallet = view === "wallets";
  const hasPageActions = showReportingCurrency || showAddTransaction || showAddWallet;

  if (loading) {
    return (
      <main className="loading-screen" role="status">
        <BrandLockup className="loading-brand-lockup" labelled />
        <p>{t("loading.preparing")}</p>
        <span className="loading-subtext">{t("loading.local")}</span>
      </main>
    );
  }

  if (snapshot.settings.setupState !== "complete") {
    return <>
      <Suspense fallback={<p role="status">{t("loading.preparing")}</p>}><SetupWizard
        snapshot={snapshot}
        initialLocale={initialSetupLocale}
        onRestore={() => restoreInput.current?.click()}
        onError={(reason) => setError(translatedErrorMessage(reason, t, "error.localOpenFailed"))}
      />
      </Suspense>
      {error && <div className="toast-region"><div className="toast error" role="alert"><span>{error}</span><button aria-label={t("shell.dismissError")} onClick={() => setError(null)}><X size={16} /></button></div></div>}
      <div className="setup-access"><AppAccess /></div>
      <input ref={restoreInput} className="visually-hidden" type="file" tabIndex={-1} aria-hidden="true" accept={BACKUP_FILE_ACCEPT} onChange={handleRestore} />
    </>;
  }

  const commands: AppCommand[] = [
    { id: "add-transaction", label: t("wallets.addTransaction"), keywords: "new add transaction income expense", icon: Plus, disabled: !hasActiveWallets, run: () => setTransactionDialog({}) },
    { id: "search-transactions", label: t("keyboard.searchTransactions"), keywords: "find search transactions", icon: Search, run: () => { selectView("transactions"); setSearchRequest(request => request + 1); } },
    { id: "add-wallet", label: t("wallets.add"), keywords: "new add wallet account", icon: WalletCards, run: () => { selectView("wallets"); setWalletDialog(null); } },
    ...NAVIGATION.map(item => ({ id: item.id, label: t(item.labelKey), icon: item.icon, run: () => selectView(item.id) })),
    { id: "keyboard-shortcuts", label: t("keyboard.shortcuts"), keywords: "keyboard shortcuts help", icon: Keyboard, run: () => setShortcutsOpen(true) },
  ];

  const navigation = <>
        <button className="brand" aria-label={`${t("common.jibjip")} — ${t("nav.overview")}`} {...logoSound}>
          <BrandLockup />
        </button>
        <nav aria-label={t("shell.mainNavigation")}>
          {NAVIGATION.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={view === item.id ? "active" : ""}
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => selectView(item.id)}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{t(item.labelKey)}</span>
                {item.id === "uncharted" && snapshot.uncharted.some((entry) => entry.status === "open") && (
                  <em>{snapshot.uncharted.filter((entry) => entry.status === "open").length}</em>
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-device">
            <span className="sidebar-device-icon" aria-hidden="true"><Database size={17} strokeWidth={1.8} /></span>
            <span className="sidebar-records">{t(snapshot.transactions.length === 1 ? "shell.recordOnDevice" : "shell.recordsOnDevice", { count: formatNumber(snapshot.transactions.length) })}</span>
          </div>
          <div className="sidebar-tools"><AppAccess />
            <button type="button" className="icon-button" aria-label={t("keyboard.shortcuts")} title={t("keyboard.shortcuts")} aria-haspopup="dialog" aria-keyshortcuts="Control+/ Meta+/" onClick={() => { setMobileNavOpen(false); setShortcutsOpen(true); }}><Keyboard size={18} aria-hidden="true" /></button>
          </div>
          <span className="app-version">{t("shell.appVersion", { version: APP_VERSION })}</span>
        </div>
  </>;

  return (
    <div className="app-shell" data-text-size={snapshot.settings.textSize}>
      <a className="app-skip-link" href="#main-content">{t("keyboard.skipContent")}</a>
      <aside className="sidebar desktop-sidebar">{navigation}</aside>
      {mobileNavOpen && <NavigationDrawer onClose={() => setMobileNavOpen(false)}>{navigation}</NavigationDrawer>}

      <main className="main-content" id="main-content" tabIndex={-1}>
        <header className={`topbar${hasPageActions ? " has-page-actions" : ""}`}>
          <div className="topbar-title">
            <button
              className="icon-button mobile-menu"
              aria-label={t("shell.openNavigation")}
              aria-controls="mobile-navigation"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div>
              <p>{formatDate(new Date(`${today}T12:00:00`), { dateStyle: "full", numberingSystem: locale === "fa" ? "arabext" : "latn" })}</p>
              {snapshot.settings.showJalali && <small className="topbar-jalali">{jalaliDate(today, locale, locale === "fa" ? "arabext" : "latn")}</small>}
              <h1 id="page-title" tabIndex={-1}>{titleFor(view, t)}</h1>
            </div>
          </div>
              <button type="button" className="quick-actions-trigger" title={t("keyboard.quickActions")} aria-keyshortcuts="Control+K Meta+K" onClick={() => setCommandsOpen(true)}><Search size={18} aria-hidden="true" /><span className="quick-actions-label">{t("keyboard.quickActions")}</span><ShortcutKeys keys={[modifierLabel(), "K"]} /></button>
          {hasPageActions && (
            <div className="topbar-actions">
              {showReportingCurrency && (
                <label className="currency-select">
                  <span>{t("shell.viewIn")}</span>
                  <select
                    aria-label={t("shell.reportingCurrency")}
                    value={snapshot.settings.reportingCurrency}
                    onChange={(event) => setReportingCurrency(event.target.value)}
                  >
                    {snapshot.currencies.filter(item => !item.archived || item.code === snapshot.settings.reportingCurrency)
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map((currency) => (
                        <option key={currency.code} value={currency.code}>{currency.code}</option>
                      ))}
                  </select>
                </label>
              )}
              {showAddTransaction && (
                <button className="button affirmative" onClick={() => setTransactionDialog({})}>
                  <Plus size={18} /> {t("wallets.addTransaction")}
                </button>
              )}
              {showAddWallet && (
                <button className="button affirmative" onClick={() => setWalletDialog(null)}>
                  <Plus size={18} /> {t("wallets.add")}
                </button>
              )}
            </div>
          )}
        </header>

        {(notice || error) && <div className="toast-region">
          {error && <div className="toast error" role="alert">
            <span>{error}</span>
            <button aria-label={t("shell.dismissError")} onClick={() => setError(null)}><X size={16} /></button>
          </div>}
          {notice && <div className="toast success" role="status">
            <Check size={17} aria-hidden="true" /><span>{notice}</span>
            <button aria-label={t("shell.dismissNotice")} onClick={() => setNotice(null)}><X size={16} /></button>
          </div>}
        </div>}

        <div className="page-content" key={view}>
        {view === "about" ? (
          <Suspense fallback={<p role="status">{t("loading.preparing")}</p>}><AboutView onOpenSettings={() => selectView("settings")} /></Suspense>
        ) : view === "settings" ? (
          <SettingsView
            snapshot={snapshot}
            onRestore={() => restoreInput.current?.click()}
            onCsvImport={() => csvImportInput.current?.click()}
            onBackup={exportBackup}
            exportingBackup={exportingBackup}
            onCsv={exportCsv}
            onPurge={purgeLocalData}
            onNotice={setNotice}
          />
        ) : view === "currency" ? (
          <CurrencyView snapshot={snapshot} onNotice={setNotice} />
        ) : snapshot.wallets.length === 0 ? (
          <EmptyState onOpenSettings={() => setView("settings")} />
        ) : (
          <>
            {view === "overview" && (
              <Overview
                snapshot={snapshot}
                onNotice={setNotice}
                onOpenWallets={() => setView("wallets")}
                onAddTransaction={() => setTransactionDialog({})}
                onViewTransactions={() => setView("transactions")}
                onEditTransaction={(transaction) =>
                  setTransactionDialog({ transaction })
                }
              />
            )}
            {view === "transactions" && (
              <TransactionsView
                snapshot={snapshot}
                onEdit={(transaction) => setTransactionDialog({ transaction })}
                onDuplicate={(transaction) => setTransactionDialog({ duplicate: transaction })}
                onBatchEdit={(transactions, count) => setTransactionDialog({ batch: transactions, batchCount: count })}
                onNotice={setNotice}
              />
            )}
            {view === "charts" && <ChartsView snapshot={snapshot} />}
            {view === "wallets" && (
              <WalletsView
                snapshot={snapshot}
                editing={walletDialog}
                setEditing={setWalletDialog}
                onAddTransaction={(walletId) => setTransactionDialog({ walletId })}
                onNotice={setNotice}
              />
            )}
            {view === "uncharted" && (
              <UnchartedView
                snapshot={snapshot}
                onPromote={(promote) => setTransactionDialog({ promote })}
                onNotice={setNotice}
              />
            )}
          </>
        )}

        </div>
        <input
          ref={restoreInput}
          className="visually-hidden"
          type="file"
          tabIndex={-1}
          aria-hidden="true"
          accept={BACKUP_FILE_ACCEPT}
          onChange={handleRestore}
        />
        <input
          ref={csvImportInput}
          className="visually-hidden"
          type="file"
          tabIndex={-1}
          aria-hidden="true"
          accept=".csv,text/csv"
          onChange={handleCsvImport}
        />
      </main>



      {commandsOpen && <CommandDialog commands={commands} onClose={() => setCommandsOpen(false)} />}
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
      {transactionDialog && (transactionDialog.batch ? (
        <BatchTransactionDialog
          snapshot={snapshot}
          transactions={transactionDialog.batch}
          count={transactionDialog.batchCount ?? transactionDialog.batch.length}
          onClose={() => setTransactionDialog(null)}
          onSaved={async () => {
            const count = transactionDialog.batchCount ?? transactionDialog.batch?.length ?? 0;
            setTransactionDialog(null);
            setNotice(t("notice.selectedTransactionsUpdated", { count: formatNumber(count) }));
          }}
        />
      ) : (
        <TransactionDialog
          snapshot={snapshot}
          state={transactionDialog}
          onClose={() => setTransactionDialog(null)}
          onSaved={async () => {
            setTransactionDialog(null);
            setNotice(
              transactionDialog.promote
                ? t("notice.entryPromoted")
                : t("notice.transactionSaved"),
            );
          }}
        />
      ))}
    </div>
  );
}

function BrandLockup({ className = "", labelled = false }: { className?: string; labelled?: boolean }) {
  const { locale, t } = useI18n();
  const classes = `brand-lockup ${className}`.trim();
  const wordmarkLocale = locale === "fa" ? "fa" : "en";

  return (
    <span
      className={classes}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? t("common.jibjip") : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      <span className="brand-icon" aria-hidden="true" />
      <span className={`brand-wordmark-frame brand-wordmark-frame-${wordmarkLocale}`} aria-hidden="true">
        {/* The public SVG must remain a direct offline asset, not an optimized remote image. */}
        <img className={`brand-wordmark brand-wordmark-${wordmarkLocale}`} src={brandWordmarkUrl(wordmarkLocale)} alt="" draggable={false} />
      </span>
    </span>
  );
}

function EmptyState({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useI18n();
  return (
    <section className="empty-state">
      <div className="empty-icon"><FileSpreadsheet size={30} /></div>
      <p className="eyebrow">{t("empty.eyebrow")}</p>
      <h2>{t("empty.title")}</h2>
      <p>{t("empty.description")}</p>
      <div className="empty-import-options">
        <article><strong>{t("empty.backupTitle")}</strong><span dir="ltr">.json.gz / .json</span><p>{t("empty.backupDescription")}</p></article>
        <article><strong>{t("empty.csvTitle")}</strong><span dir="ltr">.csv</span><p>{t("empty.csvDescription")}</p></article>
      </div>
      <button className="button primary" onClick={onOpenSettings}>
        <Settings2 size={18} /> {t("empty.openDataSettings")}
      </button>
      <span><WifiOff size={15} /> {t("empty.offline")}</span>
    </section>
  );
}

function Overview({
  snapshot,
  onNotice,
  onOpenWallets,
  onAddTransaction,
  onViewTransactions,
  onEditTransaction,
}: {
  snapshot: AppSnapshot;
  onNotice: (message: string) => void;
  onOpenWallets: () => void;
  onAddTransaction: () => void;
  onViewTransactions: () => void;
  onEditTransaction: (transaction: Transaction) => void;
}) {
  const { locale, t, tp, formatNumber } = useI18n();
  const saveSetting = useSettingWriter(onNotice);
  const currency = snapshot.settings.reportingCurrency;
  const irrDisplayUnit = snapshot.settings.irrDisplayUnit;
  const [cashflowPeriod, setCashflowPeriod] = useState<CashflowPeriod>("6m");
  const [editingPinnedWalletSlot, setEditingPinnedWalletSlot] = useState<number | null>(null);
  const [currencyChooserOpen, setCurrencyChooserOpen] = useState(false);
  const today = isoToday();
  const worth = useMemo(() => netWorth(snapshot, today), [snapshot, today]);
  const start = rollingPeriodStart("30d", today);
  const last30DaysTransactions = useMemo(
    () => snapshot.transactions.filter(
      (transaction) => transaction.date >= start && transaction.date <= today,
    ),
    [snapshot.transactions, start, today],
  );
  const incomeTotal = useMemo(
    () => reportTotalWithMissing(last30DaysTransactions, "income", currency, snapshot.rates),
    [last30DaysTransactions, currency, snapshot.rates],
  );
  const expenseTotal = useMemo(
    () => reportTotalWithMissing(last30DaysTransactions, "expense", currency, snapshot.rates),
    [last30DaysTransactions, currency, snapshot.rates],
  );
  const income = incomeTotal.value;
  const expenses = expenseTotal.value;
  const balance = income.minus(expenses);
  const balanceTone = balance.gt(0) ? "positive" : balance.lt(0) ? "negative" : "neutral";
  const recent = useMemo(
    () =>
      groupTransactionActivities(snapshot.transactions)
        .sort((a, b) =>
          b.primary.date.localeCompare(a.primary.date) ||
          b.primary.updatedAt.localeCompare(a.primary.updatedAt)
        )
        .slice(0, OVERVIEW_RECENT_ACTIVITY_LIMIT),
    [snapshot.transactions],
  );
  const walletMap = useMemo(
    () => new Map(snapshot.wallets.map((wallet) => [wallet.id, wallet])),
    [snapshot.wallets],
  );
  const cashflowMonthCount = cashflowPeriod === "6m" ? 6 : cashflowPeriod === "1y" ? 12 : 36;
  const months = useMemo(
    () => monthlySeries(snapshot, cashflowMonthCount, locale, today),
    [snapshot, cashflowMonthCount, locale, today],
  );
  const activeWallets = useMemo(
    () => snapshot.wallets.filter((wallet) => !wallet.archived),
    [snapshot.wallets],
  );
  const allCurrencyBalances = useMemo(
    () => walletsByCurrency(activeWallets).map((group) => ({
      ...group,
      balance: group.wallets.reduce(
        (total, wallet) => total.plus(walletBalance(wallet.id, snapshot.transactions)),
        new Decimal(0),
      ),
    })),
    [activeWallets, snapshot.transactions],
  );
  const hiddenCurrencyCodes = useMemo(
    () => new Set(snapshot.settings.overviewHiddenCurrencies),
    [snapshot.settings.overviewHiddenCurrencies],
  );
  const currencyBalances = useMemo(
    () => allCurrencyBalances.filter((group) => !hiddenCurrencyCodes.has(group.currency)),
    [allCurrencyBalances, hiddenCurrencyCodes],
  );
  const hiddenCurrencyBalances = useMemo(
    () => allCurrencyBalances.filter((group) => hiddenCurrencyCodes.has(group.currency)),
    [allCurrencyBalances, hiddenCurrencyCodes],
  );
  const selectedWalletIds = snapshot.settings.overviewWalletIds;
  const visibleWallets = useMemo(
    () =>
      selectedWalletIds === null
        ? activeWallets
        : activeWallets.filter((wallet) => selectedWalletIds.includes(wallet.id)),
    [activeWallets, selectedWalletIds],
  );
  const visibleWorth = useMemo(() => {
    let value = new Decimal(0);
    const missing = new Set<string>();
    for (const wallet of visibleWallets) {
      const converted = convert(
        walletBalance(wallet.id, snapshot.transactions),
        wallet.currency,
        currency,
        snapshot.rates,
        today,
      );
      if (converted) value = value.plus(converted);
      else missing.add(missingRateCurrency(wallet.currency, currency, snapshot.rates, today));
    }
    return { value, missing: [...missing] };
  }, [visibleWallets, snapshot.transactions, snapshot.rates, currency, today]);
  const walletPie = useMemo(() => {
    const items: Array<{
      id: string;
      name: string;
      currency: string;
      value: Decimal;
      color: string;
    }> = [];
    const missing: string[] = [];
    const nonPositive: string[] = [];
    const colorByWalletId = new Map(
      activeWallets.map((wallet, index) => [
        wallet.id,
        WALLET_CHART_COLORS[index % WALLET_CHART_COLORS.length],
      ]),
    );

    for (const wallet of visibleWallets) {
      const value = convert(
        walletBalance(wallet.id, snapshot.transactions),
        wallet.currency,
        currency,
        snapshot.rates,
        today,
      );
      if (!value) {
        missing.push(wallet.name);
      } else if (value.lte(0)) {
        nonPositive.push(wallet.name);
      } else {
        items.push({
          id: wallet.id,
          name: wallet.name,
          currency: wallet.currency,
          value,
          color: colorByWalletId.get(wallet.id) ?? WALLET_CHART_COLORS[0],
        });
      }
    }

    return {
      items,
      missing,
      nonPositive,
      total: items.reduce((total, item) => total.plus(item.value), new Decimal(0)),
    };
  }, [activeWallets, visibleWallets, snapshot.transactions, snapshot.rates, currency, today]);

  const updateVisibleWallets = async (walletIds: string[] | null) => {
    await saveSetting("overviewWalletIds", walletIds);
  };

  const toggleVisibleWallet = async (walletId: string) => {
    const currentIds = selectedWalletIds ?? activeWallets.map((wallet) => wallet.id);
    const nextIds = currentIds.includes(walletId)
      ? currentIds.filter((id) => id !== walletId)
      : [...currentIds, walletId];
    await updateVisibleWallets(nextIds);
  };

  const updatePinnedWallet = async (slotIndex: number, walletId: string | null) => {
    const nextIds = [...snapshot.settings.overviewPinnedWalletIds];
    nextIds[slotIndex] = walletId;
    if (await saveSetting("overviewPinnedWalletIds", nextIds)) setEditingPinnedWalletSlot(null);
  };

  const hideCurrency = async (currencyCode: string) => {
    const nextCurrencies = [...new Set([...snapshot.settings.overviewHiddenCurrencies, currencyCode])]
      .sort((left, right) => left.localeCompare(right));
    await saveSetting("overviewHiddenCurrencies", nextCurrencies);
  };

  const showCurrency = async (currencyCode: string) => {
    const saved = await saveSetting(
      "overviewHiddenCurrencies",
      snapshot.settings.overviewHiddenCurrencies.filter((currencyCodeToKeep) => currencyCodeToKeep !== currencyCode),
    );
    if (saved) setCurrencyChooserOpen(false);
  };

  return (
    <div className="page-stack">
      <section className="hero-grid">
        <article className="net-worth-card">
          <div className="card-heading">
            <span>{t("overview.netWorth")}</span>
            <Landmark size={19} />
          </div>
          <strong><MoneyAmount amount={worth.value} currency={currency} irrDisplayUnit={irrDisplayUnit} /></strong>
          <p>
            {tp("overview.activeWallets", activeWallets.length, { count: formatNumber(activeWallets.length) })}
            {worth.missing.length > 0 && ` · ${t("overview.missingRates", { currencies: worth.missing.join(", ") })}`}
          </p>
          <div className="worth-rule" />
          <small>{t("overview.conversionNote")}</small>
        </article>

        <article className="metric-card income-card">
          <div className="metric-icon"><ArrowDownRight size={19} /></div>
          <span>{t("overview.income30")}</span>
          <strong><MoneyAmount amount={income} currency={currency} irrDisplayUnit={irrDisplayUnit} /></strong>
          <small>
            {t("overview.incomeNote")}
            {incomeTotal.missing.length > 0 && ` · ${t("overview.missingRates", { currencies: incomeTotal.missing.join(", ") })}`}
          </small>
        </article>

        <article className="metric-card expense-card">
          <div className="metric-icon"><ArrowUpRight size={19} /></div>
          <span>{t("overview.spent30")}</span>
          <strong><MoneyAmount amount={expenses} currency={currency} irrDisplayUnit={irrDisplayUnit} /></strong>
          <small>
            {t("overview.spentNote")}
            {expenseTotal.missing.length > 0 && ` · ${t("overview.missingRates", { currencies: expenseTotal.missing.join(", ") })}`}
          </small>
        </article>

        <article className={`metric-card balance-card balance-${balanceTone}`}>
          <div className="metric-icon">
            {balanceTone === "negative" ? <ArrowUpRight size={19} /> : <ArrowDownRight size={19} />}
          </div>
          <span>{t("overview.net30")}</span>
          <strong><MoneyAmount amount={balance} currency={currency} irrDisplayUnit={irrDisplayUnit} /></strong>
          <small>{t("overview.netNote")}</small>
        </article>
      </section>

      <ConversionNotice transactions={last30DaysTransactions} rates={snapshot.rates} currency={currency} />

      <section className="panel overview-pinned-wallets" aria-labelledby="quick-wallets-heading">
        <div className="overview-pinned-wallets-heading">
          <div>
            <p className="eyebrow">{t("overview.glance")}</p>
            <h2 id="quick-wallets-heading">{t("overview.quickWallets")}</h2>
          </div>
          <small>{t("overview.quickWalletsDescription")}</small>
        </div>
        <div className="overview-pinned-wallet-grid">
          {snapshot.settings.overviewPinnedWalletIds.map((walletId, slotIndex) => {
            const candidate = walletId ? walletMap.get(walletId) : undefined;
            const wallet = candidate?.archived ? undefined : candidate;
            const nativeBalance = wallet ? walletBalance(wallet.id, snapshot.transactions) : 0;
            return (
              <article className={`overview-pinned-wallet ${wallet ? "is-filled" : "is-empty"}`} key={slotIndex}>
                {wallet ? (
                  <>
                    <button
                      className="overview-pinned-wallet-main"
                      type="button"
                      onClick={() => setEditingPinnedWalletSlot(slotIndex)}
                      aria-label={t("overview.changeQuickWallet", { slot: slotIndex + 1, wallet: wallet.name })}
                      aria-describedby={`quick-wallet-balance-${slotIndex}`}
                    >
                      <CurrencyBadge currency={wallet.currency} currencies={snapshot.currencies} />
                      <span className="overview-pinned-wallet-copy">
                        <strong>{wallet.name}</strong>
                        <small>{t("overview.walletBalanceLabel", { currency: wallet.currency })}</small>
                      </span>
                      <span className="overview-pinned-wallet-values" id={`quick-wallet-balance-${slotIndex}`}>
                        <b><MoneyAmount amount={nativeBalance} currency={wallet.currency} irrDisplayUnit={irrDisplayUnit} /></b>
                        <OverviewBalanceEquivalent amount={nativeBalance} from={wallet.currency} to={currency} rates={snapshot.rates} irrDisplayUnit={irrDisplayUnit} />
                      </span>
                    </button>
                    <button
                      className="icon-button overview-pinned-wallet-remove"
                      type="button"
                      aria-label={t("overview.removeQuickWallet", { wallet: wallet.name })}
                      onClick={() => updatePinnedWallet(slotIndex, null)}
                    >
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <button
                    className="overview-pinned-wallet-add"
                    type="button"
                    onClick={() => setEditingPinnedWalletSlot(slotIndex)}
                    aria-label={t("overview.chooseQuickWallet", { slot: slotIndex + 1 })}
                  >
                    <span><Plus size={24} /></span>
                    <strong>{t("overview.chooseWallet")}</strong>
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel overview-currency-balances" aria-labelledby="currency-balances-heading">
        <div className="overview-pinned-wallets-heading">
          <div>
            <p className="eyebrow">{t("overview.glance")}</p>
            <h2 id="currency-balances-heading">{t("overview.currencyBalances")}</h2>
          </div>
          <small>{t("overview.currencyBalancesDescription")}</small>
        </div>
        <div className="overview-currency-balance-grid">
          {currencyBalances.map((group) => (
            <article className="overview-currency-balance" key={group.currency}>
              <button
                className="icon-button overview-currency-balance-hide"
                type="button"
                aria-label={t("overview.hideCurrency", { currency: group.currency })}
                onClick={() => hideCurrency(group.currency)}
              >
                <X size={15} />
              </button>
              <CurrencyBadge currency={group.currency} currencies={snapshot.currencies} />
              <div className="overview-currency-balance-summary">
                <strong>{group.currency}</strong>
                <small>{tp("common.wallets", group.wallets.length, { count: formatNumber(group.wallets.length) })}</small>
              </div>
              <div className="overview-currency-balance-total">
                <span>{t("wallets.totalBalance")}</span>
                <strong><MoneyAmount amount={group.balance} currency={group.currency} irrDisplayUnit={irrDisplayUnit} /></strong>
                <OverviewBalanceEquivalent amount={group.balance} from={group.currency} to={currency} rates={snapshot.rates} irrDisplayUnit={irrDisplayUnit} />
              </div>
            </article>
          ))}
          {hiddenCurrencyBalances.length > 0 && (
            <article className="overview-currency-balance is-add">
              <button
                type="button"
                aria-label={t("overview.addCurrency")}
                onClick={() => setCurrencyChooserOpen(true)}
              >
                <span><Plus size={24} /></span>
                <strong>{t("overview.addCurrency")}</strong>
              </button>
            </article>
          )}
        </div>
      </section>

      <ClarityPoints snapshot={snapshot} onNotice={onNotice} onEdit={onEditTransaction} onAdd={onAddTransaction} onOpenWallets={onOpenWallets}
        renderCategory={row => row.operation === "transaction"
          ? <><CategoryVisual category={snapshot.categories.find(category => category.id === row.categoryId)} name={row.category} size={14} /><span>{row.category}</span></>
          : <span className={`type-pill ${row.operation}`}>{t(`transactions.${row.operation}` as TranslationKey)}</span>} />

      <section className="content-grid">
        <article className="panel cashflow-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t("overview.historical")}</p>
              <h2>{t("overview.cashFlow")}</h2>
            </div>
            <div className="cashflow-heading-actions">
              <label className="cashflow-range-control">
                <span className="visually-hidden">{t("overview.cashFlowPeriod")}</span>
                <select value={cashflowPeriod} onChange={(event) => setCashflowPeriod(event.target.value as CashflowPeriod)}>
                  <option value="6m">{t("overview.past6Months")}</option>
                  <option value="1y">{t("overview.pastYear")}</option>
                  <option value="3y">{t("overview.past3Years")}</option>
                </select>
              </label>
              <div className="chart-legend"><span className="income-key" /> {t("common.income")} <span className="expense-key" /> {t("common.expense")}</div>
            </div>
          </div>
          <CashflowChart months={months} currency={currency} irrDisplayUnit={irrDisplayUnit} />
          <ConversionNotice transactions={snapshot.transactions.filter(row => row.date.slice(0, 7) >= (months[0]?.key ?? ""))} rates={snapshot.rates} currency={currency} />
        </article>

        <article className="panel wallet-summary">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t("overview.accounts")}</p>
              <h2>{t("overview.walletBalances")}</h2>
            </div>
            <details className="account-picker">
              <summary className="text-button">{t("overview.chooseWallets")}</summary>
              <div className="account-picker-menu">
                <div className="account-picker-actions">
                  <button type="button" onClick={() => updateVisibleWallets(null)}>{t("overview.selectAll")}</button>
                  <button type="button" onClick={() => updateVisibleWallets([])}>{t("overview.clear")}</button>
                </div>
                {walletsByCurrency(activeWallets).map((group) => (
                  <div className="wallet-picker-currency-group" key={group.currency}>
                    <strong>{group.currency}</strong>
                    {group.wallets.map((wallet) => (
                      <label key={wallet.id}>
                        <input
                          type="checkbox"
                          checked={selectedWalletIds === null || selectedWalletIds.includes(wallet.id)}
                          onChange={() => toggleVisibleWallet(wallet.id)}
                        />
                        <span>{wallet.name}</span>
                        <small><MoneyAmount amount={walletBalance(wallet.id, snapshot.transactions)} currency={wallet.currency} irrDisplayUnit={irrDisplayUnit} /></small>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          </div>
          <WalletBalancePieChart {...walletPie} currency={currency} irrDisplayUnit={irrDisplayUnit} />
          <div className="wallet-list" role="region" aria-label={t("overview.walletBalancesRegion")} tabIndex={0}>
            {visibleWallets.length === 0 ? (
              <div className="wallet-list-empty">{t("overview.chooseWalletEmpty")}</div>
            ) : (
              walletsByCurrency(visibleWallets).map((group) => (
                <section className="wallet-list-currency-group" key={group.currency}>
                  <h3>{group.currency}</h3>
                  {group.wallets.map((wallet) => {
                    const pieItem = walletPie.items.find((item) => item.id === wallet.id);
                    return (
                    <div className="wallet-row" key={wallet.id}>
                      <CurrencyBadge
                        currency={wallet.currency}
                        currencies={snapshot.currencies}
                        style={pieItem ? { boxShadow: `inset 4px 0 ${pieItem.color}` } : undefined}
                      />
                      <div>
                        <strong>{wallet.name}</strong>
                        {pieItem && (
                          <small>
                            <MoneyAmount amount={pieItem.value} currency="EUR" /> {t("overview.equivalent")}
                          </small>
                        )}
                      </div>
                      <b><MoneyAmount amount={walletBalance(wallet.id, snapshot.transactions)} currency={wallet.currency} irrDisplayUnit={irrDisplayUnit} /></b>
                    </div>
                    );
                  })}
                </section>
              ))
            )}
          </div>
          <div className="wallet-total">
            <span>{t("overview.selectedTotal")}</span>
            <strong><MoneyAmount amount={visibleWorth.value} currency={currency} irrDisplayUnit={irrDisplayUnit} /></strong>
            {visibleWorth.missing.length > 0 && (
              <small>{t("overview.missingRates", { currencies: visibleWorth.missing.join(", ") })}</small>
            )}
          </div>
        </article>
        <article className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t("overview.latestActivity")}</p>
              <h2>{t("overview.recentTransactions")}</h2>
            </div>
            <button className="text-button" onClick={onViewTransactions}>{t("overview.viewAll")} <ChevronRight className="directional-icon" size={16} /></button>
          </div>
          <TransactionTable
            activities={recent}
            rates={snapshot.rates}
            reportingCurrency={snapshot.settings.reportingCurrency}
            walletMap={walletMap}
            categories={snapshot.categories}
            currencies={snapshot.currencies}
            irrDisplayUnit={irrDisplayUnit}
            showJalali={snapshot.settings.showJalali}
            showActions={false}
            onEdit={onEditTransaction}
          />
        </article>
      </section>
      {editingPinnedWalletSlot !== null && (
        <WalletShortcutDialog
          wallets={activeWallets}
          currencies={snapshot.currencies}
          transactions={snapshot.transactions}
          irrDisplayUnit={irrDisplayUnit}
          selectedWalletIds={snapshot.settings.overviewPinnedWalletIds}
          currentSlot={editingPinnedWalletSlot}
          onChoose={(walletId) => updatePinnedWallet(editingPinnedWalletSlot, walletId)}
          onClose={() => setEditingPinnedWalletSlot(null)}
        />
      )}
      {currencyChooserOpen && (
        <CurrencyChooserDialog
          currencies={hiddenCurrencyBalances}
          allCurrencies={snapshot.currencies}
          irrDisplayUnit={irrDisplayUnit}
          onChoose={showCurrency}
          onClose={() => setCurrencyChooserOpen(false)}
        />
      )}
    </div>
  );
}

function CurrencyChooserDialog({
  currencies,
  allCurrencies,
  irrDisplayUnit,
  onChoose,
  onClose,
}: {
  currencies: Array<{ currency: string; wallets: Wallet[]; balance: Decimal }>;
  allCurrencies: Currency[];
  irrDisplayUnit: IrrDisplayUnit;
  onChoose: (currency: string) => void;
  onClose: () => void;
}) {
  const { t, tp, formatNumber } = useI18n();

  return (
    <Dialog title={t("overview.addCurrencyTitle")} eyebrow={t("overview.hiddenCurrencies")} onClose={onClose}>
      <div className="currency-chooser-list">
        <p>{t("overview.addCurrencyDescription")}</p>
        {currencies.map((group) => (
          <button type="button" key={group.currency} onClick={() => onChoose(group.currency)}>
            <CurrencyBadge currency={group.currency} currencies={allCurrencies} />
            <span>
              <strong>{group.currency}</strong>
              <small>{tp("common.wallets", group.wallets.length, { count: formatNumber(group.wallets.length) })}</small>
            </span>
            <b><MoneyAmount amount={group.balance} currency={group.currency} irrDisplayUnit={irrDisplayUnit} /></b>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

function WalletShortcutDialog({
  wallets,
  currencies,
  transactions,
  irrDisplayUnit,
  selectedWalletIds,
  currentSlot,
  onChoose,
  onClose,
}: {
  wallets: Wallet[];
  currencies: Currency[];
  transactions: Transaction[];
  irrDisplayUnit: IrrDisplayUnit;
  selectedWalletIds: Array<string | null>;
  currentSlot: number;
  onChoose: (walletId: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const selectedElsewhere = new Set(
    selectedWalletIds.filter((id, index): id is string => index !== currentSlot && id !== null),
  );

  return (
    <Dialog title={t("overview.chooseAWallet")} eyebrow={t("overview.quickWalletNumber", { slot: currentSlot + 1 })} className="wallet-shortcut-dialog" onClose={onClose}>
        <div className="wallet-shortcut-list">
          {walletsByCurrency(wallets).map((group) => (
            <section className="wallet-shortcut-currency-group" key={group.currency}>
              <h3>{group.currency}</h3>
              {group.wallets.map((wallet) => {
                const unavailable = selectedElsewhere.has(wallet.id);
                return (
                  <button type="button" key={wallet.id} disabled={unavailable} onClick={() => onChoose(wallet.id)}>
                    <CurrencyBadge currency={wallet.currency} currencies={currencies} />
                    <span><strong>{wallet.name}</strong><small>{unavailable ? t("overview.alreadyShown") : wallet.currency}</small></span>
                    <b><MoneyAmount amount={walletBalance(wallet.id, transactions)} currency={wallet.currency} irrDisplayUnit={irrDisplayUnit} /></b>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
    </Dialog>
  );
}

function WalletBalancePieChart({
  currency,
  irrDisplayUnit,
  items,
  total,
  missing,
  nonPositive,
}: {
  currency: string;
  irrDisplayUnit: IrrDisplayUnit;
  items: Array<{ id: string; name: string; currency: string; value: Decimal; color: string }>;
  total: Decimal;
  missing: string[];
  nonPositive: string[];
}) {
  const { locale, t, tp, formatNumber } = useI18n();
  const accessibleSummary = items.length === 0
    ? t("overview.noPositiveBalances")
    : items
        .map((item) => `${item.name}: ${formatMoney(item.value, currency, false, irrDisplayUnit, locale)}`)
        .join(", ");

  return (
    <div className="wallet-pie-section">
      <div className="wallet-pie-chart" role="img" aria-label={t("overview.walletChartLabel", { currency, total: formatMoney(total, currency, false, irrDisplayUnit, locale), summary: accessibleSummary })}>
        {items.length > 0 ? (
          <DonutChart items={items.map(item => ({ ...item, label: `${item.name}: ${formatMoney(item.value, currency, false, irrDisplayUnit, locale)}` }))} total={total} />
        ) : (
          <div className="wallet-pie-empty">{t("overview.noBalance")}<br />{t("overview.toChart")}</div>
        )}
        {items.length > 0 && (
          <div className="wallet-pie-total">
            <strong><MoneyAmount amount={total} currency={currency} irrDisplayUnit={irrDisplayUnit} /></strong>
            <span>{t("overview.totalShown")}</span>
            <small>{t("overview.reportingEquivalent", { currency: currency === "IRR" ? irrDisplayUnit : currency })}</small>
          </div>
        )}
      </div>
      {(missing.length > 0 || nonPositive.length > 0) && (
        <small className="wallet-pie-note">
          {missing.length > 0 && t("overview.missingChartRates", {
            count: formatNumber(missing.length),
            rates: tp("common.rateNoun", missing.length),
          })}
          {missing.length > 0 && nonPositive.length > 0 && " · "}
          {nonPositive.length > 0 && t("overview.nonPositiveExcluded", {
            count: formatNumber(nonPositive.length),
            balances: tp("common.balanceNoun", nonPositive.length),
          })}
        </small>
      )}
    </div>
  );
}

function categoryChartColor(category: string) {
  let hash = 0;
  for (const character of category) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return WALLET_CHART_COLORS[hash % WALLET_CHART_COLORS.length];
}

function ChartsView({ snapshot }: { snapshot: AppSnapshot }) {
  const { locale, t, tp, formatNumber } = useI18n();
  const currency = snapshot.settings.reportingCurrency;
  const irrDisplayUnit = snapshot.settings.irrDisplayUnit;
  const [direction, setDirection] = useState<"income" | "expense">("expense");
  const [savingCategories, setSavingCategories] = useState(false);
  const [filterError, setFilterError] = useState("");
  const chartWallets = useMemo(
    () => snapshot.wallets.filter((wallet) => !wallet.archived || transactionIndex(snapshot.transactions).walletCounts.has(wallet.id)),
    [snapshot.wallets, snapshot.transactions],
  );
  const [selectedWalletIds, setSelectedWalletIds] = useState<string[]>(() =>
    chartWallets.map((wallet) => wallet.id),
  );
  const [period, setPeriod] = useState<SpendingPeriod>("30d");
  const today = isoToday();
  const earliestTransactionDate = useMemo(
    () => snapshot.transactions.reduce(
      (earliest, transaction) => transaction.date < earliest ? transaction.date : earliest,
      today,
    ),
    [snapshot.transactions, today],
  );
  const [customStart, setCustomStart] = useState(rollingPeriodStart("30d", today));
  const [customEnd, setCustomEnd] = useState(today);
  const dateRange = useMemo(() => {
    if (period === "custom") return { start: customStart, end: customEnd };
    if (period === "all") return { start: earliestTransactionDate, end: today };
    return { start: rollingPeriodStart(period, today), end: today };
  }, [period, customStart, customEnd, earliestTransactionDate, today]);
  const analysis = useMemo(() => chartAnalysis(snapshot, { ...dateRange, walletIds: selectedWalletIds }), [snapshot, dateRange, selectedWalletIds]);
  const invalidRange = !analysis.validRange;
  const spending = {
    items: [...analysis.categories[direction].values()].sort((a, b) => b.value.comparedTo(a.value)).map((item) => ({
      id: item.id, category: item.type ? t("charts.transactionTypeSeries", { type: t(`activity.${item.type}` as TranslationKey) }) : item.label || t("charts.uncategorized"),
      value: item.value, color: item.category?.color ?? categoryChartColor(item.id), metadata: item.category, isType: Boolean(item.type),
    })),
    total: analysis.total[direction],
  };
  const excluded = new Set(snapshot.settings.chartExcludedCategoryIds);
  const chartCategories = useMemo(
    () => snapshot.categories.filter((category) => !category.archived || transactionIndex(snapshot.transactions).categoryCounts.has(category.id)),
    [snapshot.categories, snapshot.transactions],
  );
  const saveExclusions = async (next: string[]) => {
    if (savingCategories) return;
    setSavingCategories(true); setFilterError("");
    try { await setSetting("chartExcludedCategoryIds", [...new Set(next)].sort()); }
    catch (reason) { setFilterError(translatedErrorMessage(reason, t, "error.chartFilterSave")); }
    finally { setSavingCategories(false); }
  };
  const months = analysis.months.map((month, index) => {
    const date = new Date(`${month.key.length === 4 ? month.key + "-01" : month.key}-01T12:00:00`);
    const fullLabel = dateFormatter(locale, { calendar: "gregory", numberingSystem: "latn", ...(month.key.length === 4 ? {} : { month: "short" as const }), year: "numeric" }).format(date);
    return { ...month, fullLabel, label: analysis.months.length > 12 && index % 3 !== 0 ? "" : fullLabel };
  });
  const flowWallets = walletsByCurrency(snapshot.wallets.filter((wallet) => selectedWalletIds.includes(wallet.id))).flatMap((group) => group.wallets);
  const walletMaximum = Decimal.max(1, ...[...analysis.wallets.values()].flatMap((flow) => [flow.income, flow.expense]));
  const netTone = analysis.total.net.gt(0) ? "positive" : analysis.total.net.lt(0) ? "negative" : "neutral";

  const toggleWallet = (walletId: string) => {
    setSelectedWalletIds((current) =>
      current.includes(walletId)
        ? current.filter((id) => id !== walletId)
        : [...current, walletId],
    );
  };

  return (
    <div className="page-stack charts-page">
      <section className="panel chart-filter-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t("charts.analysis")}</p>
            <h2>{t("charts.title")}</h2>
            <p>{t("charts.exclusionNote")}</p>
          </div>
        </div>
        <div className="spending-filter-grid">
          <ChartPeriodPicker period={period} onChange={setPeriod} />
          <details className="account-picker chart-wallet-picker">
            <summary>
              <span>{t("charts.wallets")}</span>
              <strong>{t("charts.selectionCount", { selected: formatNumber(selectedWalletIds.length), total: formatNumber(chartWallets.length) })}</strong>
            </summary>
            <div className="account-picker-menu">
              <div className="account-picker-actions">
                <button type="button" onClick={() => setSelectedWalletIds(chartWallets.map((wallet) => wallet.id))}>{t("overview.selectAll")}</button>
                <button type="button" onClick={() => setSelectedWalletIds([])}>{t("overview.clear")}</button>
              </div>
              {walletsByCurrency(chartWallets).map((group) => (
                <div className="wallet-picker-currency-group" key={group.currency}>
                  <strong>{group.currency}</strong>
                  {group.wallets.map((wallet) => (
                    <label key={wallet.id}>
                      <input
                        type="checkbox"
                        checked={selectedWalletIds.includes(wallet.id)}
                        onChange={() => toggleWallet(wallet.id)}
                      />
                      <span>{wallet.name}{wallet.archived && <small> · {t("common.archived")}</small>}</span>
                      <small><MoneyAmount amount={walletBalance(wallet.id, snapshot.transactions)} currency={wallet.currency} irrDisplayUnit={irrDisplayUnit} /></small>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </details>
          <details className="account-picker chart-wallet-picker chart-category-picker">
            <summary><span>{t("charts.categories")}</span><strong>{t("charts.hiddenCount", { count: formatNumber(chartCategories.filter((c) => c.defaultReportable && excluded.has(c.id)).length) })}</strong></summary>
            <div className="account-picker-menu">
              <p>{t("charts.categoryFilterHelp")}</p>
              <button type="button" disabled={savingCategories || excluded.size === 0} onClick={() => void saveExclusions([])}>{t("charts.resetCategories")}</button>
              {groupCategories(chartCategories, (category) => category.group, locale).map((group) => (
                <div className="wallet-picker-currency-group" key={group.name ?? "ungrouped"}>
                  <strong>{group.name ?? t("groups.ungrouped")}</strong>
                  {group.members.sort((a, b) => a.name.localeCompare(b.name, locale)).map((category) => (
                    <label key={category.id}>
                      <input type="checkbox" checked={category.defaultReportable && !excluded.has(category.id)} disabled={savingCategories || !category.defaultReportable}
                        onChange={() => void saveExclusions(excluded.has(category.id) ? [...excluded].filter((id) => id !== category.id) : [...excluded, category.id])} />
                      <CategoryVisual category={category} name={category.name} size={14} /><span>{category.name}</span>
                      {!category.defaultReportable && <small>{t("settings.outOfReports")}</small>}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </details>
          {period === "custom" && (
            <>
              <label className="chart-filter-control">
                <span>{t("charts.from")}</span>
                <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
                {snapshot.settings.showJalali && <small>{jalaliDate(customStart, locale)}</small>}
              </label>
              <label className="chart-filter-control">
                <span>{t("charts.to")}</span>
                <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
                {snapshot.settings.showJalali && <small>{jalaliDate(customEnd, locale)}</small>}
              </label>
            </>
          )}
        </div>
        <div className={`chart-range-summary ${invalidRange ? "invalid" : ""}`}>
          {invalidRange
            ? t("charts.invalidRange")
            : t("charts.rangeSummary", {
                start: dateRange.start,
                end: dateRange.end,
                wallets: tp("common.wallets", selectedWalletIds.length, {
                  count: formatNumber(selectedWalletIds.length),
                }),
              })}
          {!invalidRange && snapshot.settings.showJalali && (
            <small>{jalaliDate(dateRange.start, locale)} — {jalaliDate(dateRange.end, locale)}</small>
          )}
        </div>
      </section>

      {filterError && <p className="chart-data-warning" role="alert">{filterError}</p>}
      {analysis.missing.length > 0 && <p className="chart-data-warning" role="status">{t("charts.missingRates", { currencies: analysis.missing.join(", ") })}</p>}
      {analysis.fallback.length > 0 && <p className="chart-data-info" role="status">{t("charts.nearestRates", { currencies: analysis.fallback.join(", ") })}</p>}
      <section className="panel charts-flow-panel">
        <div className="panel-heading"><div><p className="eyebrow">{t("charts.selectedPeriod")}</p><h2>{t("charts.totalCashFlow")}</h2><p>{t("charts.flowHelp")}</p></div></div>
        <div className="charts-flow-totals">
          {(["income", "expense", "net"] as const).map((key) => <div className={`charts-flow-total ${key}${key === "net" ? ` ${netTone}` : ""}`} key={key}>
            <span>{t(`charts.flow.${key}`)}</span><strong><MoneyAmount amount={analysis.total[key]} currency={currency} irrDisplayUnit={irrDisplayUnit} /></strong>
          </div>)}
        </div>
        {analysis.total.count > 0 ? <>
          <div className="charts-flow-legend"><span><i className="income" />{t("charts.flow.income")}</span><span><i className="expense" />{t("charts.flow.expense")}</span></div>
          <CashflowChart months={months} currency={currency} irrDisplayUnit={irrDisplayUnit} label={t("charts.totalCashFlow")} />
          <details className="charts-flow-data"><summary>{t("charts.viewFigures")}</summary><div className="table-scroll"><table><thead><tr><th>{t("charts.period")}</th><th>{t("charts.flow.income")}</th><th>{t("charts.flow.expense")}</th><th>{t("charts.flow.net")}</th></tr></thead><tbody>
            {months.map((month) => <tr key={month.key}><th scope="row">{month.fullLabel}</th>{(["income", "expense", "net"] as const).map((key) => <td key={key}><MoneyAmount amount={month[key]} currency={currency} irrDisplayUnit={irrDisplayUnit} /></td>)}</tr>)}
          </tbody></table></div></details>
        </> : <p className="chart-data-info">{selectedWalletIds.length ? t("charts.noFlow") : t("charts.chooseWallet")}</p>}
      </section>

      <section className="panel spending-breakdown-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t("charts.selectedPeriod")}</p>
            <h2>{direction === "income" ? t("charts.incomeByCategory") : t("charts.spendingByCategory")}</h2>
            <div className="chart-direction-switch" role="group" aria-label={t("charts.categoryShare")}>
              <button type="button" aria-pressed={direction === "expense"} onClick={() => setDirection("expense")}>{t("charts.flow.expense")}</button>
              <button type="button" aria-pressed={direction === "income"} onClick={() => setDirection("income")}>{t("charts.flow.income")}</button>
            </div>
          </div>
          <div className="spending-chart-summary">
            <strong><MoneyAmount amount={spending.total} currency={currency} irrDisplayUnit={irrDisplayUnit} /></strong>

          </div>
        </div>
        <CategorySpendingPieChart
          items={spending.items}
          total={spending.total}
          currency={currency}
          irrDisplayUnit={irrDisplayUnit}
          direction={direction}
          emptyMessage={selectedWalletIds.length === 0 ? t("charts.chooseWallet") : direction === "income" ? t("charts.noIncome") : t("charts.noSpending")}
        />
      </section>
      <section className="panel charts-flow-panel">
        <div className="panel-heading"><div><p className="eyebrow">{t("charts.selectedPeriod")}</p><h2>{t("charts.walletCashFlow")}</h2><p>{t("charts.walletFlowHelp")}</p></div></div>
        <div className="wallet-flow-list">
          {flowWallets.map((wallet) => {
            const flow = analysis.wallets.get(wallet.id);
            if (!flow) return null;
            return <article className="wallet-flow-row" key={wallet.id}>
              <div className="wallet-flow-name"><CurrencyBadge currency={wallet.currency} /><strong>{wallet.name}</strong></div>
              <div className="wallet-flow-values">{(["income", "expense", "net"] as const).map((key) => <div key={key}><span>{t(`charts.flow.${key}`)}</span><strong><MoneyAmount amount={flow[key]} currency={currency} irrDisplayUnit={irrDisplayUnit} /></strong></div>)}</div>
              <div className="wallet-flow-bars" aria-hidden="true"><span className="income" style={{ width: `${flow.income.div(walletMaximum).mul(100).toNumber()}%` }} /><span className="expense" style={{ width: `${flow.expense.div(walletMaximum).mul(100).toNumber()}%` }} /></div>
            </article>;
          })}
          {flowWallets.length === 0 && <p>{t("charts.chooseWallet")}</p>}
        </div>
      </section>
    </div>
  );
}

function CategorySpendingPieChart({
  items,
  total,
  currency,
  irrDisplayUnit,
  emptyMessage,
  direction,
}: {
  direction: "income" | "expense";
  items: Array<{ id: string; category: string; value: Decimal; color: string; metadata?: Pick<Category, "color" | "icon">; isType: boolean }>;
  total: Decimal;
  currency: string;
  irrDisplayUnit: IrrDisplayUnit;
  emptyMessage: string;
}) {
  const { locale, t } = useI18n();
  const accessibleSummary = items.length === 0
    ? emptyMessage
    : items
        .map((item) => `${item.category}: ${formatMoney(item.value, currency, false, irrDisplayUnit, locale)}`)
        .join(", ");

  if (items.length === 0) {
    return (
      <div className="category-chart-empty">
        <ChartPie size={34} strokeWidth={1.4} />
        <strong>{t("charts.noCategoryData")}</strong>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className="category-chart-layout">
      <div className="category-pie" role="img" aria-label={`${t(direction === "income" ? "charts.incomeByCategory" : "charts.spendingByCategory")}. ${accessibleSummary}`}>
        <DonutChart items={items.map(item => ({ ...item, label: `${item.category}: ${formatMoney(item.value, currency, false, irrDisplayUnit, locale)}` }))} total={total} />
        <div className="category-pie-total">
          <strong><MoneyAmount amount={total} currency={currency} compact irrDisplayUnit={irrDisplayUnit} /></strong>
          <span>{t(direction === "income" ? "charts.totalIncome" : "charts.totalSpent")}</span>
        </div>
      </div>
      <div className="category-pie-legend" tabIndex={0} role="region" aria-label={t("charts.categoryShare")}>
        {items.map((item) => (
          <div key={item.id} style={{ "--series-color": item.color } as CSSProperties}>
            {item.isType
              ? <i style={{ backgroundColor: item.color }} />
              : <CategoryVisual category={item.metadata} name={item.category} size={14} />}
            <span className="category-legend-name" title={item.category}>{item.category}<span className="category-share-track" aria-hidden="true"><span style={{ width: `${item.value.div(total).mul(100).toNumber()}%` }} /></span></span>
            <small>{item.value.div(total).mul(100).toFixed(1)}%</small>
            <strong><MoneyAmount amount={item.value} currency={currency} irrDisplayUnit={irrDisplayUnit} /></strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function monthlySeries(snapshot: AppSnapshot, monthCount: number, locale: string, today: string) {
  const currency = snapshot.settings.reportingCurrency;
  const nowDate = new Date(`${today}T12:00:00`);
  const months = Array.from({ length: monthCount }, (_, offset) => {
    const date = new Date(nowDate.getFullYear(), nowDate.getMonth() - (monthCount - 1 - offset), 1);
    const fullLabel = dateFormatter(locale, { calendar: "gregory", numberingSystem: "latn", month: "short", year: "numeric" }).format(date);
    const displayLabel = monthCount > 12
      ? (offset % 3 === 0 ? dateFormatter(locale, { calendar: "gregory", numberingSystem: "latn", month: "short", year: "2-digit" }).format(date) : "")
      : monthCount > 6
        ? dateFormatter(locale, { calendar: "gregory", numberingSystem: "latn", month: "short", year: "2-digit" }).format(date)
        : dateFormatter(locale, { calendar: "gregory", numberingSystem: "latn", month: "short" }).format(date);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: displayLabel,
      fullLabel,
      income: new Decimal(0),
      expense: new Decimal(0),
    };
  });
  const index = new Map(months.map((month) => [month.key, month]));
  for (const transaction of snapshot.transactions) {
    if (!transaction.reportable) continue;
    const month = index.get(transaction.date.slice(0, 7));
    if (!month) continue;
    const value = convert(
      transaction.amount,
      transaction.currency,
      currency,
      snapshot.rates,
      transaction.date,
    );
    if (!value) continue;
    if (reportDirection(transaction) === "income") month.income = month.income.plus(value);
    if (reportDirection(transaction) === "expense") month.expense = month.expense.plus(value);
  }
  return months;
}

function CashflowChart({
  months,
  currency,
  irrDisplayUnit,
  label,
}: {
  months: ReturnType<typeof monthlySeries>;
  label?: string;
  currency: string;
  irrDisplayUnit: IrrDisplayUnit;
}) {
  const { locale, t } = useI18n();
  const maximum = Decimal.max(
    1,
    ...months.flatMap((month) => [month.income, month.expense]),
  );
  return (
    <div className="cashflow-chart-scroll" tabIndex={0} role="region" aria-label={label ?? t("overview.cashFlow")}>
      <div
        className="cashflow-chart"
        aria-label={label ?? t("overview.chartIncomeExpense", { period: months.length === 6 ? t("overview.past6Months") : months.length === 12 ? t("overview.pastYear") : t("overview.past3Years") })}
        style={{
          gridTemplateColumns: months.length > 12
            ? `repeat(${months.length}, 32px)`
            : `repeat(${months.length}, minmax(32px, 1fr))`,
          width: "max-content",
          minWidth: "100%",
        }}
      >
        <div className="cashflow-gridlines" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        {months.map((month) => (
          <div className="chart-month" key={month.key} title={month.fullLabel}>
            <div className="bar-stack">
              <span
                className="bar income"
                style={{ height: `${month.income.div(maximum).mul(100).toNumber()}%` }} data-empty={month.income.isZero()}
                title={t("overview.chartMonthIncome", { month: month.fullLabel, amount: formatMoney(month.income, currency, false, irrDisplayUnit, locale) })}
              />
              <span
                className="bar expense"
                style={{ height: `${month.expense.div(maximum).mul(100).toNumber()}%` }} data-empty={month.expense.isZero()}
                title={t("overview.chartMonthExpense", { month: month.fullLabel, amount: formatMoney(month.expense, currency, false, irrDisplayUnit, locale) })}
              />
            </div>
            <span>{month.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransactionsView({
  snapshot,
  onEdit,
  onDuplicate,
  onBatchEdit,
  onNotice,
}: {
  snapshot: AppSnapshot;
  onEdit: (transaction: Transaction) => void;
  onDuplicate: (transaction: Transaction) => void;
  onBatchEdit: (transactions: Transaction[], count: number) => void;
  onNotice: (message: string) => void;
}) {
  const { t, tp, formatNumber } = useI18n();
  const requestConfirmation = useConfirmation();
  const [search, setSearch] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const [operation, setOperation] = useState("all");
  const [walletId, setWalletId] = useState("all");
  const [categoryId, setCategoryId] = useState("");
  const [period, setPeriod] = useState<SpendingPeriod>("all");
  const today = isoToday();
  const [customStart, setCustomStart] = useState(rollingPeriodStart("30d", today));
  const [customEnd, setCustomEnd] = useState(today);
  const [sortBy, setSortBy] = useState<TransactionSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TransactionPageSize>(initialTransactionPageSize);
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      window.localStorage.setItem(TRANSACTION_PAGE_SIZE_STORAGE_KEY, String(pageSize));
    } catch {
      // Ignore unavailable browser storage.
    }
  }, [pageSize]);
  const walletMap = useMemo(
    () => new Map(snapshot.wallets.map((wallet) => [wallet.id, wallet])),
    [snapshot.wallets],
  );
  const categoryOptions = useMemo(
    () => visibleCategoryOptions(snapshot.categories, snapshot.transactions),
    [snapshot.categories, snapshot.transactions],
  );
  const selectedCategory = categoryOptions.find((option) => option.key === categoryId);
  const dateRange = useMemo(() => {
    if (period === "all") return { start: "", end: "" };
    if (period === "custom") return { start: customStart, end: customEnd };
    return { start: rollingPeriodStart(period, today), end: today };
  }, [period, customStart, customEnd, today]);
  const validDateRange = period === "all" || Boolean(dateRange.start && dateRange.end && dateRange.start <= dateRange.end);
  const activities = useMemo(
    () => groupTransactionActivities(snapshot.transactions),
    [snapshot.transactions],
  );
  const { activities: sortedActivities, valuations } = useMemo(() => sortActivities(activities, sortBy, {
    rates: snapshot.rates, currency: snapshot.settings.reportingCurrency,
  }), [activities, sortBy, snapshot.rates, snapshot.settings.reportingCurrency]);
  const filtered = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    return sortedActivities
      .filter((activity) => {
        const rows = activity.rows;
        return (
          (period === "all" || (validDateRange && rows.some((transaction) => transaction.date >= dateRange.start && transaction.date <= dateRange.end))) &&
          (operation === "all" || rows.some((transaction) =>
            transaction.operation === operation || transaction.direction === operation)) &&
          (walletId === "all" || rows.some((transaction) => transaction.walletId === walletId)) &&
          (!selectedCategory || rows.some((transaction) => visibleCategoryOptionMatches(selectedCategory, transaction))) &&
          (!needle || rows.some((transaction) => {
            const wallet = walletMap.get(transaction.walletId);
            return transaction.note.toLowerCase().includes(needle) || (transaction.split && (transaction.split.note.toLowerCase().includes(needle) || t("split.title").toLowerCase().includes(needle))) ||
              transaction.category.toLowerCase().includes(needle) ||
              wallet?.name.toLowerCase().includes(needle);
          }))
        );
      });
  }, [sortedActivities, deferredSearch, period, dateRange, validDateRange, operation, walletId, selectedCategory, walletMap, t]);
  const activeFilterCount = Number(operation !== "all") + Number(walletId !== "all") + Number(Boolean(categoryId)) + Number(period !== "all") + Number(sortBy !== "newest");
  const hasGroupedActivities = filtered.some((activity) => activity.rows.length > 1);
  const sortCoverage = useMemo(() => {
    const coverage = { monthly: 0, estimated: 0, missing: 0 };
    if (valuations.size) for (const activity of filtered) {
      const value = valuations.get(activity.id);
      if (!value) coverage.missing++;
      else if (value.quality === "monthly") coverage.monthly++;
      else if (value.quality === "estimate") coverage.estimated++;
    }
    return coverage;
  }, [filtered, valuations]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  if (page !== currentPage) setPage(currentPage);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedActivities = useMemo(() => filtered.filter(activity => selectedActivityIds.has(activity.id)), [filtered, selectedActivityIds]);
  const selectedTotals = useMemo(() => {
    const totals = new Map<string, Decimal>();
    for (const activity of selectedActivities) {
      for (const transaction of activity.rows) {
        const current = totals.get(transaction.currency) ?? new Decimal(0);
        totals.set(transaction.currency, current.plus(money(transaction.amount).mul(transactionSign(transaction))));
      }
    }
    return [...totals.entries()].sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB));
  }, [selectedActivities]);
  const selectedTransactions = useMemo(
    () => transactionRowsForActivities(selectedActivities, snapshot.transactions),
    [selectedActivities, snapshot.transactions],
  );
  const allVisibleSelected = visible.length > 0 && visible.every((activity) => selectedActivityIds.has(activity.id));
  const someVisibleSelected = visible.some((activity) => selectedActivityIds.has(activity.id));

  const toggleActivitySelection = (activityId: string) => {
    setSelectedActivityIds((current) => {
      const next = new Set(current);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  };
  const toggleVisibleSelection = () => {
    setSelectedActivityIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visible.forEach((activity) => next.delete(activity.id));
      else visible.forEach((activity) => next.add(activity.id));
      return next;
    });
  };

  const changePageSize = (value: TransactionPageSize) => {
    setPageSize(value);
    setPage(1);
  };

  const remove = (transaction: Transaction) => {
    const linked = Boolean(
      transaction.linkId &&
      (transaction.operation === "transfer" || transaction.operation === "exchange"),
    );
    const expected = snapshot.transactions.filter(row => transaction.split
      ? row.split?.id === transaction.split.id
      : linked ? row.linkId === transaction.linkId : row.id === transaction.id);
    requestConfirmation({ title: t("dialog.deleteTransaction"), confirmLabel: t("common.delete"), errorKey: "error.activitySave",
      description: transaction.split ? t("split.deleteConfirm") : linked ? t("notice.deleteLinked") : t("notice.deleteTransaction"),
      onConfirm: async () => {
        await db.transaction("rw", db.transactions, async () => {
          await assertStoredActivitiesUnchanged(expected);
          await db.transactions.bulkDelete(expected.map(row => row.id));
        });
        onNotice(linked ? t("notice.linkedDeleted") : t("notice.transactionDeleted"));
      },
    });
  };

  const removeSelected = () => requestConfirmation({
    title: t("transactions.deleteSelected"), confirmLabel: t("common.delete"), errorKey: "error.activitySave",
    description: t("notice.deleteSelectedTransactions", { count: formatNumber(selectedActivities.length) }),
    onConfirm: async () => {
      await db.transaction("rw", db.transactions, async () => {
        await assertStoredActivitiesUnchanged(selectedTransactions);
        await db.transactions.bulkDelete(selectedTransactions.map(row => row.id));
      });
      setSelectedActivityIds(new Set());
      onNotice(t("notice.selectedTransactionsDeleted", { count: formatNumber(selectedActivities.length) }));
    },
  });

  return (
    <section className="panel data-panel" aria-busy={search !== deferredSearch}>
      <div className={`filterbar${filtersExpanded ? " filters-expanded" : ""}`}>
        <div className="filterbar-primary">
          <label className="filter-control search-field">
            <span className="filter-control-label">{t("transactions.search")}</span>
            <span className="filter-control-input">
              <Search size={17} />
              <SearchField id="transaction-search" value={search} onValueChange={value => { setSearch(value); setPage(1); }} label={t("transactions.search")} placeholder={t("transactions.searchPlaceholder")} />
            </span>
          </label>
          <button className="button secondary filters-toggle" aria-expanded={filtersExpanded} aria-controls="transaction-type-filter transaction-wallet-filter transaction-secondary-filters" onClick={() => setFiltersExpanded(value => !value)}>
            <ListFilter size={17} /> {t("transactions.filters")}{activeFilterCount > 0 && <span className="filter-count">{formatNumber(activeFilterCount)}</span>}<ChevronDown size={16} />
          </button>
          <label className="filter-control filter-option" id="transaction-type-filter">
            <span className="filter-control-label">{t("transactions.type")}</span>
            <select value={operation} onChange={(event) => { setOperation(event.target.value); setPage(1); }} aria-label={t("transactions.filterType")}>
              <option value="all">{t("transactions.allTypes")}</option>
              <option value="income">{t("transactions.income")}</option>
              <option value="expense">{t("transactions.expense")}</option>
              <option value="transfer">{t("transactions.transfers")}</option>
              <option value="exchange">{t("transactions.exchanges")}</option>
              {snapshot.transactions.some((transaction) => transaction.operation === "fee") && <option value="fee">{t("transactions.fees")}</option>}
              {snapshot.transactions.some((transaction) => transaction.operation === "adjustment") && <option value="adjustment">{t("transactions.adjustments")}</option>}
            </select>
          </label>
          <label className="filter-control filter-option" id="transaction-wallet-filter">
            <span className="filter-control-label">{t("transactions.wallet")}</span>
            <select value={walletId} onChange={(event) => { setWalletId(event.target.value); setPage(1); }} aria-label={t("transactions.filterWallet")}>
              <option value="all">{t("transactions.allWallets")}</option>
              <WalletOptionGroups wallets={snapshot.wallets} transactions={snapshot.transactions} irrDisplayUnit={snapshot.settings.irrDisplayUnit} />
            </select>
          </label>
        </div>
        <div id="transaction-secondary-filters" className={`filterbar-secondary${period === "custom" ? " has-custom-period" : ""}`}>
          <div className={`filter-control period-control${period === "custom" ? " is-custom" : ""}`}>
            <span className="filter-control-label">{t("transactions.period")}</span>
            <div className="period-control-body">
              <select value={period} onChange={(event) => { setPeriod(event.target.value as SpendingPeriod); setPage(1); }} aria-label={t("transactions.period")}>
                <option value="30d">{t("transactions.past30Days")}</option>
                <option value="3m">{t("transactions.past3Months")}</option>
                <option value="6m">{t("transactions.past6Months")}</option>
                <option value="1y">{t("transactions.pastYear")}</option>
                <option value="3y">{t("transactions.past3Years")}</option>
                <option value="all">{t("transactions.allTime")}</option>
                <option value="custom">{t("transactions.customPeriod")}</option>
              </select>
              {period === "custom" && <div className="transaction-period-custom">
                <label><span>{t("transactions.from")}</span><input type="date" value={customStart} onChange={(event) => { setCustomStart(event.target.value); setPage(1); }} /></label>
                <label><span>{t("transactions.to")}</span><input type="date" value={customEnd} onChange={(event) => { setCustomEnd(event.target.value); setPage(1); }} /></label>
              </div>}
            </div>
          </div>
          <div className="filter-control category-filter-control">
            <span className="filter-control-label">{t("transactions.category")}</span>
            <CategoryFilterPicker
              categories={snapshot.categories}
              options={categoryOptions}
              value={categoryId}
              allLabel={t("transactions.allCategories")}
              historicalLabel={t("transactions.historicalCategory")}
              onChange={(value) => { setCategoryId(value); setPage(1); }}
            />
          </div>
          <label className="filter-control">
            <span className="filter-control-label">{t("transactions.sort")}</span>
            <select className="transaction-sort-control" value={sortBy} onChange={(event) => { setSortBy(event.target.value as TransactionSort); setPage(1); }} aria-label={t("transactions.sortBy")} aria-describedby={sortBy.startsWith("amount-") ? "transaction-sort-note" : undefined}>
              <option value="newest">{t("transactions.sortNewest")}</option>
              <option value="oldest">{t("transactions.sortOldest")}</option>
              <option value="amount-high">{t("transactions.sortAmount")}</option>
              <option value="amount-low">{t("transactions.sortAmountLow")}</option>
            </select>
          </label>
        </div>
        <div className="filterbar-footer">
          {activeFilterCount > 0 && <button className="text-button filter-reset" onClick={() => { setOperation("all"); setWalletId("all"); setCategoryId(""); setPeriod("all"); setSortBy("newest"); setPage(1); }}>{t("transactions.resetFilters")}</button>}
          <span className="result-count" aria-live="polite">
            <span>{tp("transactions.showing", filtered.length, { count: formatNumber(filtered.length) })}</span>
            {hasGroupedActivities && <>
              <span className="result-count-divider" aria-hidden="true">|</span>
              <small className="result-count-note">{t("transactions.activityCountNote")}</small>
            </>}
          </span>
        </div>
        {sortBy.startsWith("amount-") && <p id="transaction-sort-note" className="transaction-sort-note" role="status">
          {t("transactions.sortValueBasis", { currency: snapshot.settings.reportingCurrency })}
          {sortCoverage.monthly > 0 && <> {t("transactions.sortMonthly", { count: formatNumber(sortCoverage.monthly) })}</>}
          {sortCoverage.estimated > 0 && <> {t("transactions.sortEstimated", { count: formatNumber(sortCoverage.estimated) })}</>}
          {sortCoverage.missing > 0 && <> {t("transactions.sortMissing", { count: formatNumber(sortCoverage.missing) })}</>}
        </p>}
      </div>
      {!validDateRange && <p className="transaction-period-error" role="alert">{t("transactions.invalidPeriod")}</p>}
      {selectedActivities.length > 0 && <div className="transaction-selection-summary" aria-live="polite">
        <div><strong>{t("transactions.selectedTotal")}</strong><span>{tp("common.transactions", selectedActivities.length, { count: formatNumber(selectedActivities.length) })}</span></div>
        <div className="transaction-selection-totals">
          {selectedTotals.map(([currency, total]) => <span key={currency}><MoneyAmount amount={total} currency={currency} irrDisplayUnit={snapshot.settings.irrDisplayUnit} /></span>)}
        </div>
        <div className="transaction-selection-actions">
          <button className="button secondary small" type="button" onClick={() => onBatchEdit(selectedTransactions, selectedActivities.length)}><Pencil size={16} /> {t("transactions.editSelected")}</button>
          <button className="button danger small" type="button" onClick={removeSelected}><Trash2 size={16} /> {t("transactions.deleteSelected")}</button>
          <button className="text-button" type="button" onClick={() => setSelectedActivityIds(new Set())}>{t("transactions.clearSelection")}</button>
        </div>
      </div>}
      <TransactionTable
        activities={visible}
        rates={snapshot.rates}
        reportingCurrency={snapshot.settings.reportingCurrency}
        categoryFilter={selectedCategory}
        walletMap={walletMap}
        categories={snapshot.categories}
        currencies={snapshot.currencies}
        irrDisplayUnit={snapshot.settings.irrDisplayUnit}
        showJalali={snapshot.settings.showJalali}
        showActions
        selectable
        selectedIds={selectedActivityIds}
        allSelected={allVisibleSelected}
        someSelected={someVisibleSelected}
        onToggleSelected={toggleActivitySelection}
        onToggleAll={toggleVisibleSelection}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={remove}
      />
      <div className="pagination">
        <label className="pagination-page-size">
          <span>{t("transactions.rowsPerPage")}</span>
          <select
            value={pageSize}
            onChange={(event) => changePageSize(Number(event.target.value) as TransactionPageSize)}
            aria-label={t("transactions.rowsPerPage")}
          >
            {TRANSACTION_PAGE_SIZES.map((size) => <option value={size} key={size}>{formatNumber(size)}</option>)}
          </select>
        </label>
        <span>{t("transactions.page", { page: formatNumber(currentPage), pages: formatNumber(pages) })}</span>
        <div>
          <button className="icon-button" aria-label={t("transactions.previousPage")} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="directional-icon" size={18} /></button>
          <button className="icon-button" aria-label={t("transactions.nextPage")} disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRight className="directional-icon" size={18} /></button>
        </div>
      </div>
    </section>
  );
}

function canDuplicateTransaction(transaction: Transaction) {
  if (transaction.operation === "transaction" || transaction.operation === "adjustment") return true;
  return Boolean(
    transaction.linkId &&
    (transaction.operation === "transfer" || transaction.operation === "exchange"),
  );
}

/** Renders rates.currentAndChange with the numbers as LTR units, so a sign or % cannot move in right-to-left text. */
function RateChange({ current, change }: { current: string; change: string }) {
  const { t } = useI18n();
  const parts = t("rates.currentAndChange", { current: "\uE000", change: "\uE001" }).split(/([\uE000\uE001])/);
  return <>{parts.map((part, index) => {
    if (part === "\uE000") return <bdi dir="ltr" key={index}>{current}</bdi>;
    if (part === "\uE001") return <bdi dir="ltr" key={index}>{change}%</bdi>;
    return parts[index - 1] === "\uE001" ? part.replace(/^%/, "") : part;
  })}</>;
}

function TransactionEquivalent({ transaction, amount, rates, currency, irrDisplayUnit }: { transaction: Transaction; amount: string; rates: Rate[]; currency: string; irrDisplayUnit: IrrDisplayUnit }) {
  const { t } = useI18n();
  if (transaction.currency === currency) return null;
  const converted = convertWithRateFallback(amount, transaction.currency, currency, rates, transaction.date);
  return <small className="transaction-equivalent" title={t("history.datedEquivalent")}>
    {converted ? <><bdi dir="ltr">{transactionSign(transaction) > 0 ? "+" : "−"}<MoneyAmount amount={converted.value} currency={currency} irrDisplayUnit={irrDisplayUnit} /></bdi>{converted.quality === "estimate" ? ` · ${t("history.estimate")}` : converted.quality === "monthly" ? ` · ${t("history.monthlyUsed")}` : converted.quality === "previous" ? ` · ${t("history.previousUsed")}` : ""}</> : t("wallets.rateUnavailable")}
  </small>;
}

function ConversionNotice({ transactions, rates, currency }: { transactions: Transaction[]; rates: Rate[]; currency: string }) {
  const { t } = useI18n();
  let monthly = 0; let estimated = 0; let missing = 0;
  for (const row of transactions) {
    if (!row.reportable || row.currency === currency) continue;
    const result = convertWithRateFallback(row.amount, row.currency, currency, rates, row.date);
    if (!result) missing++; else if (result.quality === "estimate") estimated++; else if (result.quality === "monthly") monthly++;
  }
  return monthly + estimated + missing > 0 ? <p className="conversion-note" role="status">{t("history.conversionNotice", { monthly, estimated, missing })}</p> : null;
}

function TransactionTable({
  activities,
  rates,
  reportingCurrency,
  walletMap,
  categories,
  currencies,
  irrDisplayUnit,
  showJalali,
  showActions,
  selectable = false,
  selectedIds,
  allSelected = false,
  someSelected = false,
  onToggleSelected,
  onToggleAll,
  onEdit,
  onDuplicate,
  onDelete,
  categoryFilter,
}: {
  rates: Rate[];
  reportingCurrency: string;
  categoryFilter?: VisibleCategoryOption;
  activities: TransactionActivity[];
  walletMap: Map<string, Wallet>;
  categories: Category[];
  currencies: Currency[];
  irrDisplayUnit: IrrDisplayUnit;
  showJalali: boolean;
  showActions: boolean;
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  allSelected?: boolean;
  someSelected?: boolean;
  onToggleSelected?: (activityId: string) => void;
  onToggleAll?: () => void;
  onEdit: (transaction: Transaction) => void;
  onDuplicate?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
}) {
  const { locale, t } = useI18n();
  if (activities.length === 0) return <div className="no-results">{t("transactions.noMatches")}</div>;
  return (
    <div className="table-scroll transaction-scroll">
      {selectable && <label className="transaction-mobile-tools"><input type="checkbox" checked={allSelected} aria-checked={someSelected && !allSelected ? "mixed" : allSelected} onChange={onToggleAll} />{t("transactions.selectAll")}</label>}
      <table role="table" aria-label={t("nav.transactions")} className={`transaction-table${selectable ? " is-selectable" : ""}`}>
        <thead role="rowgroup"><tr role="row">{selectable && <th scope="col" role="columnheader" className="selection-cell"><input type="checkbox" checked={allSelected} aria-checked={someSelected && !allSelected ? "mixed" : allSelected} aria-label={t("transactions.selectAll")} onChange={onToggleAll} /></th>}<th scope="col" role="columnheader">{t("transactions.date")}</th><th scope="col" role="columnheader">{t("transactions.wallet")}</th><th scope="col" role="columnheader">{t("transactions.details")}</th><th scope="col" role="columnheader">{t("transactions.type")}</th><th scope="col" role="columnheader" className="amount-cell">{t("transactions.amount")}</th><th scope="col" role="columnheader"><span className="visually-hidden">{t("transactions.actions")}</span></th></tr></thead>
        <tbody role="rowgroup">
          {activities.map((activity) => {
            const transaction = activity.primary;
            const isSplit = Boolean(transaction.split && activity.rows.length > 1);
            const wallet = walletMap.get(transaction.walletId);
            const exchangeOut = activity.exchangeOut;
            const exchangeIn = activity.exchangeIn;
            const exchangeFromWallet = exchangeOut ? walletMap.get(exchangeOut.walletId) : undefined;
            const exchangeToWallet = exchangeIn ? walletMap.get(exchangeIn.walletId) : undefined;
            const displaySentAmount = exchangeOut
              ? money(amountForDisplayInput(exchangeOut.amount, exchangeOut.currency, irrDisplayUnit))
              : null;
            const effectiveRate = exchangeOut && exchangeIn && displaySentAmount && !displaySentAmount.isZero()
              ? money(amountForDisplayInput(exchangeIn.amount, exchangeIn.currency, irrDisplayUnit))
                .div(displaySentAmount)
                .toSignificantDigits(12)
                .toString()
              : null;
            const exchangeFromUnit = exchangeOut?.currency === "IRR" ? irrDisplayUnit : exchangeOut?.currency;
            const exchangeToUnit = exchangeIn?.currency === "IRR" ? irrDisplayUnit : exchangeIn?.currency;
            const positive = transactionSign(transaction) > 0;
            const activityClass = transaction.operation === "transaction"
              ? transaction.direction
              : transaction.operation;
            const detailLabel = isSplit ? t("split.summary", { count: activity.rows.length }) : exchangeOut && exchangeIn
              ? `${exchangeOut.currency} → ${exchangeIn.currency}`
              : isConfigurableTransactionType(transaction.operation)
                ? t(DIRECTION_LABEL_KEYS[transaction.direction])
                : transaction.category;
            const detailCategory = transaction.operation === "transaction"
              ? transaction.categoryId
                ? categories.find((category) => category.id === transaction.categoryId)
                : categoryForName(transaction.category, categories)
              : undefined;
            return (
              <tr role="row" className={`${transaction.direction === "income" ? "income-row" : ""}${selectedIds?.has(activity.id) ? " is-selected" : ""}`} key={activity.id} onDoubleClick={() => onEdit(transaction)}>
                {selectable && <td role="cell" className="selection-cell"><label className="activity-select"><input type="checkbox" checked={selectedIds?.has(activity.id) ?? false} aria-label={t("transactions.selectActivity", { category: detailLabel })} onChange={() => onToggleSelected?.(activity.id)} /></label></td>}
                <td role="cell" className="transaction-date"><strong>{transaction.date}</strong>{showJalali && <small>{jalaliDate(transaction.date, locale)}</small>}</td>
                <td role="cell" className="transaction-wallet">{exchangeOut && exchangeIn ? <div className="exchange-wallet-route"><span className="wallet-name"><CurrencyDot currency={exchangeOut.currency} currencies={currencies} />{exchangeFromWallet?.name ?? t("common.unknown")}</span><ArrowLeftRight size={14} aria-hidden="true" /><span className="wallet-name"><CurrencyDot currency={exchangeIn.currency} currencies={currencies} />{exchangeToWallet?.name ?? t("common.unknown")}</span></div> : <span className="wallet-name"><CurrencyDot currency={transaction.currency} currencies={currencies} />{wallet?.name ?? t("common.unknown")}</span>}</td>
                <td role="cell" className="transaction-details">
                  {isSplit ? <><details className="split-details" onDoubleClick={event => event.stopPropagation()}>
                    <summary><Split size={16} /><strong>{detailLabel}</strong><ChevronDown size={14} /></summary>
                    <div className="split-breakdown">{activity.rows.map(row => <div className="split-breakdown-line" key={row.id}>
                      <CategoryVisual category={categories.find(c => c.id === row.categoryId)} name={row.category} size={15} />
                      <div><strong>{row.category}</strong>{row.note && <small>{row.note}</small>}{!row.reportable && <small className="split-report-note">{t("split.excluded")}</small>}</div>
                      <MoneyAmount amount={row.amount} currency={row.currency} irrDisplayUnit={irrDisplayUnit} />
                    </div>)}</div>
                  </details>{transaction.split?.note && <small>{transaction.split.note}</small>}</> : <><div className="transaction-detail-label">
                    {transaction.operation === "transaction" && <CategoryVisual category={detailCategory} name={detailLabel} size={15} />}
                    <strong>{detailLabel}</strong>
                  </div><small>{transaction.note || t("transactions.noNote")}</small></>}

                </td>
                <td role="cell" className="transaction-type"><span className={`type-pill ${activityClass}`}>{transaction.operation === "transaction" ? t(transaction.direction === "income" ? "transactions.income" : "transactions.expense") : t(`transactions.${transaction.operation}` as TranslationKey)}</span></td>
                <td role="cell" className={`amount-cell ${exchangeOut && exchangeIn ? "exchange-activity-amount" : ""} ${positive ? "positive" : "negative"} ${activityClass}`}>
                  {exchangeOut && exchangeIn ? <div className="exchange-amount-pair"><strong>−<MoneyAmount amount={exchangeOut.amount} currency={exchangeOut.currency} irrDisplayUnit={irrDisplayUnit} /></strong><strong>+<MoneyAmount amount={exchangeIn.amount} currency={exchangeIn.currency} irrDisplayUnit={irrDisplayUnit} /></strong>{effectiveRate && <small>{t("activity.effectiveRate", { from: exchangeFromUnit ?? "", rate: effectiveRate, to: exchangeToUnit ?? "" })}</small>}</div> : <><strong>{positive ? "+" : "−"}<MoneyAmount amount={activityAmount(activity.rows)} currency={transaction.currency} irrDisplayUnit={irrDisplayUnit} /></strong>{!transaction.affectsBalance && <small>{t("transactions.reportOnly")}</small>}</>}
                  {exchangeOut && exchangeIn ? <>
                    <TransactionEquivalent transaction={exchangeOut} amount={exchangeOut.amount} rates={rates} currency={reportingCurrency} irrDisplayUnit={irrDisplayUnit} />
                    <TransactionEquivalent transaction={exchangeIn} amount={exchangeIn.amount} rates={rates} currency={reportingCurrency} irrDisplayUnit={irrDisplayUnit} />
                  </> : <TransactionEquivalent transaction={transaction} amount={activityAmount(activity.rows).toString()} rates={rates} currency={reportingCurrency} irrDisplayUnit={irrDisplayUnit} />}
                  {isSplit && categoryFilter && <small>{t("split.categoryAmount")} <MoneyAmount amount={activity.rows.filter(row => visibleCategoryOptionMatches(categoryFilter, row)).reduce((sum, row) => sum.plus(row.amount), money(0)).toString()} currency={transaction.currency} irrDisplayUnit={irrDisplayUnit} /></small>}
                </td>
                <td role="cell" className="row-actions"><div className="row-actions-inner"><button className="icon-button" aria-label={t("transactions.edit", { category: detailLabel })} onClick={() => onEdit(transaction)}><Pencil size={16} /></button>{showActions && onDuplicate && canDuplicateTransaction(transaction) && <button className="icon-button" aria-label={t("transactions.duplicate", { category: detailLabel })} onClick={() => onDuplicate(transaction)}><Copy size={16} /></button>}{showActions && <button className="icon-button danger" aria-label={t("transactions.delete", { category: detailLabel })} onClick={() => onDelete?.(transaction)}><Trash2 size={16} /></button>}</div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WalletsView({ snapshot, editing, setEditing, onAddTransaction, onNotice }: { snapshot: AppSnapshot; editing: Wallet | null | undefined; setEditing: (wallet: Wallet | null | undefined) => void; onAddTransaction: (walletId: string) => void; onNotice: (message: string) => void }) {
  const { t, tp, formatNumber } = useI18n();
  const requestConfirmation = useConfirmation();
  const reportingCurrency = snapshot.settings.reportingCurrency;
  const chooseDefaultWallet = async (wallet: Wallet) => {
    try {
      await setDefaultWallet(wallet.id);
      onNotice(t("notice.defaultWallet", { wallet: wallet.name }));
    } catch (reason) { onNotice(translatedErrorMessage(reason, t, "error.walletSave")); }
  };
  const removeWallet = async (wallet: Wallet) => {
    if (isProtectedMainWallet(wallet.id, snapshot.settings.mainWalletId)) {
      onNotice(t("notice.mainWalletProtected"));
      return;
    }
    const count = (transactionIndex(snapshot.transactions).walletCounts.get(wallet.id) ?? 0);
    try {
      if (wallet.archived || count > 0) {
        await setWalletArchived(wallet.id, !wallet.archived);
        onNotice(t(wallet.archived ? "notice.walletRestored" : "notice.walletArchived"));
      } else requestConfirmation({
        title: t("wallets.delete", { wallet: wallet.name }), description: t("notice.deleteWallet", { wallet: wallet.name }),
        confirmLabel: t("common.delete"), errorKey: "error.walletSave",
        onConfirm: async () => {
          await deleteUnusedWallet(wallet.id);
          onNotice(t("notice.walletDeleted"));
        },
      });
    } catch (reason) { onNotice(translatedErrorMessage(reason, t, "error.walletSave")); }
  };
  return (
    <div className="page-stack">
      <div className="section-intro"><div><p>{t("wallets.nativeIntro")}</p><span>{t("wallets.archiveIntro")}</span></div></div>
      <div className="wallet-currency-groups">
        {walletsByCurrency(snapshot.wallets).map((group) => {
          const groupBalance = group.wallets.reduce(
            (total, wallet) => total.plus(walletBalance(wallet.id, snapshot.transactions)),
            new Decimal(0),
          );
          return (
            <section className="wallet-currency-group" key={group.currency} aria-labelledby={`wallet-group-${group.currency}`} style={{ "--wallet-tint": mixColor(currencyAccentColor(group.currency, snapshot.currencies), "#FFFFFF", 0.94) } as CSSProperties}>
              <header>
                <h2 id={`wallet-group-${group.currency}`}><CurrencyBadge currency={group.currency} currencies={snapshot.currencies} /><small>{tp("common.wallets", group.wallets.length, { count: formatNumber(group.wallets.length) })}</small></h2>
                <div className="wallet-currency-total"><span>{t("wallets.totalBalance")}</span><strong><MoneyAmount amount={groupBalance} currency={group.currency} irrDisplayUnit={snapshot.settings.irrDisplayUnit} /></strong></div>
              </header>
              <div className="wallet-grid">
                {group.wallets.map((wallet) => {
                  const nativeBalance = walletBalance(wallet.id, snapshot.transactions);
                  const reportingBalance = convert(nativeBalance, wallet.currency, reportingCurrency, snapshot.rates);
                  const isDefault = snapshot.settings.defaultWalletId === wallet.id;
                  const isMain = snapshot.settings.mainWalletId === wallet.id;
                  const transactionCount = transactionIndex(snapshot.transactions).walletCounts.get(wallet.id) ?? 0;
                  return (
                  <article className={`wallet-card ${wallet.archived ? "archived" : ""} ${isDefault ? "is-default" : ""} ${isMain ? "is-main" : ""}`} key={wallet.id}>
                    <header className="wallet-card-top">
                      <div className="wallet-card-identity">
                        <h3 dir="auto">{wallet.name}</h3>
                      </div>
                      <div className="wallet-card-tools">
                        <button className="icon-button" aria-label={t("wallets.edit", { wallet: wallet.name })} onClick={() => setEditing(wallet)}><Pencil size={16} /></button>
                        {isMain ? <span className="icon-button static" role="img" title={t("wallets.mainProtected")} aria-label={t("wallets.mainProtected")}><LockKeyhole size={16} aria-hidden="true" /></span> : <button className={`icon-button${!wallet.archived && transactionCount === 0 ? " danger" : ""}`} aria-label={t(wallet.archived ? "wallets.restore" : transactionCount > 0 ? "wallets.archive" : "wallets.delete", { wallet: wallet.name })} onClick={() => removeWallet(wallet)}>{wallet.archived ? <RotateCcw size={16} /> : transactionCount > 0 ? <Archive size={16} /> : <Trash2 size={16} />}</button>}
                      </div>
                    </header>
                    <div className="wallet-card-balances">
                      <div className="wallet-card-native-balance"><span>{t("wallets.nativeBalance")}</span><strong><MoneyAmount amount={nativeBalance} currency={wallet.currency} irrDisplayUnit={snapshot.settings.irrDisplayUnit} /></strong></div>
                      {wallet.currency !== reportingCurrency && <div className="wallet-card-reporting-balance"><span>{t("wallets.inReportingCurrency", { currency: reportingCurrency })}</span><strong>{reportingBalance ? <MoneyAmount amount={reportingBalance} currency={reportingCurrency} irrDisplayUnit={snapshot.settings.irrDisplayUnit} /> : t("wallets.rateUnavailable")}</strong></div>}
                    </div>
                    <div className="wallet-card-meta">
                      <small>{tp("common.transactions", transactionCount, { count: formatNumber(transactionCount) })}{wallet.archived ? ` · ${t("common.archived")}` : ""}</small>
                      {(isMain || isDefault) && <div className="wallet-badges">{isMain && <span className="wallet-main-badge"><ShieldCheck size={13} /> {t("wallets.main")}</span>}{isDefault && <span className="wallet-default-badge"><Star size={13} fill="currentColor" /> {t("wallets.default")}</span>}</div>}
                    </div>
                    {!wallet.archived && (
                      <div className="wallet-card-actions">
                        <button className="button small secondary" disabled={isDefault} onClick={() => chooseDefaultWallet(wallet)}>
                          <Star size={15} /> {isDefault ? t("wallets.default") : t("wallets.setDefault")}
                        </button>
                        <button className="button small affirmative" onClick={() => onAddTransaction(wallet.id)}>
                          <Plus size={15} /> {t("wallets.addTransaction")}
                        </button>
                      </div>
                    )}
                  </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {editing !== undefined && <WalletDialog wallet={editing} snapshot={snapshot} onClose={() => setEditing(undefined)} onSaved={async () => { setEditing(undefined);  onNotice(t("notice.walletSaved")); }} />}
    </div>
  );
}

function UnchartedView({ snapshot, onPromote, onNotice }: { snapshot: AppSnapshot; onPromote: (entry: UnchartedEntry) => void; onNotice: (message: string) => void }) {
  const { locale, t, tp, formatNumber } = useI18n();
  const requestConfirmation = useConfirmation();
  const [editing, setEditing] = useState<UnchartedEntry | null | undefined>(undefined);
  const openCount = snapshot.uncharted.filter((entry) => entry.status === "open").length;
  const orderedEntries = [...snapshot.uncharted].sort(
    (left, right) =>
      Number(left.status === "retrieved") - Number(right.status === "retrieved") ||
      right.date.localeCompare(left.date),
  );
  const remove = (entry: UnchartedEntry) => requestConfirmation({
    title: t("uncharted.delete"), description: t("notice.deleteUncharted"),
    confirmLabel: t("common.delete"), errorKey: "error.unchartedSave",
    onConfirm: async () => {
      await deleteUnchartedEntry(entry);
      onNotice(t("notice.unchartedDeleted"));
    },
  });
  return (
    <div className="page-stack uncharted-page">
      <section className="uncharted-banner"><div><span className="uncharted-icon"><CircleHelp size={24} /></span><div><p className="eyebrow">{t("uncharted.staging")}</p><h2>{t("uncharted.title")}</h2><p>{t("uncharted.description")}</p></div></div><button className="button affirmative" onClick={() => setEditing(null)}><Plus size={18} /> {t("uncharted.add")}</button></section>
      <section className="panel data-panel">
        <div className="panel-heading"><div><p className="eyebrow">{t("uncharted.attention")}</p><h2>{tp("uncharted.openEntries", openCount, { count: formatNumber(openCount) })}</h2></div></div>
        {snapshot.uncharted.length === 0 ? <div className="no-results">{t("uncharted.clear")}</div> : <div className="uncharted-list">{orderedEntries.map((entry) => <article className={`status-${entry.status}`} key={entry.id}><div className="uncharted-date"><strong>{entry.date}</strong>{snapshot.settings.showJalali && <small>{jalaliDate(entry.date, locale)}</small>}</div><div className="uncharted-main"><span className={`status-pill status-${entry.status}`}>{entry.status === "open" ? t("uncharted.open") : t("uncharted.retrieved")}</span><p dir="auto">{entry.note || entry.statusUpdate || t("uncharted.noDetails")}</p></div><div className="uncharted-amount"><strong><MoneyAmount amount={entry.amount} currency={entry.currency} irrDisplayUnit={snapshot.settings.irrDisplayUnit} /></strong></div><div className="row-actions"><button className="button small secondary" onClick={() => onPromote(entry)}>{t("uncharted.convert")}</button><button className="icon-button" aria-label={t("uncharted.edit")} onClick={() => setEditing(entry)}><Pencil size={16} /></button><button className="icon-button danger" aria-label={t("uncharted.delete")} onClick={() => remove(entry)}><Trash2 size={16} /></button></div></article>)}</div>}
      </section>
      {editing !== undefined && <UnchartedDialog entry={editing} currencies={snapshot.currencies} irrDisplayUnit={snapshot.settings.irrDisplayUnit} showJalali={snapshot.settings.showJalali} onClose={() => setEditing(undefined)} onSaved={async () => { setEditing(undefined);  onNotice(t("notice.unchartedSaved")); }} />}
    </div>
  );
}

function CurrencyView({ snapshot, onNotice }: { snapshot: AppSnapshot; onNotice: (message: string) => void }) {
  const { locale, t, formatNumber } = useI18n();
  const requestConfirmation = useConfirmation();
  const [currencyDialog, setCurrencyDialog] = useState<Currency | null | undefined>(undefined);
  const [rateDialog, setRateDialog] = useState<Rate | null | undefined>(undefined);
  const [rateReview, setRateReview] = useState<RateFetchResult | undefined>(undefined);
  const [fetchingRates, setFetchingRates] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const today = isoToday();
  const currentRates = useMemo(() => currentRateRows(snapshot.rates, today), [snapshot.rates, today]);
  const matches = (code: string) => `${code} ${snapshot.currencies.find(row => row.code === code)?.name ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const visibleCurrencies = snapshot.currencies.filter(row => matches(row.code)).sort((a, b) => a.code.localeCompare(b.code));
  const visibleRates = currentRates.filter(row => matches(row.quoteCurrency));
  const referenceCounts = useMemo(() => {
    const canonicalCurrencyCodes = new Set(snapshot.currencies.filter((currency) => currency.builtIn).map((currency) => currency.code));
    return {
      canonicalCurrencies: canonicalCurrencyCodes.size,
      userAddedCurrencies: snapshot.currencies.length - canonicalCurrencyCodes.size,
      canonicalRates: new Set(snapshot.rates.filter((rate) => canonicalCurrencyCodes.has(rate.quoteCurrency)).map(rate => rate.quoteCurrency)).size,
      userAddedRates: new Set(snapshot.rates.filter((rate) => !canonicalCurrencyCodes.has(rate.quoteCurrency)).map(rate => rate.quoteCurrency)).size,
    };
  }, [snapshot.currencies, snapshot.rates]);
  const currencyUsage = useMemo(() => new Map(snapshot.currencies.map((currency) => [
    currency.code,
    snapshot.wallets.filter((wallet) => wallet.currency === currency.code).length +
      snapshot.uncharted.filter((entry) => entry.currency === currency.code).length +
      snapshot.rates.filter((rate) => rate.quoteCurrency === currency.code).length +
      (snapshot.settings.reportingCurrency === currency.code ? 1 : 0),
  ])), [snapshot]);
  const toggleCurrency = async (currency: Currency) => {
    try {
      await setCurrencyArchived(currency.code, !currency.archived);
      onNotice(currency.archived ? t("notice.currencyRestored") : t("notice.currencyArchived"));
    } catch (reason) {
      onNotice(translatedErrorMessage(reason, t, "error.currencySave"));
    }
  };
  const removeCurrency = (currency: Currency) => requestConfirmation({
    title: t("settings.deleteCurrency", { currency: currency.code }), description: t("notice.deleteCurrency", { currency: currency.code }),
    confirmLabel: t("common.delete"), errorKey: "error.currencySave",
    onConfirm: async () => {
      await deleteUnusedCurrency(currency.code);
      onNotice(t("notice.currencyDeleted"));
    },
  });
  const reviewUpdatedRates = async () => {
    setFetchingRates(true);
    try {
      const result = await fetchRateProposals(
        snapshot.currencies.filter((currency) => !currency.archived).map((currency) => currency.code),
        snapshot.rates,
      );
      setRateReview({ ...result, proposals: result.proposals.filter(item => !snapshot.rates.some(row => row.quoteCurrency === item.quoteCurrency && row.effectiveDate === item.effectiveDate && row.granularity !== "monthly" && (row.locked || row.method === "manual"))) });
    } catch { onNotice(t("history.fetchError")); } finally {
      setFetchingRates(false);
    }
  };
  const acceptUpdatedRates = async (proposals: RateProposal[]) => {
    const createdAt = new Date().toISOString();
    const savedCount = await persistRates(proposals.map((item) =>
      acceptedProposalRate(
        item,
        rateId(item.quoteCurrency, item.effectiveDate),
        createdAt,
      ),
    ));
    setRateReview(undefined);
    onNotice(t("notice.ratesAccepted", { count: savedCount }));
  };

  return (
    <div className="settings-grid currency-page">
      <label className="currency-search"><Search size={18} /><span className="visually-hidden">{t("currencies.search")}</span><SearchField value={query} onValueChange={setQuery} label={t("currencies.search")} placeholder={t("currencies.search")} /></label>
      <section className="panel settings-section currency-settings">
        <div className="panel-heading"><div><p className="eyebrow">{t("settings.referenceData")}</p><h2>{t("settings.currencies")}</h2><p>{t("settings.currenciesDescription")}</p><div className="reference-counts" aria-label={t("settings.currencyCountsLabel")}><span>{t("settings.canonicalCount", { count: formatNumber(referenceCounts.canonicalCurrencies) })}</span><span>{t("settings.userAddedCount", { count: formatNumber(referenceCounts.userAddedCurrencies) })}</span></div></div><button className="button affirmative" onClick={() => setCurrencyDialog(null)}><Plus size={17} /> {t("settings.addCurrency")}</button></div>
        <div className="managed-list currency-list" tabIndex={0} role="region" aria-label={t("settings.currencies")}>{visibleCurrencies.map((currency) => {
          const used = currencyUsage.get(currency.code) ?? 0;
          return <article key={currency.code} className={currency.archived ? "archived" : ""}>
            <CurrencyBadge currency={currency.code} currencies={snapshot.currencies} />
            <div><strong>{currency.code} · {currency.name}</strong><small>{currency.symbol} · {t(`settings.currencyKind${currency.kind.charAt(0).toUpperCase()}${currency.kind.slice(1)}` as TranslationKey)} · {t("settings.decimalPlaces", { count: currency.fractionDigits })}</small></div>
            <div className="row-actions">{currency.builtIn ? <span className="managed-lock" title={t("settings.builtInCurrency")}><LockKeyhole size={16} /></span> : <><button className="icon-button" aria-label={t("settings.editCurrency", { currency: currency.code })} onClick={() => setCurrencyDialog(currency)}><Pencil size={16} /></button><button className="icon-button" disabled={used > 0} aria-label={currency.archived ? t("settings.restoreCurrency", { currency: currency.code }) : t("settings.archiveCurrency", { currency: currency.code })} onClick={() => toggleCurrency(currency)}>{currency.archived ? <RotateCcw size={16} /> : <Archive size={16} />}</button>{used === 0 && <button className="icon-button danger" aria-label={t("settings.deleteCurrency", { currency: currency.code })} onClick={() => removeCurrency(currency)}><Trash2 size={16} /></button>}</>}</div>
          </article>;
        })}{!visibleCurrencies.length && <p className="no-results">{t("currencies.noMatches")}</p>}</div>
      </section>
      <section className="panel settings-section rate-settings">
        <div className="panel-heading"><div><p className="eyebrow">{t("settings.currencies")}</p><h2>{t("settings.referenceRates")}</h2><p>{t("settings.referenceDescription")}</p><div className="reference-counts" aria-label={t("settings.rateCountsLabel")}><span>{t("settings.canonicalCount", { count: formatNumber(referenceCounts.canonicalRates) })}</span><span>{t("settings.userAddedCount", { count: formatNumber(referenceCounts.userAddedRates) })}</span></div></div><div className="panel-heading-actions"><button className="button secondary" disabled={fetchingRates} onClick={reviewUpdatedRates}><RotateCcw size={17} /> {fetchingRates ? t("settings.fetchingRates") : t("settings.fetchRates")}</button><button className="button secondary" onClick={() => setHistoryOpen(true)}>{t("history.title")}</button><button className="button affirmative" onClick={() => setRateDialog(null)}><Plus size={17} /> {t("settings.addRate")}</button></div></div>
        <div className="rate-list" tabIndex={0} role="region" aria-label={t("settings.referenceRates")}>{visibleRates.map((rate) => <div className="rate-row" key={rate.id}><CurrencyBadge currency={rate.quoteCurrency} currencies={snapshot.currencies} /><div><strong>{t("settings.rateValue", { value: rate.value, currency: rate.quoteCurrency })}</strong><small>{rate.source} · {t("dialog.effectiveDate")}: <bdi dir="ltr">{rate.effectiveDate}</bdi>{snapshot.settings.showJalali && ` (${jalaliDate(rate.effectiveDate, locale)})`} · {t(RATE_METHOD_LABEL_KEYS[rate.method])}{resolveRate(snapshot.rates, rate.quoteCurrency)?.quality === "estimate" && ` · ${t("history.estimate")}`}</small></div><div className="row-actions"><button className="icon-button" aria-label={t(rate.locked ? "history.unlock" : "history.lock", { date: rate.effectiveDate })} onClick={async () => { try { await setRateLocked(rate.id, !rate.locked); } catch { onNotice(t("history.saveError")); } }}><LockKeyhole size={16} opacity={rate.locked ? 1 : 0.4} /></button><button className="icon-button" aria-label={t("settings.editRate", { currency: rate.quoteCurrency })} onClick={() => setRateDialog(rate)}><Pencil size={16} /></button></div></div>)}{!visibleRates.length && <p className="no-results">{t("currencies.noMatches")}</p>}</div>
      </section>
      {currencyDialog !== undefined && <CurrencyDialog currency={currencyDialog} onClose={() => setCurrencyDialog(undefined)} onSaved={async () => { setCurrencyDialog(undefined);  onNotice(t("notice.currencySaved")); }} />}
      {rateDialog !== undefined && <RateDialog rate={rateDialog} currencies={snapshot.currencies} rates={snapshot.rates} showJalali={snapshot.settings.showJalali} onClose={() => setRateDialog(undefined)} onSaved={async () => { setRateDialog(undefined);  onNotice(t("notice.rateSaved")); }} />}
      {historyOpen && <Suspense fallback={<p role="status">{t("loading.preparing")}</p>}><RateHistoryDialog snapshot={snapshot} onClose={() => setHistoryOpen(false)} onEdit={setRateDialog}  /></Suspense>}
      {rateReview !== undefined && <RateProposalDialog result={rateReview} currencies={snapshot.currencies} onClose={() => setRateReview(undefined)} onAccept={acceptUpdatedRates} />}
    </div>
  );
}

function SettingsView({ snapshot, onRestore, onCsvImport, onBackup, exportingBackup, onCsv, onPurge, onNotice }: { snapshot: AppSnapshot; exportingBackup: boolean; onRestore: () => void; onCsvImport: () => void; onBackup: () => void; onCsv: (walletIds: string[]) => void; onPurge: () => void; onNotice: (message: string) => void }) {
  const { locale, t, tp, formatNumber } = useI18n();
  const requestConfirmation = useConfirmation();
  const saveSetting = useSettingWriter(onNotice);
  const [categoriesExpanded, setCategoriesExpanded] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem("jibjip.settings.categoriesExpanded") === "true"; }
    catch { return false; }
  });
  const [categoryDialog, setCategoryDialog] = useState<Category | null | undefined>(undefined);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [categoryTranslationTarget, setCategoryTranslationTarget] = useState<InterfaceLocale | undefined>(undefined);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const categoryUsage = useMemo(() => {
    const { categoryCounts, unresolvedCategoryCounts } = transactionIndex(snapshot.transactions);
    return new Map(snapshot.categories.map(category => [category.id,
      (categoryCounts.get(category.id) ?? 0) + (unresolvedCategoryCounts.get(category.name.toLocaleLowerCase("en")) ?? 0),
    ]));
  }, [snapshot.categories, snapshot.transactions]);
  const standardCategories = useMemo(
    () => [...snapshot.categories].sort((left, right) => compareCategoryNames(left.name, right.name)),
    [snapshot.categories],
  );
  const toggleCategory = async (category: Category) => {
    try {
      await setCategoryArchived(category.id, !category.archived);
      onNotice(category.archived ? t("notice.categoryRestored") : t("notice.categoryArchived"));
    } catch (reason) {
      onNotice(translatedErrorMessage(reason, t, "error.categorySave"));
    }
  };
  const removeCategory = (category: Category) => requestConfirmation({
    title: t("settings.deleteCategory", { category: category.name }), description: t("notice.deleteCategory", { category: category.name }),
    confirmLabel: t("common.delete"), errorKey: "error.categorySave",
    onConfirm: async () => {
      await deleteUnusedCategory(category.id);
      onNotice(t("notice.categoryDeleted"));
    },
  });
  const translateCategories = async (targetLocale: InterfaceLocale) => {
    const target = t(targetLocale === "fa" ? "settings.farsi" : "settings.english");
    const count = await translateDefaultCategoryNames(targetLocale);
    setCategoryTranslationTarget(undefined);
    onNotice(count > 0
      ? t("notice.categoriesTranslated", { count, language: target })
      : t("notice.noCategoriesTranslated"));
  };
  const setIrrDisplayUnit = async (unit: IrrDisplayUnit) => {
    if (await saveSetting("irrDisplayUnit", unit)) onNotice(t("notice.irrChanged", { unit }));
  };
  const setShowJalali = async (showJalali: boolean) => {
    if (await saveSetting("showJalali", showJalali)) onNotice(showJalali ? t("notice.jalaliShown") : t("notice.gregorianOnly"));
  };
  const setTextSize = async (textSize: TextSize) => {
    if (await saveSetting("textSize", textSize)) onNotice(t("notice.textSize", { size: t(`settings.${textSize}` as TranslationKey) }));
  };
  const setInterfaceLocale = async (locale: InterfaceLocale) => {
    if (await saveSetting("locale", locale)) onNotice(translate(locale, "notice.languageChanged"));
  };
  const categoryRow = (category: Category) => {
    const used = categoryUsage.get(category.id) ?? 0;
    return <article key={category.id} className={`${category.archived ? "archived " : ""}${category.defaultReportable ? "" : "out-of-reports"}`}>
      <span className="category-symbol" style={tonalBadgeStyle(category.color)}><CategorySymbol name={category.icon} /></span>
      <div><strong>{category.name}</strong><small>{category.scope === "both" ? t("dialog.both") : category.scope === "income" ? t("common.income") : t("dialog.expenses")} · {category.defaultReportable ? t("settings.inReports") : t("settings.outOfReports")} · {tp("common.transactions", used)}</small></div>
      <div className="row-actions"><button className="icon-button" aria-label={t("settings.editCategory", { category: category.name })} onClick={() => setCategoryDialog(category)}><Pencil size={16} /></button>{category.system ? <span className="managed-lock" title={t("settings.requiredCategory")}><LockKeyhole size={16} /></span> : <><button className="icon-button" aria-label={category.archived ? t("settings.restoreCategory", { category: category.name }) : t("settings.archiveCategory", { category: category.name })} onClick={() => toggleCategory(category)}>{category.archived ? <RotateCcw size={16} /> : <Archive size={16} />}</button>{categoryCanBePermanentlyDeleted(category, used) && <button className="icon-button danger" aria-label={t("settings.deleteCategory", { category: category.name })} onClick={() => removeCategory(category)}><Trash2 size={16} /></button>}</>}</div>
    </article>;
  };
  return (
    <div className="settings-grid">
      <section className="panel settings-section display-settings">
        <div className="panel-heading"><div><h2>{t("settings.display")}</h2></div></div>
        <div className="display-setting-group language-settings">
          <div className="panel-heading"><div><h3>{t("settings.language")}</h3><p>{t("settings.languageDescription")}</p></div></div>
          <div className="irr-unit-options language-options">
            {(["en", "fa"] as const).map((locale) => (
              <label className={snapshot.settings.locale === locale ? "selected" : ""} key={locale}>
                <input
                  type="radio"
                  name="interface-locale"
                  value={locale}
                  checked={snapshot.settings.locale === locale}
                  onChange={() => setInterfaceLocale(locale)}
                />
                <span><strong lang={locale} dir={locale === "fa" ? "rtl" : "ltr"}>{t(locale === "fa" ? "settings.farsi" : "settings.english")}</strong></span>
              </label>
            ))}
          </div>
        </div>
        <div className="display-setting-group">
          <div className="panel-heading"><div><h3>{t("settings.startPage")}</h3><p>{t("settings.startPageDescription")}</p></div></div>
          <fieldset className="start-page-options" aria-label={t("settings.startPage")} data-start-page={snapshot.settings.startPage}>
            {(["overview", "transactions"] as const).map(page => <label key={page}>
              <input className="visually-hidden" type="radio" name="start-page" value={page} checked={snapshot.settings.startPage === page}
                onChange={async () => { if (await saveSetting("startPage", page)) onNotice(t("notice.startPage", { page: t(`nav.${page}`) })); }} />
              <span>{t(`nav.${page}`)}</span>
            </label>)}
          </fieldset>
        </div>
        <div className="display-setting-group calendar-display-settings">
          <div className="panel-heading"><div><h3>{t("settings.calendar")}</h3><p>{t("settings.calendarDescription")}</p></div></div>
          <div className="irr-unit-options calendar-options">
            <label className={!snapshot.settings.showJalali ? "selected" : ""}>
              <input
                type="radio"
                name="calendar-display"
                checked={!snapshot.settings.showJalali}
                onChange={() => setShowJalali(false)}
              />
              <span><strong>2026-07-14</strong><small>{t("settings.gregorianOnly")}</small></span>
            </label>
            <label className={snapshot.settings.showJalali ? "selected" : ""}>
              <input
                type="radio"
                name="calendar-display"
                checked={snapshot.settings.showJalali}
                onChange={() => setShowJalali(true)}
              />
              <span><strong>2026-07-14</strong><small>{t("settings.withJalali", { date: jalaliDate("2026-07-14", locale) })}</small></span>
            </label>
          </div>
        </div>
        <div className="display-setting-group irr-display-settings">
          <div className="panel-heading"><div><h3>{t("settings.irrRepresentation")}</h3><p>{t("settings.irrDescription")}</p></div></div>
          <div className="irr-unit-options">
            {([
              ["IRR", "10,000,000 IRR", t("settings.originalRial")],
              ["TMN", "1,000,000 TMN", t("settings.toman")],
              ["HTM", "1,000 HTM", t("settings.thousandToman")],
              ["MTM", "1 MTM", t("settings.millionToman")],
            ] as const).map(([unit, example, description]) => (
              <label className={snapshot.settings.irrDisplayUnit === unit ? "selected" : ""} key={unit}>
                <input
                  type="radio"
                  name="irr-display-unit"
                  value={unit}
                  checked={snapshot.settings.irrDisplayUnit === unit}
                  onChange={() => setIrrDisplayUnit(unit)}
                />
                <span><strong>{example}</strong><small>{description}</small></span>
              </label>
            ))}
          </div>
        </div>
        <div className="display-setting-group text-size-settings">
          <div className="panel-heading"><div><h3>{t("settings.textSize")}</h3><p>{t("settings.textSizeDescription")}</p></div></div>
          <div className="irr-unit-options text-size-options">
            {(["small", "medium", "large"] as const).map((size) => (
              <label className={snapshot.settings.textSize === size ? "selected" : ""} key={size}>
                <input
                  type="radio"
                  name="text-size"
                  value={size}
                  checked={snapshot.settings.textSize === size}
                  onChange={() => setTextSize(size)}
                />
                <span><strong className={`text-size-example ${size}`}>Aa 1,234.56</strong><small>{t(`settings.${size}` as TranslationKey)}</small></span>
              </label>
            ))}
          </div>
        </div>
        <MotionSettings value={snapshot.settings.motion} onChange={async (motion) => {
          if (await saveSetting("motion", motion)) onNotice(t("notice.motionChanged"));
        }} />
        <ClaritySetting snapshot={snapshot} onNotice={onNotice} />
      </section>
      <details className="panel settings-section category-settings" open={categoriesExpanded} onToggle={(event) => {
        const expanded = event.currentTarget.open;
        setCategoriesExpanded(expanded);
        try { localStorage.setItem("jibjip.settings.categoriesExpanded", String(expanded)); }
        catch { /* Optional display preference. */ }
      }}>
        <summary className="category-settings-summary"><h2>{t("settings.categories")} <span className="category-count">{formatNumber(standardCategories.length)}</span></h2><ChevronDown size={20} aria-hidden="true" /></summary>
        <div className="category-settings-content">
        <p className="category-groups-description">{t("settings.categoriesDescription")}</p>
        <div className="panel-heading-actions"><button className="button secondary" onClick={() => setCategoryTranslationTarget("en")}><RotateCcw size={17} /> {t("settings.translateCategoriesEnglish")}</button><button className="button secondary" onClick={() => setCategoryTranslationTarget("fa")}><RotateCcw size={17} /> {t("settings.translateCategoriesFarsi")}</button><button className="button affirmative" onClick={() => setCategoryDialog(null)}><Plus size={17} /> {t("settings.addCategory")}</button></div>
        <p className="category-groups-description">{t("groups.description")}</p>
        {groupCategories(standardCategories, (category) => category.group, locale).map((group) => <section className="category-settings-group" key={group.name ?? ""}>
          <header><h3>{group.name ?? t("groups.ungrouped")} <span>{group.members.length}</span></h3>{group.name && <button type="button" className="text-button" onClick={() => setEditingGroup(group.name)}>{t("groups.rename")}</button>}</header>
          <div className="managed-list category-list">{group.members.map(categoryRow)}</div>
        </section>)}
        </div>
      </details>
      <section className="panel settings-section transaction-type-settings">
        <div className="panel-heading"><div><p className="eyebrow">{t("settings.reporting")}</p><h2>{t("settings.transactionTypes")}</h2><p>{t("settings.transactionTypesDescription")}</p></div></div>
        <div className="managed-list category-list">{CONFIGURABLE_TRANSACTION_TYPES.map((operation) => {
          const TypeIcon = operation === "transfer" ? Repeat : operation === "exchange" ? ArrowLeftRight : Settings2;
          const typeColor = operation === "exchange" ? "var(--exchange)" : operation === "adjustment" ? "var(--amber)" : "var(--transfer)";
          const used = (transactionIndex(snapshot.transactions).operationCounts.get(operation) ?? 0);
          return <article key={operation} className={snapshot.settings.typeReportability[operation] ? "" : "out-of-reports"}>
            <span className="category-symbol" style={{ backgroundColor: typeColor, color: "#ffffff" }}><TypeIcon size={18} aria-hidden="true" /></span>
            <div><strong>{t(`activity.${operation}` as TranslationKey)}</strong><small>{snapshot.settings.typeReportability[operation] ? t("settings.inReports") : t("settings.outOfReports")} · {tp("common.transactions", used)}</small></div>
            <div className="row-actions"><label className="type-report-toggle"><input type="checkbox" checked={snapshot.settings.typeReportability[operation]} onChange={async (event) => { await setTypeReportability(operation, event.target.checked); }} /><span>{t("dialog.includeInReports")}</span></label><span className="managed-lock" title={t("settings.fixedTransactionType")}><LockKeyhole size={16} /></span></div>
          </article>;
        })}</div>
      </section>
      <section className="panel settings-section data-safety">
        <div className="panel-heading"><div><p className="eyebrow">{t("settings.dataSafety")}</p><h2>{t("settings.dataPortability")}</h2><p>{t("settings.dataDescription")}</p></div><Database size={24} /></div>
        <div className="data-actions">
          <div className="data-action"><div><strong>{t("settings.fullBackup")} <span dir="ltr">.json.gz</span></strong><p>{t("settings.fullBackupDescription")}</p></div><button className="button portability-button portability-button-download" disabled={exportingBackup} aria-busy={exportingBackup} onClick={onBackup}><Upload size={17} /> {t(exportingBackup ? "settings.exportingBackup" : "settings.downloadBackup")}</button></div>
          <div className="data-action"><div><strong>{t("settings.transactionExport")} <span dir="ltr">.csv</span></strong><p>{t("settings.transactionExportDescription")}</p></div><button className="button portability-button portability-button-import" disabled={snapshot.wallets.length === 0} onClick={() => setCsvDialogOpen(true)}><Upload size={17} /> {t("settings.chooseExport")}</button></div>
          <div className="data-action data-import"><div><strong>{t("settings.importTransactions")} <span dir="ltr">.csv</span></strong><p>{t("settings.importTransactionsDescription")}</p></div><button className="button portability-button portability-button-import" disabled={snapshot.wallets.length === 0} onClick={onCsvImport}><Download size={17} /> {t("settings.importCsv")}</button><MigrationGuide /></div>
          <div className="data-action"><div><strong>{t("settings.restoreBackup")} <span dir="ltr">.json.gz / .json</span></strong><p><Trans id="settings.restoreBackupDescription" /></p></div><button className="button portability-button portability-button-restore" onClick={onRestore}><Download size={17} /> {t("settings.chooseBackupFile")}</button></div>
          <div className="data-action danger-zone"><div><strong>{t("settings.eraseLocalData")}</strong><p>{t("settings.eraseLocalDataDescription")}</p></div><button className="button danger" onClick={onPurge}><Trash2 size={17} /> {t("settings.eraseLocalData")}</button></div>
        </div>
        <details className="import-guide">
          <summary>{t("settings.fileRequirements")}</summary>
          <div className="import-guide-content">
            <div><strong>{t("settings.csvHeading")}</strong><p><Trans id="settings.csvRequirements" /></p><p><Trans id="settings.csvOperations" /></p><p>{t("settings.csvTextSafety")}</p><p>{t("split.csvHelp")}</p></div>
            <div><strong>{t("settings.jsonHeading")}</strong><p><Trans id="settings.jsonRequirements" /></p></div>
          </div>
        </details>
        <div className="privacy-note"><WifiOff size={18} /><span><strong>{t("settings.offline")}</strong><small>{t("settings.offlineDescription")}</small></span></div>
      </section>
      {categoryDialog !== undefined && <CategoryDialog category={categoryDialog} categories={snapshot.categories} onClose={() => setCategoryDialog(undefined)} onSaved={async () => { setCategoryDialog(undefined);  onNotice(t("notice.categorySaved")); }} />}
      {editingGroup !== null && <CategoryGroupDialog name={editingGroup} onClose={() => setEditingGroup(null)} onSaved={async () => { setEditingGroup(null);  onNotice(t("groups.saved")); }} />}
      {categoryTranslationTarget !== undefined && <CategoryTranslationDialog categories={snapshot.categories} targetLocale={categoryTranslationTarget} onClose={() => setCategoryTranslationTarget(undefined)} onApply={() => translateCategories(categoryTranslationTarget)} />}
      {csvDialogOpen && <CsvExportDialog wallets={snapshot.wallets} transactions={snapshot.transactions} irrDisplayUnit={snapshot.settings.irrDisplayUnit} transactionCountByWallet={transactionIndex(snapshot.transactions).walletCounts} onClose={() => setCsvDialogOpen(false)} onExport={(walletIds) => { onCsv(walletIds); setCsvDialogOpen(false); }} />}
    </div>
  );
}

function RateProposalDialog({ result, currencies, onClose, onAccept }: { result: RateFetchResult; currencies: Currency[]; onClose: () => void; onAccept: (proposals: RateProposal[]) => Promise<void> }) {
  const { t, formatDate } = useI18n();
  const [selected, setSelected] = useState(() => new Set(result.proposals.map((item) => item.quoteCurrency)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toggle = (currency: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(currency)) next.delete(currency); else next.add(currency);
    return next;
  });
  const accepted = result.proposals.filter((item) => selected.has(item.quoteCurrency));
  return <Dialog title={t("rates.reviewTitle")} eyebrow={t("rates.reviewEyebrow")} onClose={onClose} busy={saving}>
    <div className="rate-review-body">
    <div className="rate-review-intro">
      <p>{t("rates.reviewDescription")}</p>
      <small><time dateTime={result.fetchedAt} title={result.fetchedAt} dir="auto">{t("rates.fetchedAt", { time: formatDate(result.fetchedAt, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" }) })}</time></small>
    </div>
    <div className="rate-proposal-list">
      {result.proposals.map((item) => <label className={item.fallback ? "fallback" : ""} key={item.quoteCurrency}>
        <input type="checkbox" checked={selected.has(item.quoteCurrency)} onChange={() => toggle(item.quoteCurrency)} />
        <CurrencyBadge currency={item.quoteCurrency} currencies={currencies} />
        <span><strong>{t("rates.proposedValue", { value: item.value, currency: item.quoteCurrency })}</strong><small>{item.source} · {t("dialog.effectiveDate")}: <bdi dir="ltr">{item.effectiveDate}</bdi></small>{item.currentValue && <small><RateChange current={item.currentValue} change={item.changePercent ?? "0"} /></small>}{item.fallback && <em>{t(item.provider === "USD-parity" ? "rates.usdtFallback" : "rates.providerFallback")}</em>}</span>
      </label>)}
      {result.proposals.length === 0 && <div className="no-results">{t("rates.noneAvailable")}</div>}
    </div>
    {result.unavailable.length > 0 && <div className="rate-unavailable"><strong>{t("rates.unavailableTitle")}</strong><p>{result.unavailable.map((item) => item.quoteCurrency).join(", ")}</p><small>{t("rates.unavailableDescription")}</small></div>}
    {error && <p className="dialog-form-error" role="alert">{error}</p>}
    </div>
    <footer><button type="button" className="button secondary" onClick={onClose}>{t("common.cancel")}</button><button className="button affirmative" disabled={accepted.length === 0 || saving} onClick={async () => { if (saving) return; setSaving(true); setError(""); try { await onAccept(accepted); } catch { setError(t("history.saveError")); } finally { setSaving(false); } }}>{saving ? t("rates.applying") : t("rates.acceptSelected", { count: accepted.length })}</button></footer>
  </Dialog>;
}

function CsvExportDialog({ wallets, transactions, irrDisplayUnit, transactionCountByWallet, onClose, onExport }: { wallets: Wallet[]; transactions: Transaction[]; irrDisplayUnit: IrrDisplayUnit; transactionCountByWallet: ReadonlyMap<string, number>; onClose: () => void; onExport: (walletIds: string[]) => void }) {
  const { t, tp, formatNumber } = useI18n();
  const [selectedWalletIds, setSelectedWalletIds] = useState(() => new Set(wallets.map((wallet) => wallet.id)));
  const allSelected = selectedWalletIds.size === wallets.length;
  const toggleWallet = (walletId: string) => {
    setSelectedWalletIds((current) => {
      const next = new Set(current);
      if (next.has(walletId)) next.delete(walletId);
      else next.add(walletId);
      return next;
    });
  };
  return (
    <Dialog title={t("export.title")} eyebrow={t("export.eyebrow")} onClose={onClose}>
      <form className="dialog-form" onSubmit={(event) => { event.preventDefault(); onExport([...selectedWalletIds]); }}>
        <p className="dialog-description">{t("export.description")}</p>
        <div className="wallet-export-list">
          <label className="wallet-export-all"><input type="checkbox" checked={allSelected} onChange={() => setSelectedWalletIds(allSelected ? new Set() : new Set(wallets.map((wallet) => wallet.id)))} /><span><strong>{t("export.allWallets")}</strong><small>{tp("common.wallets", wallets.length, { count: formatNumber(wallets.length) })}</small></span></label>
          {walletsByCurrency(wallets).map((group) => (
            <section className="wallet-export-currency-group" key={group.currency}>
              <h3>{group.currency}</h3>
              {group.wallets.map((wallet) => (
                <label key={wallet.id}>
                  <input type="checkbox" checked={selectedWalletIds.has(wallet.id)} onChange={() => toggleWallet(wallet.id)} />
                  <span><span className="wallet-export-heading"><strong>{wallet.name}</strong><b><MoneyAmount amount={walletBalance(wallet.id, transactions)} currency={wallet.currency} irrDisplayUnit={irrDisplayUnit} /></b></span><small>{t("export.walletSummary", { currency: wallet.currency, transactions: tp("common.transactions", transactionCountByWallet.get(wallet.id) ?? 0, { count: formatNumber(transactionCountByWallet.get(wallet.id) ?? 0) }), archived: wallet.archived ? ` · ${t("common.archived")}` : "" })}</small></span>
                </label>
              ))}
            </section>
          ))}
        </div>
        <footer><button type="button" className="button secondary" onClick={onClose}>{t("common.cancel")}</button><button type="submit" className="button primary" disabled={selectedWalletIds.size === 0}><Upload size={17} /> {t("export.submit")}</button></footer>
      </form>
    </Dialog>
  );
}

type ActivityKind = "single" | "expense" | "income" | "adjustment" | LinkedActivityKind;

function IrrStorageHint({ value, currency, unit }: { value: string; currency: string; unit: IrrDisplayUnit }) {
  const { t, tp, formatNumber } = useI18n();
  if (currency !== "IRR" || !value.trim()) return null;
  let storedText: string;
  let zeroNote: string;
  try {
    const stored = amountForStorage(value, currency, unit).abs();
    if (!stored.isFinite()) return null;
    const [whole, fraction] = stored.toFixed().split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const zeroCount = irrDisplayDecimalPlaces(unit);
    storedText = `${grouped}${fraction ? `.${fraction}` : ""}`;
    zeroNote = zeroCount > 0 && /^\s*\d+\s*$/.test(value)
      ? t("activity.zeroNote", { zeros: tp("common.zeros", zeroCount, { count: formatNumber(zeroCount) }) })
      : "";
  } catch {
    return null;
  }
  return <small className="amount-storage-hint">{t("activity.storedIrr", { amount: storedText, zeroNote })}</small>;
}

const OPERATION_DIRECTIONS: Record<Transaction["operation"], Direction[]> = {
  transaction: ["expense", "income"],
  transfer: ["out", "in"],
  exchange: ["out", "in"],
  fee: ["expense"],
  adjustment: ["out", "in"],
};

function SplitTransactionDialog({ snapshot, source, editing, initial, onClose, onSaved, promote }: {
  snapshot: AppSnapshot; source?: Transaction; editing: boolean; promote?: UnchartedEntry;
  initial: { date: string; walletId: string; amount: string; category: string; note: string; direction: "income" | "expense" };
  onClose: () => void; onSaved: () => Promise<void>;
}) {
  const { t } = useI18n();
  const sourceRows = source?.split
    ? snapshot.transactions.filter(row => row.split?.id === source.split!.id).sort((a, b) => a.split!.index - b.split!.index)
    : source ? [source] : [];
  const [date, setDate] = useState(initial.date);
  const [walletId, setWalletId] = useState(initial.walletId);
  const [total, setTotal] = useState(source?.split
    ? amountForDisplayInput(source.split.total, source.currency, snapshot.settings.irrDisplayUnit) : initial.amount);
  const [note, setNote] = useState(source?.split?.note ?? (source ? "" : initial.note));
  const [lines, setLines] = useState(() => sourceRows.length > 0 ? [
    ...sourceRows.map(row => ({ key: editing ? row.id : uid("tx"), category: source?.split ? row.category : initial.category,
      amount: source?.split ? amountForDisplayInput(row.amount, row.currency, snapshot.settings.irrDisplayUnit) : initial.amount, note: source?.split ? row.note : initial.note,
      originalCategory: row.category, reportable: row.reportable })),
    ...(sourceRows.length === 1 ? [{ key: uid("tx"), category: "", amount: "", note: "", originalCategory: "", reportable: true }] : []),
  ] : [
    { key: uid("tx"), category: initial.category, amount: initial.amount, note: "", originalCategory: "", reportable: true },
    { key: uid("tx"), category: "", amount: "", note: "", originalCategory: "", reportable: true },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [splitId] = useState(editing && source?.split ? source.split.id : uid("split"));
  const wallet = snapshot.wallets.find(w => w.id === walletId);
  const unit = wallet?.currency === "IRR" ? snapshot.settings.irrDisplayUnit : wallet?.currency ?? "";
  let remaining: Decimal | null = null;
  let valid = false;
  try {
    const paymentTotal = money(total);
    if (total.trim() && paymentTotal.isFinite() && paymentTotal.gt(0)) {
      const assigned = lines.reduce((sum, line) => sum.plus(line.amount || "0"), money(0));
      remaining = paymentTotal.minus(assigned);
      valid = Boolean(wallet && validRateDate(date) && lines.length >= 2 && remaining.isZero() &&
        lines.every(line => line.category.trim() && money(line.amount).isFinite() && money(line.amount).gt(0)));
      if (!remaining.isFinite()) remaining = null;
    }
  } catch { remaining = null; }
  const updateLine = (key: string, patch: Partial<typeof lines[number]>) => setLines(current => current.map(line => line.key === key ? { ...line, ...patch } : line));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || !wallet || saving) return;
    setSaving(true); setError(null);
    try {
      const knownCategories = [...snapshot.categories];
      const prepared = lines.map(line => {
        const item = prepareTransactionCategory(line.category, initial.direction, knownCategories);
        const index = knownCategories.findIndex(category => category.id === item.category.id);
        if (index < 0) knownCategories.push(item.category); else knownCategories[index] = item.category;
        return item;
      });
      const previous = editing ? sourceRows : [];
      const rows = buildSplitRows({ id: splitId, date, walletId, currency: wallet.currency, direction: initial.direction,
        total: amountForStorage(total, wallet.currency, snapshot.settings.irrDisplayUnit).toString(), note,
        timestamp: new Date().toISOString(), previous,
        lines: lines.map((line, index) => ({ id: line.key, category: prepared[index].category, note: line.note,
          amount: amountForStorage(line.amount, wallet.currency, snapshot.settings.irrDisplayUnit).toString() })) });
      // Duplication preserves each source line's reporting choice unless its category changed.
      if (!editing) rows.forEach((row, index) => {
        if (lines[index].originalCategory === lines[index].category) row.reportable = lines[index].reportable;
      });
      await saveActivityDraft(async () => {
        for (const old of previous) {
          if (JSON.stringify(await db.transactions.get(old.id)) !== JSON.stringify(old)) throw new AppError("error.splitStale", "Transaction changed.");
        }
        if (source?.split && editing) {
          const current = (await db.transactions.toArray()).filter(row => row.split?.id === source.split!.id);
          splitGroups(current);
          if (current.length !== previous.length) throw new AppError("error.splitStale", "Transaction changed.");
        }
        for (const category of prepared) if (category.needsPut) await db.categories.put(category.category);
        await db.transactions.bulkDelete(previous.filter(old => !rows.some(row => row.id === old.id)).map(old => old.id));
        await db.transactions.bulkPut(rows);
      }, promote, snapshot);
      await onSaved();
    } catch (reason) { setError(translatedErrorMessage(reason, t, "error.activitySave")); }
    finally { setSaving(false); }
  };
  return <Dialog title={t("split.title")} eyebrow={t(initial.direction === "income" ? "transactions.income" : "transactions.expense")} onClose={onClose} busy={saving} submitShortcut>
    <form className="dialog-form split-form" onSubmit={submit}>
      <p className="dialog-description">{t("split.description")}</p>
      {promote && <p className="dialog-description">{t("activity.promotionHelp")}</p>}
      <div className="form-grid">
        <EntryDateField value={date} onChange={setDate} showJalali={snapshot.settings.showJalali} />
        <label><span>{t("activity.wallet")}</span><select required value={walletId} onChange={event => setWalletId(event.target.value)}>
          <WalletOptionGroups wallets={snapshot.wallets.filter(w => !w.archived || w.id === source?.walletId)} transactions={snapshot.transactions} irrDisplayUnit={snapshot.settings.irrDisplayUnit} />
        </select></label>
        <label className="wide"><span>{t("split.total")} · {unit}</span><AmountInput value={total} onValueChange={setTotal} currency={wallet?.currency ?? ""} unit={snapshot.settings.irrDisplayUnit} /><IrrStorageHint value={total} currency={wallet?.currency ?? ""} unit={snapshot.settings.irrDisplayUnit} /></label>
      </div>
      <div className="split-lines">{lines.map((line, index) => <fieldset className="split-line" key={line.key}>
        <legend>{t("split.line", { number: index + 1 })}</legend>
        <div className="form-grid split-line-fields">
          <label><span>{t("activity.category")}</span><CategoryPicker categories={snapshot.categories} value={line.category} direction={initial.direction} placeholder={t("activity.categoryPlaceholder")} onChange={category => updateLine(line.key, { category })} />{(line.originalCategory === line.category ? !line.reportable : snapshot.categories.find(c => c.name === line.category)?.defaultReportable === false) && <small>{t("split.excluded")}</small>}</label>
          <label><span>{t("activity.amount")} · {unit}</span><AmountInput value={line.amount} onValueChange={amount => updateLine(line.key, { amount })} currency={wallet?.currency ?? ""} unit={snapshot.settings.irrDisplayUnit} /><IrrStorageHint value={line.amount} currency={wallet?.currency ?? ""} unit={snapshot.settings.irrDisplayUnit} /></label>
          <button type="button" className="icon-button danger" disabled={lines.length <= 2} aria-label={t("split.remove", { number: index + 1 })} onClick={() => setLines(current => current.filter(item => item.key !== line.key))}><Trash2 size={16} /></button>
          <details className="split-line-note" open={line.note ? true : undefined}><summary>{t("split.lineNote")}</summary><input aria-label={t("split.lineNote")} value={line.note} onChange={event => updateLine(line.key, { note: event.target.value })} /></details>
        </div>
      </fieldset>)}</div>
      <div className="split-balance-row"><button type="button" className="button affirmative small" onClick={() => setLines(current => [...current, { key: uid("tx"), category: "", amount: remaining?.gt(0) ? remaining.toString() : "", note: "", originalCategory: "", reportable: true }])}><Plus size={16} />{t("split.addLine")}</button>
        <output className={`split-remaining ${remaining?.isZero() ? "is-balanced" : ""}`} aria-live="polite"><span>{!remaining ? t("split.enterAmounts") : remaining.isZero() ? t("split.balanced") : remaining.lt(0) ? t("split.over") : t("split.remaining")}</span><strong>{remaining ? <MoneyAmount amount={amountForStorage(remaining.abs(), wallet?.currency ?? "", snapshot.settings.irrDisplayUnit).toString()} currency={wallet?.currency ?? ""} irrDisplayUnit={snapshot.settings.irrDisplayUnit} /> : "—"}</strong></output>
      </div>
      <div className="form-grid"><label className="wide"><span>{t("split.note")}</span><textarea rows={2} value={note} onChange={event => setNote(event.target.value)} /></label></div>
      {error && <p className="dialog-form-error" role="alert">{error}</p>}
      <footer><button type="button" className="button secondary" onClick={onClose}>{t(promote ? "common.cancel" : "common.discard")}</button><button className="button affirmative" disabled={!valid || saving}>{saving ? t("activity.saving") : t(promote ? "activity.convertAndSave" : "common.save")}</button></footer>
    </form>
  </Dialog>;
}

function TransactionDialog({ snapshot: liveSnapshot, state, onClose, onSaved }: { snapshot: AppSnapshot; state: NonNullable<TransactionDialogState>; onClose: () => void; onSaved: () => Promise<void> }) {
  const [snapshot] = useState(liveSnapshot);
  const { t } = useI18n();
  const existing = state.transaction;
  const duplicate = state.duplicate;
  const source = existing ?? duplicate;
  const promote = state.promote;
  const [splitMode, setSplitMode] = useState(Boolean(source?.split));
  const linkedRows = source?.linkId
    ? snapshot.transactions.filter((transaction) => transaction.linkId === source.linkId)
    : [];
  const linkedOut = linkedRows.find((transaction) =>
    (transaction.operation === "transfer" || transaction.operation === "exchange") && transaction.direction === "out");
  const linkedIn = linkedRows.find((transaction) =>
    (transaction.operation === "transfer" || transaction.operation === "exchange") && transaction.direction === "in");
  const linkedKind: LinkedActivityKind | null = source &&
    (source.operation === "transfer" || source.operation === "exchange") &&
    linkedOut && linkedIn &&
    (linkedOut.operation === "transfer" || linkedOut.operation === "exchange") &&
    linkedOut.operation === linkedIn.operation
    ? linkedOut.operation
    : null;
  const retainedWalletIds = new Set(existing ? [existing.walletId, ...linkedRows.map(row => row.walletId)] : []);
  const activeWallets = snapshot.wallets.filter((wallet) => !wallet.archived || retainedWalletIds.has(wallet.id));
  const initialWalletId = linkedOut?.walletId ?? source?.walletId ?? chooseNewTransactionWalletId(
    snapshot.wallets,
    {
      requestedWalletId: state.walletId,
      preferredCurrency: promote?.currency,
      defaultWalletId: snapshot.settings.defaultWalletId,
    },
  );
  const initialToWalletId = linkedIn?.walletId ?? activeWallets.find((wallet) => wallet.id !== initialWalletId)?.id ?? "";
  const initialWallet = snapshot.wallets.find((item) => item.id === initialWalletId);
  const initialAmountCurrency = linkedOut?.currency ?? source?.currency ?? initialWallet?.currency ?? promote?.currency ?? "";
  const initialKind: ActivityKind = linkedKind ?? (existing
    ? "single"
    : duplicate?.operation === "transaction"
      ? duplicate.direction === "income" ? "income" : "expense"
      : duplicate?.operation === "adjustment"
        ? "adjustment"
        : "expense");
  const [kind, setKind] = useState<ActivityKind>(initialKind);
  const [date, setDate] = useState(linkedOut?.date ?? source?.date ?? promote?.date ?? isoToday());
  const [walletId, setWalletId] = useState(initialWalletId);
  const [toWalletId, setToWalletId] = useState(initialToWalletId);
  const [direction, setDirection] = useState<Direction>(source?.direction ?? "out");
  const [category, setCategory] = useState(source?.category ?? "");
  const [amount, setAmount] = useState(() => {
    if (promote && initialAmountCurrency !== promote.currency) return "";
    const stored = linkedOut?.amount ?? source?.amount ?? promote?.amount ?? "";
    return stored ? amountForDisplayInput(stored, initialAmountCurrency, snapshot.settings.irrDisplayUnit) : "";
  });
  const [toAmount, setToAmount] = useState(() => linkedIn
    ? amountForDisplayInput(linkedIn.amount, linkedIn.currency, snapshot.settings.irrDisplayUnit)
    : "");
  const [note, setNote] = useState(linkedOut?.note ?? source?.note ?? promote?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const wallet = snapshot.wallets.find((item) => item.id === walletId);
  const movementKind = kind === "transfer" || kind === "exchange" ? kind : null;
  const destinationWallets = movementKind ? movementDestinationWallets(activeWallets, walletId, movementKind, retainedWalletIds) : [];
  const destinationId = destinationWallets.some(item => item.id === toWalletId) ? toWalletId : destinationWallets[0]?.id ?? "";
  const toWallet = destinationWallets.find(item => item.id === destinationId);
  const amountCurrency = wallet?.currency ?? existing?.currency ?? "";
  const normalDirection = kind === "income" ? "income" : kind === "expense" ? "expense" : direction;
  const categoryDirection = normalDirection === "income" ? "income" : "expense";
  const allowedDirections = existing && !linkedKind ? OPERATION_DIRECTIONS[existing.operation] : [];

  const saveLinkedActivity = async (activityKind: LinkedActivityKind, timestamp: string) => {
    if (!wallet || !toWallet) throw new Error(t("error.chooseBothWallets"));
    const changes = buildLinkedActivityChanges({
      kind: activityKind,
      date,
      fromWallet: wallet,
      toWallet,
      sentAmount: amountForStorage(amount, wallet.currency, snapshot.settings.irrDisplayUnit).toString(),
      receivedAmount: activityKind === "transfer"
        ? amountForStorage(amount, wallet.currency, snapshot.settings.irrDisplayUnit).toString()
        : amountForStorage(toAmount, toWallet.currency, snapshot.settings.irrDisplayUnit).toString(),
      note,
      timestamp,
      linkId: existing?.linkId ?? uid(activityKind),
      reportable: snapshot.settings.typeReportability[activityKind],
      existingRows: existing && linkedKind ? linkedRows : [],
      createId: uid,
    });
    await db.transaction("rw", [db.transactions], async () => {
      if (existing && linkedKind) assertTransactionsUnchanged(linkedRows, await db.transactions.where("linkId").equals(existing.linkId!).toArray());
      if (changes.rowIdsToDelete.length > 0) await db.transactions.bulkDelete(changes.rowIdsToDelete);
      await db.transactions.bulkPut(changes.rowsToPut);
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError(null);
    const timestamp = new Date().toISOString();
    try {
      if (!validRateDate(date)) throw new AppError("error.validDate", "Enter a valid date.");
      await saveActivityDraft(async () => {
        if (linkedKind) {
          await saveLinkedActivity(linkedKind, timestamp);
        } else if (existing) {
          if (!wallet) throw new Error(t("error.chooseWallet"));
          if (!allowedDirections.includes(direction)) {
            throw new Error(t("error.invalidDirection", { direction, operation: existing.operation }));
          }
          const nextAmount = amountForStorage(amount, amountCurrency, snapshot.settings.irrDisplayUnit).abs().toString();
          if (!money(nextAmount).isFinite() || money(nextAmount).lte(0)) {
            throw new Error(t("error.positiveAmount"));
          }
          const preparedCategory = existing.operation === "transaction"
            ? prepareTransactionCategory(category, direction as "income" | "expense", snapshot.categories)
            : null;
          await db.transaction("rw", [db.categories, db.transactions], async () => {
            const current = await db.transactions.get(existing.id);
            assertTransactionsUnchanged([existing], current ? [current] : []);
            if (preparedCategory?.needsPut) await db.categories.put(preparedCategory.category);
            await db.transactions.update(existing.id, {
              date,
              walletId,
              direction,
              categoryId: preparedCategory?.category.id ?? null,
              category: isConfigurableTransactionType(existing.operation)
                ? transactionTypeLabel(existing.operation)
                : preparedCategory?.category.name ?? canonicalCategoryName(category || "Other", snapshot.categories),
              reportable: existing.operation === "transaction"
                ? preparedCategory ? editedReportability(existing, preparedCategory.category) : existing.reportable
                : existing.reportable,
              amount: nextAmount,
              balanceAmount: editedBalanceAmount(existing, nextAmount, direction),
              currency: wallet.currency,
              note,
              updatedAt: timestamp,
            });
          });
        } else if (kind === "income" || kind === "expense") {
          if (!wallet) throw new Error(t("error.chooseWallet"));
          const nextAmount = amountForStorage(amount, wallet.currency, snapshot.settings.irrDisplayUnit).abs();
          if (!nextAmount.isFinite() || nextAmount.lte(0)) throw new Error(t("error.positiveAmount"));
          const preparedCategory = prepareTransactionCategory(category, kind, snapshot.categories);
          await db.transaction("rw", [db.categories, db.transactions], async () => {
            if (preparedCategory.needsPut) await db.categories.put(preparedCategory.category);
            await db.transactions.add({ id: uid("tx"), date, walletId, operation: "transaction", direction: kind, categoryId: preparedCategory.category.id, category: preparedCategory.category.name, amount: nextAmount.toString(), balanceAmount: signedBalanceAmount(nextAmount, kind), currency: wallet.currency, note, reportable: duplicate ? editedReportability(duplicate, preparedCategory.category) : preparedCategory.category.defaultReportable, affectsBalance: true, linkId: null, createdAt: timestamp, updatedAt: timestamp });
          });
        } else if (kind === "transfer" || kind === "exchange") {
          await saveLinkedActivity(kind, timestamp);
        } else if (kind === "adjustment") {
          if (!wallet) throw new Error(t("error.chooseWallet"));
          if (direction !== "in" && direction !== "out") throw new Error(t("error.invalidDirection", { direction, operation: "adjustment" }));
          const nextAmount = amountForStorage(amount, wallet.currency, snapshot.settings.irrDisplayUnit).abs();
          if (!nextAmount.isFinite() || nextAmount.lte(0)) throw new Error(t("error.positiveAmount"));
          await db.transactions.add({ id: uid("tx"), date, walletId, operation: "adjustment", direction, categoryId: null, category: "Adjustment", amount: nextAmount.toString(), balanceAmount: signedBalanceAmount(nextAmount, direction), currency: wallet.currency, note, reportable: snapshot.settings.typeReportability.adjustment, affectsBalance: true, linkId: null, createdAt: timestamp, updatedAt: timestamp });
        }
      }, promote, snapshot);
      await onSaved();
    } catch (reason) {
      setFormError(translatedErrorMessage(reason, t, "error.activitySave"));
    } finally {
      setSaving(false);
    }
  };

  const dialogTitle = duplicate
    ? linkedKind
      ? t("activity.duplicateLinked", { kind: t(`activity.${linkedKind}` as TranslationKey) })
      : t("activity.duplicateTitle")
    : linkedKind
      ? t("activity.editLinked", { kind: t(`activity.${linkedKind}` as TranslationKey) })
      : existing
        ? t("activity.editTransaction")
        : promote
          ? t("activity.promoteTitle")
          : t("activity.addTitle");

  if (splitMode) return <SplitTransactionDialog snapshot={snapshot} source={source}
    editing={Boolean(existing)} promote={promote} initial={{ date, walletId, amount, note, category, direction: categoryDirection }}
    onClose={onClose} onSaved={onSaved} />;

  return (
    <Dialog title={dialogTitle} eyebrow={existing ? t("activity.update") : t("activity.new")} onClose={onClose} busy={saving} submitShortcut>
      <form className="dialog-form" onSubmit={submit}>
        {promote && <p className="dialog-description">{t("activity.promotionHelp")}</p>}
        {!existing && !linkedKind && (
          <div className="segmented-control" role="group" aria-label={t("activity.type")}>
            {(["expense", "income", "transfer", "exchange", "adjustment"] as const).map((item) => (
              <button key={item} type="button" className={`${item} ${kind === item ? "active" : ""}`} onClick={() => { setKind(item); if (item === "adjustment" && direction !== "in" && direction !== "out") setDirection("out"); }}>{t(`activity.${item}` as TranslationKey)}</button>
            ))}
          </div>
        )}
        {(!source || (source.affectsBalance && !source.linkId)) && (kind === "expense" || kind === "income" || existing?.operation === "transaction") &&
          <button className="button secondary split-trigger" type="button" onClick={() => setSplitMode(true)}><Split size={17} />{t("split.action")}</button>}
        {promote && wallet?.currency !== promote.currency && <p className="chart-data-warning">{t("activity.promotionCurrency", { currency: promote.currency })}</p>}
        <div className="form-grid">
          <EntryDateField value={date} onChange={setDate} showJalali={snapshot.settings.showJalali} />
          <label><span>{kind === "transfer" || kind === "exchange" ? t("activity.fromWallet") : t("activity.wallet")}</span><select required value={walletId} onChange={(event) => { if (promote && snapshot.wallets.find(row => row.id === event.target.value)?.currency !== wallet?.currency) setAmount(""); setWalletId(event.target.value); }}><WalletOptionGroups wallets={activeWallets} transactions={snapshot.transactions} irrDisplayUnit={snapshot.settings.irrDisplayUnit} /></select></label>
          {(kind === "adjustment" || (existing && !linkedKind)) && <label><span>{t("activity.direction")}</span><select value={direction} onChange={(event) => setDirection(event.target.value as Direction)}>{(kind === "adjustment" ? OPERATION_DIRECTIONS.adjustment : allowedDirections).map((item) => <option value={item} key={item}>{t(DIRECTION_LABEL_KEYS[item])}</option>)}</select></label>}
          {(kind === "transfer" || kind === "exchange") && <label><span>{t("activity.toWallet")}</span><select required disabled={!destinationWallets.length} value={destinationId} onChange={(event) => setToWalletId(event.target.value)}>{!destinationWallets.length && <option value="">{t(kind === "transfer" ? "activity.noTransferWallet" : "activity.noExchangeWallet")}</option>}<WalletOptionGroups wallets={destinationWallets} transactions={snapshot.transactions} irrDisplayUnit={snapshot.settings.irrDisplayUnit} /></select></label>}
          <label><span>{kind === "exchange" ? t("activity.sentAmount") : t("activity.amount")}{amountCurrency ? ` · ${amountCurrency === "IRR" ? snapshot.settings.irrDisplayUnit : amountCurrency}` : ""}</span><AmountInput value={amount} onValueChange={setAmount} currency={amountCurrency} unit={snapshot.settings.irrDisplayUnit} /><IrrStorageHint value={amount} currency={amountCurrency} unit={snapshot.settings.irrDisplayUnit} /></label>
          {kind === "exchange" && <label><span>{t("activity.receivedAmount")}{toWallet ? ` · ${toWallet.currency === "IRR" ? snapshot.settings.irrDisplayUnit : toWallet.currency}` : ""}</span><AmountInput value={toAmount} onValueChange={setToAmount} currency={toWallet?.currency ?? ""} unit={snapshot.settings.irrDisplayUnit} /><IrrStorageHint value={toAmount} currency={toWallet?.currency ?? ""} unit={snapshot.settings.irrDisplayUnit} /></label>}
          {kind !== "transfer" && kind !== "exchange" && kind !== "adjustment" && existing?.operation !== "transfer" && existing?.operation !== "exchange" && existing?.operation !== "adjustment" && <label className="wide"><span>{t("activity.category")}</span><CategoryPicker categories={snapshot.categories} value={category} direction={categoryDirection} placeholder={t("activity.categoryPlaceholder")} onChange={setCategory} /></label>}
          <label className="wide"><span>{t("activity.note")}</span><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("activity.notePlaceholder")} /></label>
        </div>
        {kind === "exchange" && <div className="calculation-note"><ArrowLeftRight size={17} /><span>{t("activity.exchangeNote")}</span></div>}
        {formError && <p className="dialog-form-error" role="alert">{formError}</p>}
        <footer><button type="button" className="button secondary" onClick={onClose}>{t(promote ? "common.cancel" : "common.discard")}</button><button className="button affirmative" disabled={saving || Boolean(movementKind && !toWallet)}>{saving ? t("activity.saving") : t(promote ? "activity.convertAndSave" : "common.save")}</button></footer>
      </form>
    </Dialog>
  );
}

function BatchTransactionDialog({
  snapshot: liveSnapshot,
  transactions,
  count,
  onClose,
  onSaved,
}: {
  snapshot: AppSnapshot;
  transactions: Transaction[];
  count: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [snapshot] = useState(liveSnapshot);
  const { t, formatNumber } = useI18n();
  const first = transactions[0];
  const activeWallets = useMemo(
    () => snapshot.wallets.filter((wallet) => !wallet.archived),
    [snapshot.wallets],
  );
  const firstActiveWallet = activeWallets.find((wallet) => wallet.id === first?.walletId) ?? activeWallets[0];
  const commonWalletId = first && transactions.every((transaction) => transaction.walletId === first.walletId)
    ? first.walletId
    : firstActiveWallet?.id ?? "";
  const walletChangeEditable = transactions.every((transaction) => !transaction.linkId);
  const sharedDirection = first && first.operation === "transaction" &&
    (first.direction === "income" || first.direction === "expense") &&
    transactions.every((transaction) =>
      transaction.operation === "transaction" &&
      (transaction.direction === "income" || transaction.direction === "expense") &&
      transaction.direction === first.direction,
    )
    ? first.direction
    : null;
  const commonDate = first && transactions.every((transaction) => transaction.date === first.date)
    ? first.date
    : isoToday();
  const commonCategory = sharedDirection && first && transactions.every((transaction) => transaction.category === first.category)
    ? first.category
    : "";
  const [changeDate, setChangeDate] = useState(false);
  const [date, setDate] = useState(commonDate);
  const [changeWallet, setChangeWallet] = useState(false);
  const [targetWalletId, setTargetWalletId] = useState(commonWalletId);
  const [confirmedCurrencyReinterpretation, setConfirmedCurrencyReinterpretation] = useState(false);
  const [changeCategory, setChangeCategory] = useState(false);
  const [category, setCategory] = useState(commonCategory);
  const [changeNote, setChangeNote] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const categoryEditable = Boolean(sharedDirection) && !transactions.some(t => t.split);
  const targetWallet = activeWallets.find((wallet) => wallet.id === targetWalletId);
  const walletChangeValid = !changeWallet || (walletChangeEditable && Boolean(targetWallet));
  const currencyWillChange = Boolean(
    changeWallet &&
    targetWallet &&
    transactions.some((transaction) => transaction.currency !== targetWallet.currency),
  );
  const categorySelectionValid = !changeCategory || !categoryEditable || Boolean(category.trim());
  const hasChanges = Boolean(changeDate || changeWallet || changeNote || (categoryEditable && changeCategory && category.trim()));
  const canSubmit = hasChanges && categorySelectionValid && walletChangeValid && (!currencyWillChange || confirmedCurrencyReinterpretation);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !canSubmit || (changeWallet && !targetWallet)) return;
    setSaving(true);
    setFormError(null);
    try {
      const preparedCategory = categoryEditable && sharedDirection && changeCategory
        ? prepareTransactionCategory(category.trim(), sharedDirection, snapshot.categories)
        : null;
      const timestamp = new Date().toISOString();
      await saveActivityDraft(async () => {
        await assertStoredActivitiesUnchanged(transactions);
        if (preparedCategory?.needsPut) await db.categories.put(preparedCategory.category);
        await db.transactions.bulkPut(transactions.map((transaction) => ({
          ...transaction,
          ...(changeWallet && targetWallet ? {
            walletId: targetWallet.id,
            currency: targetWallet.currency,
          } : {}),
          ...(changeDate ? { date } : {}),
          ...(changeNote ? transaction.split ? { split: { ...transaction.split, note } } : { note } : {}),
          ...(preparedCategory ? {
            categoryId: preparedCategory.category.id,
            category: preparedCategory.category.name,
            reportable: editedReportability(transaction, preparedCategory.category),
          } : {}),
          updatedAt: timestamp,
        })));
      }, undefined, snapshot);
      await onSaved();
    } catch (reason) {
      setFormError(translatedErrorMessage(reason, t, "error.activitySave"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog title={t("transactions.batchEditTitle")} eyebrow={t("transactions.selectedTotal")} onClose={onClose} busy={saving} submitShortcut>
      <form className="dialog-form" onSubmit={submit}>
        <p className="dialog-description">{t("transactions.batchEditDescription", { count: formatNumber(count) })}</p>
        <div className="form-grid">
          <label className="wide checkbox-field">
            <input type="checkbox" checked={changeDate} onChange={(event) => setChangeDate(event.target.checked)} />
            <span>{t("transactions.batchChangeDate")}</span>
          </label>
          {changeDate && <EntryDateField value={date} onChange={setDate} showJalali={snapshot.settings.showJalali} label={t("transactions.date")} />}
          <label className="wide checkbox-field">
            <input type="checkbox" checked={changeWallet} disabled={!walletChangeEditable} onChange={(event) => { setChangeWallet(event.target.checked); setConfirmedCurrencyReinterpretation(false); }} />
            <span>{t("transactions.batchChangeWallet")}</span>
          </label>
          {changeWallet && walletChangeEditable && <label className="wide"><span>{t("activity.wallet")}</span><select required value={targetWalletId} onChange={(event) => { setTargetWalletId(event.target.value); setConfirmedCurrencyReinterpretation(false); }}><WalletOptionGroups wallets={activeWallets} transactions={snapshot.transactions} irrDisplayUnit={snapshot.settings.irrDisplayUnit} /></select></label>}
          {!walletChangeEditable && <p className="batch-edit-hint">{t("transactions.batchWalletUnavailable")}</p>}
          <label className="wide checkbox-field">
            <input type="checkbox" checked={changeCategory} disabled={!categoryEditable} onChange={(event) => setChangeCategory(event.target.checked)} />
            <span>{t("transactions.batchChangeCategory")}</span>
          </label>
          {changeCategory && categoryEditable && sharedDirection && <label className="wide"><span>{t("activity.category")}</span><CategoryPicker categories={snapshot.categories} value={category} direction={sharedDirection} placeholder={t("activity.categoryPlaceholder")} onChange={setCategory} /></label>}
          {!categoryEditable && <p className="batch-edit-hint">{t(transactions.some(row => row.split) ? "split.batchHint" : "transactions.batchCategoryUnavailable")}</p>}
          <label className="wide checkbox-field">
            <input type="checkbox" checked={changeNote} onChange={(event) => setChangeNote(event.target.checked)} />
            <span>{t("transactions.batchChangeNote")}</span>
          </label>
          {changeNote && <label className="wide"><span>{t("activity.note")}</span><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("transactions.batchNotePlaceholder")} /></label>}
        </div>
        {currencyWillChange && <div className="wallet-currency-warning" role="alert"><TriangleAlert size={22} /><div><strong>{t("transactions.batchWalletCurrencyWarningTitle")}</strong><p>{t("transactions.batchWalletCurrencyWarning", { currency: targetWallet?.currency ?? "", count: formatNumber(transactions.length) })}</p><label><input type="checkbox" checked={confirmedCurrencyReinterpretation} onChange={(event) => setConfirmedCurrencyReinterpretation(event.target.checked)} /> <span>{t("transactions.batchWalletCurrencyAcknowledge", { currency: targetWallet?.currency ?? "" })}</span></label></div></div>}
        {formError && <p className="dialog-form-error" role="alert">{formError}</p>}
        <footer><button type="button" className="button secondary" onClick={onClose}>{t("common.discard")}</button><button className="button affirmative" disabled={saving || !canSubmit}>{saving ? t("activity.saving") : t("common.save")}</button></footer>
      </form>
    </Dialog>
  );
}

function WalletDialog({ wallet, snapshot, onClose, onSaved }: { wallet: Wallet | null; snapshot: AppSnapshot; onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useI18n();
  const [name, setName] = useState(wallet?.name ?? "");
  const [code, setCode] = useState(wallet?.code ?? "");
  const [currency, setCurrency] = useState(wallet?.currency ?? snapshot.settings.reportingCurrency);
  const [confirmedReinterpretation, setConfirmedReinterpretation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const transactionCount = wallet
    ? (transactionIndex(snapshot.transactions).walletCounts.get(wallet.id) ?? 0)
    : 0;
  const requiresCurrencyConfirmation = walletCurrencyChangeRequiresConfirmation(wallet, currency, transactionCount);
  const currencies = snapshot.currencies
    .filter((item) => !item.archived || item.code === wallet?.currency)
    .sort((left, right) => left.code.localeCompare(right.code));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (requiresCurrencyConfirmation && !confirmedReinterpretation) {
      setFormError(t("error.walletCurrencyConfirmationRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    const value: Wallet = {
      id: wallet?.id ?? uid("wallet"),
      name: name.trim(),
      code: code.trim() || name.trim().toLowerCase().replace(/\s+/g, "-"),
      currency,
      archived: wallet?.archived ?? false,
      createdAt: wallet?.createdAt ?? new Date().toISOString(),
    };
    try {
      await persistWallet(value, confirmedReinterpretation);
      await onSaved();
    } catch (reason) {
      setFormError(translatedErrorMessage(reason, t, "error.walletSave"));
    } finally {
      setSaving(false);
    }
  };
  return <Dialog title={wallet ? t("wallets.editTitle") : t("wallets.add")} eyebrow={t("wallets.account")} onClose={onClose} busy={saving} submitShortcut><form className="dialog-form" onSubmit={submit}><div className="form-grid"><label className="wide"><span>{t("wallets.name")}</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder={t("wallets.namePlaceholder")} /></label><label><span>{t("wallets.shortCode")}</span><input value={code} onChange={(event) => setCode(event.target.value)} placeholder={t("wallets.codePlaceholder")} /></label><label><span>{t("wallets.currency")}</span><select required value={currency} onChange={(event) => { setCurrency(event.target.value); setConfirmedReinterpretation(false); setFormError(null); }}>{currencies.map((item) => <option value={item.code} key={item.code}>{item.code} · {item.name}</option>)}</select></label></div>{requiresCurrencyConfirmation && <div className="wallet-currency-warning" role="alert"><TriangleAlert size={22} /><div><strong>{t("wallets.currencyChangeTitle")}</strong><p>{t("wallets.currencyChangeWarning", { currency, count: transactionCount })}</p><label><input type="checkbox" checked={confirmedReinterpretation} onChange={(event) => setConfirmedReinterpretation(event.target.checked)} /> <span>{t("wallets.currencyChangeAcknowledge", { currency, count: transactionCount })}</span></label></div></div>}{formError && <p className="dialog-form-error" role="alert">{formError}</p>}<footer><button type="button" className="button secondary" onClick={onClose}>{t("common.cancel")}</button><button className="button affirmative" disabled={saving || (requiresCurrencyConfirmation && !confirmedReinterpretation)}>{saving ? t("activity.saving") : requiresCurrencyConfirmation ? t("wallets.saveAndReinterpret") : t("wallets.save")}</button></footer></form></Dialog>;
}

function UnchartedDialog({ entry, currencies, showJalali, irrDisplayUnit: liveIrrDisplayUnit, onClose, onSaved }: { entry: UnchartedEntry | null; currencies: Currency[]; showJalali: boolean; irrDisplayUnit: IrrDisplayUnit; onClose: () => void; onSaved: () => Promise<void> }) {
  const [irrDisplayUnit] = useState(liveIrrDisplayUnit);
  const { t } = useI18n();
  const currencyOptions = currencies.filter(currency => !currency.archived || currency.code === entry?.currency).sort((a, b) => a.code.localeCompare(b.code));
  const [form, setForm] = useState({ date: entry?.date ?? isoToday(), amount: entry ? amountForDisplayInput(entry.amount, entry.currency, irrDisplayUnit) : "", currency: entry?.currency ?? "EUR", note: entry?.note ?? "", status: normalizeUnchartedStatus(entry?.status), statusUpdate: entry?.statusUpdate ?? "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const field = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(value => ({ ...value, [key]: key === "amount" ? normalizeNumericInput(event.target.value) : event.target.value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    let amount: string;
    try {
      const value = amountForStorage(form.amount.trim(), form.currency, irrDisplayUnit);
      if (!value.isFinite() || value.lte(0)) throw new Error();
      amount = value.toString();
    } catch { setFormError(t("error.positiveAmount")); return; }
    if (!validRateDate(form.date)) { setFormError(t("error.validDate")); return; }
    setSaving(true);
    try {
      const timestamp = new Date().toISOString();
      await db.transaction("rw", db.uncharted, async () => {
        if (entry && JSON.stringify(await db.uncharted.get(entry.id)) !== JSON.stringify(entry)) throw new AppError("error.entryStale", "Entry changed. Close and reopen it.");
        await db.uncharted.put({ id: entry?.id ?? uid("uncharted"), ...form, amount, status: normalizeUnchartedStatus(form.status), sourceKey: entry?.sourceKey, createdAt: entry?.createdAt ?? timestamp, updatedAt: timestamp });
      });
      await onSaved();
    } catch (reason) { setFormError(translatedErrorMessage(reason, t, "error.unchartedSave")); }
    finally { setSaving(false); }
  };
  return <Dialog title={entry ? t("uncharted.editTitle") : t("uncharted.addTitle")} eyebrow={t("uncharted.excluded")} onClose={onClose} busy={saving} submitShortcut>
    <form className="dialog-form" onSubmit={submit}>
      <div className="form-grid">
        <EntryDateField value={form.date} onChange={date => setForm(current => ({ ...current, date }))} showJalali={showJalali} />
        <label><span>{t("uncharted.status")}</span><select className="uncharted-status-select" value={form.status} onChange={field("status")}><option value="open">{t("uncharted.open")}</option><option value="retrieved">{t("uncharted.retrieved")}</option></select></label>
        <label><span>{t("uncharted.currency")}</span><select required value={form.currency} onChange={field("currency")}>{currencyOptions.map(currency => <option key={currency.code} value={currency.code}>{currency.code} · {currency.name}</option>)}</select></label>
        <label><span>{t("uncharted.positiveAmount")} · {form.currency === "IRR" ? irrDisplayUnit : form.currency}</span><AmountInput value={form.amount} onValueChange={amount => setForm(current => ({ ...current, amount }))} currency={form.currency} unit={irrDisplayUnit} /><IrrStorageHint value={form.amount} currency={form.currency} unit={irrDisplayUnit} /></label>
        <label className="wide"><span>{t("uncharted.note")}</span><textarea rows={3} value={form.note} onChange={field("note")} /></label>
        <label className="wide"><span>{t("uncharted.statusUpdate")}</span><input value={form.statusUpdate} onChange={field("statusUpdate")} /></label>
      </div>
      {formError && <p className="dialog-form-error" role="alert">{formError}</p>}
      <footer><button type="button" className="button secondary" disabled={saving} onClick={onClose}>{t("common.cancel")}</button><button className="button affirmative" disabled={saving}>{saving ? t("activity.saving") : t("uncharted.save")}</button></footer>
    </form>
  </Dialog>;
}

function CategoryTranslationDialog({ categories, targetLocale, onClose, onApply }: { categories: Category[]; targetLocale: InterfaceLocale; onClose: () => void; onApply: () => Promise<void> }) {
  const { t } = useI18n();
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const changes = categoryTranslationPlan(categories, targetLocale);
  const language = t(targetLocale === "fa" ? "settings.farsi" : "settings.english");
  return <Dialog title={t("dialog.translateCategoriesTitle", { language })} eyebrow={t("dialog.translateCategoriesEyebrow")} onClose={onClose} busy={saving}>
    <div className="category-translation-content">
      <p>{t("dialog.translateCategoriesDescription")}</p>
      {changes.length > 0 ? <div className="category-translation-preview" role="list" aria-label={t("dialog.translateCategoriesPreview")}>
        {changes.map((change) => {
          const category = categories.find((item) => item.id === change.id);
          const current = category?.name ?? "";
          return <div role="listitem" key={change.id}><span className="category-translation-side"><CategoryVisual category={category} name={current} size={15} /><span>{current}</span></span><ArrowLeftRight size={15} /><strong className="category-translation-side" lang={targetLocale} dir={targetLocale === "fa" ? "rtl" : "ltr"}><CategoryVisual category={category} name={change.name} size={15} /><span>{change.name}</span></strong></div>;
        })}
      </div> : <div className="no-results">{t("notice.noCategoriesTranslated")}</div>}
      <div className="wallet-currency-warning" role="alert"><TriangleAlert size={22} /><div><strong>{t("dialog.translateCategoriesWarningTitle")}</strong><p>{t("dialog.translateCategoriesWarning", { language })}</p><label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> <span>{t("dialog.translateCategoriesAcknowledge")}</span></label></div></div>
    </div>
    {error && <p className="dialog-form-error" role="alert">{error}</p>}
    <footer><button type="button" className="button secondary" onClick={onClose}>{t("common.cancel")}</button><button className="button primary" disabled={!confirmed || changes.length === 0 || saving} onClick={async () => { if (saving) return; setSaving(true); setError(""); try { await onApply(); } catch (reason) { setError(translatedErrorMessage(reason, t, "error.categoryTranslation")); } finally { setSaving(false); } }}>{saving ? t("activity.saving") : t("dialog.translateCategoriesApply", { count: changes.length })}</button></footer>
  </Dialog>;
}

function CategoryDialog({ category, categories, onClose, onSaved }: { category: Category | null; categories: Category[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useI18n();
  const [name, setName] = useState(category?.name ?? "");
  const [group, setGroup] = useState(category?.group ?? "");
  const groupListId = useId();
  const groupNames = [...new Set(categories.flatMap((item) => item.group ? [item.group] : []))].sort();
  const [scope, setScope] = useState<Category["scope"]>(category?.scope ?? "expense");
  const [color, setColor] = useState(category?.color ?? DEFAULT_CATEGORY_COLOR);
  const [icon, setIcon] = useState(category?.icon ?? DEFAULT_CATEGORY_ICON);
  const [defaultReportable, setDefaultReportable] = useState(category?.defaultReportable ?? true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const iconChoices = CATEGORY_ICON_CHOICES.includes(icon as typeof CATEGORY_ICON_CHOICES[number]) ? CATEGORY_ICON_CHOICES : [icon, ...CATEGORY_ICON_CHOICES];
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      await persistCategory({ id: category?.id ?? uid("category"), name, group: group.trim() || null, scope, archived: category?.archived ?? false, templateKey: category?.templateKey ?? null, system: category?.system ?? false, color, icon, defaultReportable });
      await onSaved();
    } catch (reason) {
      setFormError(translatedErrorMessage(reason, t, "error.categorySave"));
    } finally {
      setSaving(false);
    }
  };
  return <Dialog title={category ? t("dialog.editCategory") : t("dialog.addCategory")} eyebrow={t("settings.organization")} onClose={onClose} busy={saving} submitShortcut><form className="dialog-form" onSubmit={submit}><div className="form-grid"><label className="wide"><span>{t("dialog.name")}</span><input required disabled={category?.system} value={name} onChange={(event) => setName(event.target.value)} />{category?.system && <small>{t("dialog.systemCategoryName")}</small>}</label><label className="wide"><span>{t("groups.label")}</span><input list={groupListId} value={group} onChange={(event) => setGroup(event.target.value)} placeholder={t("groups.ungrouped")} /><datalist id={groupListId}>{groupNames.map((name) => <option key={name} value={name} />)}</datalist><small>{t("groups.hint")}</small></label><label><span>{t("dialog.usedFor")}</span><select disabled={category?.system} value={scope} onChange={(event) => setScope(event.target.value as Category["scope"])}><option value="expense">{t("dialog.expenses")}</option><option value="income">{t("common.income")}</option><option value="both">{t("dialog.both")}</option></select></label><label><span>{t("dialog.color")}</span><input className="category-color-input" type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label><label className="wide"><span>{t("dialog.symbol")}</span><select value={icon} onChange={(event) => setIcon(event.target.value)}>{iconChoices.map((choice) => <option key={choice} value={choice}>{t(CATEGORY_ICON_LABELS[choice] ?? "dialog.savedIcon")}</option>)}</select><small className="category-icon-preview"><span style={tonalBadgeStyle(color)}><CategorySymbol name={icon} /></span>{t("dialog.symbolPreview")}</small></label><label className="wide checkbox-field"><input type="checkbox" checked={defaultReportable} onChange={(event) => setDefaultReportable(event.target.checked)} /><span>{t("dialog.includeInReports")}</span><small>{t("dialog.includeInReportsDescription")}</small></label></div>{formError && <p className="dialog-form-error" role="alert">{formError}</p>}<footer><button type="button" className="button secondary" onClick={onClose}>{t("common.cancel")}</button><button className="button affirmative" disabled={saving}>{saving ? t("activity.saving") : t("dialog.saveCategory")}</button></footer></form></Dialog>;
}

function CategoryGroupDialog({ name, onClose, onSaved }: { name: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useI18n();
  const [nextName, setNextName] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <Dialog title={t("groups.rename")} eyebrow={t("settings.organization")} onClose={onClose} busy={saving} submitShortcut>
    <form className="dialog-form" onSubmit={async (event) => {
      event.preventDefault();
      if (!nextName.trim() || saving) return;
      setSaving(true);
      setError(null);
      try { await renameCategoryGroup(name, nextName); await onSaved(); }
      catch (reason) { setError(translatedErrorMessage(reason, t, "error.categorySave")); }
      finally { setSaving(false); }
    }}>
      <label><span>{t("groups.label")}</span><input required value={nextName} onChange={(event) => setNextName(event.target.value)} /></label>
      <p className="dialog-description">{t("groups.renameHint")}</p>
      {error && <p role="alert" className="dialog-form-error">{error}</p>}
      <footer><button type="button" className="button secondary" onClick={onClose}>{t("common.cancel")}</button><button className="button affirmative" disabled={saving || !nextName.trim()}>{t("common.save")}</button></footer>
    </form>
  </Dialog>;
}

function CurrencyDialog({ currency, onClose, onSaved }: { currency: Currency | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useI18n();
  const [code, setCode] = useState(currency?.code ?? "");
  const [name, setName] = useState(currency?.name ?? "");
  const [symbol, setSymbol] = useState(currency?.symbol ?? "");
  const [kind, setKind] = useState<CurrencyKind>(currency?.kind ?? "custom");
  const [fractionDigits, setFractionDigits] = useState(String(currency?.fractionDigits ?? 2));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      await persistCurrency({ code, name, symbol, kind, fractionDigits: fractionDigits.trim() ? Number(fractionDigits) : NaN, builtIn: false, archived: currency?.archived ?? false }, currency?.code);
      await onSaved();
    } catch (reason) {
      setFormError(translatedErrorMessage(reason, t, "error.currencySave"));
    } finally {
      setSaving(false);
    }
  };
  return <Dialog title={currency ? t("dialog.editCurrency") : t("dialog.addCurrency")} eyebrow={t("settings.referenceData")} onClose={onClose} busy={saving} submitShortcut><form className="dialog-form" onSubmit={submit}><div className="form-grid"><label><span>{t("dialog.currencyCode")}</span><input required minLength={3} maxLength={8} disabled={Boolean(currency)} value={code} onChange={(event) => setCode(asciiDigits(event.target.value).toUpperCase().replace(/[^A-Z0-9]/g, ""))} /><small>{t("dialog.currencyCodeDescription")}</small></label><label><span>{t("dialog.currencyName")}</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>{t("dialog.currencySymbol")}</span><input required value={symbol} onChange={(event) => setSymbol(event.target.value)} /></label><label><span>{t("dialog.currencyKind")}</span><select value={kind} onChange={(event) => setKind(event.target.value as CurrencyKind)}><option value="fiat">{t("settings.currencyKindFiat")}</option><option value="crypto">{t("settings.currencyKindCrypto")}</option><option value="custom">{t("settings.currencyKindCustom")}</option></select></label><label className="wide"><span>{t("dialog.decimalPlaces")}</span><input required inputMode="numeric" pattern="[0-9]+" value={fractionDigits} onChange={(event) => setFractionDigits(asciiDigits(event.target.value))} /></label></div>{formError && <p className="dialog-form-error" role="alert">{formError}</p>}<footer><button type="button" className="button secondary" onClick={onClose}>{t("common.cancel")}</button><button className="button affirmative" disabled={saving}>{saving ? t("activity.saving") : t("dialog.saveCurrency")}</button></footer></form></Dialog>;
}

function RateDialog({ rate, currencies, rates, showJalali, onClose, onSaved }: { rate: Rate | null; currencies: Currency[]; rates: Rate[]; showJalali: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useI18n();
  const [currency, setCurrency] = useState(rate?.quoteCurrency ?? "");
  const [value, setValue] = useState(rate?.value ?? "");
  const [effectiveDate, setEffectiveDate] = useState(rate?.effectiveDate ?? isoToday());
  const [source, setSource] = useState(rate?.source ?? t("settings.manualEntry"));
  const [granularity, setGranularity] = useState<"daily" | "monthly">(rate?.granularity ?? "daily");
  const [locked, setLocked] = useState(rate?.locked ?? true);
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const currencyOptions = currencies.filter(item => item.code !== "EUR" && (!item.archived || item.code === currency)).sort((a, b) => a.code.localeCompare(b.code));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    const date = granularity === "monthly" ? effectiveDate.slice(0, 7) + "-01" : effectiveDate;
    try {
      const row: Rate = { ...rate, id: rate?.id ?? rateId(currency, date, granularity), baseCurrency: "EUR", quoteCurrency: currency,
        value: money(value).toString(), effectiveDate: date, source: source.trim(), granularity, locked, method: "manual", createdAt: rate?.createdAt ?? new Date().toISOString() };
      if (!validRate(row) || date > isoToday() || (!rate && rates.some(existing => existing.quoteCurrency === currency && existing.effectiveDate === date && (existing.granularity ?? "daily") === granularity))) { setError(t("history.invalidManual")); return; }
      setSaving(true); await persistRate(row); await onSaved();
    } catch { setError(t("history.saveError")); } finally { setSaving(false); }
  };
  return <Dialog title={rate ? t("dialog.editRate") : t("dialog.addRate")} eyebrow={t("dialog.eurBase")} busy={saving} submitShortcut onClose={() => { if (!saving) onClose(); }}><form className="dialog-form" onSubmit={submit}>
    <div className="form-grid">
      <label><span>{t("dialog.quoteCurrency")}</span><select required disabled={Boolean(rate)} value={currency} onChange={event => setCurrency(event.target.value)}><option value="" disabled>{t("dialog.chooseCurrency")}</option>{currencyOptions.map(item => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label>
      <label><span>{t("dialog.unitsPerEur")}</span><input required inputMode="decimal" value={value} onChange={event => setValue(normalizeNumericInput(event.target.value))} />{currency === "IRR" && <small>{t("history.rials")}</small>}</label>
      <label><span>{t("history.period")}</span><select disabled={Boolean(rate)} value={granularity} onChange={event => setGranularity(event.target.value as "daily" | "monthly")}><option value="daily">{t("history.daily")}</option><option value="monthly">{t("history.monthly")}</option></select></label>
      {rate ? <label><span>{t("dialog.effectiveDate")}</span><input value={effectiveDate} disabled /></label> : granularity === "monthly" ? <label><span>{t("history.month")}</span><input required type="month" max={isoToday().slice(0, 7)} value={effectiveDate.slice(0, 7)} onChange={event => setEffectiveDate(event.target.value + "-01")} /></label> : <EntryDateField label={t("dialog.effectiveDate")} value={effectiveDate} onChange={setEffectiveDate} showJalali={showJalali} />}
      <label className="wide"><span>{t("dialog.source")}</span><input required value={source} onChange={event => setSource(event.target.value)} /></label>
    </div>
    <label className="checkbox-label"><input type="checkbox" checked={locked} onChange={event => setLocked(event.target.checked)} />{t("history.keepLocked")}</label><p className="field-help">{t("history.lockHelp")}</p>
    {error && <p role="alert" className="chart-data-warning">{error}</p>}
    <footer><button type="button" className="button secondary" onClick={onClose} disabled={saving}>{t("common.cancel")}</button><button className="button affirmative" disabled={saving}>{t("dialog.saveRate")}</button></footer>
  </form></Dialog>;
}
