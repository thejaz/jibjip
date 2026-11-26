import Decimal from "decimal.js";
import { localDate } from "./dates.ts";
import type { Rate } from "./types.ts";
import { fetchIrrFallbacks, parseTgjuHistory, TGJU_SOURCE_URL, validRateDate } from "./rate-history.ts";

const BASELINE_CREATED_AT = "2026-07-23T00:00:00.000Z";

function baseline(
  quoteCurrency: string,
  value: string,
  effectiveDate: string,
  source: string,
  method: Rate["method"] = "reference",
): Rate {
  return {
    id: `rate-baseline-${quoteCurrency.toLowerCase()}`,
    baseCurrency: "EUR",
    quoteCurrency,
    value,
    effectiveDate,
    source,
    method,
    createdAt: BASELINE_CREATED_AT,
  };
}

/**
 * Public, offline-safe rates. Six values come from the user's approved current
 * Full backup; missing values were filled from the named public providers.
 * These are one current EUR-based baseline per non-EUR built-in currency.
 */
export const OFFLINE_BASELINE_RATES: readonly Rate[] = [
  baseline("USD", "1.14", "2026-07-15", "Personal baseline; original source: Google"),
  baseline("GBP", "0.85082", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("CHF", "0.9223", "2026-07-10", "European Central Bank; personal baseline"),
  baseline("CAD", "1.6073", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("AUD", "1.641", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("JPY", "186.07", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("CNY", "7.7582", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("INR", "110.3", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("CZK", "24.19", "2026-07-10", "Personal database manual rate; approved current Full backup"),
  baseline("SEK", "11.0499", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("NOK", "11.073", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("DKK", "7.4833", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("PLN", "4.3443", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("HUF", "362.71", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("RON", "5.2456", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("ISK", "143.43", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("UAH", "51.132", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("RSD", "117.46", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("RUB", "89.47", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("TRY", "53.7039", "2026-07-10", "European Central Bank; personal baseline"),
  baseline("AED", "4.2073", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("SAR", "4.2961", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("IRR", "2102000", "2026-07-15", "TGJU Iranian open market; personal baseline"),
  baseline("AFN", "75.531", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("AMD", "419.54", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("AZN", "1.947", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("IQD", "1500.57", "2026-07-18", "Frankfurter multi-provider reference"),
  baseline("PKR", "319.36", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("TMT", "4.0097", "2026-07-19", "Frankfurter multi-provider reference"),
  baseline("BRL", "5.8007", "2026-07-23", "Frankfurter multi-provider reference"),
  baseline("EGP", "58.487", "2026-07-23", "Frankfurter multi-provider reference"),
  baseline("ETB", "183.02", "2026-07-22", "Frankfurter multi-provider reference"),
  baseline("IDR", "20453", "2026-07-23", "Frankfurter multi-provider reference"),
  baseline("ZAR", "18.7743", "2026-07-23", "Frankfurter multi-provider reference"),
  baseline("BTC", "0.0000177204423022398639", "2026-07-19", "CoinGecko market price"),
  baseline("ETH", "0.000611127407841986897", "2026-07-19", "CoinGecko market price"),
  baseline("USDT", "1.14462575316374558", "2026-07-19", "CoinGecko market price"),
] as const;

export function mergeOfflineBaselineRates(existing: Rate[]): Rate[] {
  const normalized = normalizeRateRows(existing).filter((rate) =>
    rate.baseCurrency === "EUR" && rate.quoteCurrency !== "EUR",
  );
  const present = new Set(normalized.map((rate) => rate.quoteCurrency));
  return [
    ...normalized,
    ...OFFLINE_BASELINE_RATES.filter((rate) => !present.has(rate.quoteCurrency)).map((rate) => ({ ...rate })),
  ];
}

/** Preserve dated observations; EUR is always the implicit benchmark. */
export function normalizeRateRows(existing: readonly Rate[]): Rate[] {
  return existing.filter(rate => rate.baseCurrency !== "EUR" || rate.quoteCurrency !== "EUR");
}

export interface RateProposal {
  quoteCurrency: string;
  value: string;
  effectiveDate: string;
  source: string;
  sourceUrl?: string;
  provider: "ECB" | "Frankfurter" | "TGJU" | "CoinGecko" | "USD-parity";
  fallback: boolean;
  currentValue: string | null;
  changePercent: string | null;
}

export interface UnavailableRate {
  quoteCurrency: string;
  reason: "provider-unavailable" | "invalid-response";
}

export interface RateFetchResult {
  proposals: RateProposal[];
  unavailable: UnavailableRate[];
  fetchedAt: string;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface FrankfurterRow {
  date?: unknown;
  base?: unknown;
  quote?: unknown;
  rate?: unknown;
}

function latestExisting(rates: Rate[], currency: string): Rate | undefined {
  return rates
    .filter((rate) => rate.quoteCurrency === currency)
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))[0];
}

function normalizedPositiveDecimal(value: unknown): string | null {
  const cleaned = String(value ?? "").replace(/,/g, "").trim();
  try {
    const decimal = new Decimal(cleaned);
    return decimal.isFinite() && decimal.gt(0) ? decimal.toString() : null;
  } catch {
    return null;
  }
}

function proposal(
  currency: string,
  value: string,
  effectiveDate: string,
  source: string,
  provider: RateProposal["provider"],
  fallback: boolean,
  existing: Rate[],
): RateProposal {
  const currentValue = latestExisting(existing, currency)?.value ?? null;
  const changePercent = currentValue && !new Decimal(currentValue).isZero()
    ? new Decimal(value).minus(currentValue).div(currentValue).mul(100).toSignificantDigits(8).toString()
    : null;
  return { quoteCurrency: currency, value, effectiveDate, source, provider, fallback, currentValue, changePercent };
}

async function fetchJson(fetcher: FetchLike, url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetcher(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function parseFrankfurterRows(value: unknown): FrankfurterRow[] {
  return Array.isArray(value) ? value.filter((row): row is FrankfurterRow => Boolean(row) && typeof row === "object") : [];
}

function recentRateDate(value: unknown, today: string): value is string {
  return validRateDate(value) && value <= today &&
    Date.parse(`${today}T00:00:00Z`) - Date.parse(`${value}T00:00:00Z`) <= 7 * 86400000;
}

async function fetchFiatProposals(
  currencies: string[],
  existing: Rate[],
  fetcher: FetchLike,
  date: string,
): Promise<Map<string, RateProposal>> {
  const found = new Map<string, RateProposal>();
  if (currencies.length === 0) return found;
  const quotes = currencies.join(",");
  const attempts: Array<{ url: string; provider: "ECB" | "Frankfurter"; source: string; fallback: boolean }> = [
    {
      url: `https://api.frankfurter.dev/v2/rates?base=EUR&quotes=${encodeURIComponent(quotes)}&providers=ECB`,
      provider: "ECB",
      source: "European Central Bank via Frankfurter",
      fallback: false,
    },
    {
      url: `https://api.frankfurter.dev/v2/rates?base=EUR&quotes=${encodeURIComponent(quotes)}`,
      provider: "Frankfurter",
      source: "Frankfurter multi-provider reference",
      fallback: true,
    },
  ];
  for (const attempt of attempts) {
    if (found.size === currencies.length) break;
    let rows: FrankfurterRow[] = [];
    try {
      rows = parseFrankfurterRows(await fetchJson(fetcher, attempt.url));
    } catch {
      continue;
    }
    for (const row of rows) {
      const currency = String(row.quote ?? "").toUpperCase();
      if (row.base !== "EUR" || !currencies.includes(currency) || found.has(currency)) continue;
      const value = normalizedPositiveDecimal(row.rate);
      if (!value || !recentRateDate(row.date, date)) continue;
      found.set(currency, proposal(currency, value, row.date, attempt.source, attempt.provider, attempt.fallback, existing));
    }
  }
  return found;
}

async function fetchIrrProposal(
  existing: Rate[],
  fetcher: FetchLike,
  date: string,
  fetchedAt: string,
): Promise<RateProposal | null> {
  const recent = (row: Rate) => recentRateDate(row.effectiveDate, date);
  const asProposal = (row: Rate, fallback: boolean): RateProposal => ({
    ...proposal("IRR", row.value, row.effectiveDate, row.source, "TGJU", fallback, existing), sourceUrl: row.sourceUrl,
  });
  try {
    const payload = await fetchJson(fetcher, "https://api.tgju.org/v1/market/indicator/summary-table-data/price_eur?length=1") as { data?: unknown[][] };
    // A one-row query intentionally has fewer rows than TGJU's complete archive count.
    const rows = parseTgjuHistory({ data: payload?.data, recordsTotal: payload?.data?.length }, fetchedAt);
    const row = rows.filter(recent).at(-1);
    if (row) return asProposal(row, false);
  } catch { /* Browser access and malformed or stale observations can require a replica. */ }
  const rows = await fetchIrrFallbacks(fetcher, fetchedAt, rows => rows.some(recent));
  const row = rows.filter(recent).at(-1);
  return row ? asProposal(row, true) : null;
}

async function fetchCryptoProposals(
  currencies: string[],
  existing: Rate[],
  fetcher: FetchLike,
  date: string,
): Promise<Map<string, RateProposal>> {
  const found = new Map<string, RateProposal>();
  if (currencies.length === 0) return found;
  const ids: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum", USDT: "tether" };
  try {
    const payload = await fetchJson(
      fetcher,
      `https://api.coingecko.com/api/v3/simple/price?ids=${currencies.map((code) => ids[code]).join(",")}&vs_currencies=eur&include_last_updated_at=true`,
    ) as Record<string, { eur?: unknown; last_updated_at?: unknown }>;
    for (const currency of currencies) {
      const market = payload?.[ids[currency]];
      const eurPrice = normalizedPositiveDecimal(market?.eur);
      if (!eurPrice) continue;
      const value = new Decimal(1).div(eurPrice).toSignificantDigits(20).toString();
      const timestamp = Number(market?.last_updated_at);
      const updated = new Date(timestamp * 1000);
      if (!Number.isFinite(timestamp) || timestamp <= 0 || !Number.isFinite(updated.getTime())) continue;
      const effectiveDate = updated.toISOString().slice(0, 10);
      if (!recentRateDate(effectiveDate, date)) continue;
      found.set(currency, proposal(currency, value, effectiveDate, "CoinGecko market price", "CoinGecko", false, existing));
    }
  } catch {
    // Missing crypto proposals are reported by the caller.
  }
  return found;
}

export async function fetchRateProposals(
  currencies: string[],
  existing: Rate[],
  fetcher: FetchLike = fetch,
  now = new Date(),
): Promise<RateFetchResult> {
  const requested = [...new Set(currencies.map((currency) => currency.toUpperCase()))]
    .filter((currency) => currency !== "EUR");
  const date = localDate(now);
  const crypto = requested.filter((currency) => ["BTC", "ETH", "USDT"].includes(currency));
  const fiat = requested.filter((currency) => currency !== "IRR" && !crypto.includes(currency));
  const [fiatFound, irr, cryptoFound] = await Promise.all([
    fetchFiatProposals(fiat, existing, fetcher, date),
    requested.includes("IRR") ? fetchIrrProposal(existing, fetcher, date, now.toISOString()) : Promise.resolve(null),
    fetchCryptoProposals(crypto, existing, fetcher, date),
  ]);
  const found = new Map([...fiatFound, ...cryptoFound]);
  if (irr) found.set("IRR", irr);
  for (const [currency, item] of found) {
    if (!validRateDate(item.effectiveDate) || item.effectiveDate > date) found.delete(currency);
  }

  if (requested.includes("USDT") && !found.has("USDT")) {
    const usd = found.get("USD") ?? latestExisting(existing.filter(row => row.baseCurrency === "EUR" &&
      row.granularity !== "monthly" && recentRateDate(row.effectiveDate, date)), "USD");
    if (usd) {
      found.set("USDT", { ...proposal(
        "USDT",
        usd.value,
        usd.effectiveDate,
        `Temporary 1 USDT = 1 USD parity; CoinGecko unavailable; USD: ${usd.source}`,
        "USD-parity",
        true,
        existing,
      ), sourceUrl: usd.sourceUrl ?? ("provider" in usd ? "https://frankfurter.dev/" : undefined) });
    }
  }

  return {
    proposals: requested.flatMap((currency) => found.has(currency) ? [found.get(currency)!] : []),
    unavailable: requested
      .filter((currency) => !found.has(currency))
      .map((quoteCurrency) => ({ quoteCurrency, reason: "provider-unavailable" as const })),
    fetchedAt: now.toISOString(),
  };
}

export function acceptedProposalRate(item: RateProposal, id: string, createdAt: string): Rate {
  return {
    id,
    baseCurrency: "EUR",
    quoteCurrency: item.quoteCurrency,
    value: new Decimal(item.value).toString(),
    effectiveDate: item.effectiveDate,
    source: item.source,
    method: "automatic",
    createdAt,
    granularity: "daily",
    fetchedAt: createdAt,
    sourceUrl: item.sourceUrl ?? (item.provider === "TGJU" ? TGJU_SOURCE_URL : item.provider === "USD-parity" ? undefined : item.provider === "ECB" || item.provider === "Frankfurter" ? "https://frankfurter.dev/" : "https://www.coingecko.com/"),
  };
}
