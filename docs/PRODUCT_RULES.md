# JIBJIP product contracts

Read the sections relevant to a UI, financial, persistence, setup, or portability
change before editing. These are durable requirements referenced by [AGENTS.md](../AGENTS.md),
not a release history. Keep each rule here rather than copying it into several
guides. [ARCHITECTURE.md](ARCHITECTURE.md) maps the implementation; [VERSIONING.md](VERSIONING.md)
owns release policy and [OFFLINE.md](OFFLINE.md) owns the offline lifecycle.

## Identity, branding, and product scope

- Full page titles are `JIBJIP | YOUR MONEY, YOURS!` in English and
  `جیب جیپ | پول تو، برای تو` in Persian, including localized social-title metadata.
  Keep the slogan separate from the app name: install/manifest/application-name
  fields remain `JIBJIP`, and ordinary Persian brand labels remain `جیب جیپ`.
  The homepage and About use the matching slogan; preserve the approved logotype proportions.

- Holding the sidebar logo for three seconds starts the bundled chick sample;
  it loops only while held. Release/cancel/blur exits looping and lets the current
  playback finish. Short activation still opens Overview. Support primary pointer
  capture, nonpassive native touch holds, and Space/Enter holds, suppress long-press context menus/navigation, and
  cancel pending starts on release, hidden documents, or disposal. Use one gesture-unlocked
  Web Audio context, no remote audio/library, and precache `/audio/chick.mp3` with release
  integrity. Same-origin asset requests retain hosting credentials; never send records.
  Never start late after a released hold or overlap voices.

- English product-facing text, titles, metadata, and accessible brand labels use
  `JIBJIP`. Persian uses exactly `جیب جیپ` with an ordinary space. Preserve the
  existing logotype artwork and lowercase technical identifiers, filenames,
  URLs, package names, database identities, and import/export tokens. The
  creator's approved public identity is `THEJAZ`, linked only to
  `https://github.com/thejaz`. Keep the credit small and factual in About and
  the homepage footer; use an ordinary link without remote avatars, tracking,
  or automatic GitHub requests. Do not add real names or private contact details.

- The current Farsi wordmark SVG is a two-row square mark. Every shared brand lockup gives its
  locale-specific frame 25% more height than the English frame and renders either SVG with
  `object-fit: contain`; keep the frame locale class and do not hardcode an artwork aspect
  ratio, so replacement SVGs remain undistorted and unclipped.

- The smaller/lower optical adjustment applies ONLY to Persian artwork in horizontal lockups.
  Preserve English branding and all vertically stacked lockups (including sidebar, setup, and
  loading) exactly as they are unless the maintainer explicitly asks to change them. Do not convert
  stacked branding to a horizontal layout. Horizontal homepage lockups use intrinsic artwork
  widths, an 8 px gap, and one 48 px rectangular container. Do not give square Persian artwork
  the English frame's width. The Persian wordmark uses 90% of its 40 px frame height and sits 2
  px below geometric center for optical balance; keep it within the icon's vertical bounds.
  English remains centered. Preserve the locale-specific frames and undistorted artwork.

- The canonical brand artwork is `packages/core/assets/brand/jibjip-icon.svg`, with locale-specific outlined
  wordmarks in `packages/core/assets/brand/jibjip-type-en.svg` and `packages/core/assets/brand/jibjip-type-fa.svg`. The
  canonical source files are shared by personal and website builds; replace them directly when
  updating English or Farsi typography. Visible in-app lockups render the matching wordmark as a
  direct image from `/brand/` selected from the interface locale, with an automatic content
  fingerprint query so changed artwork cannot reuse a browser or service-worker cache. Do not
  recreate the wordmark with live text, CSS background images, or a generic letter mark. After
  replacing artwork, run `node scripts/verify_brand_assets.mjs`, then launch through `Open
  jibjip.cmd`; never edit `work/local-runtime/` or `work/public-candidate/` by hand. The
  portable build and hosted-release verifier require byte-identical wordmark copies. Use the
  type-free mark without a background as the source for favicons, PWA icons, maskable icons, and
  Apple touch icons. Generated raster icons live in `packages/core/assets/icons/`.
  Android selects a separate manifest with padded shortcut icons and a smaller
  maskable mark. Apple and desktop keep their approved sizing. The favicon has
  separate tight framing at 16/32/48 px. General-purpose PNGs and favicons retain transparency, the original yellow chick
  and white shell, with no baked-in tile or wordmark. Keep a separate opaque paper
  background for Android maskable and Apple touch icons; platforms control their
  final shape. Maskable artwork must fit inside the central 40%-radius safe circle.
  Regenerate through `scripts/generate_app_icons.mjs` using an existing Sharp
  installation (`--sharp <module-directory>`); `--check` verifies reproducibility.
  Sharp is an optional artwork tool, not an application/build dependency. The
  generator updates icon content fingerprints in manifest/HTML references.

- The shared core remains complete, local-first, and account-free; optional commercial
  services belong outside it. No account, authentication, cloud service, telemetry, or
  device sync is implemented.

- The public website shell may use manually installed, cookieless Cloudflare Web
  Analytics on the canonical visitor homepage only. Keep DNS in DNS-only mode:
  never enable the orange-cloud proxy or automatic site-wide beacon injection.
  This optional service stays in `apps/web/`; the shared core, `/app/`, development,
  and personal installation never load it. Disable SPA route measurement and keep
  statistics independent of rendering, navigation, offline caches, and finance.
  Statistics start without a prompt for new homepage visitors. The bilingual
  11-word English notice is a quiet line at the bottom of the app's About page,
  after backup/license resources and before the creator credit. Do not add a
  separate public About page, provider disclosure, details link, status, or controls.
  Preserve previous refusals and withdrawal from older open releases without
  forcing a reload or worker activation. Retire only former GA cookies.
  The provider receives sanitized homepage/referrer addresses (no query strings,
  fragments, or URL credentials), device/browser and performance information, and
  connection information for country statistics. Never send financial records,
  app activity or user-authored event content. The homepage's tracking promise
  refers specifically to the app. Public search discovery files list the visitor
  homepage and exclude application/data paths.

- The public root `/` is a bilingual visitor homepage, with fewer than 150
  visible words per language, canonical brand artwork, a decorative financial
  illustration and direct `/app/` links. Omit the bank/sync/rate disclaimer from
  the homepage footer; keep only Install, creator credit, and the license link.
  Lead with spending insight, multiple currencies and wallets, and offline use.
  Keep backup instructions in Settings/About and explain optional Clarity reviews
  in About rather than making points a headline benefit. Claims must describe
  implemented capabilities; no perpetual pricing or unlimited-capacity promises.
  Keep it independent of `packages/core/src/lib/db.ts`: visiting it must not open or initialize
  a financial database. Its optional language preference is browser-local UI
  state only. An `/app/?lang=en|fa` hint preselects the new setup language only;
  saved setup drafts and initialized app preferences take precedence. `/app/`
  retains the same origin and database identity, existing
  setup/upgrade requirements, and all financial workflows. The everyday launcher
  and PWA start URL open `/app/` directly; About links back to `/`.
  Portable builds contain homepage and `/app/` HTML, plus a minimal `/about/`
  compatibility redirect to the homepage for old bookmarks. Precache all
  entry points and their exact generated JS/CSS assets; offline navigation
  under `/app/` must fall back to the app shell rather than the homepage.

