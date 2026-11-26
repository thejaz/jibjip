import assert from "node:assert/strict";
import test from "node:test";
import { AppError, translatedErrorMessage } from "../packages/core/src/lib/app-error.ts";
import { jalaliDate } from "../packages/core/src/lib/finance.ts";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  directionForLocale,
  normalizeInterfaceLocale,
} from "../packages/core/src/lib/i18n/config.ts";
import { messages, translate, translatePlural } from "../packages/core/src/lib/i18n/translate.ts";

test("the interface ships with complete English and Farsi locales", () => {
  assert.deepEqual(SUPPORTED_LOCALES, ["en", "fa"]);
  assert.equal(DEFAULT_LOCALE, "en");
  assert.equal(normalizeInterfaceLocale("en"), "en");
  assert.equal(normalizeInterfaceLocale("fa"), "fa");
  assert.equal(normalizeInterfaceLocale("de"), "en");
  assert.equal(normalizeInterfaceLocale(undefined), "en");
});

test("every supported locale has a complete message catalog", () => {
  const englishKeys = Object.keys(messages.en).sort();
  for (const locale of SUPPORTED_LOCALES) {
    assert.deepEqual(Object.keys(messages[locale]).sort(), englishKeys);
    for (const key of englishKeys) {
      const placeholders = (message: string) => [...message.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)]
        .map((match) => match[1])
        .sort();
      assert.deepEqual(
        placeholders(messages[locale][key as keyof typeof messages.en]),
        placeholders(messages.en[key as keyof typeof messages.en]),
        `${locale}.${key} must preserve the English interpolation contract`,
      );
    }
  }
});

test("translation interpolates named values and preserves unknown placeholders", () => {
  assert.equal(
    translate("en", "notice.defaultWallet", { wallet: "Everyday" }),
    "Everyday is now the default wallet.",
  );
  assert.equal(
    translate("en", "notice.defaultWallet"),
    "{wallet} is now the default wallet.",
  );
});

test("plural translation selects English singular and plural forms", () => {
  assert.equal(translatePlural("en", "common.wallets", 1), "1 wallet");
  assert.equal(translatePlural("en", "common.wallets", 2), "2 wallets");
  assert.equal(translatePlural("en", "overview.activeWallets", 1), "Across 1 active wallet");
  assert.equal(translatePlural("en", "overview.activeWallets", 2), "Across 2 active wallets");
  assert.equal(
    translatePlural("en", "common.wallets", 2, { count: "02" }),
    "02 wallets",
  );
});

test("the current locale direction is explicit", () => {
  assert.equal(directionForLocale("en"), "ltr");
  assert.equal(directionForLocale("fa"), "rtl");
});

test("Farsi translations preserve interpolation and contract tokens", () => {
  assert.equal(translate("fa", "notice.defaultWallet", { wallet: "روزمره" }), "روزمره اکنون کیف پول پیش‌فرض است.");
  assert.match(translate("fa", "settings.csvRequirements"), /<code>Date<\/code>/);
  assert.equal(translatePlural("fa", "common.wallets", 2, { count: "۲" }), "۲ کیف پول");
});

test("Jalali display follows the interface language without changing the ISO input", () => {
  assert.equal(jalaliDate("2026-07-15"), "Tir 24, 1405 AP");
  assert.match(jalaliDate("2026-07-15", "fa"), /تیر/);
  assert.match(jalaliDate("2026-07-15", "fa"), /24.*1405/);
  assert.doesNotMatch(jalaliDate("2026-07-15", "fa"), /[۰-۹]/);
  assert.doesNotMatch(jalaliDate("2026-07-15", "fa"), /Tir/);
});

test("application errors translate at the interface boundary", () => {
  const error = new AppError(
    "error.csvWalletMissing",
    "CSV row 4: wallet “Travel” does not exist in JIBJIP.",
    { row: 4, wallet: "Travel" },
  );
  assert.equal(
    translatedErrorMessage(error, (key, values) => translate("en", key, values), "error.csvImportFailed"),
    "CSV row 4: wallet “Travel” does not exist in JIBJIP.",
  );
});

// Review new proper names here rather than changing the case of rendered copy.
// External menu instructions and CSV contracts retain their exact source casing.
test("English copy uses sentence case while preserving names and technical contracts", () => {
  const properNames = new Set([
    "English", "Farsi", "Persian", "Gregorian", "Jalali", "Clarity",
    "Overview", "Charts", "Transactions", "Wallets", "Currencies", "Settings",
    "Uncharted", "Ungrouped", "Other", "Excel", "CoinGecko", "Frankfurter",
    "Chrome", "Safari", "Edge", "Mac", "Android", "Windows", "Linux", "Cloudflare", "GitHub",
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "MiB",
  ]);
  const exactCopy = new Set([
    "migration.prompt", "split.csvHelp", "settings.csvRequirements",
    "settings.csvOperations", "settings.csvTextSafety", "settings.motionReduced",
    "access.iphoneSteps", "access.androidSteps", "access.computerSteps",
  ]);
  const startsSentenceOrLabel = (prefix: string) => /(?:^|[.!?][”"]?\s+|[·:\n]\s*|[“"‘(]\s*)$/.test(prefix);
  for (const [key, message] of Object.entries(messages.en)) {
    for (const term of message.matchAll(/\bFull(?: backup| JIBJIP backup)/g)) {
      assert.ok(startsSentenceOrLabel(message.slice(0, term.index)), `${key}: use full backup within a sentence or action`);
    }
    if (exactCopy.has(key) || key.startsWith("error.csv")) continue;
    const copy = message.replace(/<code>.*?<\/code>|\{.*?\}|MIT License|Rate history/g, "");
    const unexpected = [...copy.matchAll(/\b[A-Z][a-z][A-Za-z]*\b/g)]
      .filter(word => !properNames.has(word[0]) && !startsSentenceOrLabel(copy.slice(0, word.index)))
      .map(word => word[0]);
    assert.deepEqual(unexpected, [], `${key}: use sentence case, preserving only reviewed names and contract tokens`);
  }
});
