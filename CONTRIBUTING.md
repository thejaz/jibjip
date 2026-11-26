# Contributing to JIBJIP

Bug reports and suggestions are welcome as
[GitHub issues](https://github.com/thejaz/jibjip/issues). For a bug, include your browser
and device, the JIBJIP version (shown at the bottom of the side menu), the interface language, and the
steps that show the problem. Use made-up amounts and names, never your real records,
backups, or screenshots of them.

## Development

You need Node.js 22.13 or later, npm, and Python 3.

```sh
npm ci
npm run dev     # http://localhost:3000/ with its own empty database
npm run check   # lint, types, tests, privacy, and the public build checks
```

Read [AGENTS.md](AGENTS.md), [the architecture](docs/ARCHITECTURE.md), and the
[affected product contracts](docs/PRODUCT_RULES.md). Keep one complete core in
`packages/core/`; `apps/web/` only selects the view and runtime profile.

Use focused tests while developing. A package, build, or persistence restructuring
needs the complete regression suite plus browser checks. Browser coverage includes
English and Persian, narrow and wide layouts, large text, keyboard, forms, and offline
updates. Emulation is not physical-device evidence.

`npm run build:core` builds the local ESM package and declarations; `npm pack
./packages/core` creates a local archive without publishing. Keep source imports
inside the package. External hosts use its documented exports, not internal paths.

## Ground rules

- Never commit records, full backups, workbooks, credentials, private notes, financial
  screenshots, browser storage, or generated builds. Use the reference-only starter and
  synthetic test data. Review the complete diff: automated privacy checks cannot
  recognize every private detail.
- Full backup V2 replaces confirmed data; CSV appends validated transactions. Keep exact
  decimals, signed postings, rate history, atomic rechecks, and stable IDs.
- Local Clarity awards are personal progress, never financial postings or proof of
  eligibility for online rewards.
- A new file that belongs in the public source must be added to the allowlist in
  `scripts/privacy-policy.mjs`.

## Pull requests

Keep each pull request to one fix or feature, add or update tests for it, and make sure
`npm run check` passes. Don't bump the version; the maintainer does that once per release.
Describe what you verified, including languages and screen sizes for UI changes, and
what you could not verify.
