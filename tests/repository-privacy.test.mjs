import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  assertPublicPath, assertReferenceOnlySeed, assertRepositoryFileIsSafe, isPublicPath, loadPrivateMarkers,
} from "../scripts/privacy-policy.mjs";

const seed = JSON.parse(readFileSync("packages/core/assets/data/jibjip-starter-seed.json", "utf8"));
const verifier = resolve("scripts/verify_repository_privacy.mjs");
const MARKER = "synthetic-private@example.invalid";
const NOREPLY = "1+synthetic@users.noreply.github.com";
const ZERO = "0".repeat(40);

test("reference-only seed is accepted but populated or personalized seed is rejected", () => {
  assert.doesNotThrow(() => assertReferenceOnlySeed(seed));
  assert.throws(() => assertReferenceOnlySeed({...seed, transactions: [{id: "synthetic"}]}), /records/);
  assert.throws(() => assertReferenceOnlySeed({...seed, settings: {...seed.settings, mainWalletId: "synthetic"}}), /selections/);
  assert.throws(() => assertReferenceOnlySeed({...seed, settings: {...seed.settings, chartExcludedCategoryIds: ["synthetic"]}}), /selections/);
  assert.throws(() => assertReferenceOnlySeed({...seed, settings: {...seed.settings, clarity: { enabled: false, awards: [] }}}), /Clarity/);
  assert.throws(() => assertReferenceOnlySeed({...seed, settings: {...seed.settings, clarity: { enabled: true, awards: [{ task: "transactions" }] }}}), /Clarity/);
  assert.throws(() => assertReferenceOnlySeed({...seed, settings: {...seed.settings, clarity: { enabled: false, awards: [{ task: "transactions" }] }}}), /Clarity/);
});

test("private locations and renamed Full backups are rejected without echoing contents", () => {
  for (const path of ["CHANGELOG.md", "changelog.md", "Changelog.MD"]) {
    assert.throws(() => assertRepositoryFileIsSafe(path, Buffer.from("Synthetic personal notes")), /personal changelog/);
  }
  for (const path of ["collaboration/personal-database.local.md", "records.csv", "browser.db", "saved.zip"]) {
    assert.throws(() => assertRepositoryFileIsSafe(path, Buffer.from("synthetic")), /must not be tracked/);
  }
  const personalPath = ["C:", "Users", "synthetic-user", "AppData", "Local", "Google", "Chrome", "User Data"].join("\\");
  assert.throws(() => assertRepositoryFileIsSafe("GUIDE.md", Buffer.from(personalPath)), /storage paths/);
  assert.throws(() => assertRepositoryFileIsSafe("ordinary.json", Buffer.from(JSON.stringify({source:{kind:"jibjip-backup"}}))), /Full backup/);
  assert.throws(() => assertRepositoryFileIsSafe("ordinary.txt", Buffer.from(JSON.stringify({source:{kind:"jibjip-backup"}}))), /Full backup/);
  assert.doesNotThrow(() => assertRepositoryFileIsSafe("packages/core/src/lib/example.ts", Buffer.from("export const value = 1;")));
});

test("the public allowlist accepts public paths and rejects private, unknown, and unsafe ones", () => {
  for (const path of [
    "README.md", "AGENTS.md", "CLAUDE.md", ".gitignore", ".githooks/pre-commit", ".githooks/pre-push", "docs/RELEASING.md",
    "docs/images/overview.png", "docs/images/overview.webp", "scripts/release.mjs", "scripts/privacy-policy.mjs",
    "tests/charts.test.ts", "tests/release.test.mjs", "packages/core/src/lib/example.ts", "apps/web/home.tsx",
    "packages/core/assets/data/jibjip-starter-seed.json",
  ]) assert.equal(isPublicPath(path), true, path);
  for (const path of [
    "tests/release-workflow.test.mjs", "tests/cleanup_test.py", "tests/project_backup_test.py", "scripts/create_public_source.py",
    "scripts/publication/AGENTS.md", "scripts/create_hosted_release.ps1", "docs/local/private-markers.txt", "docs/local/note.md",
    "deploy/server.json", "collaboration/README.md", "CHANGELOG.md", "Back Up Project.cmd",
  ]) assert.equal(isPublicPath(path), false, path);
  for (const path of ["notes.txt", "docs/images/overview.gif", "docs/images/nested/overview.png", "scripts/sub/release.mjs", "tests/nested/a.ts", "apps/web/readme.md"]) {
    assert.equal(isPublicPath(path), false, path);
  }
  for (const path of ["/README.md", "docs\\RELEASING.md", "../README.md", "docs/../README.md", "C:/README.md", "docs//RELEASING.md", ""]) {
    assert.equal(isPublicPath(path), false, path);
  }
  assert.throws(() => assertPublicPath("scripts/create_public_source.py"), /not on the public allowlist/);
  assert.doesNotThrow(() => assertPublicPath("README.md"));
});

