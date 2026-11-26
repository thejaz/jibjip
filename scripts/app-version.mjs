import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// App releases intentionally use a numeric MAJOR.MINOR.PATCH form. Prerelease
// labels and build metadata belong in release records, not in the app version.
export const NUMERIC_APP_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function isNumericAppVersion(value) {
  return typeof value === "string" && NUMERIC_APP_VERSION_PATTERN.test(value);
}

export function compareAppVersions(left, right) {
  if (!isNumericAppVersion(left) || !isNumericAppVersion(right)) throw new Error("Versions must use numeric MAJOR.MINOR.PATCH.");
  const a = left.split(".").map(BigInt);
  const b = right.split(".").map(BigInt);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

export function nextAppVersion(current, level) {
  if (!isNumericAppVersion(current) || !["major", "minor", "patch"].includes(level)) {
    throw new Error("Choose major, minor, or patch for a numeric app version.");
  }
  const parts = current.split(".").map(BigInt);
  const index = { major: 0, minor: 1, patch: 2 }[level];
  parts[index] += 1n;
  for (let following = index + 1; following < 3; following += 1) parts[following] = 0n;
  return parts.join(".");
}

export function validateVersionMetadata(manifest, lockfile, changelog) {
  const version = manifest.version;
  if (!isNumericAppVersion(version)) throw new Error("package.json must contain numeric MAJOR.MINOR.PATCH.");
  if (lockfile.version !== version || lockfile.packages?.[""]?.version !== version) {
    throw new Error("Both package-lock.json root versions must match package.json. Use the version bump command.");
  }
  for (const workspace of manifest.workspaces ?? []) {
    if (lockfile.packages?.[workspace]?.version !== version) throw new Error("Workspace lockfile versions must match the root release.");
  }
  if (changelog !== undefined) validateChangelog(version, changelog);
  return version;
}

/** Private notes are checked locally when recording an update, never required by builds. */
export function validateChangelog(version, changelog) {
  const headings = [...changelog.matchAll(/^## ([^\s]+)(?:[^\n]*)$/gm)].map((match) => match[1]);
  if (headings[0] !== version || headings.some((entry) => !isNumericAppVersion(entry))) {
    throw new Error("The local CHANGELOG.md must start with notes for the current app version.");
  }
  for (let index = 1; index < headings.length; index += 1) {
    if (compareAppVersions(headings[index - 1], headings[index]) <= 0) {
      throw new Error("Changelog versions must be unique and newest first.");
    }
  }
  const currentNotes = changelog.split(/^## /m)[1]?.split(/^## /m)[0] ?? "";
  if (!/^[-*] \S/m.test(currentNotes)) throw new Error("The current release needs at least one release-note bullet.");
  return version;
}

export function readAppVersion(repositoryRoot = process.cwd()) {
  const packagePath = join(resolve(repositoryRoot), "package.json");
  let packageJson;
  try {
    packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${packagePath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!isNumericAppVersion(packageJson.version)) {
    throw new Error(
      `package.json must contain a numeric MAJOR.MINOR.PATCH version; received ${String(packageJson.version ?? "missing")}.`,
    );
  }
  const root = resolve(repositoryRoot);
  for (const workspace of packageJson.workspaces ?? []) {
    if (JSON.parse(readFileSync(join(root, workspace, "package.json"), "utf8")).version !== packageJson.version) throw new Error("Workspace manifest versions must match the root release.");
  }
  return validateVersionMetadata(
    packageJson,
    JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")),
  );
}
