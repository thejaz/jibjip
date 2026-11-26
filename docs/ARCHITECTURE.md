# JIBJIP architecture

JIBJIP has one complete application core and a thin browser shell. Product
behavior belongs to [PRODUCT_RULES.md](PRODUCT_RULES.md), future direction to
[ROADMAP.md](ROADMAP.md), and version identity to [VERSIONING.md](VERSIONING.md).

## Source map

| Path | Responsibility |
| --- | --- |
| `packages/core/src/index.ts` | Public asynchronous mounting interface |
| `packages/core/src/runtime.ts` | Explicit, document-lifetime runtime profile |
| `packages/core/src/components/` | Application, introduction, dialogs, setup, reports, and Clarity |
| `packages/core/src/lib/` | Finance, persistence, portability, rates, catalogs, i18n, and offline behavior |
| `packages/core/src/styles.css` | Canonical shared application styles |
| `packages/core/assets/` | Canonical brand/font/PWA assets and reference-only setup data |
| `apps/web/` | Root/app HTML and bootstrap entries, without finance implementation |
| `vite.config.ts` | One browser development/release pipeline |
| `packages/core/vite.config.ts` | ESM package build with lazy chunks and declared dependencies |
| `scripts/`, `tests/` | Build/release/maintenance tools and synthetic verification |
| `docs/local/`, `deploy/` | Maintainer-only operations; ignored by Git and absent from clones |
| `work/`, `collaboration/` | Ignored generated output and necessary private local material |

There is one npm workspace and lockfile. React is supplied as a package peer;
Dexie, Decimal.js, and Lucide are declared core dependencies. No server framework
is required for the application. See manifests for exact dependency versions.
Vite preserves symlinks, so linked package folders resolve consistently, and
deduplicates React/ReactDOM so the shell and package share one renderer instance.

## Package and runtime boundary

`mountJibjip({ container, view, profile })` returns a promise for an unmount
function. Views are `introduction` and `application`; profiles are `development`,
`personal`, and `public`. A document keeps one profile, and each container has
one active mount. Profile selection precedes dynamic loading of browser services.

Importing the package and opening the introduction must not open financial
storage. Startup effects belong to the mounted application. The package exports
its entry, stylesheet, and static assets; internal modules are not an external API.
[The package guide](../packages/core/README.md) documents host requirements.

| Context | Entry/output | Data boundary |
| --- | --- | --- |
| Everyday personal app | Launcher; `work/local-runtime/`; `http://localhost:4318/app/` | Existing browser/profile/origin database |
| Development | Vite; `http://localhost:3000/` | Empty `jibjip-development-v2`; no starter fetch or service worker |
| Website candidate | `work/public-candidate/` | Origin-bound `mwatch-local-v1`; approved reference-only starter |
| Future commercial host | Separate consumer of a pinned core release | Explicitly designed service boundary, not implemented |

The launcher bypasses the introduction. `/` and `/app/` share their origin, but
other hosts, ports, profiles, and devices have independent data. No device sync
exists. Existing preferences override untouched setup hints.

Only the public homepage loads `apps/web/analytics.ts`. Its optional
Cloudflare beacon is origin/path guarded and manually installed, with SPA route
measurement disabled. It reads earlier website statistics preferences and removes
only former GA cookies; it renders no controls or disclosure. The core has no
analytics dependency. Personal/development builds exclude this integration; app
entry bundles never import it. Existing refusals are honored, and a document-only
CSP restriction stops future requests after withdrawal from an older open release,
without reloading the page. See PRODUCT_RULES for the disclosure and network boundaries.
`vite.config.ts` generates public robots/sitemap files; the host routing policy
allows Cloudflare's script/collection hosts only on the visitor homepage.

## Persistence and Clarity

Dexie preserves the legacy `mwatch-local-v1` identity and seven stores:
`currencies`, `wallets`, `categories`, `transactions`, `uncharted`, `rates`, and
`settings`. Backup compatibility is V2; the database name is not V1-backup support.
Full-backup files use native gzip streams (`.json.gz`) with unchanged V2 JSON
inside; older browsers export `.json`. The lazy `snapshot-file.ts` transport bounds
compressed/expanded input and delegates both formats to the same restore validator.
The starter at `assets/data/jibjip-starter-seed.json` contains approved reference
currencies/rates and no personal financial records. Setup initializes an empty
store once, with transactional rechecks against concurrent work.

