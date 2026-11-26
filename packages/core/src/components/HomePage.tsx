"use client";

import { ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined, Check, ChevronRight, Coins, Download, Globe2, Plus, ShieldCheck, WalletCards, WifiOff } from "lucide-react";
import { useEffect, type CSSProperties } from "react";
import { brandWordmarkUrl } from "../lib/brand";
import { DATA_COLORS } from "../lib/colors";
import { I18nProvider, useI18n, type InterfaceLocale } from "../lib/i18n";
import { registerOfflineShell } from "../lib/offline";
import { CreatorCredit } from "./CreatorCredit";
import { AppAccess } from "./AppAccess";
import "./home.css";

const LANGUAGE_KEY = "jibjip.site.locale";

function initialWebsiteLocale(): InterfaceLocale {
  const hint = new URLSearchParams(location.search).get("lang");
  if (hint === "en" || hint === "fa") return hint;
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === "en" || saved === "fa") return saved;
  } catch { /* Language links also work without browser storage. */ }
  return "en";
}

export function HomePage() {
  return <I18nProvider initialLocale={initialWebsiteLocale()}><HomeContent /></I18nProvider>;
}

function HomeContent() {
  const { locale, setLocale, t } = useI18n();
  const appHref = `/app/?lang=${locale}`;
  useEffect(() => {
    registerOfflineShell();
  }, []);
  useEffect(() => {
    try { localStorage.setItem(LANGUAGE_KEY, locale); } catch { /* Optional display preference. */ }
  }, [locale]);

  function changeLanguage(next: InterfaceLocale) {
    setLocale(next);
    const url = new URL(location.href);
    url.searchParams.set("lang", next);
    history.replaceState(null, "", url);
  }

  return <div className="home-page">
    <a className="home-skip" href="#home-start">{t("home.skip")}</a>
    <header className="home-header">
      <a className="home-brand" href={`/?lang=${locale}`} aria-label={t("common.jibjip")}>
        <img className="home-brand-icon" src="/brand/jibjip-icon.svg" alt="" />
        <span className={`home-wordmark-frame home-wordmark-frame-${locale}`}>
          <img src={brandWordmarkUrl(locale)} alt="" />
        </span>
      </a>
      <nav aria-label={t("home.navigation")}>
        <a className="home-how-link" href="#home-start">{t("home.how")}</a>
        <button className="home-language" onClick={() => changeLanguage(locale === "en" ? "fa" : "en")} title={t("home.changeLanguage")}>
          <Globe2 size={16} aria-hidden="true" /><span lang={locale === "en" ? "fa" : "en"}>{locale === "en" ? "فارسی" : "English"}</span>
        </button>
        <a className="home-open-small" href={appHref}>{t("home.open")}<ArrowUpRight size={16} className="directional-icon" aria-hidden="true" /></a>
      </nav>
    </header>

    <main>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-pitch">
          <p className="home-eyebrow"><span aria-hidden="true" />{t("home.eyebrow")}</p>
          <h1 id="home-title">{t("home.title")}<br /><span>{t("home.titleAccent")}</span></h1>
          <p className="home-description">{t("home.description")}</p>
          <a className="button affirmative home-primary" href={appHref}>{t("home.getStarted")}<ArrowUpRight size={22} className="directional-icon" aria-hidden="true" /></a>
          <ul className="home-promises">
            <li><Check size={14} aria-hidden="true" />{t("home.noAccount")}</li>
            <li><Check size={14} aria-hidden="true" />{t("home.noTracking")}</li>
            <li><Check size={14} aria-hidden="true" />{t("home.license")}</li>
          </ul>
        </div>

        <div className="home-art" aria-hidden="true" style={{ "--art-teal": DATA_COLORS[1], "--art-gold": DATA_COLORS[5], "--art-violet": DATA_COLORS[8] } as CSSProperties}>
          <div className="home-orbit home-orbit-one" /><div className="home-orbit home-orbit-two" />
          <div className="home-currency home-currency-eur"><span>€</span><small>EUR</small></div>
          <div className="home-currency home-currency-irr"><Coins size={28} /><small>IRR</small></div>
          <div className="home-currency home-currency-usd"><span>$</span><small>USD</small></div>
          <div className="home-wallet-card">
            <div className="home-art-heading"><WalletCards size={21} /><span>{t("home.visualWallets")}</span><span className="home-art-dots">•••</span></div>
            <div className="home-chart-art">
              <svg viewBox="0 0 128 128" className="home-donut" focusable="false">
                <circle cx="64" cy="64" r="44" fill="none" stroke="var(--line)" strokeWidth="18" />
                <circle cx="64" cy="64" r="44" fill="none" stroke="var(--art-gold)" strokeWidth="18" strokeDasharray="126 277" transform="rotate(-90 64 64)" />
                <circle cx="64" cy="64" r="44" fill="none" stroke="var(--art-teal)" strokeWidth="18" strokeDasharray="74 277" strokeDashoffset="-132" transform="rotate(-90 64 64)" />
                <circle cx="64" cy="64" r="44" fill="none" stroke="var(--art-violet)" strokeWidth="18" strokeDasharray="59 277" strokeDashoffset="-212" transform="rotate(-90 64 64)" />
                <path d="M53 64h22M64 53v22" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <div className="home-art-bars"><span /><span /><span /><span /><span /><span /><span /></div>
            </div>
            <div className="home-art-flow"><span><ArrowDownLeft size={15} />{t("home.visualIncome")}</span><span><ArrowUpRight size={15} />{t("home.visualSpending")}</span></div>
          </div>
          <div className="home-device-label"><ShieldCheck size={18} />{t("home.visualDevice")}</div>
        </div>
      </section>

      <section className="home-features" aria-label={t("home.features")}>
        <article><span className="home-feature-icon home-feature-chart"><ChartNoAxesCombined size={22} aria-hidden="true" /></span><div><h2>{t("home.pictureTitle")}</h2><p>{t("home.pictureBody")}</p></div></article>
        <article><span className="home-feature-icon home-feature-currency"><Coins size={22} aria-hidden="true" /></span><div><h2>{t("home.currencyTitle")}</h2><p>{t("home.currencyBody")}</p></div></article>
        <article><span className="home-feature-icon home-feature-wallet"><WalletCards size={22} aria-hidden="true" /></span><div><h2>{t("home.walletTitle")}</h2><p>{t("home.walletBody")}</p></div></article>
        <article><span className="home-feature-icon home-feature-offline"><WifiOff size={22} aria-hidden="true" /></span><div><h2>{t("home.offlineTitle")}</h2><p>{t("home.offlineBody")}</p></div></article>
      </section>

      <section id="home-start" className="home-start" aria-labelledby="home-start-title" tabIndex={-1}>
        <h2 id="home-start-title">{t("home.startTitle")}</h2>
        <ol>
          <li><span><WalletCards size={18} aria-hidden="true" /></span>{t("home.stepWallet")}<ChevronRight className="directional-icon home-step-arrow" size={16} aria-hidden="true" /></li>
          <li><span><Plus size={18} aria-hidden="true" /></span>{t("home.stepTransactions")}<ChevronRight className="directional-icon home-step-arrow" size={16} aria-hidden="true" /></li>
          <li><span><ChartNoAxesCombined size={18} aria-hidden="true" /></span>{t("home.stepCharts")}</li>
        </ol>
      </section>
    </main>

    <footer className="home-footer"><div className="home-footer-links"><AppAccess /><CreatorCredit /><a href="/LICENSE.txt"><Download size={14} aria-hidden="true" />{t("home.licenseLink")}</a></div></footer>
  </div>;
}
