import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("upgrade summary keeps heading and description together outside the icon column", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("../packages/core/src/components/SetupWizard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../packages/core/src/styles.css", import.meta.url), "utf8"),
  ]);

  assert.equal(component.match(/className="setup-summary-copy"/g)?.length, 2);
  assert.match(styles, /\.setup-summary-copy\s*\{[^}]*min-width:\s*0;/s);
  assert.match(styles, /\.setup-summary\s*>\s*span\s*\{[^}]*grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)/s);
});

test("Farsi brand frames reserve 25 percent more height without distorting the SVG", async () => {
  const [app, setup, styles] = await Promise.all([
    readFile(new URL("../packages/core/src/components/JibjipApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../packages/core/src/components/SetupWizard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../packages/core/src/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(app, /brand-wordmark-frame-\$\{wordmarkLocale\}/);
  assert.match(setup, /brand-wordmark-frame-\$\{locale\}/);
  assert.match(styles, /\.brand-wordmark-frame\s*\{[^}]*height:\s*40px;/s);
  assert.match(styles, /\.brand-wordmark-frame-fa\s*\{[^}]*height:\s*50px;/s);
  assert.match(styles, /\.setup-brand\s+\.brand-wordmark-frame\s*\{[^}]*height:\s*30px;/s);
  assert.match(styles, /\.setup-brand\s+\.brand-wordmark-frame-fa\s*\{\s*height:\s*37\.5px;/s);
  assert.match(styles, /\.brand-wordmark-frame\s*\{[^}]*position:\s*relative;[^}]*height:\s*40px;/s);
  assert.match(styles, /\.brand-wordmark\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*contain;/s);
  assert.doesNotMatch(styles, /\.brand-wordmark-fa\s*\{[^}]*aspect-ratio:/s);
});
