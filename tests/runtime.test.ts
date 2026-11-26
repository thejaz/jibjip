import assert from "node:assert/strict";
import test from "node:test";
import { configureRuntime, runtimeProfile } from "../packages/core/src/runtime.ts";

test("a profile must be explicit and cannot switch persistence identity in one document", () => {
  assert.throws(() => runtimeProfile(), /explicit runtime profile/);
  assert.throws(() => configureRuntime("unknown" as never), /Unknown/);
  configureRuntime("development");
  configureRuntime("development");
  assert.equal(runtimeProfile(), "development");
  assert.throws(() => configureRuntime("personal"), /cannot switch/);
  assert.equal(runtimeProfile(), "development");
});
