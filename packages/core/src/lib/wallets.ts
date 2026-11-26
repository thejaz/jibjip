import type { Transaction, Wallet } from "./types.ts";

interface NewTransactionWalletChoice {
  requestedWalletId?: string;
  preferredCurrency?: string;
  defaultWalletId: string | null;
}

/** Movement destinations must be distinct active wallets with the required currency relation. */
export function movementDestinationWallets(wallets: readonly Wallet[], fromId: string, kind: "transfer" | "exchange", retainedIds: ReadonlySet<string> = new Set()): Wallet[] {
  const from = wallets.find(wallet => wallet.id === fromId);
  if (!from || (from.archived && !retainedIds.has(fromId))) return [];
  return wallets.filter(wallet => (!wallet.archived || retainedIds.has(wallet.id)) && wallet.id !== fromId &&
    (kind === "transfer" ? wallet.currency === from.currency : wallet.currency !== from.currency));
}

/**
 * Chooses an active wallet for a new transaction. A one-time explicit choice
 * wins, followed by a currency match (used by Uncharted promotion), the saved
 * default, and finally the first active wallet supplied by the caller.
 */
export function chooseNewTransactionWalletId(
  wallets: Wallet[],
  choice: NewTransactionWalletChoice,
): string {
  const activeWallets = wallets.filter((wallet) => !wallet.archived);
  const activeIds = new Set(activeWallets.map((wallet) => wallet.id));

  if (choice.requestedWalletId && activeIds.has(choice.requestedWalletId)) {
    return choice.requestedWalletId;
  }

  const currencyMatch = choice.preferredCurrency
    ? activeWallets.find((wallet) => wallet.currency === choice.preferredCurrency)
    : undefined;
  if (currencyMatch) return currencyMatch.id;

  if (choice.defaultWalletId && activeIds.has(choice.defaultWalletId)) {
    return choice.defaultWalletId;
  }

  return activeWallets[0]?.id ?? "";
}

export function isProtectedMainWallet(walletId: string, mainWalletId: string | null): boolean {
  return Boolean(mainWalletId) && walletId === mainWalletId;
}

export function walletCurrencyChangeRequiresConfirmation(
  wallet: Wallet | null,
  nextCurrency: string,
  transactionCount: number,
): boolean {
  return Boolean(
    wallet &&
    wallet.currency !== nextCurrency.trim().toUpperCase() &&
    transactionCount > 0,
  );
}

/**
 * Re-labels every record owned by a wallet while preserving all numerical and
 * user-authored fields exactly. This is an intentional reinterpretation, not a
 * currency conversion.
 */
export function reinterpretWalletTransactionCurrencies(
  transactions: Transaction[],
  walletId: string,
  nextCurrency: string,
): Transaction[] {
  const normalizedCurrency = nextCurrency.trim().toUpperCase();
  return transactions
    .filter((transaction) => transaction.walletId === walletId && transaction.currency !== normalizedCurrency)
    .map((transaction) => ({ ...transaction, currency: normalizedCurrency }));
}
