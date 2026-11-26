import Decimal from "decimal.js";
import { localDate } from "./dates.ts";
import type { Rate } from "./types.ts";

export const TGJU_HISTORY_URL = "https://api.tgju.org/v1/market/indicator/summary-table-data/price_eur?length=10000";
export const TGJU_SOURCE_URL = "https://www.tgju.org/profile/price_eur/history";
export const IRR_MIRROR_URL = "https://raw.githubusercontent.com/kooroshkz/Euro-Rial-Toman-Live-Price-Dataset/main/data/Euro_Rial_Price_Dataset.csv";
export const IRR_MIRROR_SOURCE = "https://github.com/kooroshkz/Euro-Rial-Toman-Live-Price-Dataset";
export const IRR_CDN_URL = "https://cdn.jsdelivr.net/gh/kooroshkz/Euro-Rial-Toman-Live-Price-Dataset@main/data/Euro_Rial_Price_Dataset.csv";
export const IRR_FALLBACK_URLS = [IRR_MIRROR_URL, IRR_CDN_URL] as const;
export const FRANKFURTER_URL = "https://api.frankfurter.dev/v2/rates";

export function validRateDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function rateKey(rate: Pick<Rate, "quoteCurrency" | "effectiveDate" | "granularity">): string {
  return `${rate.quoteCurrency}:${rate.granularity ?? "daily"}:${rate.effectiveDate}`;
}

export function rateId(currency: string, date: string, granularity = "daily"): string {
  return `rate-${currency.toLowerCase()}-${granularity}-${date}`;
}

