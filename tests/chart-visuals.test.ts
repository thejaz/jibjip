import assert from "node:assert/strict";
import test from "node:test";
import Decimal from "decimal.js";
import { donutArcs } from "../packages/core/src/lib/chart-visuals.ts";

test("donut geometry retains exact proportions, ordered offsets, and bounded visual gaps", () => {
  const values = [new Decimal("0.1"), new Decimal("0.3")];
  const arcs = donutArcs(values, new Decimal("0.4"));
  const circumference = 2 * Math.PI * 44;
  assert.ok(Math.abs(arcs.reduce((sum, arc) => sum + arc.length, 0) - circumference) < 1e-10);
  assert.ok(Math.abs(arcs[0].length / arcs[1].length - 1 / 3) < 1e-12);
  for (const arc of arcs) {
    assert.ok(arc.visible <= arc.length && arc.visible >= arc.length * .88);
    assert.ok(arc.offset <= 0);
  }
  assert.ok(Math.abs(-arcs[1].offset - arcs[0].length - .9) < 1e-10);
  assert.deepEqual(values.map(value => value.toString()), ["0.1", "0.3"]);
});

test("single, empty, and tiny slices never invent a minimum share or leave a one-slice seam", () => {
  assert.deepEqual(donutArcs([], new Decimal(0)), []);
  assert.deepEqual(donutArcs([new Decimal(0)], new Decimal(0)), []);
  const [single] = donutArcs([new Decimal(7)], new Decimal(7));
  assert.equal(single.visible, single.circumference);
  assert.equal(Math.abs(single.offset), 0);
  const values = [new Decimal("1e-30"), new Decimal("1e30"), new Decimal(0)];
  const before = values.map(value => value.toString());
  const arcs = donutArcs(values, values[0].plus(values[1]));
  assert.ok(arcs[0].visible > 0 && arcs[0].visible < 1e-50);
  assert.equal(arcs[2].visible, 0);
  assert.deepEqual(values.map(value => value.toString()), before);
});
