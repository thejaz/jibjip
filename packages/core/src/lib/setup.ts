import { normalizeNumericInput } from "./numeric-input.ts";
import Decimal from "decimal.js";
import { localDate } from "./dates.ts";
import { normalizeInterfaceLocale } from "./i18n/config.ts";
import type { AppSettings, IrrDisplayUnit, SetupDraft, SetupRateOverride, SetupStep, Wallet } from "./types.ts";

const CURRENCY_CODE = /^[A-Z][A-Z0-9]{2,7}$/;

export function defaultSetupDraft(settings?: Partial<AppSettings>): SetupDraft {
  return {
    locale: normalizeInterfaceLocale(settings?.locale),
    mainWalletName: "Main wallet",
    mainWalletCode: "main",
    mainWalletCurrency: "EUR",
    rateOverrides: {},
    reportingCurrency: settings?.reportingCurrency && CURRENCY_CODE.test(settings.reportingCurrency)
      ? settings.reportingCurrency
      : "EUR",
    showJalali: settings?.showJalali ?? true,
    irrDisplayUnit: settings?.irrDisplayUnit ?? "IRR",
  };
}

function validIrrUnit(value: unknown): IrrDisplayUnit {
  return value === "TMN" || value === "HTM" || value === "MTM" ? value : "IRR";
}

export function normalizeSetupDraft(value: unknown, settings?: Partial<AppSettings>): SetupDraft {
  const fallback = defaultSetupDraft(settings);
  if (!value || typeof value !== "object") return fallback;
  const draft = value as Partial<SetupDraft>;
  const mainWalletCurrency = String(draft.mainWalletCurrency ?? "").toUpperCase();
  const reportingCurrency = String(draft.reportingCurrency ?? "").toUpperCase();
  const rateOverrides: Record<string, SetupRateOverride> = {};
  if (draft.rateOverrides && typeof draft.rateOverrides === "object") {
    for (const [currency, raw] of Object.entries(draft.rateOverrides)) {
      if (!CURRENCY_CODE.test(currency) || currency === "EUR") continue;
      try {
        const candidate = raw && typeof raw === "object" ? raw as Partial<SetupRateOverride> : { value: raw };
        const value = new Decimal(normalizeNumericInput(String(candidate.value)).trim());
        if (value.isFinite() && value.gt(0)) {
          rateOverrides[currency] = {
            value: value.toString(),
            effectiveDate: typeof candidate.effectiveDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(candidate.effectiveDate)
              ? candidate.effectiveDate
              : localDate(),
            source: typeof candidate.source === "string" && candidate.source.trim()
              ? candidate.source.trim()
              : "Initial setup manual edit",
            method: candidate.method === "automatic" ? "automatic" : "manual",
            ...(typeof candidate.sourceUrl === "string" && /^https:\/\//.test(candidate.sourceUrl) ? { sourceUrl: candidate.sourceUrl } : {}),
            ...(typeof candidate.fetchedAt === "string" && Number.isFinite(Date.parse(candidate.fetchedAt)) ? { fetchedAt: candidate.fetchedAt } : {}),
          };
        }
      } catch {
        // Ignore invalid unfinished values; the wizard keeps live drafts locally.
      }
    }
  }
  return {
    locale: normalizeInterfaceLocale(draft.locale),
    mainWalletName: typeof draft.mainWalletName === "string" && draft.mainWalletName.trim()
      ? draft.mainWalletName.trim()
      : fallback.mainWalletName,
    mainWalletCode: typeof draft.mainWalletCode === "string" && draft.mainWalletCode.trim()
      ? draft.mainWalletCode.trim()
      : fallback.mainWalletCode,
    mainWalletCurrency: CURRENCY_CODE.test(mainWalletCurrency) ? mainWalletCurrency : fallback.mainWalletCurrency,
    rateOverrides,
    reportingCurrency: CURRENCY_CODE.test(reportingCurrency) ? reportingCurrency : fallback.reportingCurrency,
    showJalali: typeof draft.showJalali === "boolean" ? draft.showJalali : fallback.showJalali,
    irrDisplayUnit: validIrrUnit(draft.irrDisplayUnit),
  };
}

export function normalizeSetupStep(value: unknown): SetupStep {
  return value === 2 || value === 3 || value === 4 ? value : 1;
}

export function proposedMainWalletId(wallets: Wallet[], defaultWalletId: string | null): string | null {
  const active = wallets.filter((wallet) => !wallet.archived);
  return active.find((wallet) => wallet.code.trim().toLocaleLowerCase("en") === "eur")?.id
    ?? active.find((wallet) => wallet.currency === "EUR")?.id
    ?? active.find((wallet) => wallet.id === defaultWalletId)?.id
    ?? active[0]?.id
    ?? null;
}