export function validRate(rate: Rate): boolean {
  try {
    return Boolean(rate && typeof rate.id === "string" && rate.id && rate.baseCurrency === "EUR" &&
      /^[A-Z][A-Z0-9]{1,11}$/.test(rate.quoteCurrency) && rate.quoteCurrency !== "EUR" &&
      typeof rate.value === "string" && new Decimal(rate.value).isFinite() && new Decimal(rate.value).gt(0) &&
      validRateDate(rate.effectiveDate) && typeof rate.source === "string" && rate.source.trim() &&
      ["manual", "automatic", "system", "reference"].includes(rate.method) &&
      typeof rate.createdAt === "string" && Number.isFinite(Date.parse(rate.createdAt)) &&
      (rate.granularity === undefined || rate.granularity === "daily" || (rate.granularity === "monthly" && rate.effectiveDate.endsWith("-01"))) &&
      (rate.locked === undefined || typeof rate.locked === "boolean") &&
      (rate.sourceUrl === undefined || (typeof rate.sourceUrl === "string" && /^https:\/\//.test(rate.sourceUrl))) &&
      (rate.fetchedAt === undefined || Number.isFinite(Date.parse(rate.fetchedAt))) &&
      (rate.sampleCount === undefined || (Number.isInteger(rate.sampleCount) && rate.sampleCount > 0 && rate.sampleCount <= 31)));
  } catch { return false; }
}

/** Pure plan, repeated inside the database transaction so a newly locked row is protected. */
export function planRateUpdates(existing: readonly Rate[], incoming: readonly Rate[], automatic = true) {
  const byKey = new Map(existing.map(row => [rateKey(row), row]));
  const byId = new Map(existing.map(row => [row.id, row]));
  const seen = new Set<string>();
  const seenIds = new Set<string>();
  const puts: Rate[] = [];
  let protectedCount = 0;
  let unchanged = 0;
  for (const row of incoming) {
    if (!validRate(row) || seen.has(rateKey(row)) || seenIds.has(row.id)) throw new Error("Invalid or duplicate rate observation.");
    seen.add(rateKey(row));
    seenIds.add(row.id);
    const current = byKey.get(rateKey(row));
    const sameId = byId.get(row.id);
    if (sameId && rateKey(sameId) !== rateKey(row)) throw new Error("A saved rate's currency, date, and period cannot be changed. Add a new rate instead.");
    if (automatic && current && (current.locked || current.method === "manual")) { protectedCount++; continue; }
    if (current && current.value === row.value && current.source === row.source &&
      current.method === row.method && current.locked === row.locked && current.sourceUrl === row.sourceUrl &&
      current.sampleCount === row.sampleCount) { unchanged++; continue; }
    puts.push(current ? { ...row, id: current.id, createdAt: current.createdAt } : row);
  }
  return { puts, protectedCount, unchanged };
}

interface RateIndex { daily: Rate[]; monthly: Map<string, Rate>; monthlyHistory: Rate[] }
const indexes = new WeakMap<readonly Rate[], Map<string, RateIndex>>();
function rateIndex(rates: readonly Rate[], currency: string): RateIndex | undefined {
  let indexed = indexes.get(rates);
  if (!indexed) {
    indexed = new Map();
    for (const rate of rates) {
      if (rate.baseCurrency !== "EUR") continue;
      const series: RateIndex = indexed.get(rate.quoteCurrency) ?? { daily: [], monthly: new Map(), monthlyHistory: [] };
      if (rate.granularity === "monthly") series.monthly.set(rate.effectiveDate.slice(0, 7), rate);
      else series.daily.push(rate);
      indexed.set(rate.quoteCurrency, series);
    }
    for (const series of indexed.values()) {
      series.daily.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
      series.monthlyHistory = [...series.monthly.values()].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    }
    indexes.set(rates, indexed);
  }
  return indexed.get(currency);
}

export type RateQuality = "daily" | "previous" | "monthly" | "estimate";
export interface ResolvedRate { rate: Rate; quality: RateQuality }
function daysBetween(a: string, b: string): number { return Math.abs(Date.parse(a) - Date.parse(b)) / 86400000; }
function priorObservation(rows: Rate[], date: string): Rate | undefined {
  let lo = 0; let hi = rows.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (rows[mid].effectiveDate <= date) lo = mid + 1; else hi = mid; }
  return rows[lo - 1];
}
function periodEnd(rate: Rate): string {
  if (rate.granularity !== "monthly") return rate.effectiveDate;
  return new Date(Date.UTC(Number(rate.effectiveDate.slice(0, 4)), Number(rate.effectiveDate.slice(5, 7)), 0)).toISOString().slice(0, 10);
}

/** Daily close, preceding trading day (up to 7 days), same-month mean, then disclosed estimate. */
export function resolveRate(rates: readonly Rate[], currency: string, date = localDate()): ResolvedRate | null {
  const series = rateIndex(rates, currency);
  if (!series) return null;
  const prior = priorObservation(series.daily, date);
  if (prior?.effectiveDate === date) return { rate: prior, quality: "daily" };
  if (prior && daysBetween(prior.effectiveDate, date) <= 7) return { rate: prior, quality: "previous" };
  const month = series.monthly.get(date.slice(0, 7));
  if (month) return { rate: month, quality: "monthly" };
  // An older quote is an estimate, never silently claimed to be the transaction-date price.
  const priorMonth = priorObservation(series.monthlyHistory, date);
  const latestPrior = priorMonth && (!prior || periodEnd(priorMonth) > prior.effectiveDate) ? priorMonth : prior;
  if (latestPrior) return { rate: latestPrior, quality: "estimate" };
  const candidates = [...series.daily.slice(0, 1), ...series.monthly.values()];
  const nearest = candidates.sort((a, b) => daysBetween(a.effectiveDate, date) - daysBetween(b.effectiveDate, date))[0];
  return nearest ? { rate: nearest, quality: "estimate" } : null;
}

export function currentRateRows(rates: readonly Rate[], date = localDate()): Rate[] {
  return [...new Set(rates.map(r => r.quoteCurrency))].sort().flatMap(code => {
    const match = resolveRate(rates, code, date); return match ? [match.rate] : [];
  });
}

function decimal(value: unknown): string {
  const text = String(value ?? "").replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(text) || !new Decimal(text).gt(0)) throw new Error("Invalid rate value.");
  return new Decimal(text).toString();
}
function observation(currency: string, date: string, value: unknown, source: string, sourceUrl: string, fetchedAt: string): Rate {
  if (!validRateDate(date)) throw new Error("Invalid observation date.");
  return { id: rateId(currency, date), baseCurrency: "EUR", quoteCurrency: currency, value: decimal(value), effectiveDate: date,
    granularity: "daily", source, sourceUrl, method: "automatic", createdAt: fetchedAt, fetchedAt };
}
function deduplicate(rows: Rate[]): Rate[] {
  const unique = new Map<string, Rate>();
  for (const row of rows) {
    const old = unique.get(rateKey(row));
    if (old && old.value !== row.value) throw new Error("Conflicting rates for the same date.");
    unique.set(rateKey(row), row);
  }
  return [...unique.values()].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}

