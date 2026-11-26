/* eslint-disable @typescript-eslint/no-explicit-any -- Isolated browser event doubles. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
const source = stripTypeScriptTypes(readFileSync("packages/core/src/lib/offline.ts", "utf8")).replace(/^import .*;\n/gm, "").replace(/^export /gm, "") + ';globalThis.api = {registerOfflineShell, getOfflineStatus, checkOfflineUpdates, installApp, protectOfflineStorage};';
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
function fixture(failFirst = false) {
  const window = new EventTarget() as any;
  const document = new EventTarget() as any;
  const media = new EventTarget() as any;
  const worker = new EventTarget() as any;
  const registration = new EventTarget() as any;
  const serviceWorker = new EventTarget() as any;
  let registrations = 0;
  let updates = 0;
  let failUpdates = false;
  let forced = 0;
  media.matches = false;
  window.matchMedia = () => media;
  window.isSecureContext = true;
  window.setInterval = () => 1;
  window.location = {reload: () => forced++};
  document.visibilityState = "visible";
  worker.state = "activated";
  worker.postMessage = () => forced++;
  registration.active = worker;
  registration.waiting = null;
  registration.installing = null;
  registration.update = async () => { updates++; if (failUpdates) throw Error("Disconnected"); };
  serviceWorker.register = async () => { registrations++; if (failFirst && registrations === 1) throw Error("Unavailable"); return registration; };
  const navigator = {onLine: true, serviceWorker, storage: {persisted: async () => false, persist: async () => false}};
  const context = {window, document, navigator, runtimeProfile: () => "public", Set, WeakSet, Date, Promise} as any;
  runInNewContext(source, context);
  return {api: context.api, window, document, media, navigator, registration, worker, counts: () => ({registrations, updates, forced}), failUpdates: () => failUpdates = true};
}
test("registration is idempotent and waits safely without forcing activation or reloading", async () => {
  const f = fixture(); f.api.registerOfflineShell(); f.api.registerOfflineShell(); await flush();
  assert.equal(f.counts().registrations, 1);
  assert.equal(f.api.getOfflineStatus().ready, true);
  f.registration.waiting = f.worker;
  f.registration.dispatchEvent(new Event("updatefound"));
  assert.equal(f.api.getOfflineStatus().waiting, true);
  assert.equal(f.counts().forced, 0);
});
test("offline/online transitions retry checks and a failed update preserves readiness", async () => {
  const f = fixture(); f.api.registerOfflineShell(); await flush();
  f.navigator.onLine = false; f.window.dispatchEvent(new Event("offline"));
  await f.api.checkOfflineUpdates(true);
  assert.equal(f.api.getOfflineStatus().online, false);
  const before = f.counts().updates;
  f.navigator.onLine = true; f.window.dispatchEvent(new Event("online")); await flush();
  assert.equal(f.counts().updates, before + 1);
  f.failUpdates(); await f.api.checkOfflineUpdates(true);
  assert.equal(f.api.getOfflineStatus().failed, true);
  assert.equal(f.api.getOfflineStatus().ready, true);
  assert.equal(f.api.getOfflineStatus().checking, false);
});
test("a failed first registration recovers and continues observing installation states", async () => {
  const f = fixture(true); f.api.registerOfflineShell(); await flush();
  assert.equal(f.api.getOfflineStatus().failed, true);
  await f.api.checkOfflineUpdates(true);
  assert.equal(f.api.getOfflineStatus().ready, true);
  const installing = new EventTarget() as any;
  installing.state = "installing"; f.registration.installing = installing;
  f.registration.dispatchEvent(new Event("updatefound"));
  assert.equal(f.api.getOfflineStatus().checking, true);
  installing.state = "redundant"; f.registration.installing = null; installing.dispatchEvent(new Event("statechange"));
  assert.equal(f.api.getOfflineStatus().failed, true);
  assert.equal(f.api.getOfflineStatus().checking, false);
});
test("install prompt is user initiated, consumed once, and installation updates the UI", async () => {
  const f = fixture(); f.api.registerOfflineShell(); await flush();
  let prompts = 0;
  const event = new Event("beforeinstallprompt", {cancelable: true}) as any;
  event.prompt = async () => { prompts++; return {outcome: "dismissed"}; };
  f.window.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(prompts, 0);
  assert.equal(f.api.getOfflineStatus().canInstall, true);
  assert.equal(await f.api.installApp(), "dismissed");
  assert.equal(await f.api.installApp(), "unavailable");
  assert.equal(prompts, 1);
  f.window.dispatchEvent(new Event("appinstalled"));
  assert.equal(f.api.getOfflineStatus().installed, true);
  assert.equal(f.api.getOfflineStatus().canInstall, false);
});

test("download progress lasts until the worker finishes and a repeated check cannot hide it", async () => {
  const f = fixture(); f.api.registerOfflineShell(); await flush();
  const next = new EventTarget() as any;
  next.state = "installing"; f.registration.installing = next;
  f.registration.dispatchEvent(new Event("updatefound"));
  assert.equal(f.api.getOfflineStatus().downloading, true);
  await f.api.checkOfflineUpdates(true);
  assert.equal(f.api.getOfflineStatus().checking, true);
  f.registration.installing = null; f.registration.waiting = next;
  next.state = "installed"; next.dispatchEvent(new Event("statechange"));
  assert.equal(f.api.getOfflineStatus().downloading, false);
  assert.equal(f.api.getOfflineStatus().checking, false);
  assert.equal(f.api.getOfflineStatus().waiting, true);
  assert.equal(f.counts().forced, 0);
});

test("a failed install prompt is reported without claiming installation or losing offline readiness", async () => {
  const f = fixture(); f.api.registerOfflineShell(); await flush();
  const event = new Event("beforeinstallprompt", {cancelable: true}) as any;
  event.prompt = async () => { throw Error("Browser refused"); };
  f.window.dispatchEvent(event);
  assert.equal(await f.api.installApp(), "failed");
  assert.equal(f.api.getOfflineStatus().installed, false);
  assert.equal(f.api.getOfflineStatus().ready, true);
  assert.equal(f.api.getOfflineStatus().canInstall, false);
});
test("declined persistent storage is disclosed without preventing offline use", async () => {
  const f = fixture(); f.api.registerOfflineShell(); await flush();
  await f.api.protectOfflineStorage();
  assert.equal(f.api.getOfflineStatus().persistent, false);
  assert.equal(f.api.getOfflineStatus().protectionRequested, true);
  assert.equal(f.api.getOfflineStatus().ready, true);
});
test("the activated worker clears downloading status even before the registration pointer settles", async () => {
  const f = fixture();
  f.registration.installing = f.worker;
  f.api.registerOfflineShell(); await flush();
  assert.equal(f.api.getOfflineStatus().ready, true);
  assert.equal(f.api.getOfflineStatus().checking, false);
});
test("initial installation cannot leave a completed check promise blocking future checks", async () => {
  const f = fixture();
  f.worker.state = "installing";
  f.registration.active = null;
  f.registration.installing = f.worker;
  f.api.registerOfflineShell(); await flush();
  assert.equal(f.api.getOfflineStatus().checking, true);
  f.worker.state = "activated";
  f.registration.active = f.worker;
  f.worker.dispatchEvent(new Event("statechange"));
  f.registration.installing = null;
  assert.equal(f.api.getOfflineStatus().ready, true);
  assert.equal(f.api.getOfflineStatus().checking, false);
  await f.api.checkOfflineUpdates(true);
  assert.equal(f.counts().updates, 1);
});