- Keep ordinary use account-free. The bilingual About page explains privacy,
  offline use, user-controlled backups, and the aim to benefit anyone who needs
  the tool. Distinguish optional public-rate requests from financial-record
  uploads. The project software uses MIT, with canonical text in root `LICENSE`
  and public attribution to `THEJAZ and JIBJIP contributors`; do not insert
  private personal names or contact details.
  Keep About a bounded reading layout: a restrained introduction, one grouped
  principles panel, distinct backup/license resources, and a quiet creator footer.
  Use logical dividers and stack by available content width in narrow layouts.
  Resource cards share equal desktop columns, padding, stretch height, and bottom
  action alignment; let text determine height on phones and when details expand.
  About embeds that exact English legal text for offline reading beneath
  localized guidance. Portable builds include a byte-identical `LICENSE.txt`,
  verified in personal and public releases. About's bundled text works offline;
  the standalone file is included in the verified offline shell.
  Third-party components retain their own licenses. MIT does not authorize
  publishing private data, the personal changelog, Git history, or the website,
  and does not imply a permanent pricing commitment.

- Keep the architecture suitable for a later hosted web product and possible Android/iOS apps.

- Budgets, recurring transactions, financial goals, authentication, and synchronization are
  postponed unless the user explicitly requests them.

The tracked setup seed is V2 reference data, not a sample financial database.
It contains the 38 nonremovable built-in currencies and 37 visibly dated,
source-attributed offline rates, one for each non-EUR currency. EUR is the
implicit benchmark without a stored self-rate. Six approved rate values come from the
current personal full backup and the rest from the documented public providers;
do not reintroduce sample wallets, transactions, or Uncharted rows.

## Setup and localization

- English and Farsi are the bundled interface locales. Farsi uses a complete
  right-to-left catalog while English remains the fallback. The typed localization
  foundation lives under `packages/core/src/lib/i18n/`: add user-facing copy through stable
  message keys and `useI18n`, keep the English catalog complete, and add a
  locale to `SUPPORTED_LOCALES` only when its full catalog and RTL/LTR review
  are ready. Persisted unsupported locale values normalize to English. Interface
  language remains independent from reporting currency, IRR representation,
  and Gregorian/Jalali display. Never translate stored enums, user-authored
  wallet/category/note data, currency codes, or exact import/export contract
  tokens. Keep financial values and technical identifiers directionally
  isolated and use CSS logical properties for direction-sensitive layout.

- Numeric form fields accept mixed ASCII, Persian, and Arabic-Indic digits using
  `lib/numeric-input.ts`, displaying/storing canonical ASCII numbers. Recognize
  Arabic decimal/grouping separators and normalize complete three-digit grouping;
  reject malformed separators or embedded text instead of guessing. Keep exact
  Decimal arithmetic and IRR scaling. Apply this only to numeric fields, never
  names/notes or existing stored records; backup/CSV contracts remain unchanged.
  Transaction, exchange, split, and Uncharted amount fields use shared `AmountInput`:
  commas are display-only, and caret/selection, undo/redo, decimal drafts, IME, and pasted
  separator validation remain intact. A quiet English/Persian words preview uses
  the selected unit (HTM/MTM expand to tomans). It never rounds or validates the
  stored amount; omit previews beyond 21 integer/18 fractional digits rather than
  guessing. Rates and nonamount numeric fields retain their existing entry rules.

- English interface copy uses sentence case: capitalize the first word of a label
  or sentence, not every important word. Use “full backup” within copy and actions
  (“Export full backup,” “Restore full backup”); “Full backup” starts a standalone
  label or sentence. Preserve JIBJIP/THEJAZ, named pages/features, proper names,
  acronyms (CSV, JSON, EUR), exact external menu labels, and file-contract tokens.
  Keep file extensions literal (`.json.gz`, `.json`, `.csv`). Small-cap eyebrows/table headings
  are deliberate visual roles; never apply CSS title casing to ordinary copy.
  Stored user text and category names are data: their existing casing is unchanged.
  Persian has no letter case and retains its natural wording. The English catalog
  copy check in `tests/i18n.test.ts` guards this convention for future additions.

- Interface copy should be balanced, natural, and practical in both languages.
  Write Persian for Persian readers rather than mirroring English syntax. Use
  familiar task names and short labels; add explanations where they help a
  decision, without promotional headings or implementation jargon inside the
  app. Keep consequences, backup limits, and conversion uncertainty explicit.
  Keep terminology consistent across buttons, help, errors, and metadata. The
  homepage stays below 150 visible words per language. Copy changes must be
  checked in both directions at narrow and wide widths, including dialogs and
  large text; never translate stored names, enums, or file-contract tokens as
  part of an interface copy edit.

- New installations must use an explicit, resumable setup wizard instead of
  silently installing sample financial records. The ordered steps are
  language, main-wallet configuration, currency, and exchange-rate
  configuration, then reporting currency, Gregorian/Jalali display, and the
  IRR representation when relevant. The built-in currency catalog is
  available before the wallet step. Selecting Farsi creates the recognized
  default category names in Farsi; later interface-language changes never
  translate stored category names automatically. Existing incompatible
  databases use a shorter one-time upgrade wizard that preserves their data,
  proposes the active wallet with code `eur` as main when present, and lets the
  user choose another active wallet before confirming. Persist a normalized
  setup draft and current step so reloads resume safely. Complete either wizard
  atomically, keep native full-backup restore available from the wizard, and
  never expose the ordinary application shell before a valid main wallet has
  been confirmed.

- In upgrade-wizard summary cards, keep the heading and description grouped in
  one shrinkable copy column beside the fixed icon column. Do not place the
  description as a separate grid item: its intrinsic width can consume the
  first column and collapse the heading column to zero.

- Jalali date inputs must preserve the user's draft while focused and normalize only after a
  valid edit is finished. Backspace and segment replacement must remain natural; specifically,
  typing a two-digit month or day after a retained leading zero must replace that zero rather
  than produce a three-digit segment such as `026`.

- Gregorian dates are primary and Jalali dates are displayed as secondary dates.

- An uninitialized database opens setup or native full-backup restore rather
  than the ordinary empty application. After setup, Settings remains fully
  available even with no user transactions. Its display controls retain
  Interface language, Calendar representation, IRR representation, and Text
  size; Settings manages categories and transaction types, while the dedicated
  Currency page manages currencies and EUR rates, showing canonical and
  user-added counts for each. On wide layouts, its two cards share the same
  grid-row height; its currency catalog and
  rate list are separate, independently bounded scroll regions so long
  reference data does not create oversized cards or an unnecessarily tall
  page. Local data & portability
  keeps complete backup restore distinct from append-only CSV import. Erasing
  local data returns the installation to setup rather than reinstalling
  invisible sample records.

- Start page is a persisted two-position Overview/Transactions selector in Settings → Display.
  Interface language is always the first setting, ahead of Start page.
  Apply it once after the first database snapshot on launch, and after a confirmed full-backup
  restore; changing the preference or receiving live updates must not navigate an open session.
  Older databases/backups and new installations default to Overview. Full backups retain the
  choice; setup and upgrade requirements still take precedence.

## Interface and accessibility

