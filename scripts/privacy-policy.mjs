// These checks intentionally report only the rule, never private file contents.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const PRIVATE_MARKERS_PATH = "docs/local/private-markers.txt";

const ROOT_FILES = new Set([
  ".gitattributes", ".gitignore", "AGENTS.md", "CLAUDE.md", "LICENSE", "TRADEMARKS.md", "README.md", "CONTRIBUTING.md",
  "eslint.config.mjs", "package.json", "package-lock.json", "tsconfig.json",
  "vite-env.d.ts", "vite.config.ts", "Open jibjip.cmd",
  "packages/core/package.json", "packages/core/README.md",
  "packages/core/vite.config.ts", "packages/core/tsconfig.build.json",
  "apps/web/package.json", ".github/pull_request_template.md", ".github/workflows/ci.yml",
  ".githooks/pre-commit", ".githooks/pre-push",
  "docs/PRODUCT_RULES.md", "docs/ARCHITECTURE.md", "docs/ROADMAP.md",
  "docs/VERSIONING.md", "docs/OFFLINE.md", "docs/BUGS.md", "docs/RELEASING.md",
]);
const SCRIPTS = new Set([
  "app-version.mjs", "browser-targets.mjs", "audit_data_integrity.mjs", "bump_app_version.mjs",
  "generate_starter_seed.mjs", "generate_app_icons.mjs", "privacy-policy.mjs", "serve_app.py",
  "verify_brand_assets.mjs", "verify_public_release.mjs",
  "verify_repository_privacy.mjs", "verify_staged_version.mjs", "release.mjs",
  "benchmark_app.mjs", "benchmark_clarity.mjs",
  "prepare_core_package.mjs", "verify_core_package.mjs", "build_local_runtime.ps1", "check_documentation.py",
  "recycle_workspace.ps1",
]);
const ASSETS = new Set([
  "brand/jibjip-icon.svg", "brand/jibjip-type-en.svg", "brand/jibjip-type-fa.svg",
  "favicon.ico", "og.png", "manifest.webmanifest", "manifest-android.webmanifest", "sw.js", "audio/chick.mp3",
  "fonts/Estedad-OFL.txt", "fonts/Estedad-Variable.woff2",
  "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png",
  "icons/maskable-icon-512.png", "icons/android-icon-192.png", "icons/android-icon-512.png", "data/jibjip-starter-seed.json",
].map((name) => `packages/core/assets/${name}`));
const PRIVATE_TESTS = new Set(["release-workflow.test.mjs"]);

const extension = (path) => path.slice(path.lastIndexOf("."));

/** Whether a repository-relative POSIX path may be tracked and therefore published. */
export function isPublicPath(path) {
  if (typeof path !== "string" || path === "" || path.includes("\\") || path.startsWith("/") || /^[a-z]:/i.test(path)) return false;
  const parts = path.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) return false;
  if (ROOT_FILES.has(path) || ASSETS.has(path)) return true;
  const direct = parts.length === 2 ? parts[1] : null;
  if (parts[0] === "scripts") return direct !== null && SCRIPTS.has(direct);
  if (path.startsWith("packages/core/src/") || path.startsWith("apps/web/")) {
    return [".ts", ".tsx", ".css", ".html"].includes(extension(path));
  }
  if (parts[0] === "tests") return direct !== null && [".ts", ".mjs"].includes(extension(direct)) && !PRIVATE_TESTS.has(direct);
  return /^docs\/images\/[^/]+\.(png|webp)$/.test(path);
}

export function assertPublicPath(path) {
  if (!isPublicPath(path)) throw new Error(`${path} is not on the public allowlist.`);
}

/** Read the private marker list. Missing files mean no markers unless `required` is set. */
export function loadPrivateMarkers(root, { required = false } = {}) {
  const file = join(root, ...PRIVATE_MARKERS_PATH.split("/"));
  const markers = existsSync(file)
    ? readFileSync(file, "utf8").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"))
    : [];
  if (required && markers.length === 0) {
    throw new Error(`Private markers file ${PRIVATE_MARKERS_PATH} is missing; refusing to publish.`);
  }
  return markers;
}

