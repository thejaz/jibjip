export const SUPPORTED_LOCALES = ["en", "fa"] as const;

export type InterfaceLocale = (typeof SUPPORTED_LOCALES)[number];
export type InterfaceDirection = "ltr" | "rtl";

export const DEFAULT_LOCALE: InterfaceLocale = "en";

export function normalizeInterfaceLocale(value: unknown): InterfaceLocale {
  return SUPPORTED_LOCALES.includes(value as InterfaceLocale)
    ? (value as InterfaceLocale)
    : DEFAULT_LOCALE;
}

export function directionForLocale(locale: InterfaceLocale): InterfaceDirection {
  switch (locale) {
    case "en":
      return "ltr";
    case "fa":
      return "rtl";
  }
}
