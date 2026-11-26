import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { contrastRatio, DATA_COLORS, tonalBadgeStyle } from "../packages/core/src/lib/colors.ts";
import { categoriesForLocale, mergeCategoryTemplates } from "../packages/core/src/lib/catalogs.ts";

test("currency labels and category glyphs stay black and exceed 7:1 across custom sRGB colors", () => {
  for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
    const background = "#" + [r, g, b].map(value => value.toString(16).padStart(2, "0")).join("");
    const badge = tonalBadgeStyle(background);
    assert.equal(badge.color, "#000000");
    assert.ok(contrastRatio(badge.backgroundColor, badge.color) >= 7, background);
  }
  assert.equal(contrastRatio("#ffffff", "#000000"), 21);
});

test("the shared palette has distinct chart accents and readable opaque badge tones", () => {
  assert.equal(DATA_COLORS.length, 24);
  assert.equal(new Set(DATA_COLORS).size, DATA_COLORS.length);
  assert.equal(new Set(DATA_COLORS.map(color => tonalBadgeStyle(color).backgroundColor)).size, DATA_COLORS.length);
  for (const color of DATA_COLORS) assert.ok(contrastRatio(color, "#fbfaf3") >= 3, color);
  assert.deepEqual(tonalBadgeStyle("invalid"), tonalBadgeStyle("#7A8391"));
});

test("semantic text and primary buttons meet normal-text contrast on their surfaces", () => {
  const css = readFileSync(new URL("../packages/core/src/styles.css", import.meta.url), "utf8");
  const token = (name: string) => css.match(new RegExp(`--${name}: (#[0-9a-f]{6});`, "i"))![1];
  for (const [foreground, background] of [["ink", "paper"], ["muted", "surface"], ["green", "green-soft"], ["red", "red-soft"], ["exchange", "exchange-soft"], ["accent", "accent-soft"]]) {
    assert.ok(contrastRatio(token(foreground), token(background)) >= 4.5, `${foreground} on ${background}`);
  }
  for (const background of ["accent", "green", "green-strong"]) {
    assert.ok(contrastRatio("#ffffff", token(background)) >= 4.5, `white on ${background}`);
  }
  for (const background of ["create-surface", "create-hover"]) {
    assert.ok(contrastRatio(token("green-strong"), token(background)) >= 4.5, `dark green on ${background}`);
  }
  for (const mark of ["chart-income", "chart-expense"]) {
    assert.ok(contrastRatio(token(mark), token("surface")) >= 3, `${mark} on surface`);
  }
});

test("new categories share the current palette while existing category colors stay intact", () => {
  for (const locale of ["en", "fa"] as const) {
    const defaults = categoriesForLocale(locale);
    assert.ok(defaults.every(category => (DATA_COLORS as readonly string[]).includes(category.color)));
    const existing = defaults.map((category, index) => ({ ...category, color: index % 2 ? "#527DC5" : "#258042" }));
    const before = JSON.stringify(existing);
    assert.deepEqual(mergeCategoryTemplates(existing, locale), existing);
    assert.equal(JSON.stringify(existing), before);
  }
});

test("small money fractions retain normal-text contrast after their shared opacity", () => {
  const css = readFileSync(new URL("../packages/core/src/styles.css", import.meta.url), "utf8");
  const token = (name: string) => css.match(new RegExp(`--${name}: (#[0-9a-f]{6});`, "i"))![1];
  const opacity = Number(css.match(/--money-decimal-opacity:\s*([\d.]+);/)![1]);
  for (const foreground of ["ink", "muted", "green", "red"]) {
    for (const background of ["surface", "paper", "green-soft", "red-soft", "accent-soft"]) {
      const ink = token(foreground), surface = token(background);
      const composed = "#" + [1, 3, 5].map(i => Math.round(parseInt(ink.slice(i, i + 2), 16) * opacity + parseInt(surface.slice(i, i + 2), 16) * (1 - opacity)).toString(16).padStart(2, "0")).join("");
      assert.ok(contrastRatio(composed, surface) >= 4.5, `${foreground} decimals on ${background}`);
    }
  }
});
