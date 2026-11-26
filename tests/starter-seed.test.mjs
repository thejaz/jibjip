import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { auditSnapshot } from "../scripts/audit_data_integrity.mjs";

const seedPath = resolve("packages/core/assets/data/jibjip-starter-seed.json");

function readStarterSeed() {
  return JSON.parse(readFileSync(seedPath, "utf8"));
}

test("starter seed satisfies data-integrity invariants", () => {
  const audit = auditSnapshot(readStarterSeed());
  assert.deepEqual(audit.issues, []);
  assert.deepEqual(audit.counts, {
    wallets: 0,
    currencies: 38,
    categories: 0,
    rates: 37,
    transactions: 0,
    uncharted: 0,
    linkedGroups: 0,
  });
});

test("starter seed contains reference catalogs but no sample financial records", () => {
  const seed = readStarterSeed();
  assert.equal(seed.source.kind, "jibjip-starter");
  assert.equal(seed.version, 2);
  assert.equal(seed.settings.dataVersion, 2);
  assert.equal(seed.settings.starterSeedVersion, 2);
  assert.equal(seed.settings.setupState, "uninitialized");
  assert.equal(seed.settings.mainWalletId, null);
  assert.equal(seed.settings.setupStep, 1);
  assert.equal(seed.settings.setupDraft, null);
  assert.equal(seed.settings.defaultWalletId, null);
  assert.deepEqual(seed.settings.clarity, { enabled: true, awards: [] });
  assert.deepEqual(
    seed.currencies.map(({ code }) => code),
    ["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "JPY", "CNY", "INR", "CZK", "SEK", "NOK", "DKK", "PLN", "HUF", "RON", "ISK", "UAH", "RSD", "RUB", "TRY", "AED", "SAR", "IRR", "AFN", "AMD", "AZN", "IQD", "PKR", "TMT", "BRL", "EGP", "ETB", "IDR", "ZAR", "BTC", "ETH", "USDT"],
  );
  assert.deepEqual(
    seed.rates.map(({ quoteCurrency }) => quoteCurrency),
    seed.currencies.filter(({ code }) => code !== "EUR").map(({ code }) => code),
  );
  assert.equal(seed.rates.some(({ quoteCurrency }) => quoteCurrency === "EUR"), false);
  assert.ok(seed.rates.every(({ effectiveDate, source }) => /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) && source.length > 4));
  assert.deepEqual(seed.wallets, []);
  assert.deepEqual(seed.categories, []);
  assert.deepEqual(seed.transactions, []);
  assert.deepEqual(seed.uncharted, []);
});
