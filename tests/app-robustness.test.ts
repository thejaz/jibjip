import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { localDate } from "../packages/core/src/lib/dates.ts";
import { assertTransactionsUnchanged, editedReportability, fallbackCategoryName } from "../packages/core/src/lib/transaction-edit.ts";
import { categoriesForLocale } from "../packages/core/src/lib/catalogs.ts";
import type { Category, Transaction } from "../packages/core/src/lib/types.ts";
import { nextOptionIndex, shortcutIntent } from "../packages/core/src/lib/keyboard.ts";

test("keyboard shortcuts use explicit modifiers, tolerate Persian layouts, and preserve native editing", () => {
  const key = (changes: Partial<Parameters<typeof shortcutIntent>[0]> = {}) => ({
    key: "k", code: "KeyK", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, isComposing: false, repeat: false, ...changes,
  });
  assert.equal(shortcutIntent(key()), "commands");
  assert.equal(shortcutIntent(key({ ctrlKey: false, metaKey: true })), "commands");
  assert.equal(shortcutIntent(key({ key: "ن" })), "commands");
  assert.equal(shortcutIntent(key({ key: "/", code: "Slash" })), "help");
  assert.equal(shortcutIntent(key({ key: "Enter", code: "NumpadEnter" })), "submit");
  for (const changes of [{ ctrlKey: false }, { altKey: true }, { shiftKey: true }, { isComposing: true }, { repeat: true }, { metaKey: true }]) {
    assert.equal(shortcutIntent(key(changes)), null);
  }
  for (const letter of ["f", "n", "r", "s", "w", "p", "a", "c", "v", "z"]) {
    assert.equal(shortcutIntent(key({ key: letter, code: `Key${letter.toUpperCase()}` })), null);
  }
});

test("choice navigation wraps, handles empty results, and supports first/last boundaries", () => {
  assert.equal(nextOptionIndex(-1, 0, "ArrowDown"), -1);
  assert.equal(nextOptionIndex(-1, 4, "ArrowDown"), 0);
  assert.equal(nextOptionIndex(3, 4, "ArrowDown"), 0);
  assert.equal(nextOptionIndex(0, 4, "ArrowUp"), 3);
  assert.equal(nextOptionIndex(2, 4, "Home"), 0);
  assert.equal(nextOptionIndex(1, 4, "End"), 3);
});

test("app confirmations stay internal while installation uses the standard browser prompt", () => {
  for (const directory of ["packages/core/src", "apps/web"]) {
    const root = new URL(`../${directory}/`, import.meta.url);
    for (const path of readdirSync(root, { recursive: true, encoding: "utf8" })) {
      if (!/\.[cm]?[jt]sx?$/.test(path)) continue;
      const source = readFileSync(new URL(path.replaceAll("\\", "/"), root), "utf8");
      assert.doesNotMatch(source, /\b(?:window|globalThis)\.(?:confirm|alert|prompt)\s*\(|(?<![\w.])(?:confirm|alert|prompt)\s*\(/, `${directory}/${path}`);
    }
  }
  assert.match(readFileSync(new URL("../packages/core/src/lib/offline.ts", import.meta.url), "utf8"), /await event\.prompt\(\)/);
});

test("calendar dates follow the local day on either side of UTC midnight", () => {
  const oldZone = process.env.TZ;
  try {
    process.env.TZ = "Asia/Tehran";
    assert.equal(localDate(new Date("2026-01-01T21:00:00Z")), "2026-01-02");
    process.env.TZ = "America/Los_Angeles";
    assert.equal(localDate(new Date("2026-01-01T01:00:00Z")), "2025-12-31");
  } finally { if (oldZone === undefined) delete process.env.TZ; else process.env.TZ = oldZone; }
});

test("ordinary edits and duplicates preserve reporting exceptions until the category changes", () => {
  const category = { id: "groceries", name: "Groceries", defaultReportable: true } as Category;
  const original = { id: "payment", categoryId: category.id, category: category.name, reportable: false } as Transaction;
  assert.equal(editedReportability(original, category), false);
  assert.equal(editedReportability(original, { ...category, name: "Food" }), false);
  assert.equal(editedReportability({ ...original, categoryId: null }, category), false);
  assert.equal(editedReportability(original, { ...category, id: "other" }), true);
});

test("blank categories use the proper stored system fallback in both languages", () => {
  for (const locale of ["en", "fa"] as const) {
    const categories = categoriesForLocale(locale);
    assert.equal(fallbackCategoryName(categories, "income"), categories.find(row => row.templateKey === "other-income")?.name);
    assert.equal(fallbackCategoryName(categories, "expense"), categories.find(row => row.templateKey === "other-expenses")?.name);
  }
  assert.equal(fallbackCategoryName([], "expense"), "Other Expenses");
});

test("stale activity edits cannot overwrite changes, restore deletions, or ignore new linked rows", () => {
  const rows = [{ id: "out", amount: "1.234567890123456789", balanceAmount: "-1.234567890123456789", note: "Original" }, { id: "in", amount: "2", balanceAmount: "2" }] as Transaction[];
  assert.doesNotThrow(() => assertTransactionsUnchanged(rows, structuredClone(rows).reverse()));
  assert.throws(() => assertTransactionsUnchanged(rows, [rows[0]]));
  assert.throws(() => assertTransactionsUnchanged(rows, [...rows, { ...rows[0], id: "extra" }]));
  assert.throws(() => assertTransactionsUnchanged(rows, [{ ...rows[0], note: "Changed in another tab" }, rows[1]]));
  assert.throws(() => assertTransactionsUnchanged(rows, [{ ...rows[0], amount: "1.234567890123456788" }, rows[1]]));
});
