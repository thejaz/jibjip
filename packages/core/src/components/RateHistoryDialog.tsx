"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { LockKeyhole, LockKeyholeOpen, Pencil } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { Dialog } from "./Dialog";
import { localDate } from "../lib/dates";
import { fetchRateHistory, planRateUpdates, type HistoryResult } from "../lib/rate-history";
import { persistRates, setRateLocked } from "../lib/db";
import type { AppSnapshot, Rate } from "../lib/types";

export default function RateHistoryDialog({ snapshot, onClose, onEdit }: {
  snapshot: AppSnapshot; onClose: () => void; onEdit: (row: Rate) => void;
}) {
  const { t, formatNumber } = useI18n();
  const today = localDate();
  const used = useMemo(() => [...new Set([...snapshot.transactions.map(row => row.currency), ...snapshot.wallets.map(row => row.currency), snapshot.settings.reportingCurrency])].filter(code => code !== "EUR").sort(), [snapshot]);
  const [mode, setMode] = useState<"saved" | "fetch">("saved");
  const [currency, setCurrency] = useState(used.includes("IRR") ? "IRR" : used[0] ?? "USD");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(0);
  const [fetchCurrency, setFetchCurrency] = useState("used");
  const [from, setFrom] = useState(() => {
    const earliest = snapshot.transactions.reduce((date, row) => row.date < date ? row.date : date, today);
    return `${Math.max(1999, Number(earliest.slice(0, 4)))}-01-01`;
  });
  const [to, setTo] = useState(today);
  const [result, setResult] = useState<HistoryResult>();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [status, setStatus] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const rows = useMemo(() => snapshot.rates.filter(row => row.quoteCurrency === currency && (!month || row.effectiveDate.startsWith(month)))
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || (a.granularity ?? "daily").localeCompare(b.granularity ?? "daily")), [snapshot.rates, currency, month]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 50)); const shownPage = Math.min(page, pageCount - 1);
  const plan = useMemo(() => result ? planRateUpdates(snapshot.rates, result.rows) : null, [result, snapshot.rates]);
  const summaries = useMemo(() => result ? [...new Set(result.rows.map(row => row.quoteCurrency))].sort().map(code => {
    const daily = result.rows.filter(row => row.quoteCurrency === code && row.granularity !== "monthly").sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    return { code, count: daily.length, first: daily[0]?.effectiveDate, last: daily.at(-1)?.effectiveDate,
      monthly: result.rows.filter(row => row.quoteCurrency === code && row.granularity === "monthly").length };
  }) : [], [result]);
  const options = snapshot.currencies.filter(row => !row.archived && row.code !== "EUR").sort((a, b) => a.code.localeCompare(b.code));
  const fetchHistory = async () => {
    if (busy || saving) return;
    controller.current = new AbortController(); setBusy(true); setResult(undefined); setStatus("");
    try {
      setResult(await fetchRateHistory(fetchCurrency === "used" ? used : [fetchCurrency], from, to, {
        signal: controller.current.signal, onProgress: (done, total) => setProgress(`${done} / ${total}`),
      }));
    } catch { setStatus(controller.current.signal.aborted ? t("history.cancelled") : t("history.fetchError")); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    if (!result || saving) return;
    setSaving(true); setStatus("");
    try { const count = await persistRates(result.rows);  setResult(undefined); setStatus(t("history.saved", { count: formatNumber(count) })); setMode("saved"); }
    catch { setStatus(t("history.saveError")); }
    finally { setSaving(false); }
  };
  return <Dialog title={t("history.title")} eyebrow={t("dialog.eurBase")} busy={saving} onClose={() => { if (!saving) { controller.current?.abort(); onClose(); } }}>
    <div className="rate-history-body">
      <p className="dialog-description">{t("history.description")}</p>
      <div className="rate-history-tabs"><button className={`button ${mode === "saved" ? "primary" : "secondary"}`} aria-pressed={mode === "saved"} onClick={() => setMode("saved")}>{t("history.savedTab")}</button><button className={`button ${mode === "fetch" ? "primary" : "secondary"}`} aria-pressed={mode === "fetch"} onClick={() => setMode("fetch")}>{t("history.fetchTab")}</button></div>
      {mode === "fetch" ? <>
        <form className="dialog-form" onSubmit={event => { event.preventDefault(); void fetchHistory(); }}>
          <div className="form-grid">
            <label className="span-2"><span>{t("history.currencies")}</span><select disabled={busy || saving} value={fetchCurrency} onChange={event => { setFetchCurrency(event.target.value); setResult(undefined); }}><option value="used">{t("history.usedCurrencies", { codes: used.join(", ") || "EUR" })}</option>{options.map(row => <option key={row.code} value={row.code}>{row.code}</option>)}</select></label>
            <label><span>{t("history.from")}</span><input type="date" required min="1999-01-01" max={to} disabled={busy || saving} value={from} onChange={event => { setFrom(event.target.value); setResult(undefined); }} /></label>
            <label><span>{t("history.to")}</span><input type="date" required min={from} max={today} disabled={busy || saving} value={to} onChange={event => { setTo(event.target.value); setResult(undefined); }} /></label>
          </div>
          <p className="field-help">{t("history.sources")}</p>
          <div className="rate-history-actions"><button className="button primary" disabled={busy || saving}>{busy ? t("history.fetching", { progress }) : t("history.preview")}</button>{busy && <button type="button" className="button secondary" onClick={() => controller.current?.abort()}>{t("common.cancel")}</button>}</div>
        </form>
        {result && <section className="history-preview" aria-label={t("history.previewTitle")}>
          <h3>{t("history.previewTitle")}</h3>
          {summaries.map(row => <div className="history-summary" key={row.code}><strong>{row.code}</strong><span><bdi dir="ltr">{row.first} – {row.last}</bdi><small>{t("history.summary", { daily: formatNumber(row.count), monthly: formatNumber(row.monthly) })}</small></span></div>)}
          <p>{t("history.plan", { count: formatNumber(plan?.puts.length ?? 0), protected: formatNumber(plan?.protectedCount ?? 0), unchanged: formatNumber(plan?.unchanged ?? 0) })}</p>
          {result.mirrorUsed && <p className="chart-data-info">{t("history.mirror")}</p>}
          {result.rejected > 0 && <p className="chart-data-warning">{t("history.rejected", { count: result.rejected })}</p>}
          {result.unavailable.length > 0 && <p className="chart-data-warning">{t("history.unavailable", { codes: result.unavailable.join(", ") })}</p>}
          <p className="field-help">{t("history.coverageNote")}</p>
          <button className="button affirmative" disabled={!plan?.puts.length || saving || busy} onClick={apply}>{saving ? t("rates.applying") : t("history.apply", { count: formatNumber(plan?.puts.length ?? 0) })}</button>
        </section>}
      </> : <>
        <div className="form-grid history-filters"><label><span>{t("dialog.quoteCurrency")}</span><select value={currency} onChange={event => { setCurrency(event.target.value); setPage(0); }}>{options.map(row => <option key={row.code} value={row.code}>{row.code}</option>)}</select></label><label><span>{t("history.monthFilter")}</span><input type="month" value={month} onChange={event => { setMonth(event.target.value); setPage(0); }} /></label></div>
        <div className="history-selection"><strong dir="ltr">1 EUR → {currency}</strong>{month && <button type="button" className="text-button" onClick={() => { setMonth(""); setPage(0); }}>{t("history.clearMonth")}</button>}</div>
        <details className="history-help"><summary>{t("history.helpTitle")}</summary><p>{t("history.rules")}</p><p>{t("history.lockHelp")}</p></details>
        <div className="history-observations" role="region" aria-label={t("history.savedTab")} tabIndex={0}>{rows.slice(shownPage * 50, (shownPage + 1) * 50).map(row => <article className="history-observation" key={row.id}>
          <div><time className="history-date" dateTime={row.effectiveDate} dir="ltr">{row.effectiveDate}</time><strong className="history-value" dir="ltr">{row.value} {currency}</strong><small><span className="history-period">{t(row.granularity === "monthly" ? "history.monthly" : "history.daily")}</span> · {row.method === "manual" ? t("settings.methodManual") : row.source}</small>{row.sourceUrl && <a href={row.sourceUrl} target="_blank" rel="noreferrer">{t("history.sourceLink")}</a>}</div>
          <div className="row-actions"><button className="icon-button" aria-label={t("history.edit", { date: row.effectiveDate })} onClick={() => onEdit(row)}><Pencil size={16} /></button><button className="icon-button" aria-label={t(row.locked ? "history.unlock" : "history.lock", { date: row.effectiveDate })} onClick={async () => { try { await setRateLocked(row.id, !row.locked);  } catch { setStatus(t("history.saveError")); } }}>{row.locked ? <LockKeyhole size={16} /> : <LockKeyholeOpen size={16} />}</button></div>
        </article>)}{!rows.length && <p className="no-results">{t("history.empty")}</p>}</div>
        <div className="history-pagination"><button className="button small secondary" disabled={shownPage === 0} onClick={() => setPage(shownPage - 1)}>{t("history.previous")}</button><span>{t("history.page", { page: shownPage + 1, pages: pageCount, count: formatNumber(rows.length) })}</span><button className="button small secondary" disabled={shownPage + 1 >= pageCount} onClick={() => setPage(shownPage + 1)}>{t("history.next")}</button></div>
      </>}
      {status && <p role="status" className="chart-data-info">{status}</p>}
    </div>
  </Dialog>;
}
