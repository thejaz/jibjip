import Decimal from "decimal.js";
import { AppError, type AppErrorKey } from "./app-error.ts";
import { money, signedBalanceAmount } from "./finance.ts";
import { transactionTypeLabel } from "./transaction-types.ts";
import type { Transaction, Wallet } from "./types.ts";
import { splitGroups } from "./splits.ts";

export type LinkedActivityKind = "transfer" | "exchange";

interface BuildLinkedActivityInput {
  kind: LinkedActivityKind;
  date: string;
  fromWallet: Wallet;
  toWallet: Wallet;
  sentAmount: string;
  receivedAmount: string;
  note: string;
  timestamp: string;
  linkId: string;
  reportable: boolean;
  existingRows?: Transaction[];
  createId: (prefix: string) => string;
}

export interface LinkedActivityChanges {
  rowsToPut: Transaction[];
  rowIdsToDelete: string[];
}

export interface TransactionActivity {
  id: string;
  rows: Transaction[];
  primary: Transaction;
  exchangeOut: Transaction | null;
  exchangeIn: Transaction | null;
}

/** Expand selected linked activities in one pass, even when thousands are selected. */
export function transactionRowsForActivities(activities: readonly TransactionActivity[], allTransactions: readonly Transaction[]): Transaction[] {
  const ids = new Set<string>();
  const links = new Set<string>();
  for (const activity of activities) {
    for (const row of activity.rows) {
      ids.add(row.id);
      if (row.linkId && (row.operation === "transfer" || row.operation === "exchange")) links.add(row.linkId);
    }
  }
  return allTransactions.filter(row => ids.has(row.id) || Boolean(row.linkId && links.has(row.linkId)));
}

/**
 * Collapse complete splits and app-linked exchanges for presentation. Historical
 * unlinked movements remain independent because their counterparts cannot be
 * reconstructed safely.
 */
export function groupTransactionActivities(
  transactions: Transaction[],
): TransactionActivity[] {
  // Invalid groups remain individually visible rather than concealing postings.
  const splits = new Map<string, Transaction[]>();
  const candidates = new Map<string, Transaction[]>();
  for (const row of transactions) {
    if (!row.split?.id) continue;
    const group = candidates.get(row.split.id) ?? [];
    group.push(row);
    candidates.set(row.split.id, group);
  }
  for (const [id, rows] of candidates) {
    try { splits.set(id, splitGroups(rows).get(id)!); } catch { /* Keep damaged groups visible. */ }
  }
  const emittedSplits = new Set<string>();
  const rowsByLink = new Map<string, Transaction[]>();
  for (const row of transactions) {
    if (!row.linkId) continue;
    const group = rowsByLink.get(row.linkId) ?? [];
    group.push(row);
    rowsByLink.set(row.linkId, group);
  }

  const groupedLinks = new Map<string, { out: Transaction; incoming: Transaction }>();
  for (const [linkId, rows] of rowsByLink) {
    const out = rows.find((row) => row.operation === "exchange" && row.direction === "out");
    const incoming = rows.find((row) => row.operation === "exchange" && row.direction === "in");
    // A damaged link must not hide extra or inconsistent postings from the list.
    if (rows.filter(row => row.operation === "exchange").length === 2 && out && incoming && out.id !== incoming.id &&
      !out.split && !incoming.split && out.walletId !== incoming.walletId &&
      out.currency !== incoming.currency && out.date === incoming.date) {
      groupedLinks.set(linkId, { out, incoming });
    }
  }

  const emitted = new Set<string>();
  const activities: TransactionActivity[] = [];
  for (const row of transactions) {
    const split = row.split ? splits.get(row.split.id) : undefined;
    if (split) {
      if (!emittedSplits.has(row.split!.id)) {
        emittedSplits.add(row.split!.id);
        activities.push({ id: `split:${row.split!.id}`, rows: split, primary: split[0], exchangeOut: null, exchangeIn: null });
      }
      continue;
    }
    const linked = row.linkId ? groupedLinks.get(row.linkId) : undefined;
    const isExchangePrincipal = row.operation === "exchange" &&
      (row.direction === "out" || row.direction === "in");
    if (!linked || !row.linkId || !isExchangePrincipal) {
      activities.push({
        id: row.id,
        rows: [row],
        primary: row,
        exchangeOut: null,
        exchangeIn: null,
      });
      continue;
    }
    if (emitted.has(row.linkId)) continue;
    emitted.add(row.linkId);
    activities.push({
      id: `exchange:${row.linkId}`,
      rows: [linked.out, linked.incoming],
      primary: linked.out,
      exchangeOut: linked.out,
      exchangeIn: linked.incoming,
    });
  }
  return activities;
}

