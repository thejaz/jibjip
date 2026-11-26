import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isNumericAppVersion } from "./app-version.mjs";
import { verifyBrandAssets } from "./verify_brand_assets.mjs";
import { assertReferenceOnlySeed } from "./privacy-policy.mjs";

export const PUBLIC_RELEASE_REQUIRED_PATHS = [
  "index.html",
  "app/index.html",
  "about/index.html",
  "manifest-android.webmanifest",
  "manifest.webmanifest",
  "sw.js",
  "LICENSE.txt",
  "brand/jibjip-icon.svg",
  "brand/jibjip-type-en.svg",
  "brand/jibjip-type-fa.svg",
  "build-profile.json",
  "data/jibjip-starter-seed.json",
  "audio/chick.mp3",
];

const APPROVED_STARTER_PATH = "data/jibjip-starter-seed.json";

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Public releases must not contain filesystem links.");
    if (entry.isDirectory()) files.push(...listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function portablePath(root, path) {
  return relative(root, path).split(sep).join("/");
}

export function validatePublicReleaseCandidate(candidateDirectory) {
  if (
    !existsSync(candidateDirectory) ||
    !statSync(candidateDirectory).isDirectory()
  ) {
    throw new Error("The public candidate directory is missing.");
  }

  for (const requiredPath of PUBLIC_RELEASE_REQUIRED_PATHS) {
    if (!existsSync(join(candidateDirectory, requiredPath))) {
      throw new Error(`The public candidate is missing ${requiredPath}.`);
    }
  }

  let buildProfile;
  try {
    buildProfile = JSON.parse(
      readFileSync(join(candidateDirectory, "build-profile.json"), "utf8"),
    );
  } catch {
    throw new Error("The public candidate has an invalid build-profile.json.");
  }
  if (buildProfile?.profile !== "public") {
    throw new Error("The candidate is not a public build.");
  }
  if (!isNumericAppVersion(buildProfile?.appVersion)) {
    throw new Error("The public candidate has an invalid numeric app version.");
  }

  const releaseIdentityPath = join(candidateDirectory, "release.json");
  if (existsSync(releaseIdentityPath)) {
    let releaseIdentity;
    try {
      releaseIdentity = JSON.parse(readFileSync(releaseIdentityPath, "utf8"));
    } catch {
      throw new Error("The public candidate has an invalid release.json.");
    }
    if (
      !isNumericAppVersion(releaseIdentity?.version) ||
      releaseIdentity.version !== buildProfile.appVersion
    ) {
      throw new Error("The release identity version does not match the build profile.");
    }
  }

  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  if (sha256(join(candidateDirectory, "LICENSE.txt")) !== sha256(join(repositoryRoot, "LICENSE"))) {
    throw new Error("The public candidate license does not match the canonical MIT license.");
  }
  verifyBrandAssets(repositoryRoot, candidateDirectory);
  if (sha256(join(candidateDirectory, "audio/chick.mp3")) !== sha256(join(repositoryRoot, "packages/core/assets/audio/chick.mp3"))) {
    throw new Error("The public candidate sound does not match its canonical asset.");
  }
  const approvedStarter = join(repositoryRoot, "packages", "core", "assets", "data", "jibjip-starter-seed.json");
  const candidateStarter = join(candidateDirectory, APPROVED_STARTER_PATH);
  if (sha256(candidateStarter) !== sha256(approvedStarter)) {
    throw new Error("The public candidate starter does not match the approved synthetic seed.");
  }
  assertReferenceOnlySeed(JSON.parse(readFileSync(candidateStarter, "utf8")));

  const files = listFiles(candidateDirectory);
  const relativeFiles = files.map((path) => portablePath(candidateDirectory, path));
  if (!relativeFiles.some((path) => path.startsWith("assets/") && path.endsWith(".js"))) {
    throw new Error("The public candidate contains no JavaScript bundle.");
  }
  if (!relativeFiles.some((path) => path.startsWith("assets/") && path.endsWith(".css"))) {
    throw new Error("The public candidate contains no stylesheet bundle.");
  }

  const forbiddenPath = relativeFiles.find((path) => {
    const lowerPath = path.toLowerCase();
    if (lowerPath === APPROVED_STARTER_PATH) return false;
    const segments = lowerPath.split("/");
    return (
      [
        "data",
        "seed",
        "collaboration",
        "work",
        "node_modules",
        ".git",
        ".agents",
        ".openai",
      ].some((segment) => segments.includes(segment)) ||
      segments.some((segment) => segment.startsWith(".env")) ||
      lowerPath.includes("backup") ||
      lowerPath.endsWith(".map") ||
      lowerPath.endsWith(".xlsx") ||
      lowerPath.endsWith(".xls") ||
      lowerPath.endsWith(".pem") ||
      lowerPath.endsWith(".key") ||
      lowerPath.endsWith(".zip") ||
      lowerPath.endsWith(".htaccess") ||
      lowerPath.endsWith(".htpasswd")
    );
  });
  if (forbiddenPath) {
    throw new Error(`The public candidate contains forbidden file ${forbiddenPath}.`);
  }

  // A denylist alone lets innocently named JSON/CSV/documents slip through.
  const rootFiles = new Set([
    "index.html", "app/index.html", "about/index.html", "manifest-android.webmanifest", "manifest.webmanifest", "sw.js", "build-profile.json",
    "release.json", "favicon.ico", "og.png", "LICENSE.txt", "robots.txt", "sitemap.xml", APPROVED_STARTER_PATH, "audio/chick.mp3",
  ]);
  const unexpected = relativeFiles.find((path) => !rootFiles.has(path) &&
    !/^assets\/[^/]+\.(js|css)$/.test(path) &&
    !/^brand\/jibjip-(icon|type-en|type-fa)\.svg$/.test(path) &&
    !/^fonts\/Estedad-(Variable\.woff2|OFL\.txt)$/.test(path) &&
    !/^icons\/(apple-touch-icon|icon-192|icon-512|maskable-icon-512|android-icon-192|android-icon-512)\.png$/.test(path));
  if (unexpected) throw new Error(`The public candidate contains unexpected file ${unexpected}.`);

  return {
    fileCount: files.length,
    totalBytes: files.reduce((total, path) => total + statSync(path).size, 0),
  };
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const repositoryRoot = resolve(dirname(scriptPath), "..");
  const candidateDirectory = process.argv[2]
    ? resolve(process.argv[2])
    : join(repositoryRoot, "work", "public-candidate");
  validatePublicReleaseCandidate(candidateDirectory);
  console.log("The public candidate contains only the approved reference-only setup seed and is ready for hosting review.");
}
