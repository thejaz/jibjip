import type {
  TranslationKey,
  TranslationValues,
} from "./i18n/translate.ts";

export type AppErrorKey = Extract<TranslationKey, `error.${string}`>;

export class AppError extends Error {
  readonly key: AppErrorKey;
  readonly values: TranslationValues;

  constructor(key: AppErrorKey, fallbackMessage: string, values: TranslationValues = {}) {
    super(fallbackMessage);
    this.name = "AppError";
    this.key = key;
    this.values = values;
  }
}

export function translatedErrorMessage(
  reason: unknown,
  translate: (key: TranslationKey, values?: TranslationValues) => string,
  fallbackKey: AppErrorKey,
): string {
  if (reason instanceof AppError) return translate(reason.key, reason.values);
  return reason instanceof Error ? reason.message : translate(fallbackKey);
}
