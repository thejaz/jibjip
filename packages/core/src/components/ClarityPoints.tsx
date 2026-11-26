"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, CircleCheck, Pencil, Plus, ReceiptText, Tags, WalletCards } from "lucide-react";
import { groupTransactionActivities } from "../lib/activity";
import { translatedErrorMessage } from "../lib/app-error";
import { CLARITY_POINTS, CLARITY_TASKS, clarityProgress, clarityReviewContext, clarityReviewRows, clarityWeek, type ClarityReviewContext, type ClarityTask } from "../lib/clarity";
import { awardClarityReview, setClarityEnabled } from "../lib/db";
import { localDate } from "../lib/dates";
import { subscribeLocalDay } from "../lib/local-day";
import { transactionSign, walletBalance } from "../lib/finance";
import { useI18n } from "../lib/i18n";
import { activityAmount } from "../lib/splits";
import type { AppSnapshot, Transaction } from "../lib/types";
import { Dialog } from "./Dialog";
import { MoneyAmount } from "./MoneyAmount";
import "./clarity.css";

export function ClaritySetting({ snapshot, onNotice }: { snapshot: AppSnapshot; onNotice: (message: string) => void }) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const id = useId();
  return <section className="display-setting-group clarity-settings" aria-labelledby={`${id}-title`}>
    <div className="panel-heading"><div><h3 id={`${id}-title`}>{t("clarity.title")}</h3><p>{t("clarity.settingDescription")}</p></div></div>
    <label className="clarity-setting">
      <input className="clarity-toggle-input" type="checkbox" role="switch" aria-describedby={`${id}-note`} aria-disabled={saving || undefined} checked={snapshot.settings.clarity.enabled} onClick={event => { if (savingRef.current) event.preventDefault(); }} onChange={async event => {
        if (savingRef.current) return;
        savingRef.current = true;
        const enabled = event.target.checked;
        setSaving(true);
        try { await setClarityEnabled(enabled); }
        catch { onNotice(t("error.claritySave")); }
        finally { savingRef.current = false; setSaving(false); }
      }} />
      <span className="clarity-switch" aria-hidden="true" />
      <span>{t("clarity.showOnOverview")}</span>
    </label>
    <p id={`${id}-note`} className="clarity-note">{t("clarity.privateNote")}</p>
  </section>;
}

type Review = { context: ClarityReviewContext; snapshot: AppSnapshot };
const TASK_ICONS = { transactions: ReceiptText, categories: Tags, balance: WalletCards };

function ClarityRing({ completed }: { completed: number }) {
  const { t, formatNumber } = useI18n();
  return <svg className="clarity-ring" viewBox="0 0 48 48" role="img" aria-label={t("clarity.reviewsDone", { count: formatNumber(completed) })}>
    <circle cx="24" cy="24" r="20" className="clarity-ring-track" />
    {CLARITY_TASKS.map((task, index) => <circle key={task} cx="24" cy="24" r="20" pathLength="30"
      transform={`rotate(${-90 + index * 120} 24 24)`} strokeDasharray={`${index < completed ? 9 : 0} 30`} className="clarity-ring-value" />)}
    {completed === 3 ? <path d="m16 24 5 5 11-12" className="clarity-ring-check" /> : <text x="24" y="28" textAnchor="middle" direction="ltr">{completed}/3</text>}
  </svg>;
}

