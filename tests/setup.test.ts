import assert from "node:assert/strict";
import test from "node:test";
import { defaultSetupDraft, normalizeSetupDraft, normalizeSetupStep, proposedMainWalletId } from "../packages/core/src/lib/setup.ts";
import type { Wallet } from "../packages/core/src/lib/types.ts";

const wallet = (id: string, code: string, currency: string, archived = false): Wallet => ({
  id,
  code,
  currency,
  archived,
  name: id,
  createdAt: "2026-07-19T00:00:00.000Z",
});

test("new setup defaults are complete and resumable", () => {
  const draft = defaultSetupDraft({ locale: "fa", reportingCurrency: "IRR", showJalali: false, irrDisplayUnit: "TMN" });
  assert.equal(draft.locale, "fa");
  assert.equal(draft.reportingCurrency, "IRR");
  assert.equal(draft.showJalali, false);
  assert.equal(draft.irrDisplayUnit, "TMN");
  assert.deepEqual(draft.rateOverrides, {});
  assert.equal(normalizeSetupStep(4), 4);
  assert.equal(normalizeSetupStep(99), 1);
});

test("resumed setup rates canonicalize mixed digits without losing precision", () => {
  const draft = defaultSetupDraft();
  draft.rateOverrides.USD = { value: "۱٫۲٣٤۵۶۷۸۹۰۱۲۳۴۵۶۷۸۹", effectiveDate: "2026-01-01", source: "Synthetic", method: "manual" };
  assert.equal(normalizeSetupDraft(draft).rateOverrides.USD.value, "1.234567890123456789");
});

test("setup draft normalization preserves accepted rate provenance", () => {
  const normalized = normalizeSetupDraft({
    locale: "fa",
    mainWalletName: " کیف اصلی ",
    mainWalletCode: " eur-main ",
    mainWalletCurrency: "irr",
    reportingCurrency: "eur",
    showJalali: true,
    irrDisplayUnit: "HTM",
    rateOverrides: {
      IRR: { value: "2250000.00", effectiveDate: "2026-07-20", source: "TGJU Iranian open market", method: "automatic" },
      USD: { value: "not-a-rate", effectiveDate: "bad", source: "bad", method: "manual" },
    },
  });
  assert.equal(normalized.mainWalletName, "کیف اصلی");
  assert.equal(normalized.mainWalletCurrency, "IRR");
  assert.deepEqual(normalized.rateOverrides.IRR, {
    value: "2250000",
    effectiveDate: "2026-07-20",
    source: "TGJU Iranian open market",
    method: "automatic",
  });
  assert.equal(normalized.rateOverrides.USD, undefined);
});

test("resumed setup retains fallback URLs and retrieval times, discarding unsafe metadata", () => {
  const rate = { value: "2250000", effectiveDate: "2026-07-20", source: "Synthetic archive", method: "automatic",
    sourceUrl: "https://example.com/irr-history.json", fetchedAt: "2026-07-20T12:00:00.000Z" };
  const normalized = normalizeSetupDraft({ rateOverrides: { IRR: rate } });
  assert.deepEqual(normalized.rateOverrides.IRR, rate);
  const unsafe = normalizeSetupDraft({ rateOverrides: { IRR: { ...rate, sourceUrl: "javascript:alert(1)", fetchedAt: "invalid" } } });
  assert.equal(unsafe.rateOverrides.IRR.sourceUrl, undefined);
  assert.equal(unsafe.rateOverrides.IRR.fetchedAt, undefined);
});

test("upgrade proposal prioritizes active code eur and remains user-selectable", () => {
  const wallets = [
    wallet("default", "usd", "USD"),
    wallet("eur-currency", "travel", "EUR"),
    wallet("eur-code", "EUR", "CHF"),
    wallet("archived-eur", "eur", "EUR", true),
  ];
  assert.equal(proposedMainWalletId(wallets, "default"), "eur-code");
  assert.equal(proposedMainWalletId(wallets.filter((item) => item.id !== "eur-code"), "default"), "eur-currency");
  assert.equal(proposedMainWalletId([wallets[0]], "default"), "default");
  assert.equal(proposedMainWalletId([wallet("gone", "eur", "EUR", true)], null), null);
});
