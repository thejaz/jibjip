"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { shortcutIntent } from "../lib/keyboard";
import "./modal.css";

/** Native top-layer modality, shared by forms and the mobile navigation drawer. */
export function useModalDialog(initialFocus?: string, open = true) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    const initial = initialFocus ? dialog.querySelector<HTMLElement>(initialFocus) : null;
    (initial ?? dialog.querySelector<HTMLButtonElement>("button"))?.focus();
    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || (event.target instanceof Element && event.target.closest("dialog") !== dialog)) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]")]
        .filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener("keydown", trapTab);
    return () => {
      dialog.removeEventListener("keydown", trapTab);
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [initialFocus, open]);
  return dialogRef;
}

export function Dialog({ title, eyebrow, onClose, children, busy = false, submitShortcut = false, className = "", initialFocus }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode; busy?: boolean; submitShortcut?: boolean; className?: string; initialFocus?: string }) {
  const { t } = useI18n();
  const dialogRef = useModalDialog(initialFocus ?? (submitShortcut ? "form input:not(:disabled), form select:not(:disabled), form textarea:not(:disabled)" : undefined));
  const titleId = useId();
  return <dialog ref={dialogRef} className="dialog-backdrop" aria-labelledby={titleId} aria-busy={busy || undefined} onKeyDown={event => {
    if (event.nativeEvent.isComposing || event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) return;
    event.preventDefault();
    if (shortcutIntent(event.nativeEvent) !== "submit" || !submitShortcut || busy || event.currentTarget.querySelector('[role="combobox"][aria-expanded="true"]')) return;
    const form = event.currentTarget.querySelector<HTMLFormElement>("form");
    const submitter = form?.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');
    if (form && submitter && !submitter.matches(":disabled")) {
      if (typeof form.requestSubmit === "function") form.requestSubmit(submitter);
      else submitter.click();
    }
  }} onCancel={(event) => { if (event.target !== event.currentTarget) return; event.preventDefault(); event.stopPropagation(); if (!busy) onClose(); }} onMouseDown={(event) => { if (!busy && event.currentTarget === event.target) onClose(); }}><section className={`dialog ${className}`.trim()}><div className="dialog-scroll" tabIndex={-1}><header><div><p className="eyebrow">{eyebrow}</p><h2 id={titleId}>{title}</h2></div><button type="button" className="icon-button" aria-label={t("dialog.close")} disabled={busy} onClick={onClose}><X size={19} /></button></header><fieldset className="dialog-content" disabled={busy}>{children}</fieldset></div></section></dialog>;
}
