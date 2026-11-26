"use client";

import { Check, Copy } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { migrationPrompt } from "../lib/migration-guide";

export function MigrationGuide() {
  const { locale, direction, t } = useI18n();
  const prompt = migrationPrompt(locale);
  const promptId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [copiedPrompt, setCopiedPrompt] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const copied = copiedPrompt === prompt;
  const manualCopy = selectedPrompt === prompt;
  async function copyPrompt() {
    setSelectedPrompt("");
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(prompt);
    } catch {
      field.current?.focus();
      field.current?.select();
      setSelectedPrompt(prompt);
    }
  }
  return <details className="migration-guide">
    <summary>{t("migration.title")}</summary>
    <div className="migration-guide-content">
      <p>{t("migration.scope")}</p>
      <ol>
        <li>{t("migration.export")}</li>
        <li>{t("migration.prepare")}</li>
        <li>{t("migration.import", { settings: t("nav.settings"), data: t("settings.dataPortability"), action: t("settings.importCsv") })}</li>
      </ol>
      <div className="migration-prompt-heading"><label htmlFor={promptId}>{t("migration.promptLabel")}</label><button type="button" className="button secondary" onClick={copyPrompt}>{copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{t(copied ? "migration.copied" : "migration.copy")}</button></div>
      <textarea id={promptId} ref={field} className="migration-prompt" rows={8} readOnly value={prompt} dir={direction} lang={locale} spellCheck={false} />
      <p role="status" className="migration-copy-status">{manualCopy ? t("migration.manualCopy") : copied ? t("migration.copied") : ""}</p>
      <p className="migration-note">{t("migration.review")}</p>
      <p className="migration-note">{t("migration.privacy")}</p>
    </div>
  </details>;
}
