import Decimal from "decimal.js";
import type { InterfaceLocale } from "./i18n/config.ts";
import { normalizeNumericInput } from "./numeric-input.ts";
import { irrDisplayDecimalPlaces } from "./finance.ts";
import { numberFormatter } from "./i18n/formatters.ts";
import { translate } from "./i18n/translate.ts";
import type { IrrDisplayUnit } from "./types.ts";

const EN_SMALL = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const FA_SMALL = ["صفر", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه", "ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const FA_TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const FA_HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES = {
  en: ["", "thousand", "million", "billion", "trillion", "quadrillion", "quintillion"],
  fa: ["", "هزار", "میلیون", "میلیارد", "تریلیون", "کوادریلیون", "کوینتیلیون"],
};

function previewNumber(input: string): string | null {
  const value = normalizeNumericInput(input).trim();
  if (value.length > 128 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return null;
  const exponent = value.split(/e/i)[1];
  return exponent && Math.abs(Number(exponent)) > 40 ? null : value;
}

function threeDigits(n: number, locale: InterfaceLocale): string {
  const small = locale === "fa" ? FA_SMALL : EN_SMALL;
  if (n < 20) return small[n];
  if (n < 100) {
    const tens = (locale === "fa" ? FA_TENS : EN_TENS)[Math.floor(n / 10)];
    return tens + (n % 10 ? `${locale === "fa" ? " و " : "-"}${small[n % 10]}` : "");
  }
  const hundreds = locale === "fa" ? FA_HUNDREDS[Math.floor(n / 100)] : `${small[Math.floor(n / 100)]} hundred`;
  return hundreds + (n % 100 ? `${locale === "fa" ? " و " : " "}${threeDigits(n % 100, locale)}` : "");
}

/** Exact, bounded preview only: never rounds, validates, or writes a financial amount. */
export function amountInWords(input: string, locale: InterfaceLocale): string | null {
  const value = previewNumber(input);
  if (value === null) return null;
  let amount: Decimal;
  try { amount = new Decimal(value); } catch { return null; }
  if (!amount.isFinite() || amount.e > 20 || amount.decimalPlaces() > 18) return null;
  const [integer, fraction] = amount.abs().toFixed().split(".");
  const parts: string[] = [];
  for (let end = integer.length, scale = 0; end > 0; end -= 3, scale += 1) {
    const group = Number(integer.slice(Math.max(0, end - 3), end));
    if (group) parts.unshift([locale === "fa" && group === 1 && scale === 1 ? "" : threeDigits(group, locale), SCALES[locale][scale]].filter(Boolean).join(" "));
  }
  const small = locale === "fa" ? FA_SMALL : EN_SMALL;
  const whole = parts.join(locale === "fa" ? " و " : " ") || small[0];
  const decimal = fraction ? ` ${locale === "fa" ? "ممیز" : "point"} ${[...fraction].map(d => small[Number(d)]).join(" ")}` : "";
  return `${amount.isNegative() && !amount.isZero() ? locale === "fa" ? "منفی " : "minus " : ""}${whole}${decimal}`;
}

export function amountReadout(input: string, currency: string, unit: IrrDisplayUnit, locale: InterfaceLocale): string | null {
  if (!currency || input.length > 128) return null;
  const value = previewNumber(input);
  if (value === null) return null;
  try {
    let amount = new Decimal(value);
    let name: string;
    if (currency === "IRR") {
      if (unit !== "IRR") amount = amount.mul(new Decimal(10).pow(irrDisplayDecimalPlaces(unit) - 1));
      const key = unit === "IRR" ? amount.abs().eq(1) ? "amount.rial.one" : "amount.rial.other" : amount.abs().eq(1) ? "amount.toman.one" : "amount.toman.other";
      name = translate(locale, key);
    } else {
      try {
        name = numberFormatter(locale, { style: "currency", currency, currencyDisplay: "name", minimumFractionDigits: 0, maximumFractionDigits: 0 })
          .formatToParts(amount.abs().eq(1) ? 1 : 2).find(part => part.type === "currency")?.value ?? currency;
      } catch { name = currency; }
    }
    const words = amountInWords(amount.toString(), locale);
    return words ? translate(locale, "amount.inWords", { amount: words, currency: name }) : null;
  } catch { return null; }
}
