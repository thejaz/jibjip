import type Decimal from "decimal.js";
import { formatMoney } from "../lib/finance";
import { useI18n } from "../lib/i18n";
import type { IrrDisplayUnit } from "../lib/types";

export function MoneyAmount({ amount, currency, compact = false, irrDisplayUnit = "IRR" }: {
  amount: Decimal.Value; currency: string; compact?: boolean; irrDisplayUnit?: IrrDisplayUnit;
}) {
  const { locale } = useI18n();
  const formatted = formatMoney(amount, currency, compact, irrDisplayUnit, locale);
  const match = formatted.match(/^(.*\d)(\.)(\d+)([^\d]*)$/);
  if (!match) return <span className="money-amount">{formatted}</span>;
  const [, whole, separator, fraction, suffix] = match;
  return <span className="money-amount"><span className="visually-hidden">{formatted}</span><span aria-hidden="true">
    {whole}<span className="money-decimals">{separator}<span className="money-fraction">{fraction}</span></span>{suffix}
  </span></span>;
}
