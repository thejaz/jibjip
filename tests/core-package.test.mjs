import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readAppVersion } from "../scripts/app-version.mjs";

test("the built core can be imported without browser globals or persistence initialization", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, get() { throw new Error("Import touched financial storage"); } });
  try {
    const core = await import("../packages/core/dist/index.js");
    assert.deepEqual(Object.keys(core), ["mountJibjip"]);
    await assert.rejects(core.mountJibjip({ container: null, view: "application", profile: "personal" }), /container/);
    await assert.rejects(core.mountJibjip({ container: { nodeType: 1 }, view: "unknown", profile: "public" }), /view/);
    await assert.rejects(core.mountJibjip({ container: { nodeType: 1 }, view: "application", profile: "unknown" }), /profile/);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "indexedDB", descriptor); else delete globalThis.indexedDB;
  }
});

test("workspace versions and the supported package interface agree", () => {
  const version = readAppVersion();
  const core = JSON.parse(readFileSync("packages/core/package.json", "utf8"));
  const shell = JSON.parse(readFileSync("apps/web/package.json", "utf8"));
  assert.equal(core.version, version);
  assert.equal(shell.version, version);
  assert.equal(core.private, true);
  assert.equal(shell.private, true);
  assert.deepEqual(Object.keys(core.exports), [".", "./style.css", "./assets/*"]);
  assert.match(readFileSync("packages/core/dist/types/index.d.ts", "utf8"), /mountJibjip/);
});