export function parseTgjuHistory(payload: unknown, fetchedAt: string, diagnostics = { rejected: 0 }): Rate[] {
  const data = payload as { data?: unknown; recordsTotal?: unknown };
  if (!data || !Array.isArray(data.data) || data.data.length === 0 ||
    !Number.isInteger(data.recordsTotal) || data.recordsTotal !== data.data.length) throw new Error("Incomplete TGJU archive.");
  return deduplicate(data.data.flatMap((row: unknown) => {
    if (!Array.isArray(row) || row.length < 7) throw new Error("Invalid TGJU row.");
    // TGJU columns are open, low, high, CLOSE, changes, Gregorian date. Values are rials, not tomans.
    const close = decimal(row[3]); const low = decimal(row[1]); const high = decimal(row[2]);
    if (new Decimal(close).lt(low) || new Decimal(close).gt(high)) { diagnostics.rejected++; return []; }
    return [observation("IRR", String(row[6]).replaceAll("/", "-"), close, "TGJU free-market daily close", TGJU_SOURCE_URL, fetchedAt)];
  }));
}

export function parseIrrMirror(text: string, fetchedAt: string, diagnostics = { rejected: 0 }, sourceUrl = IRR_MIRROR_SOURCE): Rate[] {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift()?.split(",");
  if (headers?.[3] !== "Close Price" || headers?.[6] !== "Gregorian Date") throw new Error("Unknown IRR archive format.");
  return deduplicate(lines.flatMap(line => {
    const row = line.split(",");
    if (row.length !== 8) throw new Error("Invalid IRR archive row.");
    const close = decimal(row[3]); const low = decimal(row[1]); const high = decimal(row[2]);
    if (new Decimal(close).lt(low) || new Decimal(close).gt(high)) { diagnostics.rejected++; return []; }
    return [observation("IRR", row[6].replaceAll("/", "-"), close, `TGJU free-market close via community archive${sourceUrl.includes("jsdelivr.net") ? " / jsDelivr" : ""}`, sourceUrl, fetchedAt)];
  }));
}

