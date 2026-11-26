# jibjip bug tracker

This file keeps important defects visible until they are verified in every
runtime that matters. Keep this tracker in the repository permanently for
future maintenance. Remove an individual entry only when the fix is safe to
declare resolved and the user has validated the relevant workflow.

## Reporting and closing bugs

- Record a concise symptom, scope, and reproducible steps.
- Identify the persistence or calculation invariant involved.
- Add focused regression coverage where practical.
- Mark an entry resolved only after source, local runtime, and relevant user
  workflows have been checked.
- Require explicit user validation of the reported behavior before removing
  the entry. If user validation is pending, keep the entry and say so clearly.
- Remove only the resolved entry’s content; never delete this maintenance file.
- Never include private financial records, notes, backups, or other sensitive
  user data in this file.

## Reporting-currency chart, mixed numeral input, and category selection

The Overview wallet donut used EUR even after changing `View in`. Numeric forms
rejected Persian/Arabic digits, and a category option inside a form label could
reopen its picker after selection. The 0.11.21 patch uses the selected currency
throughout the donut, normalizes numeric input to exact ASCII values, and
suppresses label reactivation when choosing an option. No stored records are
migrated. Synthetic checks cover exact values, malformed input without writes,
EUR/USD/IRR display, English/Persian phone widths, and keyboard focus return.
Maintainer confirmation on actual phones is pending; retain this entry.

## About details changed page and language

Opening Details and choices from the English app About page navigated to the
public website About shell, which could use a separately saved Persian preference.
The unexpected navigation changed both language and layout. No financial data
was involved.

The later simplification removes the separate page and Details/choices interface
entirely. About ends with the short statistics note after its practical resources.
Old `/about/` bookmarks return to the homepage with their language hint preserved.
Maintainer confirmation of the simplified reading flow is pending; retain this entry.

## Open-window date rollover

An app left open across midnight could retain the previous header date, rolling
report window, monthly chart range, and memoized current-rate valuations. Reproduce
by leaving Overview open overnight, or suspending the browser and returning on a
later day. No stored transaction was changed, but the displayed period could be stale.

The fix shares a local-midnight/foreground date subscription and includes the day
in time-sensitive calculation dependencies. Open draft dates and input remain
unchanged. Automated checks cover midnight, suspended tabs, clock changes, and
date-specific valuation. Maintainer validation of the daily-use workflow is pending;
retain this entry until confirmed.

Isolated Chrome verification for 0.11.8 advanced the date by 31 days: the header
and rolling totals refreshed while an open transaction kept its date, amount, and
note. No reload or financial-store write was needed.

## Persian layout of dates, changes, and equivalents in rate and transaction lists

In Persian (right-to-left) layouts, some values built from Latin digits and signs
display in the wrong order. The ISO rate date reads "26-11-2026" instead of
"2026-11-26" in the rate-update proposal list and the saved-rate rows. A negative rate
change reads "%4.4256411−" instead of "−4.4256411%". The secondary equivalent under an
exchange row reads "€ 100.00+" with its sign at the end. The left-to-right rate line
"1 EUR = …" is also left-aligned while neighboring Persian lines are right-aligned. Data
and calculations are unaffected. Found with synthetic data on 26 November 2026.

0.14.0 isolates the dates, the signed change with its percent sign, and the signed
equivalent as left-to-right text, and right-aligns the rate lines in Persian. A
synthetic Persian check confirmed the reading order and English output unchanged.
Maintainer confirmation in the everyday app is pending; retain this entry.
