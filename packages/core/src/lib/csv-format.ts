/** Stable, untranslated transaction CSV contract shared by import, export, and help. */
export const CSV_TRANSACTION_COLUMNS = [
  "Date", "Wallet", "Operation", "Direction", "Category", "Amount", "Currency", "Note",
] as const;

/** Optional export metadata; unmarked legacy CSV text must never be decoded. */
export const CSV_TEXT_ENCODING_COLUMN = "Text Encoding";
export const CSV_TEXT_ENCODING = "apostrophe-v1";
