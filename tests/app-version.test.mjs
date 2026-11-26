import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compareAppVersions, isNumericAppVersion, nextAppVersion, readAppVersion, validateVersionMetadata } from "../scripts/app-version.mjs";
import { bumpAppVersion } from "../scripts/bump_app_version.mjs";
import { requiresVersionBump, verifyStagedVersion } from "../scripts/verify_staged_version.mjs";

const appVersion = readAppVersion(process.cwd());

test("the app version is numeric MAJOR.MINOR.PATCH metadata", () => {
  assert.equal(isNumericAppVersion(appVersion), true);
  assert.match(appVersion, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
});

test("the lockfile root metadata stays aligned with package.json", () => {
  const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));
  assert.equal(lockfile.version, appVersion);
  assert.equal(lockfile.packages[""].version, appVersion);
});

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "jibjip-version-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeMetadata(root, "0.1.1");
  writeFileSync(join(root, ".gitignore"), "/CHANGELOG.md\n");
  return root;
}

function writeMetadata(root, version) {
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "jibjip", version, private: true }, null, 2) + "\n");
  writeFileSync(join(root, "package-lock.json"), JSON.stringify({ name: "jibjip", version, packages: { "": { version } } }, null, 2) + "\n");
  writeFileSync(join(root, "CHANGELOG.md"), `# jibjip release notes\n\n## ${version}\n\n- Synthetic baseline.\n`);
}

test("numeric increments reset lower components and compare numerically", () => {
  assert.equal(nextAppVersion("0.1.9", "patch"), "0.1.10");
  assert.equal(nextAppVersion("0.1.9", "minor"), "0.2.0");
  assert.equal(nextAppVersion("0.2.9", "major"), "1.0.0");
  assert.equal(compareAppVersions("0.1.10", "0.1.9"), 1);
  assert.throws(() => nextAppVersion("0.1.1", "automatic"));
  for (const invalid of ["01.2.3", "1.2", "1.2.3.4", "1.2.3-beta"]) assert.equal(isNumericAppVersion(invalid), false);
});

