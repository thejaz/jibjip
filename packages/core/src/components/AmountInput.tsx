import { useId, useLayoutEffect, useRef, useState } from "react";
import { amountInputEdit, groupAmountInput } from "../lib/numeric-input";
import { amountReadout } from "../lib/amount-words";
import { useI18n } from "../lib/i18n";
import type { IrrDisplayUnit } from "../lib/types";

export function AmountInput({ value, onValueChange, currency, unit, required = true }: {
  value: string; onValueChange: (value: string) => void; currency: string; unit: IrrDisplayUnit; required?: boolean;
}) {
  const { locale } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const selection = useRef<number | null>(null);
  const pasted = useRef(false);
  const composing = useRef(false);
  const [composition, setComposition] = useState<string | null>(null);
  const [, renderEdit] = useState(0);
  const history = useRef({ entries: [{ value, caret: groupAmountInput(value).length }], index: 0 });
  const descriptionId = useId();
  const spoken = composition === null ? amountReadout(value, currency, unit, locale) : null;

  useLayoutEffect(() => {
    if (history.current.entries[history.current.index].value !== value) {
      history.current = { entries: [{ value, caret: groupAmountInput(value).length }], index: 0 };
    }
    if (selection.current === null || !input.current) return;
    input.current.setSelectionRange(selection.current, selection.current);
    selection.current = null;
  });
  const commit = (text: string, caret: number, fromPaste = false) => {
    const result = amountInputEdit(text, caret, fromPaste);
    const edits = history.current;
    if (result.value !== edits.entries[edits.index].value) {
      edits.entries = edits.entries.slice(0, edits.index + 1);
      edits.entries.push({ value: result.value, caret: result.caret });
      if (edits.entries.length > 50) edits.entries.shift();
      edits.index = edits.entries.length - 1;
    }
    selection.current = result.caret;
    onValueChange(result.value);
    renderEdit(revision => revision + 1);
  };
  const undo = (forward = false) => {
    const edits = history.current;
    edits.index = Math.max(0, Math.min(edits.entries.length - 1, edits.index + (forward ? 1 : -1)));
    const entry = edits.entries[edits.index];
    selection.current = entry.caret;
    onValueChange(entry.value);
    renderEdit(revision => revision + 1);
  };

  return <>
    <input ref={input} required={required} type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
      value={composition ?? groupAmountInput(value)} placeholder="0.00" aria-describedby={spoken ? descriptionId : undefined}
      onPaste={event => {
        history.current.entries[history.current.index].caret = event.currentTarget.selectionStart ?? 0;
        pasted.current = true;
        window.setTimeout(() => { pasted.current = false; }, 0);
      }}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={event => { composing.current = false; setComposition(null); commit(event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length); }}
      onChange={event => {
        if (composing.current) { setComposition(event.target.value); return; }
        const type = (event.nativeEvent as InputEvent).inputType;
        if (type === "historyUndo" || type === "historyRedo") { undo(type === "historyRedo"); return; }
        const fromPaste = pasted.current || type === "insertFromPaste";
        pasted.current = false;
        commit(event.target.value, event.target.selectionStart ?? event.target.value.length, fromPaste);
      }}
      onKeyDown={event => {
        if (composing.current) return;
        const key = event.code === "KeyZ" ? "z" : event.code === "KeyY" ? "y" : event.key.toLowerCase();
        if ((event.ctrlKey || event.metaKey) && !event.altKey && ["z", "y"].includes(key)) {
          event.preventDefault(); undo(key === "y" || event.shiftKey); return;
        }
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const field = event.currentTarget, start = field.selectionStart ?? 0;
        history.current.entries[history.current.index].caret = start;
        if (start !== field.selectionEnd) return;
        if (event.key === "Backspace" && start > 1 && field.value[start - 1] === ",") {
          event.preventDefault(); commit(field.value.slice(0, start - 2) + field.value.slice(start), start - 2);
        } else if (event.key === "Delete" && field.value[start] === ",") {
          event.preventDefault(); commit(field.value.slice(0, start) + field.value.slice(start + 2), start);
        }
      }} />
    {spoken && <small id={descriptionId} className="amount-in-words" dir="auto" aria-hidden="true">{spoken}</small>}
  </>;
}
