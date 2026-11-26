"use client";

import { CheckCircle2, Download, RefreshCw, ShieldCheck, WifiOff, X } from "lucide-react";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../lib/i18n";
import { checkOfflineUpdates, getOfflineStatus, getServerOfflineStatus, installApp, protectOfflineStorage, registerOfflineShell, subscribeOfflineStatus } from "../lib/offline";
import { useModalDialog } from "./Dialog";
import "./app-access.css";

/** Shared by the public homepage, setup, and app; never opens financial storage. */
export function AppAccess() {
  const { t } = useI18n();
  const status = useSyncExternalStore(subscribeOfflineStatus, getOfflineStatus, getServerOfflineStatus);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<Awaited<ReturnType<typeof installApp>>>();
  const [protecting, setProtecting] = useState(false);
  const dialog = useModalDialog(undefined, open);
  const heading = useId();
  useEffect(() => { registerOfflineShell(); }, []);
  const readyKey = status.supported === false ? "access.unsupported" : status.ready ? "access.ready" : status.failed ? "access.downloadFailed" : !status.online ? "access.downloadOffline" : "access.preparing";
  const updateKey = status.supported === false ? "access.unsupported" : status.downloading ? "access.downloading" : status.checking ? "access.checking" : status.failed ? "access.checkFailed" : status.waiting ? "access.updateReadyBody" : !status.online ? "access.updateOffline" : status.checked ? "access.checked" : "access.updateBody";
  return <>
    <button type="button" className={`app-access-trigger${status.waiting ? " has-update" : ""}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      {status.waiting ? <RefreshCw size={15} aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}<span>{t(status.waiting ? "access.updateReady" : status.installed ? "access.appStatus" : "access.installOffline")}</span>
      {!status.waiting && status.ready && <CheckCircle2 className="app-access-ready" size={15} role="img" aria-label={t("access.ready")} />}
    </button>
    {open && createPortal(<dialog ref={dialog} className="app-access-dialog" aria-labelledby={heading} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(false); }} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="app-access-scroll" tabIndex={-1}>
      <header><div><p>{t("access.eyebrow")}</p><h2 id={heading}>{t("access.title")}</h2></div><button type="button" className="app-access-close" aria-label={t("dialog.close")} onClick={() => setOpen(false)}><X size={20} /></button></header>
      <div className="app-access-content">
        <section className={`app-access-status${status.ready || status.waiting ? " is-ready" : ""}`} aria-live="polite">
          {status.waiting ? <RefreshCw size={20} aria-hidden="true" /> : status.ready ? <CheckCircle2 size={20} aria-hidden="true" /> : <WifiOff size={20} aria-hidden="true" />}<div><strong>{t(status.waiting ? "access.updateReady" : readyKey)}</strong><p>{t(status.waiting ? "access.updateReadyBody" : status.online ? "access.offlineBody" : "access.offlineNow")}</p></div>
        </section>
        <section className="app-access-installation">
        <h3>{t("access.installation")}</h3>
        {status.installed ? <p><CheckCircle2 className="app-access-ready" size={17} aria-hidden="true" /> {t("access.installed")}</p> : <>
          <p>{t("access.installBody")}</p>
          {(status.canInstall || installing) && <button type="button" className="button affirmative" disabled={installing} aria-busy={installing} onClick={async () => { setInstalling(true); try { setInstallResult(await installApp()); } finally { setInstalling(false); } }}><Download size={17} aria-hidden="true" />{t(installing ? "access.installing" : "access.install")}</button>}
          <small role="status">{t(installResult === "failed" ? "access.installFailed" : installResult === "dismissed" ? "access.installDismissed" : installResult === "accepted" ? "access.installAccepted" : status.canInstall ? "access.installAvailable" : "access.installManual")}</small>
          <div className="app-access-instructions">
            <details><summary>{t("access.iphone")}</summary><p>{t("access.iphoneSteps")}</p></details>
            <details><summary>{t("access.android")}</summary><p>{t("access.androidSteps")}</p></details>
            <details><summary>{t("access.computer")}</summary><p>{t("access.computerSteps")}</p></details>
          </div>
        </>}
        </section>
        <section className="app-access-updates">
          <h3>{t("access.updates")}</h3>
          {updateKey !== "access.updateReadyBody" && <p role="status">{t(updateKey)}</p>}
          {status.checking && <progress className="app-access-progress" aria-label={t(status.downloading ? "access.downloading" : "access.checking")} />}
          <button type="button" className="button secondary" aria-busy={status.checking} disabled={status.supported !== true || !status.online || status.checking} onClick={() => { void checkOfflineUpdates(true); }}><RefreshCw size={16} aria-hidden="true" />{t(status.downloading ? "access.downloading" : status.checking ? "access.checking" : "access.check")}</button>
          <small>{t("access.updateSafety")}</small>
        </section>
        <section className="app-access-storage">
          <ShieldCheck size={19} aria-hidden="true" /><div><p>{t(status.persistent ? "access.protected" : "access.backups")}</p>
            {status.storageAvailable && !status.persistent && <button type="button" className="app-access-text-button" disabled={protecting} onClick={async () => { setProtecting(true); try { await protectOfflineStorage(); } finally { setProtecting(false); } }}>{t("access.protect")}</button>}
            {status.protectionRequested && !status.persistent && <small role="status">{t("access.protectionDeclined")}</small>}
            <small>{t("access.noSync")}</small>
          </div>
        </section>
      </div>
      </div>
    </dialog>, document.body)}
  </>;
}
