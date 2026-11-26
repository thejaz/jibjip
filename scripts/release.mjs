// Publish the current version to GitHub: `npm run release` (or `-- --dry-run` to check only).
// Local work never depends on this; it is the one deliberate step that pushes `main`,
// tags the version and creates the GitHub release. Nothing private is printed.
import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path, { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readAppVersion } from "./app-version.mjs";
import { assertNoPrivateMarkers, loadPrivateMarkers } from "./privacy-policy.mjs";
import { outgoingCommits, verifyCommits, verifyTree } from "./verify_repository_privacy.mjs";

export const ORIGIN_URL = "https://github.com/thejaz/jibjip.git";
export const NAME = "JIBJIP";

const run = (root, cmd, args, options = {}) => (execFileSync(cmd, args, { cwd: root, encoding: "utf8", ...options }) ?? "").trim();
const quiet = ["ignore", "pipe", "ignore"];

export function assertCleanMain(root) {
  const git = (...args) => run(root, "git", args);
  if (git("rev-parse", "--abbrev-ref", "HEAD") !== "main") throw new Error("Release from main.");
  if (git("status", "--porcelain") !== "") throw new Error("Commit or set aside every change first; a release is exactly a commit.");
}

export function assertOriginUrl(url) {
  if (url !== ORIGIN_URL) throw new Error(`origin must be ${ORIGIN_URL}.`);
}

/** Release notes: commit subjects since the previous tag, or the first release's whole history. */
export function releaseNotes(previous, subjects) {
  const list = subjects.trim();
  return previous ? `Changes since ${previous}:\n\n${list}\n` : `First public release.\n\n${list}\n`;
}

export function previousTag(root) {
  try {
    return run(root, "git", ["describe", "--tags", "--abbrev=0", "--match", "[0-9]*.[0-9]*.[0-9]*", "HEAD"], { stdio: quiet });
  } catch { return ""; } // First release: no tag yet.
}

export function buildNotes(root) {
  const previous = previousTag(root);
  const subjects = run(root, "git", ["log", "--format=- %s", previous ? `${previous}..HEAD` : "HEAD"]);
  return releaseNotes(previous, subjects);
}

/** Commits that publishing `main` would add, and whether the remote branch is new. */
export function releaseCommits(root, remoteBranchExists) {
  const local = run(root, "git", ["rev-parse", "main"]);
  return {
    firstPush: !remoteBranchExists,
    commits: outgoingCommits(root, local, remoteBranchExists ? "refs/remotes/origin/main" : undefined),
  };
}

function main(root, dryRun) {
  const git = (...args) => run(root, "git", args);
  const step = (text) => console.log(`- ${text}`);

  // 1. A clean, committed main that agrees on one version.
  assertCleanMain(root);
  const version = readAppVersion(root);
  step(`main is clean at ${git("rev-parse", "--short", "HEAD")}; version ${version} agrees everywhere`);

  // 2. Private markers are mandatory before anything leaves this machine.
  const markers = loadPrivateMarkers(root, { required: true });
  step("private markers are present");

  // 3. The right GitHub remote, and a version not released before.
  let remote;
  try { remote = git("remote", "get-url", "origin"); } catch { throw new Error("No GitHub remote named origin."); }
  assertOriginUrl(remote);
  if (git("tag", "--list", version) !== "") throw new Error(`Tag ${version} already exists locally; bump the version first.`);
  if (git("ls-remote", "--tags", "origin", `refs/tags/${version}`) !== "") throw new Error(`${version} is already on GitHub; bump the version first.`);
  step(`origin is ${remote}; ${version} is new`);

  // 4. Everything that would be published passes the same checks as the pre-push hook.
  const remoteBranchExists = git("ls-remote", "--heads", "origin", "main") !== "";
  if (remoteBranchExists) git("fetch", "origin", "refs/heads/main:refs/remotes/origin/main");
  const { firstPush, commits } = releaseCommits(root, remoteBranchExists);
  verifyTree(root, "HEAD", markers);
  verifyCommits(root, commits, markers, { firstPush });
  step(`${commits.length} outgoing commit(s) pass the privacy checks${firstPush ? " and the noreply identity rule" : ""}`);

  // 5. Lint, typecheck, tests, and every verification.
  execSync("npm run check", { cwd: root, stdio: "inherit" });
  step("npm run check passes");

  // 6. Notes: the commit subjects since the previous release.
  const notes = buildNotes(root);
  assertNoPrivateMarkers("the release notes", notes, markers);
  if (dryRun) {
    console.log(`\nDry run: would run, in order:\n  git push origin main\n  git tag -a ${version} -m "${NAME} ${version}"\n  git push origin refs/tags/${version}\n  gh release create ${version} --verify-tag --title "${NAME} ${version}" --notes-file <notes>\nwith these notes:\n\n${notes}`);
    return;
  }

  // 7. Push, tag, and release.
  run(root, "git", ["push", "origin", "main"], { stdio: "inherit" });
  git("tag", "-a", version, "-m", `${NAME} ${version}`);
  run(root, "git", ["push", "origin", `refs/tags/${version}`], { stdio: "inherit" });
  const folder = mkdtempSync(path.join(os.tmpdir(), "jibjip-release-")), notesFile = path.join(folder, "notes.md");
  try {
    writeFileSync(notesFile, notes);
    const url = run(root, "gh", ["release", "create", version, "--verify-tag", "--title", `${NAME} ${version}`, "--notes-file", notesFile]);
    step(`released ${url}`);
  } finally { rmSync(folder, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(run(process.cwd(), "git", ["rev-parse", "--show-toplevel"]), process.argv.includes("--dry-run")); }
  catch (error) {
    console.error(`Release stopped: ${error.status === undefined ? error.message : "a command failed; see its output above."}`);
    process.exitCode = 1;
  }
}
