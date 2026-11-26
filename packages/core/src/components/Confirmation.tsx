"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { translatedErrorMessage, type AppErrorKey } from "../lib/app-error";
import { useI18n } from "../lib/i18n";
import { Dialog } from "./Dialog";

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  errorKey: AppErrorKey;
  onConfirm: () => Promise<void>;
};

const ConfirmationContext = createContext<((request: Confirmation) => void) | null>(null);

/** Lives outside the app shell so restore/erase can change the setup screen safely. */
export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Confirmation | null>(null);
  const requestConfirmation = useCallback((next: Confirmation) => setRequest(current => current ?? next), []);
  return <ConfirmationContext.Provider value={requestConfirmation}>
    {children}
    {request && <ConfirmationDialog request={request} onClose={() => setRequest(null)} />}
  </ConfirmationContext.Provider>;
}

export function useConfirmation() {
  const requestConfirmation = useContext(ConfirmationContext);
  if (!requestConfirmation) throw new Error("ConfirmationProvider is required.");
  return requestConfirmation;
}

function ConfirmationDialog({ request, onClose }: { request: Confirmation; onClose: () => void }) {
  const { t } = useI18n();
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = () => { if (!running.current) onClose(); };
  const apply = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await request.onConfirm();
      onClose();
    } catch (reason) {
      setError(translatedErrorMessage(reason, t, request.errorKey));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return <Dialog title={request.title} eyebrow={t("dialog.confirmAction")} busy={busy} onClose={close}>
    <div className="dialog-form">
      <p className="confirmation-copy">{request.description}</p>
      {error && <p className="dialog-form-error" role="alert">{error}</p>}
      <footer>
        <button type="button" className="button secondary" onClick={close}>{t("common.cancel")}</button>
        <button type="button" className="button danger" onClick={apply}>{busy ? t("activity.saving") : request.confirmLabel}</button>
      </footer>
    </div>
  </Dialog>;
}
