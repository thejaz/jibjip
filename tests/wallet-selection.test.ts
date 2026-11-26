import assert from "node:assert/strict";
import test from "node:test";
import type { Wallet } from "../packages/core/src/lib/types.ts";
import { chooseNewTransactionWalletId, movementDestinationWallets } from "../packages/core/src/lib/wallets.ts";

function wallet(id: string, currency: string, archived = false): Wallet {
  return {
    id,
    name: `Wallet ${id}`,
    code: id,
    currency,
    archived,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

const wallets = [
  wallet("first", "EUR"),
  wallet("default", "USD"),
  wallet("requested", "CHF"),
  wallet("archived", "CZK", true),
];

test("movement destinations exclude the source, archived wallets, and incompatible currencies", () => {
  const choices = [...wallets, wallet("second-eur", "EUR"), wallet("retired-eur", "EUR", true)];
  assert.deepEqual(movementDestinationWallets(choices, "first", "transfer").map(row => row.id), ["second-eur"]);
  assert.deepEqual(movementDestinationWallets(choices, "first", "exchange").map(row => row.id), ["default", "requested"]);
  assert.deepEqual(movementDestinationWallets(choices, "archived", "transfer"), []);
  assert.deepEqual(movementDestinationWallets(choices, "missing", "exchange"), []);
  assert.deepEqual(movementDestinationWallets([choices[0]], "first", "transfer"), []);
  assert.deepEqual(movementDestinationWallets(choices, "first", "transfer", new Set(["retired-eur"])).map(row => row.id), ["second-eur", "retired-eur"]);
  assert.deepEqual(movementDestinationWallets(choices, "retired-eur", "transfer", new Set(["retired-eur"])).map(row => row.id), ["first", "second-eur"]);
  assert.deepEqual(choices.slice(0, wallets.length), wallets);
});

test("an explicitly requested wallet overrides the saved default", () => {
  assert.equal(
    chooseNewTransactionWalletId(wallets, {
      requestedWalletId: "requested",
      defaultWalletId: "default",
    }),
    "requested",
  );
});

test("the saved default is used for an ordinary new transaction", () => {
  assert.equal(
    chooseNewTransactionWalletId(wallets, { defaultWalletId: "default" }),
    "default",
  );
});

test("Uncharted promotion keeps its currency match ahead of the default", () => {
  assert.equal(
    chooseNewTransactionWalletId(wallets, {
      preferredCurrency: "EUR",
      defaultWalletId: "default",
    }),
    "first",
  );
});

test("invalid or archived choices safely fall back to the first active wallet", () => {
  assert.equal(
    chooseNewTransactionWalletId(wallets, {
      requestedWalletId: "archived",
      defaultWalletId: "missing",
    }),
    "first",
  );
});