- Use sans-serif typography for all interface text and headings. The Farsi interface uses the
  locally bundled Estedad variable WOFF2 face in `packages/core/assets/fonts/` (SIL OFL 1.1); keep it scoped
  through `html:lang(fa)` and do not add duplicate legacy WOFF files or unused weights. The
  shared value stack starts with the Persian-only `Estedad Persian` face so Persian letters
  inside mixed labels remain Estedad while digits, dates, currency codes, and other numeric or
  technical tokens continue through the ASCII monospace stack; preserve that split. Interface
  numbers use the Latin numbering system in every locale except the primary Gregorian and
  secondary Jalali dates in the Farsi top bar, whose digits use the Persian `arabext` numbering
  system. Keep financial values, technical dates, date inputs, counts, and identifiers in Latin
  digits. Use the shared monospace value stack with tabular numerals for money, rates, dates,
  counts, and other numeric values; do not reintroduce serif display fonts. The persisted
  `textSize` setting supports `small`, `medium`, and `large`. Route interface font sizes through
  `--font-scale`, preserve the 10 px minimum for visible text (including nested money
  fractions), and keep display text capped at restrained sizes.
  Reuse the body-scoped `--text-caption`, `--text-small`, `--text-body`, and
  `--text-reading` roles (12, 13, 14, and 15 px at Medium) for labels and copy rather than
  adding isolated 10/11 px UI text. Keep the 12 px caption floor at Small; the 10 px
  exception is for compact money fractions. Page headings cap at 34 px before the saved
  scale. English and Persian share the size hierarchy; Persian headings use at least
  1.5 line height with no letter spacing so joined letters and dots remain clear.
  Mobile form text, including sibling dialogs, stays at least 16 px at every setting.
  Resolve type roles alongside the saved body scale so live setting changes reach dialogs.
  Currency badges grow with their complete code and text scale instead of clipping text
  inside a fixed square; their surrounding grid columns must grow with them too.
  On narrow phones, stack competing wallet names and balances rather than shrinking their
  text; the smallest Overview metrics give the amount its own row.

- The interface uses a warm yellow theme: primary accent `#8a6500`, strong accent `#6f5000`,
  soft accent `#fff3c4`, paper `#fbfaf3`, surface `#fffdf8`, and dark navigation `#352d16`. Keep
  these central tokens contrast-safe; semantic income, expense, transfer, and exchange colors
  remain distinct.
  The homepage slogan's accent uses `--green`, matching the affirmative palette.
  Use these tokens for decorative washes and status surfaces; homepage chart artwork uses
  `DATA_COLORS` rather than a separate palette. The About introduction fades from yellow on
  the left to the light surface on the right in LTR, mirrored in RTL, with yellow
  on the reading-start side.

- Add and Save actions share `.button.affirmative`: mint `--create-surface`, dark
  `--green-strong` text, `--create-hover`, and a green focus ring. Use it for records,
  categories, currencies, rates, and setup completion; compact rows use `.small`.
  The homepage's primary Open JIBJIP link uses this same affirmative treatment;
  its decorative device label uses a stronger mint than the IRR chip, with dark green
  text and no button interaction. Primary navigation/progression uses light yellow
  with near-black text. Keep neutral secondary actions, gold preview actions, and red destructive
  confirmations distinct. Choosing an existing item is not a record-creation action.
  Reuse `.button` dimensions/type, `--control-height`, `--space-2/3/4/6` (8/12/16/24 px),
  and shared radius tokens. Touch buttons stay at least 44 px; preserve saved text scale.
  Notifications share a safe-area-aware top-centered, dismissible stack; field errors
  and contextual guidance stay beside the relevant control. Native dialogs retain
  priority over background notifications. Shared Lucide icons use `--icon-stroke` (1.8);
  custom artwork and chart SVGs keep their own stroke roles. Dividers use `--line`,
  chart guides use `--chart-grid`, ring backgrounds use `--chart-track`, and donut strokes
  use `--chart-ring-width`.
  Cash-flow guides cover only the plotted bars, with five lines and a baseline above
  the date labels. Reuse semantic green/red surfaces for status and feedback colors.
  Prefer a control's text as its accessible name. Keep that text available to
  assistive tools when an icon-only mobile variant hides it visually; extra
  accessible context must retain the visible wording. Give labeled graphics
  and control groups appropriate roles instead of labeling generic containers.

- Financial values must never render outside their card or panel. Keep value containers
  shrinkable with `minmax(0, …)`/`min-width: 0`, use container-responsive display sizes, and
  preserve the shared money-value wrapping fallback for unusually long numbers or currency
  labels. Do not restore globally unbreakable money strings.

- The body's minimum width must also fit the available document width. At a
  320 px viewport, a visible vertical scrollbar can leave less than 320 px for
  content; do not force horizontal scrolling with a fixed minimum body width.

- Horizontal table scroll regions must establish a positioned containing block so absolutely
  positioned accessibility labels stay clipped inside them instead of widening the mobile page.
  Transaction lists use their own available width to switch from table rows to cards,
  including narrow Overview panels on desktop. Keep transaction-type and status badges
  and primary transaction dates on one line; arbitrary wrapping is reserved for user
  content and long values. On the smallest cards, give row actions their own row so
  they cannot squeeze dates.

- In rendered money values, keep the whole-number amount and currency at full contrast. Render
  the decimal separator and fractional digits through the shared `money-decimals` treatment at
  reduced opacity, with the fractional digits slightly smaller where the 10 px readability floor
  permits; retain the complete formatted amount as visually hidden readable text
  beside the decorative spans. Generic spans cannot use `aria-label` as a substitute
  for text. Anchor clipped text inside its amount container. The shared decimal
  opacity must preserve at least 4.5:1 contrast, including small values on tinted
  semantic surfaces; `tests/colors.test.ts` checks those combinations.

- Transaction-table amount values use a significantly larger, bold value treatment while
  remaining container-responsive and preserving the shared wrapping fallback for unusually long
  values; do not let the emphasis expand the table or affect unrelated graphics.

- Exchange activity uses the shared golden-yellow `--exchange` and `--exchange-soft` palette.
  Keep it visually distinct from red expenses and gray transfers.

- Wallet/category chart series and currency accents share the ordered 24-color `DATA_COLORS`
  palette in `packages/core/src/lib/colors.ts`. Interleave hue families for adjacent series; default chart accents
  meet 3:1 contrast against paper. Derive extra currency tones from this palette. Keep the
  separate semantic colors for income, expenses, transfers, and exchanges.
- New category templates reference `DATA_COLORS` directly; palette updates never overwrite
  persisted category colors. Wallet and category rings share `DonutChart` and the linear-time
  decimal-safe geometry in `packages/core/src/lib/chart-visuals.ts`. Thin gaps must not inflate tiny shares or
  leave a seam in a single-series ring. Use restrained color-to-darker gradients, full value
  labels, readable legend amounts, and proportional category share bars. Cash-flow marks use
  the dedicated contrast-checked teal/rose chart tokens, with matching keys in every chart;
  semantic text colors remain unchanged. Zero values must not draw positive-looking bars.
  Keep five quiet guides, saved motion/reduced-motion safeguards, and offline SVG/CSS rendering.
- Currency badges always use black (`#000000`) codes on opaque light tones, never alternating
  black/white text. Ordinary category badges and icon previews use the same `tonalBadgeStyle`
  treatment: preserve the accent hue, mix 64% white into the badge surface, and retain at least
  7:1 label/glyph contrast. Use full accents for chart marks and dots. Keep complete currency
  codes rather than flags or currency-specific icon substitutes; Currencies uses the neutral
  Coins navigation icon. Never rewrite stored category metadata merely to change badge contrast.

- Category visuals are a shared UI language, not Settings-only metadata. Wherever an ordinary
  income/expense category is displayed or chosen—including chart legends, transaction tables,
  add/edit transaction dialogs, transaction filters, and future category surfaces—show its
  persisted Lucide icon with a tonal badge derived from its persisted accent color. Use
  the shared category visual/picker treatment rather than plain category text or native controls
  that cannot render the icon and color. Unresolved historical labels may use the fallback tag
  icon and deterministic palette color; fixed transaction types remain type-labeled and use
  their separate semantic treatment.

