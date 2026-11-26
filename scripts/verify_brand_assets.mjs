import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BRAND_WORDMARK_PATHS = [
  "packages/core/assets/brand/jibjip-type-en.svg",
  "packages/core/assets/brand/jibjip-type-fa.svg",
];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function brandAssetFingerprint(repositoryRoot) {
  const hash = createHash("sha256");
  for (const relativePath of BRAND_WORDMARK_PATHS) {
    hash.update(relativePath);
    hash.update(readFileSync(join(repositoryRoot, relativePath)));
  }
  return hash.digest("hex").slice(0, 16);
}

function assertWordmark(path, label) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`${label} is missing: ${path}`);
  }

  const source = readFileSync(path, "utf8");
  if (!/<svg\b/i.test(source) || !/\bviewBox\s*=/i.test(source)) {
    throw new Error(`${label} is not a usable SVG with a viewBox: ${path}`);
  }
  if (/<text\b/i.test(source)) {
    throw new Error(`${label} must contain outlined/path artwork, not live text: ${path}`);
  }
}

/** @param {string} repositoryRoot @param {string | null} [outputRoot] */
export function verifyBrandAssets(repositoryRoot, outputRoot = null) {
  const sourceHashes = new Map();

  for (const relativePath of BRAND_WORDMARK_PATHS) {
    const sourcePath = join(repositoryRoot, relativePath.replaceAll("/", "/"));
    const label = relativePath.endsWith("-fa.svg") ? "Farsi wordmark" : "English wordmark";
    assertWordmark(sourcePath, label);
    sourceHashes.set(relativePath, sha256(sourcePath));

    if (outputRoot) {
      const outputPath = join(outputRoot, relativePath.replace(/^packages\/core\/assets\//, ""));
      assertWordmark(outputPath, `Built ${label.toLowerCase()}`);
      const outputHash = sha256(outputPath);
      if (outputHash !== sourceHashes.get(relativePath)) {
        throw new Error(
          `${relativePath} in the build does not match the source asset. ` +
          `Expected ${sourceHashes.get(relativePath)}, received ${outputHash}.`,
        );
      }
    }
  }

  return Object.fromEntries(sourceHashes);
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const repositoryRoot = resolve(dirname(scriptPath), "..");
  const outputRoot = process.argv[2] ? resolve(process.argv[2]) : null;
  const hashes = verifyBrandAssets(repositoryRoot, outputRoot);
  console.log(`Brand assets verified: ${JSON.stringify(hashes)}`);
}
