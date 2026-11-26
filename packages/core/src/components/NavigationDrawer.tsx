"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useModalDialog } from "./Dialog";

export function NavigationDrawer({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const { t } = useI18n();
  const ref = useModalDialog();
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 821px)");
    const closeOnDesktop = () => { if (desktop.matches) onClose(); };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [onClose]);
  return <dialog ref={ref} id="mobile-navigation" className="navigation-drawer" aria-label={t("shell.mainNavigation")}
    onCancel={event => { if (event.target !== event.currentTarget) return; event.preventDefault(); event.stopPropagation(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="sidebar navigation-drawer-content">
      <button className="icon-button navigation-close" aria-label={t("shell.closeNavigation")} onClick={onClose}><X size={20} /></button>
      {children}
    </div>
  </dialog>;
}
