# Releasing JIBJIP

The maintainer publishes releases from a clean `main`. Contributors don't need this
guide; see [CONTRIBUTING.md](../CONTRIBUTING.md).

1. Finish the changes on `main` with `npm run check` passing. UI changes also need the
   browser checks described in [AGENTS.md](../AGENTS.md).
2. Bump the version once with `npm run version:patch`, `version:minor`, or
   `version:major` and a short note (see [VERSIONING.md](VERSIONING.md)). Commit it as
   `JIBJIP x.y.z: summary`, with bullets for the changes.
3. Check without publishing: `npm run release -- --dry-run`.
4. Publish: `npm run release`.

`npm run release` refuses unless `main` is clean, every version field agrees, the tag
is new both locally and on GitHub, and every outgoing commit passes the privacy guard.
It then runs `npm run check`, pushes `main`, creates an annotated tag named after the
version, pushes the tag, and creates the GitHub release with the commit subjects since
the previous release as notes. GitHub adds the source archives.

## Privacy

Everything committed is public. `scripts/privacy-policy.mjs` and
`scripts/verify_repository_privacy.mjs` check every commit, push, and release against a
public-file allowlist and content rules (financial records, backups, credentials,
workstation paths, and the maintainer's private markers, which live outside Git). The
pre-push hook allows only `main` and version tags. The maintainer enables these hooks in
their own clone with `git config core.hooksPath .githooks`. Contributors don't need
them: `npm run check`, which CI runs on every pull request, includes the same tree
check without the private markers.

## Website

The website at <https://jibjip.com> is deployed separately by the maintainer. A GitHub
release does not change it, and a website deployment does not create a release.