- Keep dialog form fields top-aligned and visually consistent: single-line inputs and selects
  use the shared 42 px control height, while only multiline textareas and composite fields grow
  vertically. Do not let a control stretch to match a taller field in the same grid row.

- Review-dialog prose and lists belong in a padded body aligned with the header and
  footer (side insets: 24 px desktop, 16 px phone); the shared content fieldset has no padding.
  Show fetch timestamps as localized Gregorian dates/times with Latin digits and a
  time zone, retaining the original ISO value in the time element's metadata.

- Shared dialogs use native modal dialogs for keyboard focus containment, Escape dismissal, and
  focus restoration; lock background scrolling while they are open.
  Scroll locking follows native open state in the shared modal stylesheet, including nested
  dialogs and resize-driven unmounts. Only the innermost dialog handles its Escape/Tab events.
  Keep scrolling inside a rounded, overflow-clipped shell so native scrollbars cannot square
  its corners. Header and body share aligned insets, with a visible sticky close action and
  safe-area spacing on phones. Full-width phone sheets meet the bottom edge with square lower
  corners deliberately; floating dialogs retain all four rounded corners. Homepage styles
  must not override the shared installation dialog's typography or content layout.
  Apply the saved text scale to sibling confirmations as well as the app/setup shell.

- Keyboard access uses Ctrl/Cmd+K for searchable quick actions, Ctrl/Cmd+/ for the shortcuts
  guide, and Ctrl/Cmd+Enter only for opted-in save forms. Preserve native text editing, IME
  composition, browser commands, and ordinary Tab order; do not add global single-character
  shortcuts. Suspend page shortcuts behind other modals, never use a save shortcut to confirm
  deletion, and retain form validation and busy guards. Keep the same features available through
  visible touch controls. The app has a skip link and moves focus to page content after navigation.
- Shared choice pickers follow the [WAI combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/):
  arrow navigation, explicit Enter selection, valid active-option announcements, and focus return.
  Select-only period menus also support Home/End; editable search retains native caret keys.
  Escape first clears a nonempty search, then closes its picker, then its containing dialog.
  Search clear buttons appear only with text, have localized accessible names, and retain input
  focus. Reuse these controls instead of adding separate search or keyboard implementations.
  Selecting an option closes the menu and returns focus once, including touch inside a form
  label; suppress label default activation so it cannot reopen the trigger. Outside pointer
  input dismisses the menu without changing its saved selection.

- Application confirmations use the shared internal confirmation provider, never browser
  `alert`, `confirm`, or `prompt`. Capture requested activity records when opening, recheck them
  atomically before deletion, prevent repeat submissions and dismissal during writes, and keep
  failures visible inside the dialog. Validate full backup files before asking to replace data.
  Platform file pickers, installation, and permission prompts remain browser-managed.
  Erasing local data atomically restores only the reference catalogs and initial settings so
  first-time setup works immediately; it must not recreate financial records.

- Settings → Display offers a persisted `motion` preference: `off`, `subtle` (default),
  or `enhanced`. Full backups retain it; missing/invalid values normalize to `subtle`.
  Apply it at document scope so setup, sibling dialogs, and mobile navigation agree.
  Off disables all animation/transitions; Enhanced adds short page/dialog and control effects.
  Device reduced-motion always takes priority, including when changed during a session.
  Keep effects finite and CSS-only, without libraries, financial-value countups, layout shifts,
  or delays to input, saving, focus, and dismissal. Never change financial data for this preference.

- Mobile navigation shares the native modal lifecycle through `useModalDialog` and closes when
  resized to desktop. Keep the drawer keyboard-contained and restore focus/scrolling on
  dismissal. Entrance motion is short and CSS-only, enabled only when `prefers-reduced-motion:
  no-preference` and the app's animation preference; do not introduce an animation library.

- On phones, the transaction table becomes cards using the same rows and controls: retain dates,
  wallet, category/split detail, type, amount, selection, and actions. Keep amount signs
  directionally isolated in RTL. Secondary transaction filters collapse behind a labeled toggle
  with an active-filter count and reset action; search stays visible, and collapsing never
  clears active filters. Keep touch controls at least 44 px and phone input text at least 16 px.

- Category and currency badges share `packages/core/src/lib/colors.ts` tonal surfaces and black foregrounds.
  Preserve the warm theme and semantic colors, with at least 4.5:1 for normal
  semantic text and badge labels. English uses the native system sans-serif stack; Farsi retains
  the bundled Estedad and financial values retain the shared monospace stack.

- All single-select dropdowns use the shared inset chevron from the global select treatment.
  Keep the chevron consistently spaced from the inline end, mirror it for RTL, reserve enough
  text padding to prevent collisions, and retain the native arrow in forced-colors mode.

## Overview and charts

- Clarity points are optional and enabled by default for new or missing preferences;
  preserve existing explicit on/off choices. Keep the compact Overview review strip's
  switch inside Settings → Display as a standard separated setting
  group. Disabling hides it without deleting progress. Three explicit weekly reviews
  (transactions, categories, one active wallet balance) earn 10 points each, once per task
  and local Monday-based week. Quiet weeks and appropriate Other categories are valid.
  Points recognize self-reported review effort, never financial health or verified accuracy.
  No streaks, penalties, rankings, automatic awards, remote checks, or financial-data uploads.
- Reviews stay open after each award and offer an explicit next task. Add/edit transaction
  forms open above the review; cancel returns to it, while saved changes require refreshing
  and reconfirming the affected review. Category reviews include ordinary income/expense only.
  Use short, CSS-only progress/completion motion under `prefers-reduced-motion: no-preference`
  and the shared animation preference.
  Keep the compact Overview review strip after Currency balances and before the historical
  cash-flow/accounts panels, and allow inspection
  and correction of completed reviews without issuing additional points.
- `settings.clarity` stores only the enabled preference and task/week/UTC completion ledger.
  Derive totals from unique ledger entries. Recheck the latest ledger and opening review
  context in one write transaction; date/record changes invalidate pending reviews.
  Edits, duplicates, split lines, CSV imports, reloads, and repeated reviews never generate
  additional points. Full backup V2 replaces and retains this state without adding totals;
  backups missing Clarity start enabled with no awards; explicit opt-outs and existing ledgers
  survive unchanged. About briefly explains the reviews and Settings opt-out;
  the homepage focuses on core financial benefits. Never alter financial stores to award points.
  Local clock/database manipulation remains possible; this is a private habit aid.

- Reporting currency is selectable; EUR is the current default and reference currency.

- Overview summary metrics use a rolling 30-day window ending today (29 days before today
  through today, inclusive), not the calendar month. Show separate Income, Spent, and Net
  balance cards; Income uses a light-green surface and a southeast-pointing arrow, Spent uses
  light red and a northeast-pointing arrow, and Net balance follows the color and arrow
  direction of its positive/negative/neutral result. Net balance is reportable income minus
  reportable expense, with transfers and exchange principal excluded through normal reporting
  rules.

- The Overview cash-flow chart supports 6-month, 1-year, and 3-year ranges. All ranges show the
  same five horizontal gray reference lines through the dedicated `cashflow-gridlines` layer.
  Longer ranges remain monthly and use horizontal scrolling plus reduced date-label frequency
  rather than shrinking the chart into unreadability.