```text
UI draft -> domain validation -> atomic transaction -> immutable live snapshot
import -> complete validation -> current-context recheck -> atomic write
snapshot -> user-controlled full backup or transaction CSV
```

`loadSnapshot` still reads complete snapshots. Shared immutable-array indexes
bound repeated calculations; this is a local application, not an unlimited
server dataset. Financial money/rate arithmetic uses Decimal.js.
Charts uses the existing transaction index to include archived wallets/categories
with history, avoiding a full history scan per archived item. `npm run benchmark`
compares the old selectors with fresh and shared indexes and checks identical
results. Cache by immutable snapshot identity; do not retain a second copy of
financial records or add memoization without measured benefit.

Clarity keeps unique task/week awards in settings, independent of finances.
Award checks query the relevant date range or selected wallet and referenced
entities inside one transaction. A balance review retains that wallet's entire
history. Three possible awards per week imply roughly 156 ledger entries per
year. Existing scores and opt-outs survive rebuilds and Full restores. Online
competitive/redeemable awards require a separate verification model.

### Measured local limits

`npm run benchmark:clarity` measures synthetic review calculations and 40 years
of awards (6,240 entries). A desktop run took about 18 ms for 10,000 transactions,
35 ms for 100,000, and 73 ms to normalize the award history. These are observations,
not performance guarantees or a maximum supported dataset.

Build `tests/build-database-fixture.mjs` with the existing toolchain, serve its
output at `http://127.0.0.1:4333`, and run the synthetic browser checks. The real
IndexedDB checks at 10,000 and 100,000 transactions took about 128 ms and 1,087 ms
respectively, including review contexts, signatures, and preservation snapshots.
They reject a full transaction-store read during award operations and check
duplicate prevention, stale contexts, complete selected-wallet balances, and
unchanged financial records.

Award queries allocate only the indexed transaction subset and referenced
entities. Balance review size still grows with the selected wallet's history;
ordinary app snapshots and their indexes still grow with the complete database.
The fixture checks query/allocation scope rather than claiming a stable browser
heap ceiling. Large database imports, memory use on phones, and initial rendering
need device measurements before promising capacity. No extra ledger store,
database migration or service capacity claim follows from these local tests.

## Builds, updates, and source

Personal builds fingerprint source inputs, validate staging, and promote through
rename/rollback. Failure retains the working runtime. Public packaging isolates
its own staging and never requires deletion of the personal runtime.
Both profiles copy the same approved assets and embed the same numeric version.
The ignored private changelog is not a build input.

The shell stamps exact SHA-256 integrity for all three HTML entries and every emitted
JavaScript/CSS chunk. Service-worker installation is atomic; updates use the
standard waiting lifecycle. See [OFFLINE.md](OFFLINE.md).

This repository is the public source. The privacy guard (`scripts/privacy-policy.mjs`)
checks every commit, push, and release against a public-file allowlist and content
rules, so private notes, data, and generated output stay out of Git. Nothing is
published by building locally; see [RELEASING.md](RELEASING.md).

## Network boundary

Financial storage and calculations stay on-device. User-requested public-rate
retrieval sends only public currency/date information under the product rules.
IRR fetching shares validated archive fallbacks between latest-rate previews and
history: the exact rial CSV archive delivered by raw GitHub, then jsDelivr.
They improve delivery availability but share TGJU's upstream price risk. The CDN
is permitted only as a rate connection, never as a script or dependency source.
The core has no account backend, telemetry, cloud database, payment verification,
or synchronization. Homepage statistics belong only to the optional website-shell
integration described above. Future business services consume the core and remain optional.

About exists only in the app. The legacy `/about/` entry is a minimal redirect
back to the homepage, preserving a supported language hint and dropping the old
fragment; it renders no duplicate About content and loads no service or database.
Only `/` may insert the Cloudflare beacon. Android selects a separate padded-icon
manifest in the shell; canonical artwork and other platform sizes are shared.
