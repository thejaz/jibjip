/* eslint-disable @typescript-eslint/no-explicit-any -- Isolated browser clock doubles. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";

const source = stripTypeScriptTypes(readFileSync("packages/core/src/lib/local-day.ts", "utf8"))
  .replace(/^import .*;\n/gm, "").replace(/^export /gm, "") + ";globalThis.subscribe = subscribeLocalDay;";
function fixture() {
  let now = new Date(2026, 9, 18, 23, 59).getTime();
  const window = new EventTarget() as any;
  const document = new EventTarget() as any;
  document.visibilityState = "visible";
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let id = 0;
  window.setTimeout = (callback: () => void, delay: number) => { timers.set(++id, {callback, delay}); return id; };
  window.clearTimeout = (key: number) => timers.delete(key);
  const Clock = new Proxy(Date, {construct: (target, args) => Reflect.construct(target, args.length ? args : [now])});
  const context = {window, document, Date: Clock, Set, localDate: () => new Date(now).toDateString()} as any;
  runInNewContext(source, context);
  return {window, document, timers, subscribe: context.subscribe as (callback: () => void) => () => void,
    advance: (milliseconds: number) => { now += milliseconds; }};
}

test("one midnight timer refreshes every subscriber and cleans up after the last", () => {
  const f = fixture(); let notifications = 0;
  const first = f.subscribe(() => notifications++);
  const second = f.subscribe(() => notifications++);
  assert.equal(f.timers.size, 1);
  const timer = [...f.timers.values()][0];
  assert.equal(timer.delay, 60_050);
  f.advance(timer.delay); timer.callback();
  assert.equal(notifications, 2);
  assert.equal(f.timers.size, 1);
  first(); assert.equal(f.timers.size, 1);
  second(); assert.equal(f.timers.size, 0);
  f.advance(86_400_000); f.window.dispatchEvent(new Event("focus"));
  assert.equal(notifications, 2);
});

test("foreground catches suspended or adjusted clocks without noisy same-day notifications", () => {
  const f = fixture(); let notifications = 0;
  const stop = f.subscribe(() => notifications++);
  f.window.dispatchEvent(new Event("focus")); assert.equal(notifications, 0);
  f.document.visibilityState = "hidden";
  f.advance(2 * 86_400_000);
  f.document.dispatchEvent(new Event("visibilitychange")); assert.equal(notifications, 0);
  f.document.visibilityState = "visible";
  f.document.dispatchEvent(new Event("visibilitychange")); assert.equal(notifications, 1);
  f.advance(-86_400_000); f.window.dispatchEvent(new Event("focus")); assert.equal(notifications, 2);
  stop();
});