test("workstation paths, credentials, and private markers are rejected without echoing them", () => {
  const drive = ["D:", "wk", "project"].join("\\");
  assert.throws(() => assertRepositoryFileIsSafe("docs/ARCHITECTURE.md", Buffer.from(`See ${drive}`)), /Workstation path found in docs\/ARCHITECTURE\.md/);
  const userFolder = ["c:", "Users", "someone", "file"].join("/");
  assert.throws(() => assertRepositoryFileIsSafe("a.ts", Buffer.from(`see ${userFolder}`)), /Workstation path/);
  const key = ["-----BEGIN", "OPENSSH", "PRIVATE KEY-----"].join(" ");
  assert.throws(() => assertRepositoryFileIsSafe("a.ts", Buffer.from(key)), /Possible credential found in a\.ts/);
  assert.throws(() => assertRepositoryFileIsSafe("a.ts", Buffer.from(`token ghp_${"A1".repeat(15)}`)), /Possible credential/);
  assert.doesNotThrow(() => assertRepositoryFileIsSafe("a.ts", Buffer.from("ghp_short and plain text")));
  assert.doesNotThrow(() => assertRepositoryFileIsSafe("a.ts", Buffer.from(`mentions ${MARKER}`)), "no markers, no check");
  for (const text of [`mail ${MARKER}`, `mail ${MARKER.toUpperCase()}`]) {
    assert.throws(() => assertRepositoryFileIsSafe("a.ts", Buffer.from(text), [MARKER]), (error) => {
      assert.match(error.message, /Private marker found in a\.ts; contents withheld\./);
      assert.equal(error.message.toLowerCase().includes(MARKER), false);
      return true;
    });
  }
  assert.throws(() => assertRepositoryFileIsSafe(`${MARKER}.ts`, Buffer.from("clean"), [MARKER]), (error) => !error.message.includes(MARKER));
});

