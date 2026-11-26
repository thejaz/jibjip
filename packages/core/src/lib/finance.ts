import Decimal from "decimal.js";
import { resolveRate, type RateQuality } from "./rate-history.ts";
import { BUILT_IN_CURRENCIES } from "./catalogs.ts";
import { transactionIndex } from "./transaction-index.ts";
import { asciiDigits, normalizeNumericInput } from "./numeric-input.ts";
import { AppError } from "./app-error.ts";
import { dateFormatter, numberFormatter } from "./i18n/formatters.ts";
import type { AppSnapshot, IrrDisplayUnit, Rate, Transaction } from "./types.ts";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const money = (value: Decimal.Value) => new Decimal(value || 0);

/** Activity categories report outgoing legs as expenses and incoming legs as income when enabled. */
export function reportDirection(transaction: Transaction): "income" | "expense" | null {
  if (transaction.direction === "income" || transaction.direction === "expense") return transaction.direction;
  if (transaction.direction === "in") return "income";
  if (transaction.direction === "out") return "expense";
  return null;
}

const IRR_DISPLAY_DECIMAL_PLACES: Record<IrrDisplayUnit, number> = {
  IRR: 0,
  TMN: 1,
  HTM: 4,
  MTM: 7,
};

export function irrDisplayDecimalPlaces(unit: IrrDisplayUnit): number {
  return IRR_DISPLAY_DECIMAL_PLACES[unit];
}

/** Converts a canonical stored amount into the value shown in an amount input. */
export function amountForDisplayInput(
  amount: Decimal.Value,
  currency: string,
  irrDisplayUnit: IrrDisplayUnit,
): string {
  if (currency !== "IRR") return money(amount).toString();
  return money(amount)
    .div(new Decimal(10).pow(irrDisplayDecimalPlaces(irrDisplayUnit)))
    .toString();
}

/** Converts an amount input back to the canonical native-currency storage value. */
export function amountForStorage(
  amount: Decimal.Value,
  currency: string,
  irrDisplayUnit: IrrDisplayUnit,
): Decimal {
  let value: Decimal;
  try { value = money(typeof amount === "string" ? normalizeNumericInput(amount).trim() : amount); }
  catch { throw new AppError("error.invalidNumber", "Enter a valid number."); }
  return currency === "IRR"
    ? value.mul(new Decimal(10).pow(irrDisplayDecimalPlaces(irrDisplayUnit)))
    : value;
}

export function latestRate(
  rates: Rate[],
  currency: string,
  onDate = "9999-12-31",
): Decimal | null {
  if (currency === "EUR") return new Decimal(1);
  const candidates = rates
    .filter((rate) => rate.quoteCurrency === currency)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  const match = candidates.find((rate) => rate.effectiveDate <= onDate);
  return match ? new Decimal(match.value) : null;
}

export interface RateResolution {
  value: Decimal;
  usedFallback: boolean;
  quality?: RateQuality;
  rateDate?: string;
}

/** Shared transaction-date resolver. Older or future substitutes are explicitly estimates. */
export function rateWithNearestFallback(
  rates: Rate[], currency: string, onDate?: string,
): RateResolution | null {
  if (currency === "EUR") return { value: new Decimal(1), usedFallback: false, quality: "daily" };
  const match = resolveRate(rates, currency, onDate);
  return match ? { value: new Decimal(match.rate.value), usedFallback: match.quality === "monthly" || match.quality === "estimate",
    quality: match.quality, rateDate: match.rate.effectiveDate } : null;
}

export function rateOnOrBefore(
  rates: Rate[],
  currency: string,
  onDate: string,
): Decimal | null {
  if (currency === "EUR") return new Decimal(1);
  const match = rates
    .filter((rate) => rate.quoteCurrency === currency && rate.effectiveDate <= onDate)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
  return match ? new Decimal(match.value) : null;
}

