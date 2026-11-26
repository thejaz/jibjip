import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareAppVersions, validateChangelog, validateVersionMetadata } from "./app-version.mjs";

export function requiresVersionBump(path) {
  return path === "LICENSE" || /^(packages|apps|deploy)\//.test(path) ||
    /^(scripts\/.*\.(mjs|ps1|py)|[^/]+\.cmd|package(-lock)?\.json|vite[^/]*\.ts|tsconfig\.json|\.githooks\/)/.test(path);
}

/** Inspect exactly what will be committed; unstaged metadata cannot mask a stale release. */
export function verifyStagedVersion(root = process.cwd()) {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const manifest = JSON.parse(git("show", ":package.json"));
  const lockfile = JSON.parse(git("show", ":package-lock.json"));
  if (git("ls-files", "--cached", "-z").split("\0").some((path) => path.toLowerCase() === "changelog.md")) {
    throw new Error("CHANGELOG.md is personal and must remain untracked; retain the local file and remove it from the Git index.");
  }
  const version = validateVersionMetadata(manifest, lockfile);
  for (const workspace of manifest.workspaces ?? []) {
    if (JSON.parse(git("show", `:${workspace}/package.json`)).version !== version) throw new Error("Staged workspace versions must match the root release.");
  }
  let previous;
  try { previous = JSON.parse(git("show", "HEAD:package.json")).version; }
  catch { previous = null; } // Initial repository commit has no prior app release.
  const order = previous === null ? 1 : compareAppVersions(version, previous);
  if (order < 0) throw new Error("The app version cannot go backwards.");
  // Versions change once per release, not per commit. A new version is checked against the private notes when they exist.
  const historyPath = join(root, "CHANGELOG.md");
  if (order > 0 && existsSync(historyPath)) validateChangelog(version, readFileSync(historyPath, "utf8"));
  return version;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(`Staged app version verified: ${verifyStagedVersion()}.`); }
  catch (error) { console.error(`Version check failed: ${error.message}`); process.exitCode = 1; }
}
