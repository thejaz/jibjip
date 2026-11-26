# JIBJIP development

Read [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md), then the affected
contracts in [docs/PRODUCT_RULES.md](docs/PRODUCT_RULES.md).
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) maps packages, runtimes, and data flow;
[docs/ROADMAP.md](docs/ROADMAP.md) holds the direction.

## Product rules

- Keep one complete local-first application in `packages/core/`. `apps/web/` is a thin
  browser shell. Commercial services stay outside the core.
- Preserve the existing appearance, English and Persian behavior, exact decimal money,
  signed postings, rate history, stable IDs, atomic persistence, and Full backup V2.
- Keep the development database separate from personal data.
- Importing the package or opening the introduction must not initialize financial
  storage. Mount with an explicit runtime profile.
- Preserve account-free offline use, all HTML entry points, integrity-checked lazy
  chunks, and the ordinary waiting service-worker lifecycle.
- Preserve the canonical artwork and the exact JIBJIP / جیب جیپ / THEJAZ identity.
- Source changes never authorize publishing packages, uploading the website, accounts,
  sync, payments, telemetry, or online rewards.

## Data and privacy

- Everything committed becomes public at the next release. Tests, examples, and
  screenshots use synthetic data. Never commit records, backups, credentials, private
  notes, browser storage, or generated builds.
- Owner-only files live in this folder but are ignored by Git (see `.gitignore`). Never
  force-add them. When `docs/local/README.md` exists, it holds the owner's operations.
- The privacy guard in `scripts/privacy-policy.mjs` runs on every commit, push, and
  release. Add a new public file to its allowlist only after reviewing it. Never bypass
  the guard or its Git hooks.

## Workflow

- Work on `main`, one contributor at a time. Before editing, check
  `git status --short --branch` and `git log -5 --oneline`; treat existing uncommitted
  changes as someone else's work.
- Commit after each completed fix or feature, with its checks. Stage explicit paths and
  review `git diff --cached` and `git diff --cached --check` first.
- Commit messages have a short subject and, when useful, bullets. A release commit is
  titled `JIBJIP x.y.z: summary`.
- Run `npm run check` before handing off. UI changes also need English and Persian at
  phone and desktop widths, large text, keyboard, and form checks. Report emulation
  separately from physical devices.
- Update the guide that owns a changed fact, and keep generated output out of source.
- Bump the version once per release (see [docs/VERSIONING.md](docs/VERSIONING.md)).
- Publish only when the owner asks: `npm run release -- --dry-run`, then
  `npm run release`. Never push other branches or refs, and never rewrite published
  history.
- American English (converted 2026-11-26): documentation, interface text, and the
  spelling of code comments, tests, and tools. Write new text the same way.
