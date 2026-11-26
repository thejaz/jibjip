import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readAppVersion } from "../scripts/app-version.mjs";
import { validatePublicReleaseCandidate } from "../scripts/verify_public_release.mjs";

const APP_VERSION = readAppVersion(process.cwd());

function writeCandidate(directory, profile = "public") {
  const files = {
    "index.html": "jibjip",
    "app/index.html": "jibjip app",
    "about/index.html": "jibjip about",
    "manifest-android.webmanifest": "{}",
    "manifest.webmanifest": "{}",
    "sw.js": "self.addEventListener('fetch', () => undefined);",
    "brand/jibjip-icon.svg": "<svg></svg>",
    "build-profile.json": JSON.stringify({ profile, appVersion: APP_VERSION }),
    "assets/app.js": "console.log('jibjip');",
    "assets/app.css": "body {}",
  };

  for (const [relativePath, contents] of Object.entries(files)) {
    const destination = join(directory, relativePath);
    mkdirSync(join(destination, ".."), { recursive: true });
    writeFileSync(destination, contents);
  }
  for (const wordmark of ["jibjip-type-en.svg", "jibjip-type-fa.svg"]) {
    const destination = join(directory, "brand", wordmark);
    copyFileSync(join(process.cwd(), "packages", "core", "assets", "brand", wordmark), destination);
  }
  copyFileSync(join(process.cwd(), "LICENSE"), join(directory, "LICENSE.txt"));
  mkdirSync(join(directory, "audio"), { recursive: true });
  copyFileSync(join(process.cwd(), "packages", "core", "assets", "audio", "chick.mp3"), join(directory, "audio", "chick.mp3"));
  const starterDestination = join(directory, "data", "jibjip-starter-seed.json");
  mkdirSync(join(starterDestination, ".."), { recursive: true });
  copyFileSync(
    join(process.cwd(), "packages", "core", "assets", "data", "jibjip-starter-seed.json"),
    starterDestination,
  );
}

test("a public candidate with the approved reference-only setup seed passes validation", (t) => {
  const root = mkdtempSync(join(tmpdir(), "jibjip-public-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeCandidate(root);
  mkdirSync(join(root, "fonts"));
  for (const font of ["Estedad-Variable.woff2", "Estedad-OFL.txt"]) {
    copyFileSync(join(process.cwd(), "packages", "core", "assets", "fonts", font), join(root, "fonts", font));
  }
  assert.doesNotThrow(() => validatePublicReleaseCandidate(root));
});

test("a personal-profile candidate is rejected", (t) => {
  const root = mkdtempSync(join(tmpdir(), "jibjip-public-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeCandidate(root, "personal");

  assert.throws(
    () => validatePublicReleaseCandidate(root),
    /not a public build/,
  );
});

test("a public release must include its separate application entry point", (t) => {
  const root = mkdtempSync(join(tmpdir(), "jibjip-public-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeCandidate(root);
  rmSync(join(root, "app", "index.html"));
  assert.throws(() => validatePublicReleaseCandidate(root), /missing app\/index.html/);
});

test("a public candidate cannot omit or replace the canonical license", (t) => {
  const root = mkdtempSync(join(tmpdir(), "jibjip-public-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeCandidate(root);
  rmSync(join(root, "LICENSE.txt"));
  assert.throws(() => validatePublicReleaseCandidate(root), /missing LICENSE.txt/);
  writeFileSync(join(root, "LICENSE.txt"), "An altered license notice");
  assert.throws(() => validatePublicReleaseCandidate(root), /license does not match/);
});

test("a public candidate with a modified starter is rejected", (t) => {
  const root = mkdtempSync(join(tmpdir(), "jibjip-public-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeCandidate(root);
  writeFileSync(join(root, "data", "jibjip-starter-seed.json"), "{}");

  assert.throws(
    () => validatePublicReleaseCandidate(root),
    /starter does not match the approved synthetic seed/,
  );
});

test("a release identity with a mismatched app version is rejected", (t) => {
  const root = mkdtempSync(join(tmpdir(), "jibjip-public-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeCandidate(root);
  writeFileSync(
    join(root, "release.json"),
    JSON.stringify({ product: "jibjip", profile: "public", version: "9.9.9" }),
  );

  assert.throws(
    () => validatePublicReleaseCandidate(root),
    /version does not match the build profile/,
  );
});

test("a public candidate containing other data is rejected", (t) => {
  const root = mkdtempSync(join(tmpdir(), "jibjip-public-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeCandidate(root);
  writeFileSync(join(root, "data", "private.json"), "{}");

  assert.throws(
    () => validatePublicReleaseCandidate(root),
    /forbidden file data\/private\.json/,
  );
});

test("a public candidate containing a credential file is rejected", (t) => {
  const root = mkdtempSync(join(tmpdir(), "jibjip-public-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeCandidate(root);
  writeFileSync(join(root, ".env.production"), "EXAMPLE=synthetic");

  assert.throws(
    () => validatePublicReleaseCandidate(root),
    /forbidden file \.env\.production/,
  );
});

test("a public candidate containing server configuration is rejected", (t) => {
  const root = mkdtempSync(join(tmpdir(), "jibjip-public-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeCandidate(root);
  writeFileSync(join(root, ".htaccess"), "Require valid-user");

  assert.throws(
    () => validatePublicReleaseCandidate(root),
    /forbidden file \.htaccess/,
  );
});

for (const path of ["records.json", "transactions.csv", "personal.local.md", "assets/records.json", "app/private.html", "browser.sqlite", "CHANGELOG.md", "changelog.md"]) {
  test(`a public candidate rejects unexpected payload ${path}`, (t) => {
    const root = mkdtempSync(join(tmpdir(), "jibjip-public-release-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    writeCandidate(root);
    writeFileSync(join(root, path), "synthetic");
    assert.throws(() => validatePublicReleaseCandidate(root), /unexpected file/);
  });
}

test("a linked directory cannot bypass release file inspection", (t) => {
  const root = mkdtempSync(join(tmpdir(), "jibjip-public-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeCandidate(root);
  symlinkSync(join(root, "assets"), join(root, "linked-assets"), "junction");
  assert.throws(() => validatePublicReleaseCandidate(root), /filesystem links/);
});
