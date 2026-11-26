"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { nextOptionIndex } from "../lib/keyboard";
import { SearchField } from "./SearchField";
import { useI18n } from "../lib/i18n";

export type PickerChoice = { key: string; label: string; content: ReactNode; group?: string; custom?: boolean };

/** Shared combobox navigation; exploring options never changes a saved selection. */
export function ChoicePicker({ choices, value, label, selectedLabel, children, onChoose, query, onQueryChange, className = "category-picker", triggerClass = "category-picker-trigger", menuClass = "category-picker-menu", optionClass = "category-picker-option" }: {
  choices: PickerChoice[]; value: string; label: string; children: ReactNode;
  onChoose: (choice: PickerChoice) => void; query?: string; onQueryChange?: (query: string) => void;
  className?: string; triggerClass?: string; menuClass?: string; optionClass?: string; selectedLabel?: string;
}) {
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const searchable = Boolean(onQueryChange);
  const chosenIndex = choices.findIndex(choice => choice.key === value);
  const requestedIndex = choices.findIndex(choice => choice.key === activeKey);
  const activeIndex = requestedIndex >= 0 ? requestedIndex : query ? (choices.length ? 0 : -1) : Math.max(0, chosenIndex);
  const activeId = choices[activeIndex] ? `${listId}-${activeIndex}` : undefined;
  const close = (restoreFocus = false) => {
    setOpen(false); setActiveKey(null); onQueryChange?.("");
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  };
  const choose = (choice: PickerChoice) => { onChoose(choice); close(true); };

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) { setOpen(false); setActiveKey(null); }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open && activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [open, activeId]);

  const groups = choices.reduce<Array<{ name?: string; items: Array<{ choice: PickerChoice; index: number }> }>>((result, choice, index) => {
    if (!result.length || result.at(-1)?.name !== choice.group) result.push({ name: choice.group, items: [] });
    result.at(-1)!.items.push({ choice, index });
    return result;
  }, []);

  return <div className={`${className}${open ? " is-open" : ""}`} ref={rootRef} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  }} onKeyDown={event => {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target !== triggerRef.current && event.target !== inputRef.current && event.key !== "Escape") return;
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault(); setActiveKey(event.key === "ArrowUp" ? choices.at(-1)?.key ?? null : choices[chosenIndex >= 0 ? chosenIndex : 0]?.key ?? null); setOpen(true); return;
    }
    if (!open) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
    else if (["ArrowDown", "ArrowUp"].includes(event.key) || (!searchable && ["Home", "End"].includes(event.key))) {
      event.preventDefault(); setActiveKey(choices[nextOptionIndex(activeIndex, choices.length, event.key)]?.key ?? null);
    } else if (event.key === "Enter" || (!searchable && event.key === " ")) {
      event.preventDefault(); if (choices[activeIndex]) choose(choices[activeIndex]);
    }
  }}>
    <button ref={triggerRef} type="button" className={triggerClass} aria-label={selectedLabel && selectedLabel !== label ? `${label}: ${selectedLabel}` : label}
      role={searchable ? undefined : "combobox"} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-activedescendant={!searchable && open ? activeId : undefined} onClick={() => open ? close() : setOpen(true)}>{children}</button>
    {open && <div className={menuClass}>
      {searchable && <SearchField inputRef={inputRef} label={label} placeholder={label} value={query ?? ""}
        role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={activeId}
        onValueChange={next => { setActiveKey(null); onQueryChange?.(next); }} />}
      <div className="category-picker-options" role="listbox" aria-label={label} id={listId}>
        {groups.map((group, groupIndex) => <div key={groupIndex} role={group.name ? "group" : undefined} aria-label={group.name}>
          {group.name && <p className="category-group-label">{group.name}</p>}
          {group.items.map(({ choice, index }) => <button key={choice.key} id={`${listId}-${index}`} type="button" role="option" tabIndex={-1}
            aria-selected={index === activeIndex} className={`${optionClass}${choice.custom ? " is-custom" : ""}`}
            onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActiveKey(choice.key)} onClick={event => {
              // A surrounding form label must not activate the trigger after this option disappears.
              event.preventDefault(); event.stopPropagation(); choose(choice);
            }}>{choice.content}</button>)}
        </div>)}
        {!choices.length && <span className="category-picker-empty" role="status">{t("common.noMatches")}</span>}
      </div>
    </div>}
  </div>;
}
