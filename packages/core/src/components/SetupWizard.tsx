"use client";

import { normalizeNumericInput } from "../lib/numeric-input";
import Decimal from "decimal.js";
import { localDate } from "../lib/dates";
import { resolveRate } from "../lib/rate-history";
import { ArrowLeft, ArrowRight, Check, Database, RotateCcw, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { BUILT_IN_CURRENCIES } from "../lib/catalogs";
import { brandWordmarkUrl } from "../lib/brand";
import {
  completeInitialSetup,
  completeUpgradeSetup,
  saveSetupProgress,
} from "../lib/db";
import { translate, useI18n, type InterfaceLocale } from "../lib/i18n";
import { acceptedProposalRate, fetchRateProposals, type RateFetchResult } from "../lib/rates";
import { defaultSetupDraft, normalizeSetupDraft, proposedMainWalletId } from "../lib/setup";
import type { AppSnapshot, IrrDisplayUnit, SetupDraft, SetupStep } from "../lib/types";
import { MigrationGuide } from "./MigrationGuide";

function setupId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function latestRate(snapshot: AppSnapshot, currency: string) {
  return resolveRate(snapshot.rates, currency)?.rate;
}

function validPositive(value: string): boolean {
  try {
    return new Decimal(normalizeNumericInput(value).trim()).isFinite() && new Decimal(normalizeNumericInput(value).trim()).gt(0);
  } catch {
    return false;
  }
}

function SetupBrand() {
  const { locale, t } = useI18n();
  return <div className="setup-brand" role="img" aria-label={t("common.jibjip")}>
    <span className="brand-icon" aria-hidden="true" />
    <span className={`brand-wordmark-frame brand-wordmark-frame-${locale}`} aria-hidden="true">
      <img className={`brand-wordmark brand-wordmark-${locale}`} src={brandWordmarkUrl(locale)} alt="" />
    </span>
  </div>;
}

export function SetupWizard({
  snapshot,
  initialLocale,
  onRestore,
  onError,
}: {
  snapshot: AppSnapshot;
  initialLocale?: InterfaceLocale;
  onRestore: () => void;
  onError: (error: unknown) => void;
}) {
  const { setLocale, t } = useI18n();
  const upgrade = snapshot.settings.setupState === "upgrade-required";
  const [step, setStep] = useState<SetupStep>(upgrade ? 1 : snapshot.settings.setupStep);
  const [draft, setDraft] = useState<SetupDraft>(() => normalizeSetupDraft(
    snapshot.settings.setupDraft ?? { ...defaultSetupDraft(snapshot.settings), ...(initialLocale ? { locale: initialLocale } : {}) },
    snapshot.settings,
  ));
  const [mainWalletId, setMainWalletId] = useState(() =>
    proposedMainWalletId(snapshot.wallets, snapshot.settings.defaultWalletId) ?? ""
  );
  const [working, setWorking] = useState(false);
  const [rateFetch, setRateFetch] = useState<RateFetchResult | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const currencies = snapshot.currencies.length > 0 ? snapshot.currencies : [...BUILT_IN_CURRENCIES];
  const activeCurrencies = currencies.filter((currency) => !currency.archived);
  const activeWallets = snapshot.wallets.filter((wallet) => !wallet.archived);
  const visibleRates = useMemo(() => activeCurrencies.filter((currency) => currency.code !== "EUR").map((currency) => ({
    currency,
    rate: latestRate(snapshot, currency.code),
  })), [activeCurrencies, snapshot]);

  const patchDraft = (patch: Partial<SetupDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const persistStep = async (next: SetupStep) => {
    setValidation(null);
    if (step === 2 && (!draft.mainWalletName.trim() || !draft.mainWalletCode.trim())) {
      setValidation(t("setup.walletRequired"));
      return;
    }
    if (step === 3 && Object.values(draft.rateOverrides).some((item) => !validPositive(item.value))) {
      setValidation(t("setup.invalidRate"));
      return;
    }
    setWorking(true);
    try {
      await saveSetupProgress(next, draft);
      setStep(next);
    } catch (reason) {
      onError(reason);
    } finally {
      setWorking(false);
    }
  };
  const fetchUpdates = async () => {
    setWorking(true);
    setValidation(null);
    try {
      setRateFetch(await fetchRateProposals(activeCurrencies.map((currency) => currency.code), snapshot.rates));
    } catch (reason) {
      onError(reason);
    } finally {
      setWorking(false);
    }
  };
  const acceptFetched = () => {
    if (!rateFetch) return;
    const overrides = { ...draft.rateOverrides };
    for (const item of rateFetch.proposals) {
      const accepted = acceptedProposalRate(item, "setup-preview", rateFetch.fetchedAt);
      overrides[item.quoteCurrency] = {
        value: item.value,
        effectiveDate: item.effectiveDate,
        source: item.source,
        method: "automatic",
        sourceUrl: accepted.sourceUrl,
        fetchedAt: rateFetch.fetchedAt,
      };
    }
    patchDraft({ rateOverrides: overrides });
    setRateFetch(null);
  };
  const finishInitial = async () => {
    setWorking(true);
    setValidation(null);
    try {
      await completeInitialSetup(draft, setupId("wallet"), new Date().toISOString());
    } catch (reason) {
      setValidation(reason instanceof Error ? reason.message : t("setup.couldNotFinish"));
      onError(reason);
    } finally {
      setWorking(false);
    }
  };
  const finishUpgrade = async () => {
    if (!mainWalletId) {
      setValidation(t("setup.chooseMainWallet"));
      return;
    }
    setWorking(true);
    try {
      await completeUpgradeSetup(mainWalletId);
    } catch (reason) {
      setValidation(reason instanceof Error ? reason.message : t("setup.couldNotFinish"));
      onError(reason);
    } finally {
      setWorking(false);
    }
  };

  if (upgrade) {
    const selected = activeWallets.find((wallet) => wallet.id === mainWalletId);
    return <main className="setup-screen" data-text-size={snapshot.settings.textSize}>
      <section className="setup-card upgrade-card">
        <SetupBrand />
        <p className="eyebrow">{t("setup.upgradeEyebrow")}</p>
        <h1>{t("setup.upgradeTitle")}</h1>
        <p>{t("setup.upgradeDescription")}</p>
        <div className="setup-summary"><span><WalletCards size={20} /><span className="setup-summary-copy"><strong>{t("setup.recordsPreserved")}</strong><small>{t("setup.recordsPreservedDescription")}</small></span></span><span><Database size={20} /><span className="setup-summary-copy"><strong>{t("setup.catalogReady")}</strong><small>{t("setup.catalogCounts", { currencies: snapshot.currencies.length, rates: snapshot.rates.length })}</small></span></span></div>
        <label className="setup-field"><span>{t("setup.mainWallet")}</span><select required value={mainWalletId} onChange={(event) => setMainWalletId(event.target.value)}><option value="">{t("setup.chooseWallet")}</option>{activeWallets.map((wallet) => <option value={wallet.id} key={wallet.id}>{wallet.name} · {wallet.currency}</option>)}</select><small>{selected?.code.toLocaleLowerCase("en") === "eur" ? t("setup.eurProposed") : t("setup.mainWalletExplanation")}</small></label>
        {validation && <p className="setup-validation" role="alert">{validation}</p>}
        <div className="setup-actions"><button className="button secondary" onClick={onRestore}>{t("setup.restoreDifferentBackup")}</button><button className="button affirmative" disabled={working || !mainWalletId} onClick={finishUpgrade}><Check size={18} /> {working ? t("setup.finishing") : t("setup.confirmUpgrade")}</button></div>
      </section>
    </main>;
  }

  const steps = [t("setup.stepLanguage"), t("setup.stepWallet"), t("setup.stepRates"), t("setup.stepEssentials")];
  return <main className="setup-screen" data-text-size={snapshot.settings.textSize}>
    <section className="setup-card">
      <SetupBrand />
      <div className="setup-progress" role="group" aria-label={t("setup.progress")}>
        {steps.map((label, index) => <span className={step === index + 1 ? "active" : step > index + 1 ? "complete" : ""} key={label}><i>{step > index + 1 ? <Check size={13} /> : index + 1}</i><small>{label}</small></span>)}
      </div>

      {step === 1 && <div className="setup-step">
        <p className="eyebrow">{t("setup.welcomeEyebrow")}</p><h1>{t("setup.welcomeTitle")}</h1><p>{t("setup.welcomeDescription")}</p>
        <div className="setup-language-options">
          {(["en", "fa"] as const).map((choice) => <button className={draft.locale === choice ? "selected" : ""} lang={choice} dir={choice === "fa" ? "rtl" : "ltr"} key={choice} onClick={() => { patchDraft({ locale: choice }); setLocale(choice); }}><strong>{choice === "fa" ? "فارسی" : "English"}</strong><small>{translate(choice, "setup.categoryLanguage")}</small></button>)}
        </div>
        <div className="setup-restore"><span>{t("setup.haveBackup")}</span><button className="button secondary" onClick={onRestore}>{t("setup.restoreBackup")}</button></div>
        <MigrationGuide />
      </div>}

      {step === 2 && <div className="setup-step">
        <p className="eyebrow">{t("setup.stepWallet")}</p><h1>{t("setup.walletTitle")}</h1><p>{t("setup.walletDescription")}</p>
        <div className="setup-form-grid"><label className="setup-field"><span>{t("setup.walletName")}</span><input required value={draft.mainWalletName} onChange={(event) => patchDraft({ mainWalletName: event.target.value })} /></label><label className="setup-field"><span>{t("setup.walletCode")}</span><input required maxLength={32} value={draft.mainWalletCode} onChange={(event) => patchDraft({ mainWalletCode: event.target.value })} /></label><label className="setup-field wide"><span>{t("setup.walletCurrency")}</span><select value={draft.mainWalletCurrency} onChange={(event) => patchDraft({ mainWalletCurrency: event.target.value })}>{activeCurrencies.map((currency) => <option value={currency.code} key={currency.code}>{currency.code} · {currency.name}</option>)}</select><small>{t("setup.walletCurrencyWarning")}</small></label></div>
      </div>}

      {step === 3 && <div className="setup-step">
        <p className="eyebrow">{t("setup.stepRates")}</p><h1>{t("setup.ratesTitle")}</h1><p>{t("setup.ratesDescription")}</p>
        <div className="setup-rate-toolbar"><span>{t("setup.offlineRatesReady", { count: visibleRates.filter((item) => item.rate).length })}</span><button className="button secondary" disabled={working} onClick={fetchUpdates}><RotateCcw size={17} /> {working ? t("settings.fetchingRates") : t("settings.fetchRates")}</button></div>
        {rateFetch && <div className="setup-rate-proposals"><strong>{t("setup.proposalsReady", { count: rateFetch.proposals.length })}</strong><div>{rateFetch.proposals.map((item) => <span key={item.quoteCurrency}><b>{item.quoteCurrency}</b><small>{item.value} · {item.source} · {t("dialog.effectiveDate")}: <bdi dir="ltr">{item.effectiveDate}</bdi>{item.fallback ? ` · ${t("setup.fallback")}` : ""}</small></span>)}</div>{rateFetch.unavailable.length > 0 && <p>{t("setup.unavailableRates", { currencies: rateFetch.unavailable.map((item) => item.quoteCurrency).join(", ") })}</p>}<div className="setup-inline-actions"><button className="button secondary" onClick={() => setRateFetch(null)}>{t("common.cancel")}</button><button className="button primary" disabled={rateFetch.proposals.length === 0} onClick={acceptFetched}>{t("setup.useProposals")}</button></div></div>}
        <div className="setup-rate-grid">{visibleRates.map(({ currency, rate }) => {
          const override = draft.rateOverrides[currency.code];
          const value = override?.value ?? rate?.value ?? "";
          const effectiveDate = override?.effectiveDate ?? rate?.effectiveDate ?? localDate();
          const patchRate = (patch: Partial<SetupDraft["rateOverrides"][string]>) => patchDraft({ rateOverrides: { ...draft.rateOverrides, [currency.code]: { value, effectiveDate, source: override?.source ?? rate?.source ?? t("settings.manualEntry"), method: override?.method ?? "manual", ...patch } } });
          return <label key={currency.code}><span><b>{currency.code}</b><small>{override?.source ?? rate?.source ?? t("rates.noneAvailable")}</small></span><div className="setup-rate-inputs"><input required inputMode="decimal" aria-label={`${currency.code} ${t("dialog.unitsPerEur")}`} value={value} onChange={(event) => patchRate({ value: normalizeNumericInput(event.target.value) })} /><input required type="date" aria-label={`${currency.code} ${t("dialog.effectiveDate")}`} value={effectiveDate} onChange={(event) => patchRate({ effectiveDate: event.target.value })} /></div></label>;
        })}</div>
      </div>}

      {step === 4 && <div className="setup-step">
        <p className="eyebrow">{t("setup.stepEssentials")}</p><h1>{t("setup.essentialsTitle")}</h1><p>{t("setup.essentialsDescription")}</p>
        <div className="setup-form-grid"><label className="setup-field wide"><span>{t("setup.reportingCurrency")}</span><select value={draft.reportingCurrency} onChange={(event) => patchDraft({ reportingCurrency: event.target.value })}>{activeCurrencies.map((currency) => <option value={currency.code} key={currency.code}>{currency.code} · {currency.name}</option>)}</select></label><fieldset className="setup-field wide"><legend>{t("setup.calendar")}</legend><div className="setup-choice-row"><label><input type="radio" checked={!draft.showJalali} onChange={() => patchDraft({ showJalali: false })} /> {t("settings.gregorianOnly")}</label><label><input type="radio" checked={draft.showJalali} onChange={() => patchDraft({ showJalali: true })} /> {t("setup.gregorianAndJalali")}</label></div></fieldset>{(draft.mainWalletCurrency === "IRR" || draft.reportingCurrency === "IRR") && <label className="setup-field wide"><span>{t("settings.irrRepresentation")}</span><select value={draft.irrDisplayUnit} onChange={(event) => patchDraft({ irrDisplayUnit: event.target.value as IrrDisplayUnit })}><option value="IRR">IRR</option><option value="TMN">TMN</option><option value="HTM">HTM</option><option value="MTM">MTM</option></select></label>}</div>
        <div className="setup-finish-summary"><Check size={20} /><span><strong>{t("setup.readyTitle")}</strong><small>{t("setup.readyDescription", { wallet: draft.mainWalletName, currency: draft.mainWalletCurrency })}</small></span></div>
      </div>}

      {validation && <p className="setup-validation" role="alert">{validation}</p>}
      <footer className="setup-actions">{step > 1 ? <button className="button secondary" disabled={working} onClick={() => persistStep((step - 1) as SetupStep)}><ArrowLeft className="directional-icon" size={17} /> {t("setup.back")}</button> : <span />}{step < 4 ? <button className="button primary" disabled={working} onClick={() => persistStep((step + 1) as SetupStep)}>{t("setup.continue")} <ArrowRight className="directional-icon" size={17} /></button> : <button className="button affirmative" disabled={working} onClick={finishInitial}><Check size={17} /> {working ? t("setup.finishing") : t("setup.finish")}</button>}</footer>
    </section>
  </main>;
}
