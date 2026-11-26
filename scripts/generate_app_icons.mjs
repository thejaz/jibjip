import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Artwork maintenance only: use an existing Sharp installation, never a runtime dependency.
const args = process.argv.slice(2);
const sharpArgument = args.indexOf("--sharp");
const sharp = createRequire(import.meta.url)(sharpArgument < 0 ? "sharp" : resolve(args[sharpArgument + 1]));
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = resolve(root, "packages/core/assets");
const check = args.includes("--check");
const outputs = new Map();
const source = await sharp(resolve(assets, "brand/jibjip-icon.svg"), { density: 288 })
  .ensureAlpha().trim().png().toBuffer();
const { data, info } = await sharp(source).raw().toBuffer({ resolveWithObject: true });
let radius = 0;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3]) {
      radius = Math.max(radius, Math.hypot(x + 0.5 - info.width / 2, y + 0.5 - info.height / 2));
    }
  }
}
assert.ok(radius > 0, "The canonical logo must contain visible artwork.");

async function icon(size, purpose) {
  // Maskable artwork fits within the standard 40% radius, with a small rasterization margin.
  const scale = purpose === "maskable" ? size * 0.32 / radius
    : size * (purpose === "apple" ? 0.78 : purpose === "android" ? 0.76 : purpose === "favicon" ? 0.98 : 0.92) / Math.max(info.width, info.height);
  const mark = await sharp(source).resize(Math.floor(info.width * scale), Math.floor(info.height * scale)).png().toBuffer();
  const transparent = purpose === "any" || purpose === "favicon";
  return sharp({ create: { width: size, height: size, channels: 4,
    background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : "#fbfaf3" } })
    .composite([{ input: mark, gravity: "centre" }]).png().toBuffer();
}

for (const [name, size, purpose] of [
  ["android-icon-192.png", 192, "android"], ["android-icon-512.png", 512, "android"],
  ["icon-192.png", 192, "any"], ["icon-512.png", 512, "any"],
  ["maskable-icon-512.png", 512, "maskable"], ["apple-touch-icon.png", 180, "apple"],
]) outputs.set(`icons/${name}`, await icon(size, purpose));

// ICO supports PNG frames; keep the three declared favicon sizes in one transparent file.
const sizes = [16, 32, 48];
const frames = await Promise.all(sizes.map(size => icon(size, "favicon")));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
frames.forEach((frame, i) => {
  const entry = 6 + i * 16;
  header[entry] = sizes[i]; header[entry + 1] = sizes[i];
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
outputs.set("favicon.ico", Buffer.concat([header, ...frames]));

const urlFor = path => `/${path}?v=${createHash("sha256").update(outputs.get(path)).digest("hex").slice(0, 12)}`;
const manifest = JSON.parse(readFileSync(resolve(assets, "manifest.webmanifest"), "utf8"));
for (const entry of manifest.icons) {
  const path = entry.src.split("?")[0].slice(1);
  assert.ok(outputs.has(path), `Unknown installation icon: ${path}`);
  entry.src = urlFor(path);
}
outputs.set("manifest.webmanifest", Buffer.from(JSON.stringify(manifest, null, 2) + "\n"));
const androidManifest = structuredClone(manifest);
for (const entry of androidManifest.icons) {
  if (entry.purpose === "any") entry.src = urlFor(`icons/android-icon-${entry.sizes.split("x")[0]}.png`);
}
outputs.set("manifest-android.webmanifest", Buffer.from(JSON.stringify(androidManifest, null, 2) + "\n"));
for (const path of ["apps/web/index.html", "apps/web/app/index.html", "apps/web/about/index.html"]) {
  const html = readFileSync(resolve(root, path), "utf8")
    .replace(/href="\/favicon\.ico(?:\?[^\"]*)?"/, `href="${urlFor("favicon.ico")}"`)
    .replace(/href="\/icons\/apple-touch-icon\.png(?:\?[^\"]*)?"/, `href="${urlFor("icons/apple-touch-icon.png")}"`);
  outputs.set(resolve(root, path), Buffer.from(html));
}
for (const [path, bytes] of outputs) {
  const destination = resolve(assets, path);
  if (check) assert.ok(readFileSync(destination).equals(bytes), `Regenerate ${path}`);
  else writeFileSync(destination, bytes);
}
console.log(`${check ? "Verified" : "Generated"} installation icons, favicon, and content-versioned references from the canonical logo.`);