- On wide Overview layouts, Recent transactions sits directly beneath Cash flow while Wallet
  balances spans beside both panels; preserve this staggered grid so the taller wallet panel
  does not leave a large empty gap. At narrower widths, keep the stacked order Cash flow, Wallet
  balances, then Recent transactions.

- Charts shares one period, wallet selection, and category filter across income/spending
  category shares, total cash flow, and wallet cash flow. `packages/core/src/lib/charts.ts` performs one
  decimal-safe dated conversion per eligible posting; totals, trends, and wallet summaries must
  reconcile. Net flow is reportable income minus spending, not wallet balance change.
  Its summary card uses soft green for a positive exact decimal value, soft red for
  negative, and light neutral gray for zero; share the income/expense surface tokens.
  Include
  archived wallets with history in the Charts wallet chooser so all-time analysis remains
  complete. Empty months remain visible; periods beyond ten years use yearly buckets to bound
  rendering. Show missing-rate and monthly/estimated-rate disclosures for all views.

- `settings.chartExcludedCategoryIds` is a persisted, full-backup-compatible list of stable
  category IDs, initially empty. It affects Charts only and never changes transactions, report
  settings, or balances. Both `transaction.reportable` and the category's `defaultReportable`
  must permit inclusion; fixed types additionally follow `typeReportability`. A category
  excluded from reports cannot be re-enabled in Charts. Preserve exclusions across category
  renames and backup restore; older V2 backups default to an empty list.

- Use the shared `packages/core/src/lib/dates.ts` period helper for Charts and Transactions; month/year
  subtraction clamps to the last valid day, including leap years. The shared Charts period
  selector supports rolling 30-day, 3-month, 6-month, 1-year, and 3-year ranges, plus all-time
  and custom dates. Use the styled accessible period menu rather than a native select so the
  option list remains consistent across browsers and screen sizes. Charts panels share
  one contained desktop column (main-content maximum 1280 px),
  with the category ring close to its legend and wallet-flow values aligned beside names.
  Preserve the existing stacked phone layout and usable chart scrolling.

- Overview Recent transactions shows the newest 20 displayed activities across all wallets,
  ordered by date and then update time descending; a complete linked exchange counts as one
  activity, while unlinked historical movements remain independent. It is independent of the
  Overview wallet-balance selection.

- Global top-bar actions are page-specific: Overview and Transactions show Reporting currency
  (`View in`) and Add transaction; Wallets shows Reporting currency and Add wallet; Charts shows
  Reporting currency only; Currency, Uncharted, Settings, and About show neither and rely on
  their existing page-specific actions.

- The primary navigation order is Overview, Charts, Transactions, Uncharted, Wallets,
  Currencies, Settings, then About. About remains available after setup even without financial
  records; its backup guidance links to Settings without triggering a download.

- Keep the sidebar vertically scrollable so all navigation destinations remain reachable on
  short and landscape screens.
  Its footer uses a quiet, unboxed local-record row and aligned installation and keyboard-help
  actions with at least 44 px targets. The current app version has its own plain-text line at
  the very bottom, outside the record row and controls; do not put it in a box or badge.
  A status indicator must reflect real state; a decorative dot must not imply
  verified offline readiness or a downloaded update.
  Install uses a green check only for an activated offline release, independently
  of OS installation; install prompts and update feedback follow [OFFLINE.md](OFFLINE.md).

- Keep the Overview Wallet balances card compact: its grouped wallet list is a
  keyboard-focusable, bounded vertical scroll region with sticky currency headings and a subtle
  custom scrollbar, while the selected total stays outside and visible.

- Overview includes three locally persisted Quick wallet slots. Keep the section heading,
  description, and all three slots inside one shared panel so it remains consistent with the
  other Overview content. Empty slots show a plus action; each filled slot shows one distinct
  active wallet and its native balance, and can be changed or cleared. Quick wallets and
  currency-balance cards also show a smaller equivalent in the selected `View in` currency
  when it differs from the native currency. Use today's saved reference rates through the
  shared conversion resolver; disclose previous-day, monthly, estimated, or unavailable rates.
  Keep native balances dominant and preserve signed values, zero balances, and IRR display units.

- Overview includes a currency-balances panel that groups active wallets by native currency and
  shows each currency's wallet count and decimal-safe total native balance. Users can
  persistently hide individual currencies; while any are hidden, keep a dashed plus card
  available to add them back from a chooser. Newly encountered currencies remain visible by
  default.
  Quick-wallet and Show currency tile buttons fill their cards even when neighboring
  balances wrap onto extra lines. Center empty-tile actions in the full available height;
  keep hover fills inside the rounded border and keyboard focus rings visible inside it.

- The Overview wallet donut follows `View in` for its total, segments, and accessible summary,
  using today's dated conversions and the selected IRR display unit. The center shows one
  unbroken amount labeled `Total shown` and the selected-currency equivalent; it sums positive
  selected balances only. Disclose missing rates and nonpositive exclusions without hiding
  native balances. Keep center-label CSS scoped to direct children so `MoneyAmount` decimal
  spans remain inline, and retain the complete total in the chart's accessible label.

## Transactions and atomic edits

- Transactions can be filtered by an exact stable category using the filter bar. Build the
  choices from used income/expense categories and labels so archived and unresolved historical
  categories remain selectable. Transfer, exchange, and adjustment are available only through
  the Type filter and must never appear in the Category filter.

- Transaction filters use a labeled two-tier responsive grid: search/type/wallet in the primary
  row and period/category/sort in the secondary row. Custom date fields stay inside the period
  group, the localized result summary lives in a dedicated footer, and the layout responds to
  the data panel's container width rather than relying only on viewport breakpoints.

- Transactions can be sorted newest first, oldest first, or by ascending/descending absolute
  value in the selected reporting currency using each transaction's date and the shared
  historical-rate resolver. Value complete splits by their full payment total and paired
  exchanges by the sent leg once. Convert once per activity, outside the comparator; re-sort
  when reporting currency or saved rates change. Missing conversions stay last in both
  directions, never treated as zero or compared as raw native amounts. Disclose the valuation
  currency and monthly/estimated/missing coverage for filtered activities. Sorting never edits
  records; changing the sort resets pagination without changing selection state.

- Transactions show 50 rows per page by default and offer locally persisted 100, 200, and 500
  row sizes; changing page size resets to page 1 without clearing selection.

- Clamp the current transaction page when edits or deletions reduce the result count, so the
  table never remains on a nonexistent page.

- Transactions support an all-time default period plus rolling 30-day, 3-month, 6-month, 1-year,
  and 3-year periods and custom Gregorian date ranges; invalid custom ranges show no results and
  an inline validation message.

- The Transactions page supports selecting displayed activities and shows their signed
  native-currency totals grouped by currency. A complete linked exchange remains one selectable
  activity, with both native legs included in the grouped total; selection is presentation-only
  and never changes stored data.

- When displayed activity grouping reduces the Transactions result count, show a subtle
  localized note in the result-count chip that paired records count as one activity; derive its
  visibility from the grouped activities rather than hardcoded record counts.

- Selected transaction activities support atomic batch deletion and batch editing of shared
  date, note, safe ordinary-transaction category, and unlinked-wallet fields; transaction
  currency follows the selected wallet and is never an independent batch field. Amounts, balance
  deltas, and fixed transaction types remain unchanged. Linked transfer and exchange selections
  expand to both principal legs but cannot change wallets.

