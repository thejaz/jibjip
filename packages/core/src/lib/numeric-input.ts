/** Normalize numeric fields only; user-authored names and notes remain untouched. */
export function asciiDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, digit => String(digit.charCodeAt(0) - (digit >= "۰" ? 0x06f0 : 0x0660)));
}

export function normalizeNumericInput(value: string): string {
  const ascii = asciiDigits(value).replace(/٫/g, ".").replace(/٬/g, ",").replace(/−/g, "-");
  // Strip grouping only when complete and unambiguous; malformed input must fail validation.
  return /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?(?:[eE][+-]?\d+)?$/.test(ascii.trim())
    ? ascii.replace(/,/g, "") : ascii;
}

/** Group only valid plain decimals; incomplete/invalid drafts must remain editable. */
export function groupAmountInput(value: string): string {
  if (!/^[+-]?\d*(?:\.\d*)?$/.test(value)) return value;
  const [integer, fraction] = value.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

export function amountInputEdit(text: string, caret: number, pasted = false) {
  const ascii = asciiDigits(text).replace(/٫/g, ".").replace(/٬/g, ",").replace(/−/g, "-");
  // Typed commas belong to the formatted view. Pasted separators still need validation.
  const value = pasted ? normalizeNumericInput(ascii).trim() : ascii.replace(/,/g, "");
  const display = groupAmountInput(value);
  if (display === value && value.includes(",")) return { value, display, caret: Math.min(caret, display.length) };
  const offset = ascii.slice(0, caret).replace(/,/g, "").length;
  let position = 0, characters = 0;
  while (position < display.length && characters < offset) {
    if (display[position] !== ",") characters += 1;
    position += 1;
  }
  return { value, display, caret: position };
}
