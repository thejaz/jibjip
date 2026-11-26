import { CSV_TRANSACTION_COLUMNS } from "./csv-format.ts";
import { translate } from "./i18n/translate.ts";
import type { InterfaceLocale } from "./i18n/config.ts";

/** Static instructions only: never insert personal wallet names or records. */
export function migrationPrompt(locale: InterfaceLocale): string {
  return translate(locale, "migration.prompt", { columns: CSV_TRANSACTION_COLUMNS.join(",") });
}
