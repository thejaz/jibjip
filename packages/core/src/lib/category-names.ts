import type { Operation } from "./types.ts";

export function cleanCategoryName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Apply English title casing while leaving Farsi and compatibility tokens intact. */
export function titleCaseCategoryName(value: string): string {
  const cleaned = cleanCategoryName(value);
  const minorWords = new Set(["a", "an", "and", "for", "in", "of", "on", "the", "to"]);
  return cleaned.replace(/[A-Za-z][A-Za-z']*/g, (word, offset: number) => {
    if (word === "IN" || word === "OUT") return word;
    const lower = word.toLocaleLowerCase("en");
    if (offset > 0 && minorWords.has(lower)) return lower;
    return lower.charAt(0).toLocaleUpperCase("en") + lower.slice(1);
  });
}

export function titleCaseCategoryLabel(value: string, operation?: Operation): string {
  return operation === "transfer" || operation === "exchange" || operation === "adjustment"
    ? cleanCategoryName(value)
    : titleCaseCategoryName(value);
}