- Ordinary income and expense payments support optional splits: one shared date,
  wallet, currency, direction, and total with two or more category postings.
  `Transaction.split` stores the group ID, one-based line index, expected line
  count, total, and common note. Each posting retains its own ID, note, category,
  reporting flag, and signed balance delta. There is no additional monetary
  parent row. Validate complete groups and exact decimal sums through
  `packages/core/src/lib/splits.ts`; never reuse transfer/exchange `linkId` for splits. Group only
  complete valid splits in lists; reports and balances continue using postings.
  Edit, duplicate, and delete whole splits atomically. Batch category changes
  are unavailable for selections containing splits; batch notes change the
  common payment note while preserving line notes. Category filters retain
  the whole payment and disclose the matching category subtotal.
  Native V2 full backups retain split metadata and reject incomplete groups.
  CSV adds optional `Reportable`, `Affects Balance`, `Balance Amount`, `Split ID`,
  `Split Part`, `Split Count`, `Split Total`, `Split Note`, `Wallet Code`, and
  `Link ID` columns. Exports include them; imports accept legacy eight-column
  files, validate complete groups before writing, and remap group IDs per import.
  `Wallet Code` takes precedence over a duplicate or renamed wallet name; archived
  wallets are rejected until restored. A `Link ID` pair must be one out and one in
  leg of the same transfer/exchange on one date across two wallets; a lone leg from
  a wallet-filtered export imports unlinked. CSV remains append-only:
  repeated imports intentionally add new records. Never infer or convert
  historical split candidates without maintainer approval and a verified backup.

- Transaction creation, editing, and duplication use explicit Save and Discard actions. A
  duplicate opens a new prefilled draft; the original is not changed until the draft is saved.
  Linked transfers and exchanges duplicate both principal legs atomically, while retired fee
  rows are not duplicated.

- Read complete app/backup snapshots in one readonly database transaction. Promote an Uncharted
  entry and remove its draft in one write transaction, including split promotions. Ordinary
  edits and duplicates preserve per-transaction reportability when the category identity is
  unchanged. Ordinary, linked, split, and Uncharted edits reject stale records instead of
  overwriting another window's changes. Busy save dialogs disable editing and dismissal;
  failures retain the draft and show an error.

- Transfer, exchange, and adjustment remain fixed transaction types alongside income and
  expense. Categories classify only ordinary income and expense transactions. The fixed types
  have dedicated persisted type-reportability settings, `categoryId` always remains null, and
  their denormalized CSV compatibility label is the canonical type name without an `IN`/`OUT`
  suffix. Show them only in type controls and in a separate Transaction types Settings panel;
  never offer or present them as categories. Types are excluded from reports by default, but
  users may opt them into reporting; out legs then count as expenses and in legs as income.
  Charts that include opted-in types must label their series explicitly as types rather than
  categories.

- An exchange records only the exact amount removed from its source wallet and the exact amount
  added to its destination wallet. It has no fee field, generated fee, gain/loss, or
  valuation-adjustment row. Its effective rate is derived for display only; reference rates do
  not participate in exchange persistence. Exchange principal affects wallet balances and is
  excluded from income, expense, and Net balance reporting by default through its type setting.
  A separately debited fee may be entered independently as an ordinary expense.

- Workbook-era transfer and exchange rows may remain deliberately unlinked and use their signed
  `balanceAmount`. Migrate missing imported deltas in place; never replace a live database to
  reconstruct them. When an imported row's amount or direction is edited, keep its signed
  balance delta synchronized.

- App-created balance-affecting transactions persist an explicit signed
  `balanceAmount` at the same atomic boundary as their positive `amount`;
  expenses and outgoing movements are negative, while income and incoming
  movements are positive. Keep edits synchronized and never rely on a
  display-time sign inference for newly written records.

- App-created transfers and exchanges are linked activities with exactly one out leg and one in
  leg. Create, edit, and delete both principal legs atomically. Transfers require matching
  wallet currencies; exchanges require different currencies. Present a complete linked exchange
  as one activity while keeping its two wallet postings internal. Adjustments are unpaired,
  single-wallet balance corrections using `in`/`out`. Do not create, import, or specially
  process retired fee, exchange gain/loss, or report-only adjustment behavior. Initialization,
  CSV import, and native-backup restore normalize retired movement labels such as `Transfer
  (OUT)` to the canonical fixed type name and clear their category identity while preserving
  amounts, `balanceAmount`, currencies, notes, dates, links, source metadata, and timestamps.

## Wallets and currencies

- Currency-group headers pair the currency badge and wallet count in a semantic
  heading, followed by the native total in a compact wrapping row. Use a quiet
  bottom divider without a filled header band; reserve the currency tint for cards. Keep labels
  and numeric values together rather than distributing them across the full width.
  Wallet cards use a compact header with a readable wallet name and
  edit/archive controls. The native balance is the largest element; reporting-currency
  equivalents remain readable beneath it and are omitted when both currencies match.
  Keep counts and main/default badges secondary, with transaction/default actions below.
  Scope label styles to direct label children so nested `MoneyAmount` spans inherit their
  intended size and full contrast. Archived wallets keep readable amounts and use a dashed
  border and explicit status. Show the currency badge once in the group heading,
  without repeating it inside individual wallet cards. Give those cards a subtle
  94%-white tint of their group's currency accent, including archived cards;
  preserve main/default markers and readable native/converted balances. Each
  currency-group heading shows the decimal-safe sum of its wallets in their shared native
  currency. Wallet selection controls on Overview, Charts, Transactions, activity dialogs, and
  export show current native-currency balances only. Wherever wallets are listed or selected,
  group currencies alphabetically and sort wallet names alphabetically within each currency
  group; use the shared grouping helper rather than relying on database order.

- Movement destination choices exclude the source and require matching currencies for transfers
  or different currencies for exchanges. Explain when another wallet is needed and prevent
  saving without an eligible destination. Editing existing history may retain its original
  archived wallets; new activities and duplicates use active wallets only.

- Archiving or deleting a wallet clears its default selection and Overview shortcuts atomically;
  selecting a default rechecks that the wallet is still active. Uncharted deletion rejects
  changed or already promoted entries, preserving concurrent work.

- One active wallet can be persisted as the default for ordinary new transactions. Wallet cards
  expose both “Set as default” and wallet-specific “Add transaction” actions; the
  wallet-specific action overrides the saved default for that dialog only. Archived, deleted, or
  missing wallets must never remain selected as the default.

- Every initialized database has one active main wallet, distinct from the
  optional default wallet. The main wallet is required infrastructure and
  cannot be archived or deleted, but users may rename it and edit its other
  properties. On first setup it also becomes the initial default wallet. A
  currency change on a wallet with records deliberately changes only the
  wallet and associated transaction currency labels; it does not convert the
  stored numerical amounts or alter balance deltas, notes, dates, or timestamps.
  Perform the wallet and transaction-label updates atomically. Permit this only
  after a strong consequence warning and explicit confirmation that historical
  balances, reports, conversions, totals, and comparisons may become inaccurate
  or misleading.

- Currency is catalog data rather than a free-form per-wallet or
  per-transaction value. The nonremovable built-in catalog is defined in `packages/core/src/lib/catalogs.ts` and mirrored by the reference-only starter. It currently contains 38 codes, including `BRL`, `EGP`, `ETB`, `IDR`, `ZAR`, and four-character `USDT`. Users may define additional currencies. Currency badges, selectors, validation, and
  backups must preserve the complete uppercase code and must not assume a
  three-character length; `USDT` is a required four-character code. Assign a
  deterministic, readable, unique palette-derived color to every known
  currency badge, including user-added currencies. Ordinary accounted
  transactions continue to inherit currency from their wallet.

