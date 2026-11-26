"use client";

import { useImperativeHandle, useRef, type InputHTMLAttributes, type Ref } from "react";
import { X } from "lucide-react";
import { useI18n } from "../lib/i18n";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  inputRef?: Ref<HTMLInputElement>;
};

/** Clearing retains focus; Escape clears before dismissing a surrounding picker or dialog. */
export function SearchField({ value, onValueChange, label, inputRef, onKeyDown, ...props }: Props) {
  const { t } = useI18n();
  const localRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(inputRef, () => localRef.current!, []);
  return <span className="clearable-search">
    <input {...props} type="search" ref={localRef} aria-label={label} value={value} onChange={event => onValueChange(event.target.value)} onKeyDown={event => {
      if (!event.nativeEvent.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key === "Escape" && value) {
        event.preventDefault(); event.stopPropagation(); onValueChange("");
      } else onKeyDown?.(event);
    }} />
    {value && <button type="button" className="search-clear" aria-label={t("common.clearSearch")} title={t("common.clearSearch")} onMouseDown={event => event.preventDefault()} onClick={() => {
      onValueChange(""); localRef.current?.focus({ preventScroll: true });
    }}><X size={15} aria-hidden="true" /></button>}
  </span>;
}
