import { configureRuntime } from "../packages/core/src/runtime";
configureRuntime("development");
import { liveQuery } from "dexie";
const { db, initializeLocalData, loadSnapshot, completeInitialSetup, saveActivityDraft, assertStoredActivitiesUnchanged, setSetting, awardClarityReview } = await import("../packages/core/src/lib/db");
import { defaultSetupDraft } from "../packages/core/src/lib/setup";
import { clarityReviewContext, clarityProgress, normalizeClarity } from "../packages/core/src/lib/clarity.ts";
import { localDate } from "../packages/core/src/lib/dates.ts";
import type { Transaction } from "../packages/core/src/lib/types";

// Isolated synthetic fixture only; never included in either app build.
async function run() {
  if (location.origin !== "http://127.0.0.1:4333" || db.name !== "jibjip-development-v2") throw Error("Wrong test origin/database");
  await db.delete();
  await db.open();
  const results: string[] = [];
  const assert = (condition: unknown, name: string) => { if (!condition) throw Error(name); results.push(name); };
  const first = initializeLocalData();
  assert(first === initializeLocalData(), "Concurrent initializers share one operation");
  await first;
  await completeInitialSetup(defaultSetupDraft(), "synthetic-main", "2026-01-01T12:00:00Z");
  const snapshot = await loadSnapshot();
  let setupRejected = false;
  try { await completeInitialSetup({ ...defaultSetupDraft(), mainWalletCode: "other" }, "synthetic-second", "2026-01-01T12:00:00Z"); }
  catch { setupRejected = true; }
  assert(setupRejected && (await db.wallets.count()) === 1, "A second setup cannot create another main wallet");
  const category = snapshot.categories.find(row => row.templateKey === "other-expenses")!;
  const row: Transaction = { id: "synthetic-payment", date: "2026-01-01", walletId: "synthetic-main", currency: "EUR", operation: "transaction",
    direction: "expense", amount: "12.34567890123456789", balanceAmount: "-12.34567890123456789", categoryId: category.id, category: category.name,
    note: "Synthetic draft", reportable: false, affectsBalance: true, linkId: null, createdAt: "2026-01-01T12:00:00Z", updatedAt: "2026-01-01T12:00:00Z" };
  await saveActivityDraft(() => db.transactions.add(row).then(() => {}), undefined, snapshot);
  const before = JSON.stringify(await loadSnapshot());
  await initializeLocalData();
  assert(JSON.stringify(await loadSnapshot()) === before, "Repeated initialization preserves all seven stores exactly");
  let rejected = false;
  try {
    await saveActivityDraft(async () => { await db.transactions.update(row.id, { amount: "900" }); throw Error("Synthetic failure"); }, undefined, snapshot);
  } catch { rejected = true; }
  assert(rejected && JSON.stringify(await loadSnapshot()) === before, "Failed activity save rolls back every write");
  await db.transactions.update(row.id, { note: "Newer edit in another window" });
  const newer = JSON.stringify(await loadSnapshot());
  rejected = false;
  try {
    await saveActivityDraft(async () => { await assertStoredActivitiesUnchanged([row]); await db.transactions.put(row); }, undefined, snapshot);
  } catch { rejected = true; }
  assert(rejected && JSON.stringify(await loadSnapshot()) === newer, "Stale batch edit cannot overwrite a newer record");
  await setSetting("irrDisplayUnit", "TMN");
  rejected = false;
  try { await saveActivityDraft(() => db.transactions.add({ ...row, id: "stale-context" }).then(() => {}), undefined, snapshot); } catch { rejected = true; }
  assert(rejected && !await db.transactions.get("stale-context"), "Changed units reject a stale draft without adding a record");
  const linked = [{ ...row, id: "linked-out", operation: "exchange" as const, direction: "out" as const, linkId: "synthetic-link" },
    { ...row, id: "linked-in", operation: "exchange" as const, direction: "in" as const, linkId: "synthetic-link", walletId: "synthetic-usd", currency: "USD" }];
  await db.transactions.bulkPut([...linked, { ...linked[1], id: "unexpected-part" }]);
  rejected = false;
  try { await db.transaction("rw", db.transactions, () => assertStoredActivitiesUnchanged(linked)); } catch { rejected = true; }
  assert(rejected, "Unexpected linked rows are detected before batch mutation");
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { subscription.unsubscribe(); reject(Error("Snapshot observation timed out")); }, 5000);
    let initial = true;
    const subscription = liveQuery(loadSnapshot).subscribe({
      next: value => {
        if (initial) { initial = false; void setSetting("textSize", "large").catch(reject); }
        else if (value.settings.textSize === "large") { clearTimeout(timeout); subscription.unsubscribe(); resolve(); }
      }, error: reject,
    });
  });
  assert(true, "Atomic snapshots react to committed database writes");
  // Stress only this disposable origin. Award persistence must use indexes.
  const day = localDate();
  for (const size of [10_000, 100_000]) {
    await db.transactions.clear();
    const records = Array.from({length:size}, (_, i) => ({...row, id: `stress-${String(i).padStart(6,"0")}`,
      walletId: i % 10 === 0 ? "synthetic-main" : "synthetic-other", date: i < 100 ? day : "2024-01-01", note: "Synthetic scale fixture"}));
    await db.transactions.bulkPut(records);
    await setSetting("clarity", {enabled:true,awards:[]});
    const snapshot = await loadSnapshot();
    const financialBefore = JSON.stringify(snapshot.transactions);
    const fullRead = db.transactions.toArray;
    db.transactions.toArray = (() => { throw Error("Clarity attempted a full store read"); }) as typeof fullRead;
    const started = performance.now();
    try {
      const context = clarityReviewContext(snapshot, "transactions", null, day);
      const awards = await Promise.all([awardClarityReview(context), awardClarityReview(context)]);
      assert(awards.filter(Boolean).length === 1, `${size}: concurrent completions award once without a full-store read`);
      const stale = clarityReviewContext(snapshot, "categories", null, day);
      await db.transactions.update(records[0].id, {note:"Synthetic newer edit"});
      let staleRejected = false;
      try { await awardClarityReview(stale); } catch { staleRejected = true; }
      assert(staleRejected, `${size}: indexed category review rejects newer data`);
      await db.transactions.update(records[0].id, {note:records[0].note});
      const balanceContext = clarityReviewContext(snapshot, "balance", "synthetic-main", day);
      assert(await awardClarityReview(balanceContext), `${size}: balance review checks the entire selected wallet`);
      const ledger = normalizeClarity((await db.settings.get("clarity"))?.value);
      assert(clarityProgress(ledger, day).total === 20, `${size}: ledger totals remain exact`);
    } finally { db.transactions.toArray = fullRead; }
    assert(JSON.stringify((await loadSnapshot()).transactions) === financialBefore, `${size}: awards preserve financial records`);
    results.push(`Synthetic ${size} indexed Clarity award checks: ${(performance.now()-started).toFixed(1)} ms`);
  }
  return results;
}

document.querySelector("button")!.addEventListener("click", async () => {
  const button = document.querySelector("button")!;
  button.disabled = true;
  try { document.querySelector("pre")!.textContent = (await run()).map(name => `PASS ${name}`).join("\n"); }
  catch (error) { document.querySelector("pre")!.textContent = `FAIL ${error instanceof Error ? error.message : "Unknown failure"}`; }
  finally { button.disabled = false; }
});
