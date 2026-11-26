import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nextAppVersion, readAppVersion, validateChangelog } from "./app-version.mjs";

/** Plan and validate every output before touching any of the three version files. */
export function bumpAppVersion(root, level, notes, date) {
  const directory = resolve(root);
  const previous = readAppVersion(directory);
  const version = nextAppVersion(previous, level);
  if (!Array.isArray(notes) || notes.length === 0 || notes.some((note) => typeof note !== "string" || !note.trim() || /[\r\n]/.test(note))) {
    throw new Error("Supply at least one nonempty, single-line release note.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error("The release date must be a valid Gregorian YYYY-MM-DD date.");
  }
  const workspacePaths = (JSON.parse(readFileSync(join(directory, "package.json"), "utf8")).workspaces ?? []).map(path => `${path}/package.json`);
  const paths = ["package.json", "package-lock.json", "CHANGELOG.md", ...workspacePaths].map((path) => join(directory, path));
  const originals = paths.map((path, index) => index === 2 && !existsSync(path) ? null : readFileSync(path, "utf8"));
  if (originals[2] !== null) validateChangelog(previous, originals[2]);
  const manifest = JSON.parse(originals[0]);
  const lockfile = JSON.parse(originals[1]);
  manifest.version = version;
  lockfile.version = version;
  lockfile.packages[""].version = version;
  const workspaceOutputs = workspacePaths.map((path, index) => {
    const workspace = JSON.parse(originals[index + 3]);
    workspace.version = version;
    lockfile.packages[path.slice(0, -"/package.json".length)].version = version;
    return JSON.stringify(workspace, null, 2) + "\n";
  });
  const entry = `## ${version} - ${date}\n\n${notes.map((note) => `- ${note.trim()}`).join("\n")}\n\n`;
  const history = originals[2] ?? "# jibjip private version history\n\nLocal personal notes. Do not commit, bundle, or publish without owner approval.\n\n";
  const changelog = /^## /m.test(history) ? history.replace(/^## /m, () => `${entry}## `) : `${history.trimEnd()}\n\n${entry}`;
  const outputs = [JSON.stringify(manifest, null, 2) + "\n", JSON.stringify(lockfile, null, 2) + "\n", changelog, ...workspaceOutputs];
  const written = [];
  const temporary = paths.map((path) => `${path}.version-${randomUUID()}.tmp`);
  try {
    for (let index = 0; index < paths.length; index += 1) writeFileSync(temporary[index], outputs[index], { flag: "wx" });
    for (let index = 0; index < paths.length; index += 1) {
      renameSync(temporary[index], paths[index]);
      written.push(index);
    }
  } catch (error) {
    for (const index of written.reverse()) {
      if (originals[index] === null) { rmSync(paths[index], { force: true }); continue; }
      writeFileSync(temporary[index], originals[index]);
      renameSync(temporary[index], paths[index]);
    }
    throw error;
  } finally {
    for (const path of temporary) rmSync(path, { force: true });
  }
  return { previous, version };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [level, ...args] = process.argv.slice(2);
    let date = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
    const notes = [];
    for (let index = 0; index < args.length; index += 1) {
      if (args[index] === "--date") date = args[++index];
      else notes.push(args[index]);
    }
    const result = bumpAppVersion(process.cwd(), level, notes, date);
    console.log(`jibjip ${result.previous} -> ${result.version}. Review your private CHANGELOG.md, validate, and commit the app files without the changelog.`);
  } catch (error) {
    console.error(`Version update failed: ${error.message}`);
    process.exitCode = 1;
  }
}