## Rate history and conversions

- Exchange rates remain EUR-based and decimal-safe; EUR is an implicit 1:1 benchmark without a
  stored self-rate. The `rates` store retains one observation per currency, Gregorian date, and
  granularity (`daily` or `monthly`; absent means daily for older V2 backups). Never collapse
  history to one currency row during initialization, restore, or refresh. Rate dates/periods are
  immutable; add a new observation to change them. The starter still contains only one offline
  baseline per non-EUR currency.

- All dated conversions share `packages/core/src/lib/rate-history.ts`: exact daily close, preceding observation
  within 7 days, same-month average, then a visibly labeled older/future estimate. Present-day
  wallet equivalents use today's rates; native balances and actual exchange postings never
  depend on reference conversion. Financial charts disclose monthly/estimated/missing
  conversions, and transaction equivalents show their quality. Index rate histories per
  immutable snapshot instead of sorting thousands of rows for every transaction.

- Calendar dates use the device's local day through `packages/core/src/lib/dates.ts`; UTC remains the timestamp
  format for audit metadata and provider timestamps. Share `lib/local-day.ts` for
  midnight/foreground refreshes, include the day in current-rate and rolling-report
  memo dependencies, and preserve open draft dates and inputs during refresh.
  The reporting-currency selector includes
  the active currency catalog independently of wallet ownership. Monthly-only history remains
  eligible for a disclosed estimate after its covered month, even if an older daily quote
  exists.

- Historical fetching is user initiated, previews before saving, and remains entirely
  browser-side. Use TGJU EUR/IRR free-market Gregorian-date closing prices in rials (column 3,
  never opening price). IRR fallbacks try the daily-updated Euro-Rial-Toman CSV archive on
  raw GitHub, then its jsDelivr delivery. Both are labeled TGJU replicas, not independent
  price sources. Preserve the CSV's exact rial closes and recorded Gregorian dates; do not
  substitute reconstructed or converted candles from another archive. Validate headers,
  decimal values, dates, duplicate conflicts, and OHLC bounds. Latest-rate refresh rejects
  observations older than 7 days or in the future; historical fetching may use older observations
  for their actual dates. Attempt backups only after failure or unusable coverage, and retain
  the actual delivery URL. Use AbortController-based deadlines and cancellation without
  requiring newer AbortSignal static helpers. Use
  ECB through Frankfurter for supported fiat currencies, then Frankfurter reference data where
  ECB is unavailable. Validate each latest fiat observation before choosing a provider;
  invalid or stale primary rows must not block valid fallback rows. Stop fetching once all
  requested fiat quotes are covered. Latest crypto quotes require a valid provider timestamp;
  one malformed quote must not discard others. Latest-rate previews accept dates within the
  preceding seven days, never future dates. Any labeled USDT/USD parity fallback must use a
  recent daily USD observation and retain its date and provenance, never relabel an old or
  monthly rate as today's quote. Cryptocurrency history is currently unavailable, never fabricate past USD
  parity. Monthly fallbacks are means of at least 10 daily observations spanning a completed
  month; retain sample count and provenance. Never treat a monthly value as a daily close.

- Fetches send only public currency codes and whole calendar years, without credentials,
  referrers, or personal records. Reject invalid/conflicting observations and disclose source
  failures/partial coverage. Automatic saves recheck locks inside an atomic database
  transaction, preserve manual and locked observations, and leave all other dates/stores
  untouched. Manual values, locks, source URLs, retrieval timestamps, and history are retained
  by V2 full backups. Transaction CSV does not contain rate history. Saved rates work offline;
  new fetching requires connectivity and provider CORS support. The static hosting CSP allows
  only the reviewed rate hosts in addition to self; no backend, secret key, automatic background
  fetch, or remote database is introduced.

- IRR representation (`IRR`, `TMN`, `HTM`, or `MTM`) applies to transaction amount inputs as
  well as rendered values. Keep the typed and edited value in the selected display unit, show
  the exact canonical IRR storage value beneath each IRR amount field, and convert through
  decimal-safe scaling only at the persistence boundary; stored transaction amounts and
  currencies remain IRR.

## Categories and Uncharted

- Categories carry optional persisted `group` metadata. Missing values on recognized built-ins
  receive the bilingual defaults from `packages/core/src/lib/category-groups.ts` once; null means deliberately
  Ungrouped and must not be reassigned. Group names are stored user data, independent of
  interface locale. Settings and category pickers show group headings; category editing can
  create or change groups, and group rename atomically updates all members including archived
  categories. Defaults group by everyday purpose: Income is separate from
  Work & Learning (Business, Tools & Equipment, Education). Only Other has a
  single default category; user-authored groups may have any size. Existing authored groups
  remain saved choices; changing defaults does not silently migrate them.
  Groups are organizational only: never change category IDs, transaction records,
  reportability, or fixed transaction types. V2 full backups retain groups; the transaction CSV
  contract remains unchanged.

