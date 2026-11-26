# JIBJIP versioning

## One core release

Root `package.json` owns numeric `MAJOR.MINOR.PATCH`. Both lockfile roots, the
core/shell manifests, and workspace lock entries must match. One version covers
a coherent update. Personal installation and website records identify the core
release actually running; GitHub source uses that same core version.

A separate commercial service will receive an independent release identity when
it exists, recording its compatible core version. Do not create counters for
hypothetical services or separate personal/GitHub app versions.

- Patch: compatible bug fixes, polish, reliability, launcher, or tooling fixes.
- Minor: compatible new features, meaningful milestones, or package restructuring.
- Major: an explicitly reviewed incompatible contract or stability milestone.

Bump the version once per release, just before publishing, when the release contains
app, asset, dependency, launcher, license, or release-tool changes. Commits between
releases keep the current version; guide and test changes alone need no new version.
Rebuilding or deploying identical
source never increments it. Do not reuse or decrease a release version.

## Update and validate

```sh
node scripts/bump_app_version.mjs patch "Describe the completed change."
node scripts/bump_app_version.mjs minor "Describe the milestone."
```

Run the appropriate command once. It validates metadata, updates all workspace
versions together, and records private local notes with rollback on failure.
Additional quoted arguments add note bullets. Use `--date YYYY-MM-DD` to select
a release date explicitly. It does not install, commit, tag, or contact a host.

The version command also writes notes to an optional local `CHANGELOG.md`, which Git
ignores and nothing reads: builds, bundles, Settings, and packages never include it.
Public release notes come from commit messages (see [RELEASING.md](RELEASING.md)).
The pre-commit hook checks that the staged versions agree and that nothing private
is committed.

## Data and delivery

App versions are independent from data/setup/starter counters, database identity,
and full backup V2. A version bump alone never migrates or replaces data.
Rebuild and verify the everyday runtime for app changes. Record the same verified
source commit for personal/public artifacts; installation and deployment are
separate outcomes. Never relabel the recorded older hosted release.