export function editedBalanceAmount(
  current: Transaction,
  nextAmount: Decimal.Value,
  nextDirection: Transaction["direction"],
): string | undefined {
  const normalizedAmount = money(nextAmount).abs().toString();
  if (current.balanceAmount === undefined) {
    return current.affectsBalance
      ? signedBalanceAmount(normalizedAmount, nextDirection)
      : undefined;
  }
  if (normalizedAmount === current.amount && nextDirection === current.direction) {
    return current.balanceAmount;
  }
  return signedBalanceAmount(normalizedAmount, nextDirection);
}

export function signedBalanceAmount(
  amount: Decimal.Value,
  direction: Transaction["direction"],
): string {
  return money(amount)
    .abs()
    .mul(direction === "income" || direction === "in" ? 1 : -1)
    .toString();
}

export function convert(
  amount: Decimal.Value,
  from: string,
  to: string,
  rates: Rate[],
  onDate?: string,
): Decimal | null {
  return convertWithRateFallback(amount, from, to, rates, onDate)?.value ?? null;
}

export function convertWithRateFallback(
  amount: Decimal.Value,
  from: string,
  to: string,
  rates: Rate[],
  onDate?: string,
): RateResolution | null {
  if (from === to) return { value: new Decimal(amount), usedFallback: false };
  const fromRate = rateWithNearestFallback(rates, from, onDate);
  const toRate = rateWithNearestFallback(rates, to, onDate);
  if (!fromRate || !toRate || fromRate.value.isZero()) return null;
  return {
    value: new Decimal(amount).div(fromRate.value).mul(toRate.value),
    usedFallback: fromRate.usedFallback || toRate.usedFallback,
    quality: [fromRate.quality, toRate.quality].includes("estimate") ? "estimate" :
      [fromRate.quality, toRate.quality].includes("monthly") ? "monthly" :
      [fromRate.quality, toRate.quality].includes("previous") ? "previous" : "daily",
  };
}

/** Names the side of a failed conversion that lacks a usable rate, so warnings point at the right fix. */
export function missingRateCurrency(from: string, to: string, rates: Rate[], onDate?: string): string {
  const fromRate = rateWithNearestFallback(rates, from, onDate);
  return fromRate && !fromRate.value.isZero() ? to : from;
}

export function transactionSign(transaction: Transaction): 1 | -1 {
  return transaction.direction === "income" || transaction.direction === "in"
    ? 1
    : -1;
}

export function walletBalance(
  walletId: string,
  transactions: Transaction[],
): Decimal {
  return transactionIndex(transactions).balances.get(walletId) ?? new Decimal(0);
}

export function netWorth(snapshot: AppSnapshot, onDate?: string): {
  value: Decimal;
  missing: string[];
} {
  const target = snapshot.settings.reportingCurrency;
  const missing = new Set<string>();
  let value = new Decimal(0);
  for (const wallet of snapshot.wallets.filter((item) => !item.archived)) {
    const balance = walletBalance(wallet.id, snapshot.transactions);
    const converted = convert(
      balance,
      wallet.currency,
      target,
      snapshot.rates,
      onDate,
    );
    if (converted) value = value.plus(converted);
    else missing.add(missingRateCurrency(wallet.currency, target, snapshot.rates, onDate));
  }
  return { value, missing: [...missing] };
}

export function reportTotal(
  transactions: Transaction[],
  direction: "income" | "expense",
  targetCurrency: string,
  rates: Rate[],
  fromDate?: string,
): Decimal {
  return reportTotalWithMissing(transactions, direction, targetCurrency, rates, fromDate).value;
}

