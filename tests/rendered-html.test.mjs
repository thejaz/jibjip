import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

for (const entry of ["index.html", "app/index.html", "about/index.html"]) {
  test(`the static ${entry} entry preserves metadata and loads only local assets`, () => {
    const html = readFileSync(`work/public-candidate/${entry}`, "utf8");
    assert.match(html, /<title>JIBJIP \| YOUR MONEY, YOURS!<\/title>/);
    assert.match(html, /name="application-name" content="JIBJIP"/);
    assert.match(html, /name="apple-mobile-web-app-title" content="JIBJIP"/);
    assert.match(html, /name="description"/);
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1.0"/);
    assert.match(html, /rel="manifest"/);
    assert.match(html, /type="module"[^>]+src="\/assets\//);
    assert.doesNotMatch(html, /(?:src|href)="https?:/);
    assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
  });
}

test("both built stylesheets retain Safari 15 phone breakpoints and container-query fallbacks", () => {
  const publicCss = readdirSync("work/public-candidate/assets").filter(name => name.endsWith(".css"))
    .map(name => readFileSync(`work/public-candidate/assets/${name}`, "utf8")).join("\n");
  for (const css of [publicCss, readFileSync("packages/core/dist/style.css", "utf8")]) {
    assert.match(css, /@media\s*\(max-width:\s*820px\)/);
    assert.doesNotMatch(css, /@media[^{}]*[<>]/, "minification must not upgrade phone breakpoints to Safari 16.4 syntax");
    assert.match(css, /@supports not\s*\(container-type:\s*inline-size\)/);
    assert.match(css, /\.transaction-table tbody tr\s*\{[^}]*display:\s*grid/);
    assert.match(css, /\.amount-in-words/);
  }
});

test("the default introduction retains explicit same-origin access to the workspace", () => {
  const home = readFileSync("packages/core/src/components/HomePage.tsx", "utf8");
  assert.match(home, /`\/app\/\?lang=\$\{locale\}`/);
});

test("installation keeps the short app name separate from the page title", () => {
  const manifest = JSON.parse(readFileSync("work/public-candidate/manifest.webmanifest", "utf8"));
  assert.equal(manifest.name, "JIBJIP");
  assert.equal(manifest.short_name, "JIBJIP");
  assert.equal(manifest.start_url, "/app/");
});