export function ClarityPoints({ snapshot, onNotice, onEdit, onAdd, onOpenWallets, renderCategory }: {
  snapshot: AppSnapshot; onNotice: (message: string) => void;
  onEdit: (transaction: Transaction) => void; onOpenWallets: () => void;
  onAdd: () => void;
  renderCategory: (row: Transaction) => ReactNode;
}) {
  const { t, formatNumber } = useI18n();
  const [review, setReview] = useState<Review | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [showCompletedRecords, setShowCompletedRecords] = useState(false);
  const savingRef = useRef(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  const focusAfterSave = useRef(false);
  const lastWallet = useRef<string | null>(null);
  const [localCompletions, setLocalCompletions] = useState<{ source: AppSnapshot | null; period: string; tasks: ClarityTask[] }>({ source: null, period: "", tasks: [] });
  const day = useSyncExternalStore(subscribeLocalDay, localDate, localDate);
  const storedProgress = clarityProgress(snapshot.settings.clarity, day);
  // Only bridge the current snapshot's liveQuery delay, never a later Full restore.
  const pendingCompletions = localCompletions.source === snapshot && localCompletions.period === clarityWeek(day) ? localCompletions.tasks.filter(task => !storedProgress.completed.includes(task)) : [];
  const progress = { total: storedProgress.total + pendingCompletions.length * CLARITY_POINTS,
    weekly: storedProgress.weekly + pendingCompletions.length * CLARITY_POINTS,
    completed: [...storedProgress.completed, ...pendingCompletions] };
  const nextTask = CLARITY_TASKS.find(task => !progress.completed.includes(task));
  const done = Boolean(review && progress.completed.includes(review.context.task));
  useEffect(() => {
    if (!saving && done && focusAfterSave.current) { continueRef.current?.focus(); focusAfterSave.current = false; }
  }, [saving, done]);
  const wallets = [...snapshot.wallets].filter(wallet => !wallet.archived).sort((a, b) => a.currency.localeCompare(b.currency) || a.name.localeCompare(b.name));
  const open = (task: ClarityTask, walletId: string | null = lastWallet.current) => {
    if (savingRef.current) return;
    try {
      const chosenWallet = wallets.some(wallet => wallet.id === walletId) ? walletId : snapshot.settings.mainWalletId ?? wallets[0]?.id ?? null;
      if (task === "balance") lastWallet.current = chosenWallet;
      setReview({ context: clarityReviewContext(snapshot, task, chosenWallet), snapshot });
      setConfirmed(false); setError(""); setPage(0); setShowCompletedRecords(false);
    } catch (reason) { onNotice(translatedErrorMessage(reason, t, "error.claritySave")); }
  };
  const activities = useMemo(() => review ? groupTransactionActivities(clarityReviewRows(review.snapshot, review.context.task, review.context.walletId, review.context.day))
    .sort((a, b) => b.primary.date.localeCompare(a.primary.date) || b.primary.updatedAt.localeCompare(a.primary.updatedAt)) : [], [review]);
  const changed = (() => {
    if (!review) return false;
    try { return day !== review.context.day || clarityReviewContext(snapshot, review.context.task, review.context.walletId, day).signature !== review.context.signature; }
    catch { return true; }
  })();
  if (!snapshot.settings.clarity.enabled) return null;
  const selectedWallet = review?.snapshot.wallets.find(wallet => wallet.id === review.context.walletId);
  return <>
    <section className={`clarity-summary${nextTask ? "" : " is-complete"}`} aria-label={t("clarity.title")}>
      <ClarityRing completed={progress.completed.length} />
      <div className="clarity-summary-copy"><strong>{t(nextTask ? "clarity.title" : "clarity.weekDone")}</strong><span>{t("clarity.weekly", { points: formatNumber(progress.weekly) })}</span><small>{t("clarity.total", { points: formatNumber(progress.total) })}</small></div>
      <button type="button" className="button secondary" onClick={() => open(nextTask ?? "transactions")}>{t(!nextTask ? "clarity.viewReview" : progress.completed.length ? "clarity.continue" : "clarity.start")}</button>
    </section>
    {review && <Dialog title={t("clarity.review")} eyebrow={t("clarity.title")} busy={saving} onClose={() => { if (!savingRef.current) setReview(null); }} className="clarity-dialog">
      <div className="clarity-tasks" role="group" aria-label={t("clarity.tasks")}>
        {CLARITY_TASKS.map(task => {
          const completed = progress.completed.includes(task);
          const Icon = completed ? Check : TASK_ICONS[task];
          return <button type="button" key={task} aria-pressed={review.context.task === task} data-completed={completed} onClick={() => open(task)}>
            <span className="clarity-task-icon"><Icon size={18} aria-hidden="true" /></span><span>{t(`clarity.${task}`)}<small>{t(completed ? "clarity.reviewed" : "clarity.taskPoints")}</small></span>
          </button>;
        })}
      </div>
      <p className="clarity-period"><bdi dir="ltr">{clarityWeek(review.context.day)} – {review.context.day}</bdi><span>{t("clarity.weekStarts")}</span></p>
      {done && <div className="clarity-completed"><span className="clarity-completed-icon"><CircleCheck size={30} aria-hidden="true" /></span><div role="status"><h3>{t(nextTask ? "clarity.taskDone" : "clarity.weekDone")}</h3><p>{t(nextTask ? "clarity.taskDoneDescription" : "clarity.weekDoneDescription")}</p><small>{t("clarity.weekly", { points: formatNumber(progress.weekly) })}</small></div><button ref={continueRef} type="button" className="button primary clarity-continue" onClick={() => nextTask ? open(nextTask) : setReview(null)}>{t(nextTask ? "clarity.continue" : "clarity.finish")}{nextTask && <ArrowRight size={16} aria-hidden="true" />}</button></div>}
      {done && <button type="button" className="text-button clarity-show-records" aria-expanded={showCompletedRecords} onClick={() => setShowCompletedRecords(value => !value)}>{t(showCompletedRecords ? "clarity.hideRecords" : "clarity.showRecords")}</button>}
      {(!done || showCompletedRecords) && <>
      <p className="clarity-instruction">{t(`clarity.${review.context.task}Description`)}</p>
      {review.context.task === "balance" ? <div className="clarity-wallet">
        <label><span>{t("clarity.chooseWallet")}</span><select value={review.context.walletId ?? ""} onChange={event => { open("balance", event.target.value); if (done) setShowCompletedRecords(true); }}>
          {wallets.map(wallet => <option key={wallet.id} value={wallet.id}>{wallet.currency} · {wallet.name}</option>)}
        </select></label>
        {selectedWallet && <strong><MoneyAmount amount={walletBalance(selectedWallet.id, review.snapshot.transactions)} currency={selectedWallet.currency} irrDisplayUnit={snapshot.settings.irrDisplayUnit} /></strong>}
        <button type="button" className="text-button" onClick={() => { setReview(null); onOpenWallets(); }}>{t("clarity.openWallets")}</button>
      </div> : <>
        <div className="clarity-list-heading"><span>{t("clarity.activityCount", { count: formatNumber(activities.length) })}</span>{review.context.task === "transactions" && <button type="button" className="text-button affirmative" onClick={onAdd}><Plus size={16} aria-hidden="true" />{t("clarity.addMissing")}</button>}</div>
        {activities.length ? <ul className="clarity-activities">{activities.slice(page * 10, page * 10 + 10).map(activity => {
          const row = activity.primary;
          const wallet = review.snapshot.wallets.find(item => item.id === row.walletId);
          const categories = [...new Map(activity.rows.map(item => [item.categoryId ?? item.category, item])).values()];
          const category = <span className="clarity-category-list">{categories.map(item => <span key={item.categoryId ?? item.category}>{renderCategory(item)}</span>)}</span>;
          return <li key={activity.id}><div><strong>{review.context.task === "categories" ? category : wallet?.name ?? row.currency}</strong>
            <small><bdi>{row.date}</bdi> · {review.context.task === "categories" ? wallet?.name : category}</small></div>
            <div className="clarity-amounts">{activity.exchangeOut && activity.exchangeIn ? [activity.exchangeOut, activity.exchangeIn].map(leg => <MoneyAmount key={leg.id} amount={`${transactionSign(leg) < 0 ? "-" : ""}${leg.amount}`} currency={leg.currency} irrDisplayUnit={snapshot.settings.irrDisplayUnit} />) : <MoneyAmount amount={`${transactionSign(row) < 0 ? "-" : ""}${activityAmount(activity.rows)}`} currency={row.currency} irrDisplayUnit={snapshot.settings.irrDisplayUnit} />}</div>
            <button type="button" className="icon-button" aria-label={t("clarity.edit", { date: row.date, wallet: wallet?.name ?? row.currency })} onClick={() => onEdit(row)}><Pencil size={16} /></button></li>;
        })}</ul> : <p className="clarity-empty">{t(review.context.task === "categories" ? "clarity.noCategories" : "clarity.quietWeek")}</p>}
        {activities.length > 10 && <div className="clarity-pagination"><button type="button" className="icon-button" aria-label={t("transactions.previousPage")} disabled={page === 0} onClick={() => setPage(value => value - 1)}><ChevronLeft size={18} /></button>
          <span dir="ltr">{formatNumber(page + 1)} / {formatNumber(Math.ceil(activities.length / 10))}</span>
          <button type="button" className="icon-button" aria-label={t("transactions.nextPage")} disabled={(page + 1) * 10 >= activities.length} onClick={() => setPage(value => value + 1)}><ChevronRight size={18} /></button></div>}
      </>}
      {changed && <p className="clarity-refresh" role="status">{t("error.clarityStale")} <button type="button" className="text-button" onClick={() => { open(review.context.task, review.context.walletId); if (done) setShowCompletedRecords(true); }}>{t("clarity.refresh")}</button></p>}
      {!done && <label className="clarity-confirm"><input type="checkbox" checked={confirmed} disabled={changed} onChange={event => setConfirmed(event.target.checked)} /><span>{t(`clarity.${review.context.task}Confirm`)}</span></label>}
      </>}
      <details className="clarity-help"><summary>{t("clarity.howItWorks")}</summary><p className="clarity-note">{t("clarity.reviewNote")}</p></details>
      {error && <p className="dialog-form-error" role="alert">{error}</p>}
      <footer className="clarity-actions"><button type="button" className="button secondary" onClick={() => setReview(null)}>{t("dialog.close")}</button>
        {!done && <button type="button" className="button primary" disabled={!confirmed || changed || saving} onClick={async () => {
          if (savingRef.current || !confirmed || changed) return;
          savingRef.current = true;
          setSaving(true); setError("");
          try {
            const awarded = await awardClarityReview(review.context);
            const period = clarityWeek(review.context.day);
            setLocalCompletions(current => ({ source: snapshot, period, tasks: [...new Set([...(current.period === period ? current.tasks : []), review.context.task])] }));
            focusAfterSave.current = true;
            if (!awarded) onNotice(t("clarity.completed"));
          } catch (reason) { setError(translatedErrorMessage(reason, t, "error.claritySave")); }
          finally { savingRef.current = false; setSaving(false); }
        }}>{t(saving ? "activity.saving" : "clarity.complete")}</button>}
      </footer>
    </Dialog>}
  </>;
}