test("one version update aligns both lockfile roots and preserves literal notes and older history", (t) => {
  const root = fixture(t);
  const result = bumpAppVersion(root, "minor", ["Keep $& and $1 literal."], "2026-10-17");
  assert.deepEqual(result, { previous: "0.1.1", version: "0.2.0" });
  assert.equal(readAppVersion(root), "0.2.0");
  const notes = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  assert.match(notes, /## 0\.2\.0 - 2026-10-17\n\n- Keep \$& and \$1 literal\./);
  assert.match(notes, /## 0\.1\.1\n\n- Synthetic baseline\./);
});

test("build metadata needs no private notes, and the first update creates a local history without inventing old entries", (t) => {
  const root = fixture(t);
  rmSync(join(root, "CHANGELOG.md"));
  assert.equal(readAppVersion(root), "0.1.1");
  bumpAppVersion(root, "patch", ["Keep local notes."], "2026-10-17");
  assert.equal(readAppVersion(root), "0.1.2");
  const history = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  assert.match(history, /## 0\.1\.2 - 2026-10-17/);
  assert.doesNotMatch(history, /## 0\.1\.1/);
});

test("invalid dates, notes, and mismatched lockfiles fail before changing any version files", (t) => {
  const root = fixture(t);
  const files = ["package.json", "package-lock.json", "CHANGELOG.md"];
  const before = files.map((file) => readFileSync(join(root, file), "utf8"));
  for (const [notes, date] of [[[], "2026-10-17"], [[""], "2026-10-17"], [["Bad\nheading"], "2026-10-17"], [["A note"], "2026-02-30"]]) {
    assert.throws(() => bumpAppVersion(root, "patch", notes, date));
    assert.deepEqual(files.map((file) => readFileSync(join(root, file), "utf8")), before);
  }
  const lock = JSON.parse(before[1]);
  lock.version = "0.1.0";
  writeFileSync(join(root, files[1]), JSON.stringify(lock));
  assert.throws(() => readAppVersion(root), /Both package-lock/);
});

test("release metadata rejects stale, duplicate, unordered, or empty notes", () => {
  const manifest = { version: "0.2.0" };
  const lock = { version: "0.2.0", packages: { "": { version: "0.2.0" } } };
  for (const notes of ["## 0.1.1\n- Old", "## 0.2.0\nNo details", "## 0.2.0\n- Note\n## 0.2.0\n- Duplicate", "## 0.2.0\n- Note\n## 0.3.0\n- Newer"]) {
    assert.throws(() => validateVersionMetadata(manifest, lock, notes));
  }
});

test("the commit guard checks staged version metadata once per release and keeps the changelog out of Git", (t) => {
  const root = fixture(t);
  const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  git("init"); git("config", "user.name", "Synthetic Test"); git("config", "user.email", "test@example.invalid");
  mkdirSync(join(root, "apps"));
  writeFileSync(join(root, "apps", "view.js"), "export const label = 'Before';\n");
  git("add", ".");
  assert.equal(verifyStagedVersion(root), "0.1.1");
  git("commit", "-m", "Synthetic baseline");
  writeFileSync(join(root, "README.md"), "Documentation only"); git("add", "README.md");
  assert.equal(verifyStagedVersion(root), "0.1.1");
  writeFileSync(join(root, "apps", "view.js"), "export const label = 'After';\n"); git("add", "apps/view.js");
  assert.equal(verifyStagedVersion(root), "0.1.1", "app changes no longer need a version bump per commit");
  const notes = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  rmSync(join(root, "CHANGELOG.md"));
  assert.equal(verifyStagedVersion(root), "0.1.1", "the local changelog is optional");
  writeFileSync(join(root, "CHANGELOG.md"), notes);
  bumpAppVersion(root, "patch", ["Update label."], "2026-10-17");
  assert.equal(verifyStagedVersion(root), "0.1.1", "unstaged metadata does not count");
  git("add", "package.json");
  assert.throws(() => verifyStagedVersion(root), /Both package-lock/);
  git("add", "package-lock.json");
  assert.equal(verifyStagedVersion(root), "0.1.2");
  assert.equal(git("ls-files", "CHANGELOG.md").toString(), "");
  const bumped = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  writeFileSync(join(root, "CHANGELOG.md"), "# jibjip release notes\n\n## 0.1.1\n\n- Stale.\n");
  assert.throws(() => verifyStagedVersion(root), /must start with notes for the current app version/);
  rmSync(join(root, "CHANGELOG.md"));
  assert.equal(verifyStagedVersion(root), "0.1.2", "a missing local changelog is not an error");
  writeFileSync(join(root, "CHANGELOG.md"), bumped);
  git("add", "-f", "CHANGELOG.md");
  assert.throws(() => verifyStagedVersion(root), /personal and must remain untracked/);
  git("rm", "--cached", "CHANGELOG.md");
  writeMetadata(root, "0.1.0"); git("add", "package.json", "package-lock.json");
  assert.throws(() => verifyStagedVersion(root), /cannot go backwards/);
});

test("version checks cover runtime, reference defaults, dependencies, and launchers without bumping tests or prose", () => {
  for (const path of ["LICENSE", "apps/web/home.tsx", "packages/core/src/lib/charts.ts", "packages/core/assets/sw.js", "packages/core/assets/data/jibjip-starter-seed.json", "package-lock.json", "vite.config.ts", "scripts/build_local_runtime.ps1", "Open jibjip.cmd", ".githooks/pre-commit"]) assert.ok(requiresVersionBump(path), path);
  for (const path of ["README.md", "VERSIONING.md", "tests/app-version.test.mjs", "collaboration/README.md"]) assert.equal(requiresVersionBump(path), false, path);
});

test("prerelease and build labels are not app versions", () => {
  assert.equal(isNumericAppVersion("0.1.0-beta.1"), false);
  assert.equal(isNumericAppVersion("0.1.0+build.1"), false);
});
