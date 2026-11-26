import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";

const key = "jibjip.website.statistics.v1";
const legacyKey = "jibjip.website.analytics.v1";
const source = stripTypeScriptTypes(readFileSync("apps/web/analytics.ts", "utf8")
  .replace('import "./analytics.css";', "").replace("export function", "function"));

function page({ origin = "https://jibjip.com", pathname = "/", saved = null, legacy = null, storageFails = false } = {}) {
  const events = new Map();
  const nodes = [];
  const writes = [];
  const data = new Map([[key, saved], [legacyKey, legacy]]);
  let reloads = 0;
  class Element {
    children = []; handlers = new Map(); attributes = new Map(); hidden = false; textContent = "";
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    setAttribute(name, value) { this.attributes.set(name, value); }
    addEventListener(name, handler) { this.handlers.set(name, handler); }
    focus() { this.focused = true; }
    click() { this.handlers.get("click")?.(); }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
  }
  const document = {
    head: new Element(), body: new Element(), documentElement: { lang: "en" },
    getElementById() { return this.body; },
    createElement(tag) { const element = new Element(); element.tag = tag; nodes.push(element); return element; },
    get cookie() { return "_ga=synthetic; _ga_SYNTHETIC=synthetic; unrelated=keep"; },
    set cookie(value) { writes.push(value); },
  };
  const window = { addEventListener(name, handler) { events.set(name, handler); } };
  Object.defineProperty(window, "indexedDB", { get() { throw new Error("Financial storage must not be accessed."); } });
  let languageChange;
  runInNewContext(source + "\nsetupHomepageAnalytics();", {
    document, window, location: { origin, pathname, reload() { reloads++; }, search: "?note=synthetic-private", hash: "#synthetic-private" },
    localStorage: {
      getItem(name) { if (storageFails) throw Error("blocked"); return data.get(name) ?? null; },
      setItem(name, value) { if (storageFails) throw Error("blocked"); data.set(name, value); },
    },
    MutationObserver: class { constructor(callback) { languageChange = callback; } observe() {} },
  });
  return {
    document, window, writes, data, nodes, events,
    get reloads() { return reloads; },
    scripts() { return document.head.children.filter(node => node.tag === "script"); },
    click(text) { const button = nodes.find(node => node.tag === "button" && !node.hidden && node.textContent === text); assert.ok(button, text); button.click(); },
    setLanguage(locale) { document.documentElement.lang = locale; languageChange(); },
  };
}

test("cookieless homepage statistics start automatically for new and previously consenting visitors", () => {
  for (const options of [{}, { saved: "granted" }, { legacy: "granted" }]) {
    const context = page(options);
    assert.equal(context.scripts().length, 1);
    assert.equal(context.window.dataLayer, undefined);
    assert.equal(context.nodes.some(node => node.tag === "button" && !node.hidden && /Allow|No thanks/.test(node.textContent)), false);
  }
});

test("previous refusals and corrupt or unreadable preferences remain untracked", () => {
  for (const options of [{ saved: "denied" }, { legacy: "denied" }, { saved: "unexpected" }, { storageFails: true }]) {
    const context = page(options);
    assert.equal(context.scripts().length, 0);
    assert.equal(context.window.dataLayer, undefined);
  }
});

test("no statistics, cookie changes, or financial storage access on app and local origins", () => {
  for (const options of [{ origin: "http://localhost:4318" }, { origin: "http://localhost:3000" }, { pathname: "/app/" }, { pathname: "/wallet/synthetic" }, { pathname: "/index.html" }]) {
    const context = page({ ...options, saved: "granted" });
    assert.equal(context.document.head.children.length, 0);
    assert.equal(context.document.body.children.length, 0);
    assert.equal(context.writes.length, 0);
  }
});

test("one asynchronous manual beacon measures the homepage with SPA collection disabled", () => {
  const context = page();
  const [script] = context.scripts();
  assert.equal(context.scripts().length, 1);
  assert.equal(script.src, "https://static.cloudflareinsights.com/beacon.min.js");
  assert.equal(script.type, "module");
  assert.equal(script.async, true);
  assert.equal(script.referrerPolicy, "no-referrer");
  assert.deepEqual(JSON.parse(script.attributes.get("data-cf-beacon")), {
    token: "4361015c39ec41d8b26cc3fde22ab7b9", spa: false,
  });
  assert.equal(context.data.get(key), null); // Default measurement does not write a preference.
  assert.equal(context.window.gtag, undefined);
});

test("only former GA cookies are retired; statistics write no cookies or unrelated preferences", () => {
  const context = page({ saved: "granted", legacy: "granted" });
  assert.equal(context.scripts().length, 1);
  assert.ok(context.writes.length > 0);
  assert.ok(context.writes.every(value => /^(?:_ga|_ga_SYNTHETIC)=; max-age=0;/.test(value)));
  assert.equal(context.data.get(legacyKey), "granted");
  assert.equal(context.data.size, 2);
});

test("older tabs can revoke without reload or silently enabling collection", () => {
  const off = page({ saved: "denied" });
  off.events.get("storage")?.({ key, newValue: "granted" });
  assert.equal(off.scripts().length, 0);
  for (const event of [{ key, newValue: "denied" }, { key: legacyKey, newValue: "denied" }, { key: null, newValue: null }]) {
    const context = page();
    context.events.get("storage")(event);
    assert.equal(context.scripts().length, 0);
    assert.ok(context.document.head.children.some(node => node.tag === "meta"));
    assert.equal(context.reloads, 0);
  }
});

test("measurement creates no disclosure, controls, or preference writes", () => {
  const context = page();
  assert.equal(context.document.body.children.length, 0);
  assert.equal(context.nodes.some(node => !["script", "meta"].includes(node.tag)), false);
  assert.equal(context.data.get(key), null);
  const oldAbout = page({ pathname: "/about/" });
  assert.equal(oldAbout.scripts().length, 0);
  assert.equal(oldAbout.writes.length, 0);
});
