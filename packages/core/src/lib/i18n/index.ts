export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  directionForLocale,
  normalizeInterfaceLocale,
  type InterfaceDirection,
  type InterfaceLocale,
} from "./config.ts";
export { I18nProvider, Trans, useI18n } from "./I18nProvider.tsx";
export {
  interpolate,
  messages,
  translate,
  translatePlural,
  type PluralKey,
  type TranslationKey,
  type TranslationValues,
} from "./translate.ts";
