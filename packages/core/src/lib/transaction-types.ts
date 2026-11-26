import type { Operation } from "./types.ts";

/** Built-in transaction types. Income and expense are always reporting directions. */
export const CONFIGURABLE_TRANSACTION_TYPES = ["transfer", "exchange", "adjustment"] as const;
export type ConfigurableTransactionType = (typeof CONFIGURABLE_TRANSACTION_TYPES)[number];

export const DEFAULT_TYPE_REPORTABILITY: Record<ConfigurableTransactionType, boolean> = {
  transfer: false,
  exchange: false,
  adjustment: false,
};

export function isConfigurableTransactionType(operation: Operation): operation is ConfigurableTransactionType {
  return CONFIGURABLE_TRANSACTION_TYPES.includes(operation as ConfigurableTransactionType);
}

export function normalizeTypeReportability(value: unknown): Record<ConfigurableTransactionType, boolean> {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(CONFIGURABLE_TRANSACTION_TYPES.map((operation) => [
    operation,
    candidate[operation] === true,
  ])) as Record<ConfigurableTransactionType, boolean>;
}

export function transactionTypeLabel(operation: ConfigurableTransactionType): string {
  return operation.charAt(0).toUpperCase() + operation.slice(1);
}

/** Fixed type names and their retired directional compatibility labels are not category names. */
export function isTransactionTypeCategoryLabel(value: string): boolean {
  return /^(transfer|exchange|adjustment)(?:\s*\((?:in|out)\))?$/i.test(value.trim());
}
