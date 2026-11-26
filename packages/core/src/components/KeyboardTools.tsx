"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Search, type LucideIcon } from "lucide-react";
import { nextOptionIndex } from "../lib/keyboard";
import { useI18n } from "../lib/i18n";
import { Dialog } from "./Dialog";
import { SearchField } from "./SearchField";

export type AppCommand = { id: string; label: string; keywords?: string; icon: LucideIcon; run: () => void; disabled?: boolean };

export function modifierLabel() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
}

export function ShortcutKeys({ keys }: { keys: string[] }) {
  return <span className="shortcut-keys" dir="ltr">{keys.map(key => <kbd key={key}>{key}</kbd>)}</span>;
}

export function CommandDialog({ commands, onClose }: { commands: AppCommand[]; onClose: () => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const needle = query.trim().toLocaleLowerCase();
  const visible = commands.filter(command => !command.disabled && `${command.label} ${command.keywords ?? command.id}`.toLocaleLowerCase().includes(needle));
  const activeIndex = Math.max(0, visible.findIndex(command => command.id === activeId));
  const optionId = visible[activeIndex] ? `${listId}-${activeIndex}` : undefined;
  const choose = (command: AppCommand) => {
    onClose();
    // Restore the menu's trigger before the destination moves focus or opens a form.
    window.setTimeout(command.run, 0);
  };
  useEffect(() => { if (optionId) document.getElementById(optionId)?.scrollIntoView({ block: "nearest" }); }, [optionId]);
  return <Dialog title={t("keyboard.quickActions")} eyebrow={t("common.jibjip")} className="command-dialog" initialFocus="input" onClose={onClose}>
    <div className="command-search"><Search size={18} aria-hidden="true" /><SearchField inputRef={inputRef} label={t("keyboard.findAction")} placeholder={t("keyboard.findAction")} value={query}
      role="combobox" aria-autocomplete="list" aria-controls={listId} aria-expanded="true" aria-activedescendant={optionId}
      onValueChange={next => { setQuery(next); setActiveId(null); }} onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (["ArrowDown", "ArrowUp"].includes(event.key)) {
          event.preventDefault(); setActiveId(visible[nextOptionIndex(activeIndex, visible.length, event.key)]?.id ?? null);
        } else if (event.key === "Enter") { event.preventDefault(); if (visible[activeIndex]) choose(visible[activeIndex]); }
      }} /></div>
    <div className="command-list" role="listbox" aria-label={t("keyboard.quickActions")} id={listId}>
      {visible.map((command, index) => {
        const Icon = command.icon;
        return <button key={command.id} id={`${listId}-${index}`} type="button" role="option" tabIndex={-1} aria-selected={index === activeIndex}
          onMouseEnter={() => setActiveId(command.id)} onMouseDown={event => event.preventDefault()} onClick={() => choose(command)}>
          <Icon size={18} aria-hidden="true" /><span>{command.label}</span><ArrowRight size={15} className="command-go" aria-hidden="true" />
        </button>;
      })}
      {!visible.length && <p className="no-results" role="status">{t("keyboard.noActions")}</p>}
    </div>
    <p className="keyboard-hint"><ShortcutKeys keys={["↑", "↓"]} />{t("keyboard.chooseHint")}<ShortcutKeys keys={["Enter"]} />{t("keyboard.openHint")}</p>
  </Dialog>;
}

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const mod = modifierLabel();
  const rows = [
    [[mod, "K"], "keyboard.quickActions"], [[mod, "/"], "keyboard.shortcuts"], [[mod, "Enter"], "keyboard.saveForm"],
    [["Tab", "Shift+Tab"], "keyboard.moveFocus"], [["↑", "↓"], "keyboard.chooseOption"],
    [["Enter", "Space"], "keyboard.activate"], [["Esc"], "keyboard.escape"],
  ] as const;
  return <Dialog title={t("keyboard.shortcuts")} eyebrow={t("common.jibjip")} className="shortcuts-dialog" onClose={onClose}>
    <p className="dialog-description">{t("keyboard.intro")}</p>
    <dl className="shortcuts-list">{rows.map(([keys, label]) => <div key={label}><dt>{t(label)}</dt><dd><ShortcutKeys keys={[...keys]} /></dd></div>)}</dl>
    <p className="field-help">{t("keyboard.safety")}</p>
  </Dialog>;
}