test("private markers load from the local file, ignore comments, and fail closed when required", (t) => {
  const root = mkdtempSync(join(tmpdir(), "jibjip-markers-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(loadPrivateMarkers(root), []);
  assert.throws(() => loadPrivateMarkers(root, { required: true }), /docs\/local\/private-markers\.txt is missing; refusing to publish\./);
  mkdirSync(join(root, "docs", "local"), { recursive: true });
  const file = join(root, "docs", "local", "private-markers.txt");
  writeFileSync(file, "# comment\n\n   \n");
  assert.throws(() => loadPrivateMarkers(root, { required: true }), /refusing to publish/);
  writeFileSync(file, `# comment\r\n${MARKER}\r\n\r\nsecond-synthetic-marker\n`);
  assert.deepEqual(loadPrivateMarkers(root, { required: true }), [MARKER, "second-synthetic-marker"]);
});

function repository(t, { email = NOREPLY, markers = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "jibjip-privacy-git-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "pipe" }).toString().trim();
  const check = (args = [], input) => spawnSync(process.execPath, [verifier, ...args], { cwd: root, encoding: "utf8", input });
  git("init", "-b", "main");
  git("config", "user.name", "Synthetic Test");
  git("config", "user.email", email);
  if (markers) {
    mkdirSync(join(root, "docs", "local"), { recursive: true });
    writeFileSync(join(root, "docs", "local", "private-markers.txt"), `# synthetic\n${MARKER}\n`);
  }
  const commit = (message, file = "README.md", text = "Synthetic test repository", env = {}) => {
    writeFileSync(join(root, file), text);
    git("add", file);
    execFileSync("git", ["commit", "-m", message], { cwd: root, stdio: "pipe", env: { ...process.env, ...env } });
    return git("rev-parse", "HEAD");
  };
  const push = (line) => check(["--push"], `${line}\n`);
  return { root, git, check, commit, push };
}

test("Git checks inspect staged blobs and outgoing history, not just the working tree", (t) => {
  const { root, git, check, push } = repository(t);
  writeFileSync(join(root, "README.md"), "Synthetic test repository");
  git("add", "README.md");
  assert.equal(check().status, 0);
  git("commit", "-m", "safe");
  const baseline = git("rev-parse", "HEAD");
  writeFileSync(join(root, "records.json"), JSON.stringify({source:{kind:"jibjip-backup"}}));
  git("add", "records.json");
  writeFileSync(join(root, "records.json"), "{}");
  assert.notEqual(check().status, 0, "a safe working copy must not conceal an unsafe staged blob");
  git("rm", "--cached", "-f", "-q", "records.json");
  // An allowlisted path with unsafe contents is caught in the index and in history.
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "docs", "BUGS.md"), JSON.stringify({source:{kind:"jibjip-backup"}}));
  git("add", "docs/BUGS.md");
  assert.notEqual(check().status, 0);
  git("commit", "-m", "synthetic unsafe intermediate");
  writeFileSync(join(root, "docs", "BUGS.md"), "Safe notes");
  git("add", "docs/BUGS.md");
  git("commit", "-m", "safe final tree");
  const head = git("rev-parse", "HEAD");
  assert.equal(check(["--ref", "HEAD"]).status, 0);
  const result = push(`refs/heads/main ${head} refs/heads/main ${baseline}`);
  assert.notEqual(result.status, 0, "an unsafe intermediate commit must stop the push");
  assert.match(result.stderr, /Full backup/);
});

test("tracked files must be on the allowlist, in the index, and in a commit", (t) => {
  const { git, check, commit } = repository(t);
  commit("Add stray", "stray.txt", "synthetic");
  assert.match(check().stderr, /stray\.txt is not on the public allowlist/, "the index is checked");
  const result = check(["--ref", "HEAD"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stray\.txt is not on the public allowlist/);
  git("rm", "-q", "stray.txt");
  assert.equal(check().status, 0);
});

test("markers are optional by default, used when present, and mandatory with --require-markers", (t) => {
  const withMarkers = repository(t);
  withMarkers.commit("Clean", "README.md", `Mentions ${MARKER}`);
  const result = withMarkers.check(["--ref", "HEAD"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Private marker found in README\.md; contents withheld\./);
  assert.equal(`${result.stdout}${result.stderr}`.includes(MARKER), false, "the marker is never echoed");

  const without = repository(t, { markers: false });
  without.commit("Clean");
  assert.equal(without.check(["--ref", "HEAD"]).status, 0);
  const required = without.check(["--ref", "HEAD", "--require-markers"]);
  assert.notEqual(required.status, 0);
  assert.match(required.stderr, /private-markers\.txt is missing; refusing to publish/);
  assert.equal(withMarkers.commit("Fixed", "README.md", "Clean") && withMarkers.check(["--ref", "HEAD", "--require-markers"]).status, 0);
});

test("--push refuses other refs, deletions, private markers in metadata, and missing markers", (t) => {
  const { git, commit, push } = repository(t);
  const head = commit("Clean");
  for (const ref of ["refs/heads/topic", "refs/tags/v1.0.0", "refs/tags/1.0.0-beta"]) {
    const result = push(`${ref} ${head} ${ref} ${ZERO}`);
    assert.notEqual(result.status, 0, ref);
    assert.match(result.stderr, /other than main/);
  }
  const deletion = push(`(delete) ${ZERO} refs/heads/main ${head}`);
  assert.match(deletion.stderr, /delete/);

  const marked = commit("Update", "README.md", "changed", {});
  git("commit", "--amend", "-q", "-m", `Contains ${MARKER} in the message`);
  const bad = git("rev-parse", "HEAD");
  const result = push(`refs/heads/main ${bad} refs/heads/main ${head}`);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Private marker found in the metadata of commit [0-9a-f]{8}; contents withheld\./);
  assert.equal(`${result.stdout}${result.stderr}`.includes(MARKER), false);
  assert.notEqual(marked, bad);

  const noMarkers = repository(t, { markers: false });
  const clean = noMarkers.commit("Clean");
  const missing = noMarkers.push(`refs/heads/main ${clean} refs/heads/main ${ZERO}`);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /private-markers\.txt is missing; refusing to publish/);
});

test("--push checks annotated tag messages and the tagged tree", (t) => {
  const { git, commit, push } = repository(t);
  const head = commit("Clean");
  git("tag", "-a", "0.1.0", "-m", `Release ${MARKER}`);
  const tag = git("rev-parse", "refs/tags/0.1.0");
  const result = push(`refs/tags/0.1.0 ${tag} refs/tags/0.1.0 ${ZERO}`);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Private marker found in annotated tag/);
  assert.equal(`${result.stdout}${result.stderr}`.includes(MARKER), false);
  git("tag", "-a", "0.1.1", "-m", "Release 0.1.1");
  const good = git("rev-parse", "refs/tags/0.1.1");
  assert.equal(push(`refs/tags/0.1.1 ${good} refs/tags/0.1.1 ${ZERO}`).status, 0);
  assert.equal(push(`refs/tags/0.1.1 ${head} refs/tags/0.1.1 ${ZERO}`).status, 0, "a lightweight tag on a clean commit passes");
});

test("a first push needs the configured GitHub noreply identity on every commit", (t) => {
  const clean = repository(t);
  clean.commit("One");
  const head = clean.commit("Two", "CONTRIBUTING.md", "Synthetic");
  assert.equal(clean.push(`refs/heads/main ${head} refs/heads/main ${ZERO}`).status, 0, "a clean first push is accepted");

  const foreign = repository(t);
  foreign.commit("One");
  const author = foreign.commit("Two", "CONTRIBUTING.md", "Synthetic", { GIT_AUTHOR_EMAIL: "synthetic@example.invalid" });
  const result = foreign.push(`refs/heads/main ${author} refs/heads/main ${ZERO}`);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Commit [0-9a-f]{8} was not authored and committed with the configured GitHub noreply email/);
  assert.equal(result.stderr.includes("example.invalid"), false);

  const personal = repository(t, { email: "synthetic@example.invalid" });
  const sha = personal.commit("One");
  const refused = personal.push(`refs/heads/main ${sha} refs/heads/main ${ZERO}`);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /GitHub noreply address/);
  // Later pushes are not a first push, so only trees and metadata are checked.
  const later = personal.commit("Two", "CONTRIBUTING.md", "Synthetic");
  assert.equal(personal.push(`refs/heads/main ${later} refs/heads/main ${sha}`).status, 0);
});
