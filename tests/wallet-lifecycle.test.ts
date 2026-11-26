import assert from "node:assert/strict";
import test from "node:test";
import {
  isProtectedMainWallet,
  reinterpretWalletTransactionCurrencies,
  walletCurrencyChangeRequiresConfirmation,
} from "../packages/core/src/lib/wallets.ts";
import type { Transaction, Wallet } from "../packages/core/src/lib/types.ts";

const wallet: Wallet = {
  id: "wallet-main",
  name: "Main wallet",
  code: "main",
  currency: "EUR",
  archived: false,
  createdAt: "2026-07-19T00:00:00.000Z",
};

const transaction = (id: string, walletId: string, currency = "EUR"): Transaction => ({
  id,
  date: "2026-07-19",
  walletId,
  operation: "transaction",
  direction: "expense",
  categoryId: "category-test",
  category: "Synthetic test",
  amount: "123456789.012300",
  balanceAmount: "-123456789.012300",
  currency,
  note: "Synthetic preservation marker",
  reportable: true,
  affectsBalance: true,
  linkId: null,
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z",
});

test("main-wallet protection is independent from default-wallet choice", () => {
  assert.equal(isProtectedMainWallet("wallet-main", "wallet-main"), true);
  assert.equal(isProtectedMainWallet("wallet-default", "wallet-main"), false);
  assert.equal(isProtectedMainWallet("wallet-main", null), false);
});

test("historical currency reinterpretation requires records and an actual currency change", () => {
  assert.equal(walletCurrencyChangeRequiresConfirmation(wallet, "USD", 1), true);
  assert.equal(walletCurrencyChangeRequiresConfirmation(wallet, "usd", 200), true);
  assert.equal(walletCurrencyChangeRequiresConfirmation(wallet, "EUR", 200), false);
  assert.equal(walletCurrencyChangeRequiresConfirmation(wallet, "USD", 0), false);
  assert.equal(walletCurrencyChangeRequiresConfirmation(null, "USD", 10), false);
});

test("currency reinterpretation changes only associated currency labels", () => {
  const owned = transaction("owned", wallet.id);
  const unrelated = transaction("unrelated", "wallet-other", "CHF");
  const relabeled = reinterpretWalletTransactionCurrencies([owned, unrelated], wallet.id, "USD");

  assert.equal(relabeled.length, 1);
  assert.deepEqual(relabeled[0], { ...owned, currency: "USD" });
  assert.equal(relabeled[0].amount, owned.amount);
  assert.equal(relabeled[0].balanceAmount, owned.balanceAmount);
  assert.equal(relabeled[0].note, owned.note);
  assert.equal(relabeled[0].updatedAt, owned.updatedAt);
  assert.deepEqual(unrelated, transaction("unrelated", "wallet-other", "CHF"));
});