/** Like reportTotal, but names currencies whose postings were excluded for lack of a rate. */
export function reportTotalWithMissing(
  transactions: Transaction[],
  direction: "income" | "expense",
  targetCurrency: string,
  rates: Rate[],
  fromDate?: string,
): { value: Decimal; missing: string[] } {
  const missing = new Set<string>();
  let value = new Decimal(0);
  for (const transaction of transactions) {
    if (
      !transaction.reportable ||
      reportDirection(transaction) !== direction ||
      (fromDate && transaction.date < fromDate)
    ) continue;
    const converted = convert(
      transaction.amount,
      transaction.currency,
      targetCurrency,
      rates,
      transaction.date,
    );
    if (converted) value = value.plus(converted);
    else missing.add(missingRateCurrency(transaction.currency, targetCurrency, rates, transaction.date));
  }
  return { value, missing: [...missing].sort() };
}

export function formatMoney(
  amount: Decimal.Value,
  currency: string,
  compact = false,
  irrDisplayUnit: IrrDisplayUnit = "IRR",
  locale = "en",
): string {
  if (currency === "IRR") {
    const places = irrDisplayDecimalPlaces(irrDisplayUnit);
    const scaled = money(amount).div(new Decimal(10).pow(places));
    const [integer, fraction = ""] = scaled.toFixed(places).split(".");
    const sign = integer.startsWith("-") ? "-" : "";
    const digits = sign ? integer.slice(1) : integer;
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const trimmedFraction = fraction.replace(/0+$/, "");
    return `${sign}${grouped}${trimmedFraction ? `.${trimmedFraction}` : ""} ${irrDisplayUnit}`;
  }
  const decimal = new Decimal(amount);
  const fractionDigits = BUILT_IN_CURRENCIES.find((item) => item.code === currency)?.fractionDigits ?? 2;
  try {
    // A decimal string keeps every digit where Intl supports it; older engines read it as a number.
    return numberFormatter(locale, {
      numberingSystem: "latn",
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : fractionDigits,
      minimumFractionDigits: compact ? 0 : fractionDigits,
    }).format(decimal.toFixed() as `${number}`);
  } catch {
    const [integer, fraction = ""] = decimal.toFixed(compact ? Math.min(1, fractionDigits) : fractionDigits).split(".");
    const sign = integer.startsWith("-") ? "-" : "";
    const grouped = (sign ? integer.slice(1) : integer).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${sign}${grouped}${fraction ? `.${fraction}` : ""} ${currency}`;
  }
}

export function jalaliDate(
  value: string,
  locale = "en",
  numberingSystem: "latn" | "arabext" = "latn",
): string {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return dateFormatter(locale === "fa" ? "fa-IR-u-ca-persian" : "en-US-u-ca-persian", {
    numberingSystem,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

const persianNumericDate = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

function persianDateParts(date: Date): { year: number; month: number; day: number } | null {
  const parts = new Map(
    persianNumericDate
      .formatToParts(date)
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, Number(part.value)]),
  );
  const year = parts.get("year");
  const month = parts.get("month");
  const day = parts.get("day");
  return year && month && day ? { year, month, day } : null;
}

export function jalaliIsoDate(gregorianValue: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gregorianValue)) return "";
  const parts = persianDateParts(new Date(`${gregorianValue}T12:00:00Z`));
  return parts
    ? `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`
    : "";
}

export function gregorianDateFromJalali(jalaliValue: string): string | null {
  const normalized = asciiDigits(jalaliValue.trim());
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(normalized);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const target = { year: Number(yearText), month: Number(monthText), day: Number(dayText) };
  if (target.month < 1 || target.month > 12 || target.day < 1 || target.day > 31) return null;

  const candidate = new Date(Date.UTC(target.year + 621, 2, 1, 12));
  for (let offset = 0; offset < 400; offset += 1) {
    const parts = persianDateParts(candidate);
    if (parts?.year === target.year && parts.month === target.month && parts.day === target.day) {
      return `${candidate.getUTCFullYear()}-${String(candidate.getUTCMonth() + 1).padStart(2, "0")}-${String(candidate.getUTCDate()).padStart(2, "0")}`;
    }
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return null;
}

export function monthStart(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
