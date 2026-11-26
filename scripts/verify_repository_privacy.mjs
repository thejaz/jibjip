import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertNoPrivateMarkers, assertPublicPath, assertRepositoryFileIsSafe, loadPrivateMarkers,
} from "./privacy-policy.mjs";

export const NOREPLY_SUFFIX = "@users.noreply.github.com";
const ZERO = /^0+$/;
const TAG_REF = /^refs\/tags\/(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const gitIn = (root) => (...args) => execFileSync("git", args, { cwd: root, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
const short = (sha) => String(sha).slice(0, 8);
const lines = (text) => text.toString("utf8").split("\n").map((line) => line.trim()).filter(Boolean);

/** Check every tracked file of the index (no `ref`) or of a commit's tree: allowlist, content, markers. */
export function verifyTree(root, ref, markers = [], checked = new Set()) {
  const git = gitIn(root);
  const entries = (ref ? git("ls-tree", "-rz", ref) : git("ls-files", "--stage", "-z"))
    .toString("utf8").split("\0").filter(Boolean);
  for (const entry of entries) {
    const [metadata, path] = entry.split("\t");
    const fields = metadata.split(" ");
    const hash = ref ? fields[2] : fields[1];
    if (fields[0] !== "100644" && fields[0] !== "100755") {
      throw new Error("Privacy checks require ordinary tracked files, without links or submodules.");
    }
    assertPublicPath(path);
    const key = `${path}:${hash}`;
    if (checked.has(key)) continue;
    assertRepositoryFileIsSafe(path, git("cat-file", "blob", hash), markers);
    checked.add(key);
  }
}

/** Author, committer, and full message of a commit, checked against private markers. */
export function verifyCommitMetadata(root, commit, markers) {
  const text = gitIn(root)("show", "-s", "--format=%an%x00%ae%x00%cn%x00%ce%x00%B", commit).toString("utf8");
  assertNoPrivateMarkers(`the metadata of commit ${short(commit)}`, text, markers);
}

export function configuredEmail(root) {
  try { return gitIn(root)("config", "user.email").toString("utf8").trim(); } catch { return ""; }
}

/** First-push rule: author and committer must be the configured GitHub noreply identity. */
export function assertNoreplyIdentity(root, commit, email = configuredEmail(root)) {
  if (!email || !email.toLowerCase().endsWith(NOREPLY_SUFFIX)) {
    throw new Error("The configured Git email must be a GitHub noreply address before the first public push.");
  }
  const [author, committer] = gitIn(root)("show", "-s", "--format=%ae%x00%ce", commit).toString("utf8").trim().split("\0");
  if (author !== email || committer !== email) {
    throw new Error(`Commit ${short(commit)} was not authored and committed with the configured GitHub noreply email.`);
  }
}

/** Only `main` and numeric version tags may be pushed, and never deleted. */
export function assertAllowedPushRef(remoteRef, localSha) {
  if (ZERO.test(localSha)) throw new Error("Refusing to delete a remote ref.");
  if (remoteRef !== "refs/heads/main" && !TAG_REF.test(remoteRef)) {
    throw new Error("Refusing to push any ref other than main or a MAJOR.MINOR.PATCH version tag.");
  }
}

/** Commits a push would add: everything reachable from `local` and not from `remote`. */
export function outgoingCommits(root, local, remote) {
  const args = ["rev-list", "--reverse", local];
  if (remote && !ZERO.test(remote)) args.push(`^${remote}`);
  return lines(gitIn(root)(...args));
}

/** Tree, metadata, and (on a first push) identity checks for a list of commits. */
export function verifyCommits(root, commits, markers, { firstPush = false, checked = new Set() } = {}) {
  const email = firstPush ? configuredEmail(root) : "";
  for (const commit of commits) {
    verifyTree(root, commit, markers, checked);
    verifyCommitMetadata(root, commit, markers);
    if (firstPush) assertNoreplyIdentity(root, commit, email);
  }
}

function verifyTag(root, sha, markers, checked) {
  const git = gitIn(root);
  if (git("cat-file", "-t", sha).toString("utf8").trim() === "tag") {
    assertNoPrivateMarkers(`annotated tag ${short(sha)}`, git("cat-file", "tag", sha).toString("utf8"), markers);
  }
  verifyTree(root, git("rev-parse", `${sha}^{commit}`).toString("utf8").trim(), markers, checked);
}

/** Verify the stdin lines Git gives a pre-push hook: `<local ref> <local sha> <remote ref> <remote sha>`. */
export function verifyPush(root, stdin, markers) {
  const checked = new Set(), done = new Set();
  for (const line of lines(stdin)) {
    const [, localSha, remoteRef, remoteSha] = line.split(/\s+/);
    assertAllowedPushRef(remoteRef, localSha);
    const outgoing = outgoingCommits(root, localSha, remoteSha);
    const fresh = outgoing.filter((commit) => !done.has(commit));
    const isMain = remoteRef === "refs/heads/main";
    verifyCommits(root, fresh, markers, { firstPush: isMain && ZERO.test(remoteSha), checked });
    if (!isMain) verifyTag(root, localSha, markers, checked);
    for (const commit of outgoing) done.add(commit);
  }
}

function main(argv) {
  const root = gitIn(process.cwd())("rev-parse", "--show-toplevel").toString("utf8").trim();
  if (argv.includes("--push")) {
    verifyPush(root, readFileSync(0, "utf8"), loadPrivateMarkers(root, { required: true }));
  } else {
    const refIndex = argv.indexOf("--ref");
    const ref = refIndex >= 0 ? argv[refIndex + 1] : undefined;
    if (refIndex >= 0 && !ref) throw new Error("--ref needs a commit.");
    verifyTree(root, ref, loadPrivateMarkers(root, { required: argv.includes("--require-markers") }));
  }
  console.log("Repository privacy check passed; no private contents were printed.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    // Git's own stderr could quote paths or contents; report only our rule text.
    console.error(`Repository privacy check failed: ${error.status === undefined ? error.message : "a Git lookup failed."}`);
    process.exitCode = 1;
  }
}