function positiveAmount(
  value: string,
  errorKey: AppErrorKey,
  fallbackMessage: string,
): Decimal {
  const amount = money(value);
  if (!amount.isFinite() || amount.lte(0)) {
    throw new AppError(errorKey, fallbackMessage);
  }
  return amount.abs();
}

function existingPrincipal(
  rows: Transaction[],
  direction: "in" | "out",
): Transaction | undefined {
  return rows.find(
    (row) =>
      (row.operation === "transfer" || row.operation === "exchange") &&
      row.direction === direction,
  );
}

export function buildLinkedActivityChanges({
  kind,
  date,
  fromWallet,
  toWallet,
  sentAmount,
  receivedAmount,
  note,
  timestamp,
  linkId,
  reportable,
  existingRows = [],
  createId,
}: BuildLinkedActivityInput): LinkedActivityChanges {
  if (fromWallet.id === toWallet.id) {
    throw new AppError("error.chooseDifferentWallets", "Choose two different wallets.");
  }
  if (kind === "transfer" && fromWallet.currency !== toWallet.currency) {
    throw new AppError("error.useExchange", "Use an exchange when wallet currencies differ.");
  }
  if (kind === "exchange" && fromWallet.currency === toWallet.currency) {
    throw new AppError("error.useTransfer", "Use a transfer when both wallets have the same currency.");
  }

  const sent = positiveAmount(sentAmount, "error.sentPositive", "Sent amount must be greater than zero.");
  const received = positiveAmount(receivedAmount, "error.receivedPositive", "Received amount must be greater than zero.");
  const existingOut = existingPrincipal(existingRows, "out");
  const existingIn = existingPrincipal(existingRows, "in");
  const principalRows = existingRows.filter(
    (row) => row.operation === "transfer" || row.operation === "exchange",
  );
  if (existingRows.length > 0 && (principalRows.length !== 2 || !existingOut || !existingIn)) {
    throw new AppError(
      "error.linkedIncomplete",
      "This linked activity is incomplete and cannot be edited safely.",
    );
  }

  const base = {
    date,
    operation: kind,
    note,
    reportable,
    affectsBalance: true,
    linkId,
    updatedAt: timestamp,
  } as const;
  const outRow: Transaction = {
    ...base,
    id: existingOut?.id ?? createId("tx"),
    walletId: fromWallet.id,
    direction: "out",
    categoryId: null,
    category: transactionTypeLabel(kind),
    amount: sent.toString(),
    balanceAmount: signedBalanceAmount(sent, "out"),
    currency: fromWallet.currency,
    createdAt: existingOut?.createdAt ?? timestamp,
  };
  const inRow: Transaction = {
    ...base,
    id: existingIn?.id ?? createId("tx"),
    walletId: toWallet.id,
    direction: "in",
    categoryId: null,
    category: transactionTypeLabel(kind),
    amount: received.toString(),
    balanceAmount: signedBalanceAmount(received, "in"),
    currency: toWallet.currency,
    createdAt: existingIn?.createdAt ?? timestamp,
  };
  const rowsToPut: Transaction[] = [outRow, inRow];

  return {
    rowsToPut,
    rowIdsToDelete: [],
  };
}
