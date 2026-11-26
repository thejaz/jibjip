import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { LOGO_HOLD_MS, LogoSound } from "../packages/core/src/lib/logo-sound.ts";

const settle = () => new Promise<void>(resolve => setImmediate(resolve));

function fixture(t: TestContext, options: { delayed?: boolean; blocked?: boolean; failedFetch?: boolean; protectedHost?: boolean } = {}) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const sources: { loop: boolean; stopped: number; disconnected: number; onended: (() => void) | null; start(): void; stop(): void; disconnect(): void; connect(): void }[] = [];
  let contexts = 0, requests = 0, resumes = 0, closed = false;
  let decode: ((buffer: AudioBuffer) => void) | undefined;
  const sample = { duration: 0.8 } as AudioBuffer;
  const context = {
    state: "suspended",
    destination: {},
    async resume() { resumes++; if (options.blocked) throw new Error("Blocked"); context.state = "running"; },
    async close() { closed = true; context.state = "closed"; },
    decodeAudioData: () => options.delayed ? new Promise<AudioBuffer>(resolve => { decode = resolve; }) : Promise.resolve(sample),
    createBufferSource() {
      const source = { loop: false, stopped: 0, disconnected: 0, onended: null,
        start() {}, connect() {}, stop() { source.stopped++; }, disconnect() { source.disconnected++; } };
      sources.push(source);
      return source;
    },
  };
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    requests++;
    if (url !== "/audio/chick.mp3") return new Response(null, { status: 404 });
    if (options.protectedHost && init?.credentials !== "same-origin") return new Response(null, { status: 401 });
    return new Response(new Uint8Array([1, 2, 3]), { status: options.failedFetch ? 503 : 200 });
  });
  const player = new LogoSound(() => { contexts++; return context as unknown as AudioContext; });
  t.after(() => player.dispose());
  return { player, sources, options, resolveDecode: () => decode?.(sample),
    stats: () => ({ contexts, requests, resumes, closed }) };
}

test("short activation stays silent and never fetches the sample", async t => {
  const f = fixture(t);
  assert.equal(f.stats().contexts, 0);
  f.player.begin();
  t.mock.timers.tick(LOGO_HOLD_MS - 1);
  assert.equal(f.player.end(), false);
  t.mock.timers.tick(LOGO_HOLD_MS * 2);
  await settle();
  assert.equal(f.sources.length, 0);
  assert.equal(f.stats().requests, 0);
});

test("a full hold starts one looping voice and release preserves its current playback", async t => {
  const f = fixture(t);
  f.player.begin();
  await settle();
  t.mock.timers.tick(LOGO_HOLD_MS);
  await settle();
  assert.equal(f.sources.length, 1);
  assert.equal(f.sources[0].loop, true);
  f.player.begin(); // Repeated input cannot create another timer or voice.
  assert.equal(f.player.end(), true);
  assert.equal(f.sources[0].loop, false);
  assert.equal(f.sources[0].stopped, 0);
  assert.equal(f.sources[0].disconnected, 0);
  f.sources[0].onended?.();
  assert.equal(f.sources[0].disconnected, 1);
});

test("a released hold cannot start after slow decoding finishes", async t => {
  const f = fixture(t, { delayed: true });
  f.player.begin(); await settle();
  t.mock.timers.tick(LOGO_HOLD_MS); await settle();
  assert.equal(f.player.end(), true);
  f.resolveDecode(); await settle();
  assert.equal(f.sources.length, 0);
});

test("the bundled sound remains available behind same-origin hosting authentication", async t => {
  const f = fixture(t, { protectedHost: true });
  f.player.begin(); await settle(); t.mock.timers.tick(LOGO_HOLD_MS); await settle();
  assert.equal(f.sources.length, 1);
  assert.equal(f.sources[0].loop, true);
});

test("a new hold gets a complete delay and reuses the decoded local sample", async t => {
  const f = fixture(t);
  f.player.begin(); await settle(); t.mock.timers.tick(LOGO_HOLD_MS); await settle();
  f.player.end(); f.sources[0].onended?.();
  f.player.begin(); await settle();
  t.mock.timers.tick(LOGO_HOLD_MS - 1); await settle();
  assert.equal(f.sources.length, 1);
  t.mock.timers.tick(1); await settle();
  assert.equal(f.sources.length, 2);
  assert.equal(f.stats().requests, 1);
});

test("blocked audio and missing assets fail silently and can be retried", async t => {
  const f = fixture(t, { blocked: true, failedFetch: true });
  f.player.begin(); await settle(); t.mock.timers.tick(LOGO_HOLD_MS); await settle(); f.player.end();
  assert.equal(f.sources.length, 0); assert.equal(f.stats().requests, 0);
  f.options.blocked = false;
  f.player.begin(); await settle(); t.mock.timers.tick(LOGO_HOLD_MS); await settle(); f.player.end();
  assert.equal(f.sources.length, 0); assert.equal(f.stats().requests, 1);
  f.options.failedFetch = false;
  f.player.begin(); await settle(); t.mock.timers.tick(LOGO_HOLD_MS); await settle();
  assert.equal(f.sources.length, 1); assert.equal(f.stats().requests, 2);
});

test("disposal prevents pending starts and releases the owned audio resources", async t => {
  const f = fixture(t);
  f.player.begin(); await settle(); t.mock.timers.tick(LOGO_HOLD_MS); await settle();
  f.player.dispose();
  assert.equal(f.sources[0].loop, false);
  assert.equal(f.sources[0].stopped, 1);
  assert.equal(f.stats().closed, true);
  f.player.begin(); t.mock.timers.tick(LOGO_HOLD_MS); await settle();
  assert.equal(f.sources.length, 1);
});
