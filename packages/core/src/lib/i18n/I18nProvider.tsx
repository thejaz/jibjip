"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  directionForLocale,
  normalizeInterfaceLocale,
  type InterfaceDirection,
  type InterfaceLocale,
} from "./config.ts";
import {
  translate,
  translatePlural,
  type PluralKey,
  type TranslationKey,
  type TranslationValues,
} from "./translate.ts";
import { dateFormatter, numberFormatter } from "./formatters.ts";

interface I18nContextValue {
  locale: InterfaceLocale;
  direction: InterfaceDirection;
  setLocale: (locale: unknown) => void;
  t: (key: TranslationKey, values?: TranslationValues) => string;
  tp: (key: PluralKey, count: number, values?: TranslationValues) => string;
  formatNumber: (value: number | bigint) => string;
  formatDate: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: InterfaceLocale }) {
  const [locale, setActiveLocale] = useState<InterfaceLocale>(() => normalizeInterfaceLocale(initialLocale));
  const direction = directionForLocale(locale);
  const setLocale = useCallback((value: unknown) => {
    setActiveLocale(normalizeInterfaceLocale(value));
  }, []);
  const t = useCallback(
    (key: TranslationKey, values?: TranslationValues) => translate(locale, key, values),
    [locale],
  );
  const tp = useCallback(
    (key: PluralKey, count: number, values?: TranslationValues) =>
      translatePlural(locale, key, count, values),
    [locale],
  );
  const formatNumber = useCallback(
    (value: number | bigint) => numberFormatter(locale, { numberingSystem: "latn" }).format(value),
    [locale],
  );
  const formatDate = useCallback(
    (value: Date | string, options: Intl.DateTimeFormatOptions = { dateStyle: "full" }) => {
      const date = typeof value === "string" ? new Date(value) : value;
      return dateFormatter(locale, { calendar: "gregory", numberingSystem: "latn", ...options }).format(date);
    },
    [locale],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    document.title = t("meta.title");
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      const meta = document.querySelector<HTMLMetaElement>(selector);
      if (meta) meta.content = t("meta.title");
    }
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = t("meta.description");
  }, [direction, locale, t]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, direction, setLocale, t, tp, formatNumber, formatDate }),
    [direction, formatDate, formatNumber, locale, setLocale, t, tp],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider.");
  return value;
}

export function Trans({ id, values }: { id: TranslationKey; values?: TranslationValues }) {
  const { t } = useI18n();
  const text = t(id, values);
  const parts = text.split(/(<code>.*?<\/code>)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^<code>(.*?)<\/code>$/);
        return match ? <code key={index}>{match[1]}</code> : part;
      })}
    </>
  );
}
