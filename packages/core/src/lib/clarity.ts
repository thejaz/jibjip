import { AppError } from "./app-error.ts";
import { localDate } from "./dates.ts";
import type { AppSnapshot } from "./types.ts";

export const CLARITY_TASKS = ["transactions", "categories", "balance"] as const;
export type ClarityTask = (typeof CLARITY_TASKS)[number];
export const CLARITY_POINTS = 10;

export interface ClarityAward {
  /** Local Monday identifying the review week, independent of interface locale. */
  period: string;
  task: ClarityTask;
  completedAt: string;
}

export interface ClarityState {
  enabled: boolean;
  awards: ClarityAward[];
}

export function clarityWeek(day = localDate()): string {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return localDate(date);
}

function validPeriod(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T12:00:00`)) &&
    localDate(new Date(`${value}T12:00:00`)) === value && clarityWeek(value) === value;
}

/** Missing preferences use the enabled default; explicit opt-outs and unique awards survive. */
export function normalizeClarity(value: unknown): ClarityState {
  const candidate = value && typeof value === "object" ? value as Partial<ClarityState> : {};
  const awards = new Map<string, ClarityAward>();
  for (const item of Array.isArray(candidate.awards) ? candidate.awards : []) {
    if (!item || !validPeriod(item.period) || !CLARITY_TASKS.includes(item.task) ||
        typeof item.completedAt !== "string" || !Number.isFinite(Date.parse(item.completedAt))) continue;
    const award = { period: item.period, task: item.task, completedAt: item.completedAt };
    const key = `${award.period}:${award.task}`;
    const existing = awards.get(key);
    if (!existing || award.completedAt < existing.completedAt) awards.set(key, award);
  }
  return { enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : true, awards: [...awards.values()].sort((a, b) =>
    a.period.localeCompare(b.period) || a.task.localeCompare(b.task)) };
}

export function clarityProgress(value: unknown, day = localDate()) {
  const state = normalizeClarity(value);
  const completed = state.awards.filter(award => award.period === clarityWeek(day)).map(award => award.task);
  return { total: state.awards.length * CLARITY_POINTS, weekly: completed.length * CLARITY_POINTS, completed };
}

/** Kept in the open dialog only; never persisted in the award ledger or exported. */
export interface ClarityReviewContext {
  day: string;
  task: ClarityTask;
  walletId: string | null;
  signature: string;
}

type ReviewSnapshot = Pick<AppSnapshot, "transactions" | "wallets" | "categories">;

/** The visible review and the atomic stale-data check must cover the same postings. */
export function clarityReviewRows(snapshot: ReviewSnapshot, task: ClarityTask, walletId: string | null, day = localDate()) {
  const start = clarityWeek(day);
  return snapshot.transactions.filter(row => task === "balance" ? row.walletId === walletId
    : row.date >= start && row.date <= day && (task !== "categories" || row.operation === "transaction"));
}

export function clarityReviewContext(snapshot: ReviewSnapshot, task: ClarityTask, walletId: string | null = null, day = localDate()): ClarityReviewContext {
  if (!CLARITY_TASKS.includes(task)) throw new AppError("error.clarityStale", "Reopen this review.");
  const transactions = clarityReviewRows(snapshot, task, walletId, day);
  const walletIds = new Set(transactions.map(row => row.walletId));
  if (task === "balance" && walletId) walletIds.add(walletId);
  const wallets = snapshot.wallets.filter(row => walletIds.has(row.id));
  if (task === "balance" && !wallets.some(row => row.id === walletId && !row.archived)) {
    throw new AppError("error.clarityWallet", "Choose an active wallet.");
  }
  const categoryIds = new Set(transactions.map(row => row.categoryId));
  const categories = task === "categories" ? snapshot.categories.filter(row => categoryIds.has(row.id)) : [];
  const ordered = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return { day, task, walletId: task === "balance" ? walletId : null,
    signature: JSON.stringify([ordered(transactions), ordered(wallets), ordered(categories)]) };
}

/** Call with the latest state/context inside the same write transaction as the ledger save. */
export function completeClarityReview(value: unknown, expected: ClarityReviewContext, snapshot: ReviewSnapshot, now = new Date()): { state: ClarityState; awarded: boolean } {
  const state = normalizeClarity(value);
  const day = localDate(now);
  if (!state.enabled) throw new AppError("error.clarityDisabled", "Clarity points are switched off.");
  if (expected.day !== day || !CLARITY_TASKS.includes(expected.task)) {
    throw new AppError("error.clarityStale", "The review period changed. Reopen this review.");
  }
  const period = clarityWeek(day);
  if (state.awards.some(award => award.period === period && award.task === expected.task)) return { state, awarded: false };
  if (clarityReviewContext(snapshot, expected.task, expected.walletId, day).signature !== expected.signature) {
    throw new AppError("error.clarityStale", "Records changed. Reopen this review before confirming.");
  }
  state.awards = normalizeClarity({ ...state, awards: [...state.awards,
    { period, task: expected.task, completedAt: now.toISOString() }] }).awards;
  return { state, awarded: true };
}