/** Completed, reasonably covered months only. A sampled mean is never labeled a daily quote. */
export function monthlyAverages(rows: Rate[], today: string): Rate[] {
  const groups = new Map<string, Rate[]>();
  for (const row of deduplicate(rows)) {
    if (row.granularity === "monthly" || row.effectiveDate.slice(0, 7) >= today.slice(0, 7)) continue;
    const key = `${row.quoteCurrency}:${row.effectiveDate.slice(0, 7)}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].flatMap(group => {
    const first = group[0]; const last = group.at(-1)!;
    if (group.length < 10 || Number(first.effectiveDate.slice(8)) > 7 || Number(last.effectiveDate.slice(8)) < 24) return [];
    const date = first.effectiveDate.slice(0, 7) + "-01";
    return [{ ...first, id: rateId(first.quoteCurrency, date, "monthly"), effectiveDate: date, granularity: "monthly" as const,
      value: group.reduce((sum, row) => sum.plus(row.value), new Decimal(0)).div(group.length).toSignificantDigits(20).toString(),
      sampleCount: group.length, source: `${first.source}; mean of available daily observations` }];
  });
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export interface HistoryResult { rows: Rate[]; unavailable: string[]; fetchedAt: string; mirrorUsed: boolean; rejected: number }
async function readSource(url: string, fetcher: FetchLike, signal?: AbortSignal): Promise<string> {
  checkAborted(signal);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 12_000);
  try {
    const response = await fetcher(url, { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`Rate source unavailable (${response.status}).`);
    const text = await response.text();
    checkAborted(signal);
    if (text.length > 8_000_000) throw new Error("Rate response is too large.");
    return text;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Rate fetch canceled.", "AbortError");
}

/** Try the second delivery host only if the first cannot provide usable observations. */
export async function fetchIrrFallbacks(fetcher: FetchLike, fetchedAt: string, usable: (rows: Rate[]) => boolean,
  signal?: AbortSignal, diagnostics = { rejected: 0 }): Promise<Rate[]> {
  for (const url of IRR_FALLBACK_URLS) {
    checkAborted(signal);
    try {
      const text = await readSource(url, fetcher, signal);
      const rows = parseIrrMirror(text, fetchedAt, diagnostics, url);
      if (usable(rows)) return rows;
    } catch { checkAborted(signal); }
  }
  return [];
}

/** Only public currency codes and whole calendar years leave the device, never financial records. */
export async function fetchRateHistory(currencies: string[], from: string, to: string, options: {
  fetcher?: FetchLike; signal?: AbortSignal; now?: Date; onProgress?: (completed: number, total: number) => void;
} = {}): Promise<HistoryResult> {
  const now = options.now ?? new Date(); const today = localDate(now); const fetchedAt = now.toISOString();
  if (!validRateDate(from) || !validRateDate(to) || from > to || to > today || from < "1999-01-01" || Number(to.slice(0, 4)) - Number(from.slice(0, 4)) > 30) throw new Error("Choose a valid range from 1999 through today (up to 30 years).");
  const requested = [...new Set(currencies)].filter(code => code !== "EUR");
  if (!requested.length || requested.some(code => !/^[A-Z][A-Z0-9]{1,11}$/.test(code))) throw new Error("Choose currencies to fetch.");
  const fetcher = options.fetcher ?? fetch; const rows: Rate[] = []; const unavailable: string[] = []; let mirrorUsed = false;
  const diagnostics = { rejected: 0 };
  const years = Array.from({ length: Number(to.slice(0, 4)) - Number(from.slice(0, 4)) + 1 }, (_, i) => Number(from.slice(0, 4)) + i);
  const total = requested.length * years.length; let completed = 0;
  const bufferDate = new Date(`${from}T00:00:00Z`);
  bufferDate.setUTCDate(bufferDate.getUTCDate() - 7);
  const buffer = bufferDate.toISOString().slice(0, 10);
  for (const currency of requested) {
    checkAborted(options.signal);
    if (["BTC", "ETH", "USDT"].includes(currency)) { unavailable.push(currency); completed += years.length; options.onProgress?.(completed, total); continue; }
    if (currency === "IRR") {
      let archive: Rate[] = [];
      const usable = (observations: Rate[]) => observations.some(row => row.effectiveDate >= buffer && row.effectiveDate <= to);
      try { archive = parseTgjuHistory(JSON.parse(await readSource(TGJU_HISTORY_URL, fetcher, options.signal)), fetchedAt, diagnostics); }
      catch { checkAborted(options.signal); }
      if (!usable(archive)) {
        archive = await fetchIrrFallbacks(fetcher, fetchedAt, usable, options.signal, diagnostics);
        mirrorUsed = archive.length > 0;
      }
      if (!archive.length) unavailable.push(currency);
      rows.push(...archive.filter(row => row.effectiveDate <= today));
      completed += years.length; options.onProgress?.(completed, total); continue;
    }
    for (const year of years) {
      checkAborted(options.signal); let found: Rate[] = [];
      for (const provider of ["ECB", ""]) {
        try {
          const end = `${year}-12-31` < today ? `${year}-12-31` : today;
          const payload: unknown = JSON.parse(await readSource(`${FRANKFURTER_URL}?base=EUR&quotes=${currency}&from=${year}-01-01&to=${end}${provider ? "&providers=ECB" : ""}`, fetcher, options.signal));
          if (!Array.isArray(payload)) throw new Error("Invalid fiat history response.");
          found = deduplicate(payload.map(row => {
            if (!row || row.base !== "EUR" || row.quote !== currency || !validRateDate(row.date) || row.date > end || row.date < `${year - 1}-12-20`) throw new Error("Unexpected fiat observation.");
            return observation(currency, row.date, row.rate, provider ? "ECB reference via Frankfurter" : "Frankfurter blended reference", "https://frankfurter.dev/", fetchedAt);
          }));
          if (found.length) break;
        } catch { checkAborted(options.signal); }
      }
      if (!found.length) unavailable.push(`${currency} ${year}`);
      rows.push(...found); options.onProgress?.(++completed, total);
    }
  }
  const daily = deduplicate(rows).filter(row => row.effectiveDate >= (buffer < from.slice(0, 7) + "-01" ? buffer : from.slice(0, 7) + "-01") && row.effectiveDate <= today);
  const monthly = monthlyAverages(daily, today).filter(row => row.effectiveDate.slice(0, 7) >= from.slice(0, 7) && row.effectiveDate.slice(0, 7) <= to.slice(0, 7));
  return { rows: [...daily.filter(row => row.effectiveDate >= buffer && row.effectiveDate <= to), ...monthly], unavailable, fetchedAt, mirrorUsed, rejected: diagnostics.rejected };
}