- Categories use stable identities so renaming, translation, colors, symbols,
  report defaults, and historical references can be updated atomically. Most
  categories are editable and archivable. Only unused custom, nonsystem
  categories may be permanently deleted; identify and lock only categories
  that are truly required by application behavior. Each category has a
  validated Lucide symbol and a default color derived from the approved chart
  palette. English category names use title case, including canonical `Other
  Income`; Farsi names remain unchanged by English casing rules. `Other Income`
  and `Other Expenses` are built-in system categories: they remain available as
  the canonical generic income/expense fallbacks and cannot be renamed,
  repurposed, archived, or deleted. `Other Income` is the canonical merged
  destination for legacy `Extra Income`. Recognized English legacy system fallback aliases
  receive their canonical names without changing IDs or authored groups. CSV category lookup,
  naming and reference assignment normalize whitespace consistently; never fabricate `Other`
  after a lookup miss. An explicitly supplied or authored custom `Other` remains valid and
  separate. Wallet creation does not create or reseed categories. Category deletion uses the
  shared in-app confirmation dialog, rechecks unused/custom status atomically, and leaves
  failures visible without dismissing the dialog. The four English temporary categories
  use ASCII names: `Temporary - Paid for Others` (own money advanced, expecting
  repayment), `Temporary - Funds Received` (others' money entrusted for spending),
  `Temporary - Funds Spent` (spending those entrusted funds), and
  `Temporary - Repayment Received` (recovery of one's own advance). Preserve
  their existing template keys, category IDs, and user-selected metadata;
  recognize prior built-in names during initialization without overwriting
  custom names. Their default visuals are yellow `hand-coins` for Paid for
  Others, blue `banknote-arrow-up` for Funds Spent, green `wallet-cards` for
  Funds Received, and darker green `handshake` for Repayment Received. Visual
  changes preserve all transaction fields and existing user customization;
  changing templates alone does not overwrite persisted category visuals.
  All four expose a user-configurable default-reportable setting
  whose initial value is false because
  temporary/pass-through movements should not inflate Income or Spent unless
  the user explicitly opts them in. A deliberate English/Farsi category
  translation tool changes only recognized built-in names, previews and warns
  before an atomic update, and leaves custom or unrecognized names unchanged.

- Uncharted entries are flexible records kept separate from balances and reports.
  Its introduction uses the ordinary surface and a quiet paper-tinted icon;
  avoid a yellow emphasis panel for routine guidance.
  The secondary “Convert to transaction” action opens a draft; explain that saving
  replaces the Uncharted entry and affects wallet balances. Cancel preserves it.
  Keep this distinct from Add entry and avoid the ambiguous “Record transaction” label.
  Uncharted amounts are always stored as
  positive absolute decimal values; sanitize existing records, historical workbook-derived data,
  and native-backup restores accordingly, without changing accounted transaction signs. The
  Uncharted model intentionally contains no wallet/source, free-form type, or category fields;
  do not reintroduce them. Existing local records and imported backups are sanitized to remove
  those legacy properties. The only statuses are `open` and `retrieved`; Open is green,
  Retrieved rows are visually muted, and missing or legacy status values normalize to `open`.

## Backup and CSV contracts

- Backup, export, and import actions are available only under Settings. Native full backups
  are the only complete restore format; transaction CSV import remains append-only and is never a
  replacement workflow. Excel workbook replacement is no longer supported.

Keep the Settings data-portability actions and their semantics clearly separated:

- **Full backup (`.json.gz`, or `.json` on browsers without compression streams)** is a complete restorable JIBJIP database containing currencies,
  wallets, transactions, Uncharted entries, categories, rates, and settings. Current backups use
  the V2 contract and `source.kind === "jibjip-backup"`; older versions and markers are not
  restore inputs. Public seed files, workbook-derived JSON, arbitrary JSON, and other
  applications' exports are not restore inputs.
- **Transaction export (`.csv`)** is not a backup. Users can export one, several, or all
  wallets. The wallet selector shows each wallet's current balance in its native currency. The
  eight required base columns are `Date`, `Wallet`, `Operation`, `Direction`, `Category`,
  `Amount`, `Currency`, and `Note`; exports also include the optional split and
  financial-preservation columns documented above.
- **Transaction import (`.csv`)** is append-only. It must never clear, replace, or delete
  existing wallets, transactions, rates, settings, or Uncharted entries. Parse and validate the
  entire file before opening the write transaction, then add all transactions and any required
  category updates in one Dexie transaction. If any row fails, write nothing.
- **Native backup restore (`.json.gz` or `.json`)** is the only complete replacement workflow and replaces the
  local database only after confirmation. Excel workbooks are not accepted. Do not route CSV
  through the replacement workflow.
- Gzip is a standard, lossless file wrapper around unchanged V2 UTF-8 JSON; it
  does not migrate, encrypt, or rewrite records. Detect gzip by its magic bytes,
  independently of filename/MIME. Bound file and expanded sizes to 100 MiB,
  reject damaged streams, then run the same V2 validation before confirmation.
  Unsupported browsers retain JSON export/restore and explain how to extract
  gzip externally. Export reads one atomic snapshot, prevents duplicate clicks
  while preparing, and never writes the database. Both formats work offline.
- **Erase local data** is a confirmed destructive Settings action that clears all
  user records and resets settings. In the same transaction, restore initial settings
  and reference catalogs so setup works immediately. Retain the internal
  `starterSeedVersion` marker; never recreate financial records.

CSV transaction import requires all eight base columns; the additional split and
financial-preservation columns are optional for legacy files. Dates are Gregorian `YYYY-MM-DD`;
Wallet matches an existing wallet name or code; Amount is a positive decimal without formatting
symbols; Category is required; and Currency equals the matched wallet's native currency. Valid
accounting pairs are `transaction` with `income`/`expense` and `transfer`, `exchange`, or
`adjustment` with `in`/`out`. For transfer/exchange/adjustment rows, Category is a required
compatibility token on input but is canonicalized to the fixed type name, never creates or
resolves a category identity, and reportability follows the corresponding type setting. Missing
ordinary transaction categories may be created, and an existing category scope may be widened to
`both`. Retired `fee` and report-only adjustment CSV rows are not accepted. Use decimal-safe
parsing and never coerce imported money through JavaScript `Number`.

Keep the in-app file-structure guidance synchronized with these rules whenever an import or
export format changes.

CSV exports guard formula-like text at the shared serializer, including whitespace,
control/format characters, fullwidth formula prefixes, and literal leading apostrophes.
Only whole-cell ASCII decimals/exponents in numeric columns are exempt; preserve exact
amount strings and signed balance deltas without JavaScript `Number` coercion. Exports
append `Text Encoding` with `apostrophe-v1` on every row. The importer rejects unknown,
missing or inconsistent markers when that column is present, then removes exactly one
leading guard before normal field validation. Unmarked legacy CSV remains unchanged.
Keep this column intact for lossless re-import into current JIBJIP; older versions may
retain protective apostrophes. Spreadsheet editing/re-saving can reinterpret cells and
is outside the original file's safety/precision guarantee. Full backups and stored
records are never modified to implement export safety.

The shared, collapsed migration guide appears beside Settings CSV import and in
first-time setup. It explains exporting from another app, creating matching
wallets/currencies, and converting transaction CSV with a copyable bilingual
prompt. Keep its header sourced from `packages/core/src/lib/csv-format.ts`, shared with the real
parser/exporter. Never suggest fabricating a native full backup or claim that
CSV transfers another app's complete database, settings, rate history, or links.
The prompt is static: never insert personal records or automatically send them
to a converter. Explain append-only duplicates and the converter's data handling.
Settings categories use a native details disclosure, collapsed initially;
`jibjip.settings.categoriesExpanded` is an optional localStorage UI preference,
independent of financial data, full backups, and category/report settings.

## Seed and data compatibility

The tracked setup seed at `packages/core/assets/data/jibjip-starter-seed.json` contains 38 built-in
currencies, 37 dated and source-attributed baseline rates for non-EUR
currencies, and no wallets,
categories, transactions, or
Uncharted entries. Default category rows are deliberately materialized from
the bilingual templates in `packages/core/src/lib/catalogs.ts` only after the user chooses a
setup language, so Farsi names become stored data when Farsi is selected. The
seed is safe to commit and distribute.

Existing databases normalize all persisted settings keys and sanitize Uncharted
records during initialization. Run `node scripts/audit_data_integrity.mjs` to
check the tracked starter (and an explicitly supplied disposable runtime copy)
for schema, reference,
decimal, date, currency, category-scope, source-metadata, link-pair, settings,
and Uncharted invariants; its output is aggregate-only.

The current native data contract is V2. It adds the `currencies` store,
`dataVersion`, setup state/version, `mainWalletId`, category metadata, and
stable nullable `transaction.categoryId` references while retaining the
denormalized category label for CSV. Only V2 native full backups are accepted;
the source backup file is never rewritten. Normalization must preserve every
stored transaction amount, `balanceAmount`, currency, and note exactly. A
reportable transaction must resolve to a stable category ID during
normalization, while nonreporting transfer/exchange labels may deliberately
retain a null category ID.

Use decimal-safe arithmetic for money and rates. Never use JavaScript floating-point arithmetic
for persisted financial amounts. Imported `balanceAmount` values preserve the workbook's
original signed wallet delta.

## Future compatibility

If synchronization is explicitly introduced later, preserve stable UUIDs,
transaction ownership, exact decimal values, dated EUR observations, granularity,
provenance and locks. Keep offline behavior and define conflict resolution before
syncing records. No backend or sync system is implicitly authorized by this guide.

## Shared-core boundary

The complete reusable application lives in `packages/core/`; the thin `apps/web/`
shell mounts it with an explicit development/personal/public profile. Imports and
the introduction must not initialize financial storage. Personal and website
builds share one core release and the same financial/backup contracts. Optional
commercial services consume a pinned core; their absence must not block ordinary
finance use. Local Clarity is self-reported progress, never trusted online reward
eligibility. See [the architecture](ARCHITECTURE.md) and [roadmap](ROADMAP.md).