/** Throws without echoing the marker when any marker appears in the text. */
export function assertNoPrivateMarkers(label, text, markers = []) {
  const lower = String(text).toLowerCase();
  if (markers.some((marker) => marker && lower.includes(marker.toLowerCase()))) {
    throw new Error(`Private marker found in ${label}; contents withheld.`);
  }
}

export function assertReferenceOnlySeed(seed) {
  if (seed?.source?.kind !== "jibjip-starter" || seed.version !== 2) {
    throw new Error("The starter must be a V2 reference-only seed.");
  }
  for (const store of ["wallets", "categories", "transactions", "uncharted"]) {
    if (!Array.isArray(seed[store]) || seed[store].length !== 0) {
      throw new Error("The starter contains personal or sample records.");
    }
  }
  const settings = seed.settings;
  if (settings?.clarity !== undefined && (settings.clarity?.enabled !== true ||
      !Array.isArray(settings.clarity.awards) || settings.clarity.awards.length !== 0)) {
    throw new Error("The starter must use the default Clarity setting without personal progress.");
  }
  if (!settings || settings.setupState !== "uninitialized" ||
      settings.mainWalletId !== null || settings.defaultWalletId !== null ||
      settings.setupDraft !== null || settings.overviewWalletIds !== null ||
      !Array.isArray(settings.overviewPinnedWalletIds) ||
      settings.overviewPinnedWalletIds.some((id) => id !== null) ||
      !Array.isArray(settings.overviewHiddenCurrencies) ||
      settings.overviewHiddenCurrencies.length !== 0 ||
      (settings.chartExcludedCategoryIds !== undefined &&
        (!Array.isArray(settings.chartExcludedCategoryIds) || settings.chartExcludedCategoryIds.length !== 0))) {
    throw new Error("The starter contains personal setup or wallet selections.");
  }
}

export function assertRepositoryFileIsSafe(path, contents, markers = []) {
  const lower = path.toLowerCase();
  if (lower === "changelog.md") {
    throw new Error("The personal changelog must not be tracked or published.");
  }
  if ((lower.startsWith("collaboration/") && lower !== "collaboration/readme.md") ||
      /(^|\/)(exports|work|indexeddb)(\/|$)/.test(lower) ||
      /\.(csv|tsv|xlsx?|sqlite3?|db|ldb|zip|local\.md)$/.test(lower) ||
      /(^|\/)(jibjip|mwatch)-backup[^/]*\.json$/.test(lower)) {
    throw new Error("Private data or local-only artifacts must not be tracked.");
  }
  const text = contents.toString("utf8");
  if (/[a-z]:[\\/]+Users[\\/]+[^\\/\s"']+[\\/]+AppData[\\/]+Local[\\/]+(?:Google[\\/]+Chrome|Microsoft[\\/]+Edge)/i.test(text)) {
    throw new Error("Personal browser storage paths must stay in ignored local notes.");
  }
  if (/[a-z]:[\\/]+(?:Users|wk|zy)[\\/]/i.test(text)) {
    throw new Error(`Workstation path found in ${path}; contents withheld.`);
  }
  if (/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}/.test(text)) {
    throw new Error(`Possible credential found in ${path}; contents withheld.`);
  }
  assertNoPrivateMarkers(path, text, markers);
  assertNoPrivateMarkers("a file path", path, markers);
  if (lower.endsWith(".json") || text.trimStart().startsWith("{")) {
    let value;
    try { value = JSON.parse(text); } catch { return; }
    if (value?.source?.kind === "jibjip-backup") {
      throw new Error("A native Full backup must never be tracked.");
    }
    if (lower === "packages/core/assets/data/jibjip-starter-seed.json") assertReferenceOnlySeed(value);
    else if (["wallets", "transactions", "uncharted"].some((store) =>
      Array.isArray(value?.[store]) && value[store].length > 0)) {
      throw new Error("A financial data snapshot must never be tracked.");
    }
  }
}
