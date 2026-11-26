"use client";

import { Archive, ArrowRight, CircleCheck, DatabaseBackup, FileText, ShieldCheck, WifiOff } from "lucide-react";
import { useI18n } from "../lib/i18n";
import licenseText from "../../../../LICENSE?raw";
import { CreatorCredit } from "./CreatorCredit";

const PRINCIPLES = [
  { key: "privacy", icon: ShieldCheck },
  { key: "offline", icon: WifiOff },
  { key: "clarity", icon: CircleCheck },
  { key: "control", icon: DatabaseBackup },
] as const;

export function AboutView({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { locale, t } = useI18n();
  return (
    <div className="about-page">
      <section className="panel about-intro" aria-labelledby="about-mission">
        <div className="about-intro-copy">
          <p className="eyebrow">{t("about.eyebrow")}</p>
          <h2 id="about-mission">{t("about.mission")}</h2>
          <p className="about-lead">{t("about.description")}</p>
        </div>
        <div className="about-emblem" aria-hidden="true"><img src="/brand/jibjip-icon.svg" alt="" width="80" height="80" /></div>
      </section>
      <div className="panel about-principles">
        {PRINCIPLES.map(({ key, icon: Icon }) => (
          <section className={`about-principle about-principle-${key}`} key={key} aria-labelledby={`about-${key}`}>
            <span className="about-icon" aria-hidden="true"><Icon size={21} strokeWidth={1.7} /></span>
            <div>
              <h3 id={`about-${key}`}>{t(`about.${key}Title`)}</h3>
              <p>{t(`about.${key}Body`)}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="about-resources">
        <section className="panel about-resource about-backup" aria-labelledby="about-backup-title">
          <div className="about-section-heading"><Archive size={20} aria-hidden="true" /><h3 id="about-backup-title">{t("about.backupTitle")}</h3></div>
          <p>{t("about.backupBody")}</p>
          <div className="about-resource-action">{onOpenSettings ? <button type="button" className="button secondary" onClick={onOpenSettings}>{t("about.backupAction")}<ArrowRight size={16} className="about-arrow" aria-hidden="true" /></button> : <a className="button secondary" href={`/app/?lang=${locale}`}>{t("home.open")}<ArrowRight size={16} className="about-arrow" aria-hidden="true" /></a>}</div>
        </section>
        <section className="panel about-resource about-license" aria-labelledby="about-license-title">
          <div className="about-section-heading"><FileText size={20} aria-hidden="true" /><h3 id="about-license-title">{t("about.licenseTitle")}</h3></div>
          <p>{t("about.licenseBody")}</p>
          <p>{t("about.thirdPartyLicenses")}</p>
          <details className="about-resource-action">
            <summary>{t("about.readLicense")}</summary>
            <pre dir="ltr" lang="en">{licenseText}</pre>
          </details>
        </section>
      </div>
      <p className="about-statistics">{t("about.statisticsNote")}</p>
      <footer className="about-footer"><CreatorCredit /><a className="about-home-link" href={`/?lang=${locale}`}>{t("about.homeLink")}<ArrowRight size={15} className="about-arrow" aria-hidden="true" /></a></footer>
    </div>
  );
}
