import { DEFAULT_LOCALE, type InterfaceLocale } from "./config.ts";
import { en, type MessageCatalog } from "./locales/en.ts";
import { fa } from "./locales/fa.ts";
import { pluralFormatter } from "./formatters.ts";

export const messages: Record<InterfaceLocale, MessageCatalog> = { en, fa };

export type TranslationKey = keyof typeof en;
export type TranslationValues = Record<string, string | number>;

export type PluralKey = {
  [Key in TranslationKey]: Key extends `${infer Prefix}.one`
    ? `${Prefix}.other` extends TranslationKey
      ? Prefix
      : never
    : never;
}[TranslationKey];

export function interpolate(message: string, values: TranslationValues = {}): string {
  return message.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}

export function translate(
  locale: InterfaceLocale,
  key: TranslationKey,
  values?: TranslationValues,
): string {
  const resource = messages[locale] ?? messages[DEFAULT_LOCALE];
  return interpolate(resource[key], values);
}

export function translatePlural(
  locale: InterfaceLocale,
  key: PluralKey,
  count: number,
  values: TranslationValues = {},
): string {
  const category = pluralFormatter(locale, {}).select(count);
  const candidate = `${key}.${category}` as TranslationKey;
  const fallback = `${key}.other` as TranslationKey;
  const resource = messages[locale] ?? messages[DEFAULT_LOCALE];
  return interpolate(resource[candidate] ?? resource[fallback], { count, ...values });
}
