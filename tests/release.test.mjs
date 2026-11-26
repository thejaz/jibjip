import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertCleanMain, assertOriginUrl, buildNotes, previousTag, releaseCommits, releaseNotes, ORIGIN_URL,
} from "../scripts/release.mjs";
import { assertAllowedPushRef, assertNoreplyIdentity, verifyCommits } from "../scripts/verify_repository_privacy.mjs";

const NOREPLY = "1+synthetic@users.noreply.github.com";

function repository(t, email = NOREPLY) {
  const root = mkdtempSync(join(tmpdir(), "jibjip-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "pipe", encoding: "utf8" }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Synthetic");
  git("config", "user.email", email);
  const commit = (subject, file = "README.md") => {
    writeFileSync(join(root, file), `${subject}\n`);
    git("add", file);
    git("commit", "-m", subject);
    return git("rev-parse", "HEAD");
  };
  return { root, git, commit };
}

test("release notes list subjects since the previous tag, or mark the first release", () => {
  assert.equal(releaseNotes("", "- One\n- Two"), "First public release.\n\n- One\n- Two\n");
  assert.equal(releaseNotes("0.1.0", "- Three\n"), "Changes since 0.1.0:\n\n- Three\n");
});

test("the notes come from real commit subjects and only version tags count as releases", (t) => {
  const { root, git, commit } = repository(t);
  commit("Start");
  assert.equal(previousTag(root), "");
  assert.equal(buildNotes(root), "First public release.\n\n- Start\n");
  git("tag", "-a", "0.1.0", "-m", "JIBJIP 0.1.0");
  commit("Add feature");
  git("tag", "-a", "not-a-release", "-m", "other");
  assert.equal(previousTag(root), "0.1.0");
  assert.equal(buildNotes(root), "Changes since 0.1.0:\n\n- Add feature\n");
});

test("release requires a clean main and the exact GitHub origin", (t) => {
  const { root, git, commit } = repository(t);
  commit("Start");
  assert.doesNotThrow(() => assertCleanMain(root));
  writeFileSync(join(root, "stray.txt"), "synthetic");
  assert.throws(() => assertCleanMain(root), /Commit or set aside/);
  rmSync(join(root, "stray.txt"));
  git("checkout", "-b", "topic");
  assert.throws(() => assertCleanMain(root), /Release from main/);
  assert.doesNotThrow(() => assertOriginUrl(ORIGIN_URL));
  for (const url of ["https://github.com/other/jibjip.git", "git@github.com:thejaz/jibjip.git", ""]) {
    assert.throws(() => assertOriginUrl(url), /origin must be/);
  }
});

test("outgoing commits are all of main on a first push and only the new ones afterward", (t) => {
  const { root, git, commit } = repository(t);
  const first = commit("One");
  const second = commit("Two");
  assert.deepEqual(releaseCommits(root, false), { firstPush: true, commits: [first, second] });
  git("update-ref", "refs/remotes/origin/main", first);
  assert.deepEqual(releaseCommits(root, true), { firstPush: false, commits: [second] });
  git("update-ref", "refs/remotes/origin/main", second);
  assert.deepEqual(releaseCommits(root, true).commits, []);
});

test("the first-push identity rule requires the configured GitHub noreply email on every commit", (t) => {
  const { root, commit } = repository(t);
  const clean = commit("Clean");
  assert.doesNotThrow(() => verifyCommits(root, [clean], [], { firstPush: true }));
  const second = commit("Second", "CONTRIBUTING.md");
  assert.doesNotThrow(() => verifyCommits(root, [clean, second], [], { firstPush: true }));
  assert.doesNotThrow(() => assertNoreplyIdentity(root, clean));
  assert.throws(() => assertNoreplyIdentity(root, clean, "someone@example.invalid"), /noreply address/);

  const other = repository(t, "synthetic@example.invalid");
  const sha = other.commit("Private identity");
  assert.throws(() => verifyCommits(other.root, [sha], [], { firstPush: true }), /noreply address/);
  assert.doesNotThrow(() => verifyCommits(other.root, [sha], [], { firstPush: false }));

  const mixed = repository(t);
  mixed.commit("Clean");
  mixed.git("config", "user.email", "synthetic@example.invalid");
  const foreign = mixed.commit("Foreign", "CONTRIBUTING.md");
  mixed.git("config", "user.email", NOREPLY);
  assert.throws(() => verifyCommits(mixed.root, [foreign], [], { firstPush: true }), /was not authored and committed/);
});

test("only main and numeric version tags may be pushed, and never deleted", () => {
  const sha = "a".repeat(40);
  for (const ref of ["refs/heads/main", "refs/tags/0.13.7", "refs/tags/1.0.0"]) assert.doesNotThrow(() => assertAllowedPushRef(ref, sha), ref);
  for (const ref of ["refs/heads/topic", "refs/tags/v1.0.0", "refs/tags/01.0.0", "refs/tags/1.0", "refs/tags/1.0.0-beta.1", "refs/notes/commits"]) {
    assert.throws(() => assertAllowedPushRef(ref, sha), /other than main/, ref);
  }
  assert.throws(() => assertAllowedPushRef("refs/heads/main", "0".repeat(40)), /delete/);
});
